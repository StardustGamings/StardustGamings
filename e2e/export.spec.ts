import { readFile } from 'node:fs/promises';
import type { Download, Locator, Page } from '@playwright/test';
import { createCarousel, expect, open, test } from './fixtures';

/**
 * Export: PNG / JPG / WebP / PDF, one slide, all slides as a ZIP or separate
 * files, the whole carousel as one wide image, transparency, quality, photos
 * with looks (GPU and, in the no-webgl project, CPU), the project card entry
 * point and the phone share sheet. Every file is checked byte for byte.
 */

const exportDialog = (page: Page) => page.getByRole('dialog', { name: 'Export' });

async function openExport(page: Page): Promise<Locator> {
  await page.getByTestId('open-export').click();
  const dialog = exportDialog(page);
  await expect(dialog.getByTestId('export-options')).toBeVisible();
  return dialog;
}

async function pick(dialog: Locator, ...names: string[]) {
  for (const name of names) {
    const radio = dialog.getByRole('radio', { name, exact: true });
    await radio.click();
    await expect(radio).toHaveAttribute('aria-checked', 'true');
  }
}

/** Starts the export and returns the one file it saves. */
async function exportOne(page: Page, dialog: Locator): Promise<{ name: string; bytes: Buffer }> {
  const [download] = await Promise.all([page.waitForEvent('download'), dialog.getByTestId('export-start').click()]);
  await expect(page.getByTestId('export-done')).toBeVisible();
  return read(download);
}

async function read(download: Download) {
  return { name: download.suggestedFilename(), bytes: await readFile((await download.path())!) };
}

async function finish(page: Page) {
  await page.getByRole('button', { name: 'Done', exact: true }).click();
  await expect(page.getByTestId('export-done')).toBeHidden();
}

const isPng = (b: Buffer) => b.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
const pngSize = (b: Buffer) => ({ width: b.readUInt32BE(16), height: b.readUInt32BE(20) });

/** Reads the entries of a stored ZIP (what the app writes). */
function unzip(b: Buffer): { name: string; data: Buffer }[] {
  const end = b.length - 22;
  expect(b.readUInt32LE(end)).toBe(0x06054b50);
  const count = b.readUInt16LE(end + 10);
  let p = b.readUInt32LE(end + 16);
  const out: { name: string; data: Buffer }[] = [];
  for (let i = 0; i < count; i++) {
    expect(b.readUInt32LE(p)).toBe(0x02014b50);
    const size = b.readUInt32LE(p + 20);
    const nameLength = b.readUInt16LE(p + 28);
    const offset = b.readUInt32LE(p + 42);
    const name = b.subarray(p + 46, p + 46 + nameLength).toString('utf8');
    const local = offset + 30 + b.readUInt16LE(offset + 26);
    out.push({ name, data: b.subarray(local, local + size) });
    p += 46 + nameLength;
  }
  return out;
}

/** Decodes an exported image in the page and samples pixels at fractional positions (RGBA). */
async function sample(page: Page, bytes: Buffer, mime: string, points: [number, number][]): Promise<number[][]> {
  return page.evaluate(
    async ({ base64, mime, points }) => {
      const data = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
      const bitmap = await createImageBitmap(new Blob([data], { type: mime }));
      const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(bitmap, 0, 0);
      return points.map(([fx, fy]) => [
        ...ctx.getImageData(Math.floor(fx * (bitmap.width - 1)), Math.floor(fy * (bitmap.height - 1)), 1, 1).data,
      ]);
    },
    { base64: bytes.toString('base64'), mime, points },
  );
}

const grid: [number, number][] = [0.2, 0.35, 0.5, 0.65, 0.8].flatMap((y) =>
  [0.2, 0.5, 0.8].map((x) => [x, y] as [number, number]),
);
const grey = (p: number[]) => Math.max(p[0]!, p[1]!, p[2]!) - Math.min(p[0]!, p[1]!, p[2]!) < 14;
const blue = (p: number[]) => p[2]! > p[0]! + 60;

test.describe('export (desktop)', () => {
  test.skip(({ isMobile }) => isMobile, 'Phones are covered below');

  test('one slide as PNG, JPG and WebP — right size, remembered, MP4 honestly marked “Soon”', async ({ app: page }) => {
    await createCarousel(page, 3);
    let dialog = await openExport(page);
    await expect(dialog.getByText('Soon')).toBeVisible();
    await expect(dialog.getByRole('radio', { name: /MP4/ })).toHaveCount(0);

    await pick(dialog, 'PNG', 'Standard', 'One slide', 'Slide 2');
    await expect(dialog.getByTestId('export-start')).toHaveText(/Export 1 image/);
    const png = await exportOne(page, dialog);
    expect(png.name).toMatch(/^carousel-.+-02\.png$/);
    expect(isPng(png.bytes)).toBe(true);
    expect(pngSize(png.bytes)).toEqual({ width: 1080, height: 1350 });
    await expect(page.getByTestId('export-done')).toContainText('1080 × 1350 px');
    await expect(page.getByTestId('export-done')).toContainText('No watermark, ever.');
    // Saving again works from the done screen.
    const [again] = await Promise.all([
      page.waitForEvent('download'),
      page.getByRole('button', { name: 'Download again' }).click(),
    ]);
    expect(again.suggestedFilename()).toBe(png.name);
    await finish(page);

    dialog = await openExport(page);
    await pick(dialog, 'JPG', 'High', 'One slide');
    await expect(dialog.getByRole('switch', { name: 'Transparent background' })).toHaveCount(0);
    const jpg = await exportOne(page, dialog);
    expect(jpg.name).toMatch(/\.jpg$/);
    expect([...jpg.bytes.subarray(0, 3)]).toEqual([0xff, 0xd8, 0xff]);
    await expect(page.getByTestId('export-done')).toContainText('2160 × 2700 px');
    await finish(page);

    // The last format and quality are remembered.
    dialog = await openExport(page);
    await expect(dialog.getByRole('radio', { name: 'JPG', exact: true })).toHaveAttribute('aria-checked', 'true');
    await expect(dialog.getByRole('radio', { name: 'High', exact: true })).toHaveAttribute('aria-checked', 'true');
    await pick(dialog, 'WebP', 'Standard', 'One slide');
    const webp = await exportOne(page, dialog);
    expect(webp.name).toMatch(/\.webp$/);
    expect(webp.bytes.subarray(0, 4).toString('latin1')).toBe('RIFF');
    expect(webp.bytes.subarray(8, 12).toString('latin1')).toBe('WEBP');
  });

  test('all slides as a ZIP or separate files, and the full carousel as one wide image', async ({ app: page }) => {
    await createCarousel(page, 3);
    let dialog = await openExport(page);
    await pick(dialog, 'PNG', 'Standard', 'All 3 slides');
    await expect(dialog.getByText('3 images · PNG · ZIP')).toBeVisible();
    const zip = await exportOne(page, dialog);
    expect(zip.name).toMatch(/^carousel-.+\.zip$/);
    const entries = unzip(zip.bytes);
    expect(entries.map((e) => e.name.replace(/^carousel-.+?-(\d+\.png)$/, '$1'))).toEqual(['01.png', '02.png', '03.png']);
    for (const e of entries) {
      expect(isPng(e.data)).toBe(true);
      expect(pngSize(e.data)).toEqual({ width: 1080, height: 1350 });
    }
    await finish(page);

    dialog = await openExport(page);
    await dialog.getByRole('switch', { name: 'Separate files' }).click();
    const downloads: Download[] = [];
    page.on('download', (d) => downloads.push(d));
    await dialog.getByTestId('export-start').click();
    await expect.poll(() => downloads.length).toBe(3);
    expect(downloads.map((d) => d.suggestedFilename().slice(-6))).toEqual(['01.png', '02.png', '03.png']);
    await finish(page);
    page.removeAllListeners('download');

    dialog = await openExport(page);
    await pick(dialog, 'Full carousel');
    const strip = await exportOne(page, dialog);
    expect(strip.name).toMatch(/-carousel\.png$/);
    expect(pngSize(strip.bytes)).toEqual({ width: 3240, height: 1350 });
    await expect(page.getByTestId('export-done')).toContainText('Your carousel is ready');
  });

  test('PDF: one page per slide', async ({ app: page }) => {
    await createCarousel(page, 3);
    const dialog = await openExport(page);
    await pick(dialog, 'PDF', 'Standard');
    // A PDF is always pages, so there’s no single wide image.
    await expect(dialog.getByRole('radio', { name: 'Full carousel' })).toHaveCount(0);
    await expect(dialog.getByTestId('export-start')).toHaveText(/Export 3 pages/);
    const pdf = await exportOne(page, dialog);
    expect(pdf.name).toMatch(/\.pdf$/);
    const text = pdf.bytes.toString('latin1');
    expect(text.startsWith('%PDF-1.4')).toBe(true);
    expect(text.trimEnd().endsWith('%%EOF')).toBe(true);
    expect(text).toMatch(/\/Type \/Pages \/Kids \[[^\]]+\] \/Count 3/);
    expect(text.match(/\/MediaBox \[0 0 810 1012\.5\]/g)).toHaveLength(3);
    expect(text.match(/\/Width 1080 \/Height 1350/g)).toHaveLength(3);
  });

  test('transparent PNGs leave the background out', async ({ app: page }) => {
    await createCarousel(page, 2);
    let dialog = await openExport(page);
    await pick(dialog, 'PNG', 'Standard', 'One slide');
    const solid = await exportOne(page, dialog);
    expect((await sample(page, solid.bytes, 'image/png', [[0.02, 0.02]]))[0]![3]).toBe(255);
    await finish(page);

    dialog = await openExport(page);
    await pick(dialog, 'One slide');
    await dialog.getByRole('switch', { name: 'Transparent background' }).click();
    const clear = await exportOne(page, dialog);
    const [corner, middle] = await sample(page, clear.bytes, 'image/png', [
      [0.02, 0.02],
      [0.5, 0.5],
    ]);
    expect(corner![3]).toBe(0);
    expect(middle![3]).toBe(0);
  });

  test('photos export at full quality with their look', async ({ app: page }) => {
    await open(page, '/');
    await page.getByRole('button', { name: /^New Post:/ }).click();
    await page.getByTestId('create-project').click();
    await expect(page.getByTestId('canvas-viewport')).toBeVisible();
    const photo = await page.evaluate(() => {
      const c = document.createElement('canvas');
      c.width = 1600;
      c.height = 2000;
      const x = c.getContext('2d')!;
      x.fillStyle = '#2F6BD8';
      x.fillRect(0, 0, 1600, 2000);
      return c.toDataURL('image/png').split(',')[1]!;
    });
    await page
      .getByTestId('photo-input')
      .setInputFiles({ name: 'sky.png', mimeType: 'image/png', buffer: Buffer.from(photo, 'base64') });
    await expect(page.getByTestId('selection-frame')).toBeVisible();

    let dialog = await openExport(page);
    await pick(dialog, 'PNG', 'High');
    const plain = await exportOne(page, dialog);
    expect(pngSize(plain.bytes)).toEqual({ width: 2160, height: 2700 });
    expect((await sample(page, plain.bytes, 'image/png', grid)).some(blue)).toBe(true);
    await finish(page);

    const picker = page.getByTestId('look-picker');
    await picker.getByRole('radio', { name: 'Monochrome' }).click();
    await expect(picker.getByRole('radio', { name: 'Monochrome' })).toHaveAttribute('aria-checked', 'true');
    dialog = await openExport(page);
    const mono = await exportOne(page, dialog);
    const pixels = await sample(page, mono.bytes, 'image/png', grid);
    expect(pixels.every(grey), JSON.stringify(pixels)).toBe(true);
  });

  test('export straight from a project card on the home screen', async ({ app: page }) => {
    await createCarousel(page, 2);
    await page.getByRole('link', { name: 'Back to home' }).click();
    const card = page.getByTestId('project-card').first();
    await card.getByRole('button', { name: /^Actions for/ }).click();
    await page.getByRole('menuitem', { name: /^Export/ }).click();
    const dialog = exportDialog(page);
    await expect(dialog.getByTestId('export-options')).toBeVisible();
    await pick(dialog, 'JPG', 'Standard');
    const zip = await exportOne(page, dialog);
    expect(zip.name).toMatch(/\.zip$/);
    expect(unzip(zip.bytes).map((e) => e.name.slice(-6))).toEqual(['01.jpg', '02.jpg']);
  });
});

test.describe('export (phone)', () => {
  test.skip(({ isMobile }) => !isMobile, 'Phone flow');

  test('offers the share sheet, with Save as the alternative', async ({ app: page }) => {
    // Stand in for the system share sheet (headless browsers have none).
    await page.addInitScript(() => {
      const shared: string[][] = [];
      Object.assign(window, { __shared: shared });
      Object.defineProperty(navigator, 'canShare', { configurable: true, value: (d?: ShareData) => !!d?.files?.length });
      Object.defineProperty(navigator, 'share', {
        configurable: true,
        value: async (d: ShareData) => void shared.push((d.files ?? []).map((f) => f.name)),
      });
    });
    await createCarousel(page, 3);
    const downloads: Download[] = [];
    page.on('download', (d) => downloads.push(d));

    const dialog = await openExport(page);
    await pick(dialog, 'JPG', 'Standard');
    await dialog.getByTestId('export-start').click();
    const done = page.getByRole('dialog').filter({ has: page.getByTestId('export-done') });
    await expect(done).toBeVisible();
    // Nothing is saved until the person chooses.
    expect(downloads).toHaveLength(0);

    await done.getByRole('button', { name: 'Share', exact: true }).click();
    await expect
      .poll(() => page.evaluate(() => (window as unknown as { __shared: string[][] }).__shared))
      .toEqual([[expect.stringMatching(/-01\.jpg$/), expect.stringMatching(/-02\.jpg$/), expect.stringMatching(/-03\.jpg$/)]]);

    const [download] = await Promise.all([
      page.waitForEvent('download'),
      done.getByRole('button', { name: 'Save', exact: true }).click(),
    ]);
    const zip = await read(download);
    expect(unzip(zip.bytes)).toHaveLength(3);
  });
});
