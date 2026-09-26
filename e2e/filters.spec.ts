import type { Page } from '@playwright/test';
import { expect, frameBox, open, scenePixel, test } from './fixtures';

/**
 * Filters & effects: one-tap looks with intensity, effects, the Filters panel
 * (selected photos or every photo), undo, templates that carry looks and the
 * trend cards. Runs with WebGL and (in the no-webgl project) on the CPU path.
 */

/** A photo painted in the page: blue top half, green bottom half. */
async function twoTone(page: Page, name = 'two-tone.png'): Promise<{ name: string; mimeType: string; buffer: Buffer }> {
  const data = await page.evaluate(() => {
    const c = document.createElement('canvas');
    c.width = 900;
    c.height = 1100;
    const x = c.getContext('2d')!;
    x.fillStyle = '#2F6BD8';
    x.fillRect(0, 0, 900, 550);
    x.fillStyle = '#2FA84F';
    x.fillRect(0, 550, 900, 550);
    return c.toDataURL('image/png').split(',')[1]!;
  });
  return { name, mimeType: 'image/png', buffer: Buffer.from(data, 'base64') };
}

async function newPostWithPhoto(page: Page) {
  await open(page, '/');
  await page.getByRole('button', { name: /^New Post:/ }).click();
  await page.getByTestId('create-project').click();
  await expect(page.getByTestId('canvas-viewport')).toBeVisible();
  await page.getByTestId('photo-input').setInputFiles(await twoTone(page));
  await expect(page.getByTestId('selection-frame')).toBeVisible();
  const f = await frameBox(page);
  const top = { x: f.cx, y: f.y + f.height * 0.25 };
  const bottom = { x: f.cx, y: f.y + f.height * 0.75 };
  // Wait for the photo itself to be drawn.
  await expect.poll(async () => (await scenePixel(page, top))[2]!, { timeout: 15_000 }).toBeGreaterThan(150);
  return { f, top, bottom };
}

const grey = (p: number[]) => Math.max(p[0]!, p[1]!, p[2]!) - Math.min(p[0]!, p[1]!, p[2]!) < 12;

test.describe('filters (desktop)', () => {
  test.skip(({ isMobile }) => isMobile, 'Mouse-driven; phones are covered below');

  test('one-tap looks with intensity, from the photo’s Design tab — undoable', async ({ app: page }) => {
    const { top, bottom } = await newPostWithPhoto(page);
    const original = await scenePixel(page, top);
    const picker = page.getByTestId('look-picker');
    await expect(picker.getByRole('radio', { name: 'None' })).toHaveAttribute('aria-checked', 'true');

    await picker.getByRole('radio', { name: 'Monochrome' }).click();
    await expect(picker.getByRole('radio', { name: 'Monochrome' })).toHaveAttribute('aria-checked', 'true');
    await expect.poll(async () => grey(await scenePixel(page, top)), { timeout: 15_000 }).toBe(true);

    // Intensity 0 brings the original back; the look stays selected.
    const intensity = page.getByRole('slider', { name: 'Intensity' });
    await intensity.focus();
    await page.keyboard.press('Home');
    await expect.poll(async () => (await scenePixel(page, top))[2]!, { timeout: 15_000 }).toBeGreaterThan(original[2]! - 6);
    await page.keyboard.press('End');
    await expect.poll(async () => grey(await scenePixel(page, top)), { timeout: 15_000 }).toBe(true);

    // A look with tone curves keeps the photo's content (regression: curves once replaced it on the GPU).
    await picker.getByRole('radio', { name: 'Cinematic' }).click();
    await expect
      .poll(
        async () => {
          const [t, b] = [await scenePixel(page, top), await scenePixel(page, bottom)];
          return t[2]! > t[1]! && b[1]! > b[2]! && !grey(t);
        },
        { timeout: 15_000 },
      )
      .toBe(true);

    await page.keyboard.press('ControlOrMeta+z');
    await expect(picker.getByRole('radio', { name: 'Monochrome' })).toHaveAttribute('aria-checked', 'true');
    await picker.getByRole('radio', { name: 'None' }).click();
    await expect.poll(async () => grey(await scenePixel(page, top)), { timeout: 15_000 }).toBe(false);
  });

  test('effects: a light leak warms the edge it comes from', async ({ app: page }) => {
    const { f } = await newPostWithPhoto(page);
    const corner = { x: f.x + f.width * 0.06, y: f.y + f.height * 0.12 };
    const before = await scenePixel(page, corner);
    await page.getByRole('button', { name: 'Effects' }).click();
    const leak = page.getByRole('slider', { name: 'Light leak' });
    await leak.focus();
    await page.keyboard.press('End');
    await expect.poll(async () => (await scenePixel(page, corner))[0]!, { timeout: 15_000 }).toBeGreaterThan(before[0]! + 60);
    await page.getByRole('radio', { name: 'Ice', exact: true }).click();
    await expect.poll(async () => (await scenePixel(page, corner))[0]!, { timeout: 15_000 }).toBeLessThan(before[0]! + 40);
    await page.getByRole('button', { name: 'Reset', exact: true }).click();
    await expect.poll(async () => (await scenePixel(page, corner))[0]!, { timeout: 15_000 }).toBeLessThan(before[0]! + 6);
  });

  test('the Filters panel puts one look on every photo in the design', async ({ app: page }) => {
    const { top } = await newPostWithPhoto(page);
    await page.getByTestId('photo-input').setInputFiles(await twoTone(page, 'second.png'));
    // Wait for the second photo to land (it gets selected) before deselecting.
    await page.getByRole('tab', { name: 'Layers' }).click();
    await expect(page.getByTestId('layers-panel').getByRole('button', { name: 'two-tone', exact: true })).toHaveCount(2);
    await page.getByRole('tab', { name: 'Design' }).click();
    await page.keyboard.press('Escape');
    await page.keyboard.press('f');
    const panel = page.getByTestId('filters-panel');
    await expect(panel.getByText('Applies to all 2 photos in this design.')).toBeVisible();
    await panel.getByRole('radio', { name: 'Monochrome' }).click();
    await expect.poll(async () => grey(await scenePixel(page, top)), { timeout: 15_000 }).toBe(true);
    await page.getByRole('tab', { name: 'Layers' }).click();
    // Both photos are the same file, so the library stores it once and both layers share its name.
    for (const i of [0, 1]) {
      await page.getByTestId('layers-panel').getByRole('button', { name: 'two-tone', exact: true }).nth(i).click();
      await page.getByRole('tab', { name: 'Design' }).click();
      await expect(
        page
          .getByRole('complementary', { name: 'Inspector' })
          .getByTestId('look-picker')
          .getByRole('radio', { name: 'Monochrome' }),
      ).toHaveAttribute('aria-checked', 'true');
      await page.getByRole('tab', { name: 'Layers' }).click();
    }
    // One undo removes it from both.
    await page.keyboard.press('ControlOrMeta+z');
    await expect.poll(async () => grey(await scenePixel(page, top)), { timeout: 15_000 }).toBe(false);
  });

  test('without photos the Filters panel says so', async ({ app: page }) => {
    await open(page, '/');
    await page.getByRole('button', { name: /^New Post:/ }).click();
    await page.getByTestId('create-project').click();
    await expect(page.getByTestId('canvas-viewport')).toBeVisible();
    await page.getByRole('button', { name: 'Filters', exact: true }).first().click();
    await expect(page.getByTestId('filters-panel').getByText('No photos yet')).toBeVisible();
    await expect(page.getByTestId('filters-panel').getByRole('button', { name: 'Add photos' })).toBeEnabled();
  });

  test('template frames carry a look to the photos you drop in, and trend cards use real filters', async ({ app: page }) => {
    await open(page, '/templates/');
    await page.getByRole('button', { name: 'Template Gilded Frame' }).click();
    const dialog = page.getByRole('dialog', { name: 'Gilded Frame' });
    await expect(dialog.getByText(/Luxury — your photos get the look/)).toBeVisible();
    await dialog.getByTestId('template-with-photos').click();
    await page.getByTestId('flow-photo-input').setInputFiles(await twoTone(page));
    await expect(dialog.getByTestId('template-use')).toHaveText(/1 photo/, { timeout: 20_000 });
    await dialog.getByTestId('template-use').click();
    await expect(page.getByTestId('canvas-viewport')).toBeVisible();
    await page.getByRole('tab', { name: 'Layers' }).click();
    await page.getByTestId('layers-panel').getByRole('button', { name: 'Photo', exact: true }).click();
    await page.getByRole('tab', { name: 'Design' }).click();
    await expect(page.getByTestId('look-picker').getByRole('radio', { name: 'Luxury' })).toHaveAttribute('aria-checked', 'true');

    await open(page, '/discover/');
    await expect(page.getByText('Filter · Film')).toBeVisible();
    await expect(page.getByText('Filter · VHS')).toBeVisible();
  });
});

test.describe('filters (phone)', () => {
  test.skip(({ isMobile }) => !isMobile, 'Touch layout only');

  test('pick a look from the Filters tool on a phone', async ({ app: page }) => {
    await open(page, '/');
    await page.getByRole('button', { name: /^New Post:/ }).tap();
    await page.getByTestId('create-project').tap();
    await expect(page.getByTestId('canvas-viewport')).toBeVisible();
    await page.getByTestId('photo-input').setInputFiles(await twoTone(page));
    await expect(page.getByTestId('selection-frame')).toBeVisible();
    await page.getByRole('navigation', { name: 'Selection actions' }).getByRole('button', { name: 'Filters' }).tap();
    const panel = page.locator('[data-testid="filters-panel"]:visible');
    await expect(panel.getByText('Applies to the selected photo.')).toBeVisible();
    await panel.getByRole('radio', { name: 'Dreamy' }).tap();
    await expect(panel.getByRole('radio', { name: 'Dreamy' })).toHaveAttribute('aria-checked', 'true');
    await expect(panel.getByRole('slider', { name: 'Intensity' })).toBeVisible();
  });
});
