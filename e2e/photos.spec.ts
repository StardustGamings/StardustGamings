import type { Page } from '@playwright/test';
import { expect, frameBox, makePng, open, scenePixel, test, type Paint } from './fixtures';

/**
 * Photo tools: import, crop, adjustments, frames, cut-outs, paste and stickers.
 * Test photos are painted in the browser, so no binary fixtures are needed.
 */

async function newPost(page: Page) {
  await open(page, '/');
  await page.getByRole('button', { name: /^New Post:/ }).click();
  await page.getByTestId('create-project').click();
  await expect(page.getByTestId('canvas-viewport')).toBeVisible();
}

async function addPhoto(page: Page, paint: Paint = 'subject', name = 'studio.png') {
  const buffer = await makePng(page, paint);
  await page.getByTestId('photo-input').setInputFiles({ name, mimeType: 'image/png', buffer });
  await expect(page.getByTestId('selection-frame')).toBeVisible();
  // Let side panels finish animating (they shift the canvas) before measuring positions.
  let prev: { x: number; y: number } | null = null;
  for (let i = 0; i < 40; i++) {
    const box = await page.getByTestId('selection-frame').boundingBox();
    if (box && prev && Math.abs(box.x - prev.x) < 0.5 && Math.abs(box.y - prev.y) < 0.5) break;
    prev = box;
    await page.waitForTimeout(50);
  }
}

/** RGBA of the rendered scene (not the overlay) at a page coordinate. */
const isRed = (p: number[]) => p[0]! > 170 && p[1]! < 90 && p[2]! < 90;

test.describe('photos (desktop)', () => {
  test.skip(({ isMobile }) => isMobile, 'Mouse-driven; phones are covered below');

  test('adds a photo from the device and keeps it in the local library', async ({ app: page }) => {
    await newPost(page);
    await page.getByRole('button', { name: 'Photos', exact: true }).first().click();
    await expect(page.getByText('Photos stay on this device.')).toBeVisible();
    await addPhoto(page);
    const f = await frameBox(page);
    await expect.poll(async () => isRed(await scenePixel(page, { x: f.cx, y: f.cy }))).toBe(true);
    await expect(page.getByTestId('photo-library').getByRole('button', { name: 'Add studio.png' })).toBeVisible();
    await page.getByRole('tab', { name: 'Layers' }).click();
    await expect(page.getByTestId('layers-panel').getByText('studio')).toBeVisible();

    // The same file again reuses the stored copy (no duplicate in the library).
    await addPhoto(page);
    await expect(page.getByTestId('photo-library').getByRole('button', { name: /^Add / })).toHaveCount(1);
  });

  test('crop mode: aspect presets, zoom, pan; Esc cancels and Done commits', async ({ app: page }) => {
    await newPost(page);
    await addPhoto(page, 'gradient');
    const f = await frameBox(page);
    const width = page.getByRole('textbox', { name: 'Width', exact: true });
    const height = page.getByRole('textbox', { name: 'Height', exact: true });
    const w0 = await width.inputValue();

    await page.mouse.dblclick(f.cx, f.cy);
    const bar = page.getByTestId('crop-bar').first();
    await expect(bar).toBeVisible();
    await expect(page.getByTestId('crop-chrome')).toBeVisible();
    await bar.getByRole('radio', { name: '1:1' }).click();
    await expect.poll(async () => (await width.inputValue()) === (await height.inputValue())).toBe(true);
    await page.keyboard.press('Escape');
    await expect(bar).toBeHidden();
    await expect(width).toHaveValue(w0);

    // Pan the zoomed photo: the pixel under the centre changes colour.
    await page.keyboard.press('Enter');
    await expect(bar).toBeVisible();
    const zoom = bar.getByRole('slider', { name: 'Photo zoom' });
    await zoom.focus();
    for (let i = 0; i < 40; i++) await page.keyboard.press('ArrowRight');
    const before = await scenePixel(page, { x: f.cx, y: f.cy });
    await page.mouse.move(f.cx, f.cy);
    await page.mouse.down();
    await page.mouse.move(f.cx + 160, f.cy, { steps: 6 });
    await page.mouse.up();
    await expect.poll(async () => (await scenePixel(page, { x: f.cx, y: f.cy }))[0]).not.toBe(before[0]);
    await bar.getByRole('button', { name: 'Done' }).click();
    await expect(bar).toBeHidden();
    await expect(page.getByTestId('selection-frame')).toBeVisible();
  });

  test('adjustments re-develop the photo; hold to compare shows the original', async ({ app: page }) => {
    await newPost(page);
    await addPhoto(page);
    const f = await frameBox(page);
    await expect.poll(async () => isRed(await scenePixel(page, { x: f.cx, y: f.cy }))).toBe(true);

    const saturation = page.getByRole('slider', { name: 'Saturation', exact: true });
    await saturation.focus();
    await page.keyboard.press('Home'); // -100: black & white
    await expect
      .poll(async () => {
        const [r, g, b] = await scenePixel(page, { x: f.cx, y: f.cy });
        return Math.max(r!, g!, b!) - Math.min(r!, g!, b!);
      })
      .toBeLessThan(12);

    const compare = page.getByRole('button', { name: 'Hold to compare' });
    await compare.hover();
    await page.mouse.down();
    await expect.poll(async () => isRed(await scenePixel(page, { x: f.cx, y: f.cy }))).toBe(true);
    await page.mouse.up();

    // One undo step brings the colour back.
    await page.keyboard.press('ControlOrMeta+z');
    await expect.poll(async () => isRed(await scenePixel(page, { x: f.cx, y: f.cy }))).toBe(true);
  });

  test('drag a library photo into an empty frame', async ({ app: page }) => {
    await newPost(page);
    await page.getByRole('button', { name: 'Photos', exact: true }).first().click();
    await addPhoto(page);
    await page.keyboard.press('Delete');
    await page.getByRole('button', { name: 'Add circle frame' }).click();
    await expect(page.getByRole('button', { name: 'Add a photo to this frame' })).toBeVisible();
    const target = await frameBox(page);
    await page
      .getByTestId('photo-library')
      .getByRole('button', { name: 'Add studio.png' })
      .dragTo(page.getByTestId('canvas-viewport'), {
        targetPosition: await page.getByTestId('canvas-viewport').evaluate((el, t) => {
          const r = el.getBoundingClientRect();
          return { x: t.cx - r.left, y: t.cy - r.top };
        }, target),
      });
    await expect(page.getByRole('button', { name: 'Crop & position' })).toBeVisible();
    await page.getByRole('tab', { name: 'Layers' }).click();
    // Filled the frame rather than adding another element.
    await expect(page.getByTestId('layers-panel').getByRole('button', { name: 'studio', exact: true })).toHaveCount(1);
  });

  test('colour-key background removal, backdrops and restore', async ({ app: page }) => {
    await newPost(page);
    await addPhoto(page);
    const f = await frameBox(page);
    const corner = { x: f.x + 6, y: f.y + 6 };
    const studio = await scenePixel(page, corner);

    await page.getByRole('radio', { name: /Colour key/ }).click();
    await page.getByRole('button', { name: 'Remove background' }).click();
    await expect(page.getByRole('button', { name: 'Restore original' })).toBeVisible({ timeout: 20_000 });
    // The studio background is gone: the slide colour shows through, the subject stays.
    await expect.poll(async () => (await scenePixel(page, corner)).join()).not.toBe(studio.join());
    await expect.poll(async () => isRed(await scenePixel(page, { x: f.cx, y: f.cy }))).toBe(true);

    await page.getByRole('radio', { name: 'Colour', exact: true }).click();
    await page.getByRole('button', { name: 'Background colour: change colour' }).click();
    await page.getByRole('textbox', { name: /hex/i }).first().fill('#00FF00');
    await page.keyboard.press('Enter');
    await page.keyboard.press('Escape');
    await expect.poll(async () => (await scenePixel(page, corner)).slice(0, 3).join()).toBe('0,255,0');

    await page.getByRole('button', { name: 'Restore original' }).click();
    await expect.poll(async () => (await scenePixel(page, corner)).join()).toBe(studio.join());
  });

  test('on-device AI cut-out runs locally without contacting other servers', async ({ app: page }) => {
    test.setTimeout(90_000);
    const foreign: string[] = [];
    page.on('request', (r) => {
      if (!r.url().startsWith('http://127.0.0.1') && !r.url().startsWith('data:') && !r.url().startsWith('blob:'))
        foreign.push(r.url());
    });
    await newPost(page);
    await addPhoto(page);
    await expect(page.getByText(/never leaves this device/)).toBeVisible();
    const model = page.waitForResponse((r) => r.url().endsWith('/ml/u2netp.onnx'));
    await page.getByRole('button', { name: 'Remove background' }).click();
    expect((await model).status()).toBe(200);
    await expect(page.getByRole('button', { name: 'Restore original' })).toBeVisible({ timeout: 60_000 });
    await expect(page.getByText('On-device AI', { exact: false }).first()).toBeVisible();
    expect(foreign).toEqual([]);
  });

  test('pastes screenshots and rejects files that aren’t photos', async ({ app: page }) => {
    await newPost(page);
    const png = (await makePng(page, 'gradient', 300, 200)).toString('base64');
    await page.evaluate(async (b64) => {
      const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
      const data = new DataTransfer();
      data.items.add(new File([bytes], 'Screenshot.png', { type: 'image/png' }));
      window.dispatchEvent(new ClipboardEvent('paste', { clipboardData: data }));
    }, png);
    await expect(page.getByTestId('selection-frame')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Crop & position' })).toBeVisible();

    await page.getByTestId('photo-input').setInputFiles({
      name: 'holiday.png',
      mimeType: 'image/png',
      buffer: Buffer.from('<html><script>alert(1)</script></html>'),
    });
    await expect(page.getByText('That file isn’t a photo we can open')).toBeVisible();
  });

  test('uploads a transparent sticker and adds it', async ({ app: page }) => {
    await newPost(page);
    await page.getByRole('button', { name: 'Stickers', exact: true }).first().click();
    const svg = Buffer.from(
      '<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64"><circle cx="32" cy="32" r="28" fill="#A06BFF"/></svg>',
    );
    const chooser = page.waitForEvent('filechooser');
    await page.getByRole('button', { name: 'Upload PNG / SVG' }).click();
    await (await chooser).setFiles({ name: 'blob.svg', mimeType: 'image/svg+xml', buffer: svg });
    await expect(page.getByTestId('sticker-library').getByRole('button', { name: 'Add blob.svg' })).toBeVisible();
    await page.getByRole('tab', { name: 'Layers' }).click();
    await expect(page.getByTestId('layers-panel').getByText('Sticker')).toBeVisible();
  });

  test('settings show photo storage and clean up unused photos', async ({ app: page }) => {
    await newPost(page);
    await addPhoto(page);
    await page.keyboard.press('Delete');
    // Let autosave store the deletion before leaving.
    await expect(page.getByTestId('save-indicator')).toHaveAttribute('data-state', 'saved');
    await open(page, '/settings/');
    const row = page.getByText(/1 photo · 0 stickers/);
    await expect(row).toBeVisible();
    await expect(page.getByText(/1 not used anywhere/)).toBeVisible();
    await page.getByRole('button', { name: 'Clean up', exact: true }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Clean up' }).click();
    await expect(page.getByText(/0 photos · 0 stickers/)).toBeVisible();
  });
});

test.describe('photos (phone)', () => {
  test.skip(({ isMobile }) => !isMobile, 'Touch layout only');

  test('adds a photo from the toolbar and crops it', async ({ app: page }) => {
    await newPost(page);
    await page.getByRole('button', { name: 'Photos', exact: true }).tap();
    await expect(page.getByTestId('mobile-sheet')).toBeVisible();
    const buffer = await makePng(page, 'gradient');
    const chooser = page.waitForEvent('filechooser');
    await page.getByRole('button', { name: 'Add photos' }).tap();
    await (await chooser).setFiles({ name: 'beach.png', mimeType: 'image/png', buffer });
    const actions = page.getByRole('navigation', { name: 'Selection actions' });
    await expect(actions).toBeVisible();
    await actions.getByRole('button', { name: 'Crop' }).tap();
    const bar = page.getByTestId('crop-bar').last();
    await expect(bar).toBeVisible();
    await bar.getByRole('radio', { name: '4:5' }).tap();
    await bar.getByRole('button', { name: 'Done' }).tap();
    await expect(bar).toBeHidden();
    await expect(actions.getByRole('button', { name: 'Replace' })).toBeVisible();
  });
});
