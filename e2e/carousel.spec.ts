import type { Page } from '@playwright/test';
import { expect, makePng, open, test } from './fixtures';

/**
 * Carousel tools: smart photo dump, seamless swipe, collages (shuffle, remix,
 * lock) and the live swipe preview.
 */

/** Distinct photos (different hues and shapes, so the library doesn't de-duplicate them). */
async function photoFiles(page: Page, count: number) {
  const files = [];
  for (let i = 0; i < count; i++) {
    const landscape = i % 3 !== 1;
    files.push({
      name: `pic-${i + 1}.png`,
      mimeType: 'image/png',
      buffer: await makePng(page, 'gradient', landscape ? 900 : 600, landscape ? 600 : 900, i * 47),
    });
  }
  return files;
}

async function pickInFlow(page: Page, count: number) {
  await page.getByTestId('flow-photo-input').setInputFiles(await photoFiles(page, count));
  await expect(page.getByTestId('photo-chooser').getByRole('checkbox', { checked: true })).toHaveCount(count, {
    timeout: 20_000,
  });
  await page.getByTestId('flow-next').click();
}

const slideThumbs = (page: Page) => page.getByRole('button', { name: /^Slide \d+/ });

test.describe('carousel tools (desktop)', () => {
  test.skip(({ isMobile }) => isMobile, 'Desktop flows; phones are covered below');

  test('smart photo dump builds a finished carousel from the home screen', async ({ app: page }) => {
    await open(page, '/');
    await page.getByRole('button', { name: /Smart photo dump/ }).click();
    const dialog = page.getByRole('dialog', { name: 'Smart photo dump' });
    await expect(dialog.getByRole('button', { name: /Pick at least 3/ })).toBeDisabled();
    await pickInFlow(page, 7);

    await dialog.getByRole('radio', { name: /^Clean/ }).click();
    await dialog.getByRole('textbox', { name: 'Cover title' }).fill('summer 26');
    const preview = dialog.getByTestId('carousel-preview');
    await expect(preview).toBeVisible();
    const counter = preview.getByText(/^1 \/ \d+$/);
    await expect(counter).toBeVisible();
    const total = Number((await counter.textContent())!.split('/')[1]);
    expect(total).toBeGreaterThan(2);

    await dialog.getByTestId('flow-create').click();
    await expect(page).toHaveURL(/\/editor\/\?id=prj_/);
    await expect(page.getByTestId('canvas-viewport')).toBeVisible();
    await expect(page.getByRole('textbox', { name: 'Project name' })).toHaveValue('Clean dump');
    await page.getByRole('tab', { name: 'Layers' }).click();
    await expect(page.getByTestId('layers-panel').getByText('summer 26')).toBeVisible();
    await expect(page.getByTestId('layers-panel').getByRole('button', { name: 'Photo', exact: true })).toHaveCount(7);
  });

  test('seamless swipe flows photos across slides; slide count and preview stay in sync', async ({ app: page }) => {
    await open(page, '/');
    await page.getByRole('button', { name: /Seamless swipe/ }).click();
    const dialog = page.getByRole('dialog', { name: 'Seamless swipe' });
    await pickInFlow(page, 2);
    const slides = dialog.getByRole('slider', { name: 'Number of slides' });
    await slides.focus();
    await page.keyboard.press('Home');
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('ArrowRight'); // 3 slides
    await expect(dialog.getByTestId('carousel-preview').getByText('1 / 3')).toBeVisible();
    await dialog.getByTestId('flow-create').click();
    await expect(page.getByTestId('canvas-viewport')).toBeVisible();

    // Select a panorama photo: the seamless controls appear; more slides extends it.
    await page.getByRole('tab', { name: 'Layers' }).click();
    await page.getByTestId('layers-panel').getByRole('button', { name: 'Photo', exact: true }).first().click();
    await page.getByRole('tab', { name: 'Design' }).click();
    await expect(page.getByRole('heading', { name: 'Seamless swipe' })).toBeVisible();
    const count = page.getByRole('textbox', { name: 'Panorama slides' });
    await count.fill('4');
    await count.press('Enter');
    await expect(page.getByText('Slides').locator('..').getByText('4')).toBeVisible();

    // Swipe preview from the top bar: arrow keys move between slides.
    await page.getByRole('button', { name: 'Swipe preview' }).first().click();
    const region = page.getByRole('region', { name: 'Swipe preview' });
    await expect(page.getByTestId('carousel-preview').getByText('1 / 4')).toBeVisible();
    await region.focus();
    await page.keyboard.press('ArrowRight');
    await expect(page.getByTestId('carousel-preview').getByText('2 / 4')).toBeVisible();
    await page.getByRole('tab', { name: 'Go to slide 4' }).click();
    await expect(page.getByTestId('carousel-preview').getByText('4 / 4')).toBeVisible();
  });

  test('collage: arrange selected photos, remix, keep one in place while shuffling', async ({ app: page }) => {
    await open(page, '/');
    await page.getByRole('button', { name: /^New Post:/ }).click();
    await page.getByTestId('create-project').click();
    await expect(page.getByTestId('canvas-viewport')).toBeVisible();
    await page.getByTestId('photo-input').setInputFiles(await photoFiles(page, 4));
    await expect(page.getByText('4 selected')).toBeVisible();

    await page.keyboard.press('l');
    await expect(page.getByTestId('layouts-panel').getByText('Arrange the 4 selected photos')).toBeVisible();
    await page.getByRole('button', { name: 'Grid collage' }).click();
    await expect(page.getByRole('heading', { name: 'Collage · Grid' })).toBeVisible();
    await page.getByRole('button', { name: 'More chaotic' }).click();
    await expect(page.getByRole('heading', { name: 'Collage · Scrapbook' })).toBeVisible();
    await page.getByRole('button', { name: 'Editorial', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Collage · Editorial' })).toBeVisible();

    // Lock the first photo, then shuffle: it stays exactly where it was.
    await page.getByRole('tab', { name: 'Layers' }).click();
    const layer = (i: number) => page.getByTestId('layers-panel').getByRole('button', { name: 'pic', exact: false }).nth(i);
    await layer(0).click();
    await page.getByRole('tab', { name: 'Design' }).click();
    await page.getByRole('button', { name: 'Keep this photo in place' }).click();
    await expect(page.getByRole('button', { name: 'Kept in place when shuffling' })).toBeVisible();
    const x = page.getByRole('textbox', { name: 'X', exact: true });
    const y = page.getByRole('textbox', { name: 'Y', exact: true });
    const before = [await x.inputValue(), await y.inputValue()];
    await page.getByRole('button', { name: 'Shuffle', exact: true }).click();
    await page.getByRole('button', { name: 'Shuffle', exact: true }).click();
    expect([await x.inputValue(), await y.inputValue()]).toEqual(before);

    // Undo steps back through the shuffles.
    await page.keyboard.press('ControlOrMeta+z');
    await expect(page.getByRole('heading', { name: 'Collage · Editorial' })).toBeVisible();
  });

  test('a photo dump can be added to an existing carousel from the Layouts panel', async ({ app: page }) => {
    await open(page, '/');
    await page.getByRole('button', { name: /New Carousel: Swipeable/ }).click();
    await page.getByTestId('create-project').click();
    await expect(page.getByTestId('canvas-viewport')).toBeVisible();
    await page.getByRole('button', { name: 'Text', exact: true }).first().click();
    await page.getByTestId('text-panel').getByRole('button', { name: 'Add a heading' }).click();
    await expect(slideThumbs(page)).toHaveCount(5);

    await page.getByRole('button', { name: 'Layouts', exact: true }).first().click();
    await page
      .getByTestId('layouts-panel')
      .getByRole('button', { name: /Smart photo dump/ })
      .click();
    await pickInFlow(page, 4);
    await page
      .getByRole('dialog')
      .getByRole('radio', { name: /^Minimal/ })
      .click();
    await page.getByTestId('flow-create').click();
    await expect(page.getByRole('dialog')).toBeHidden();
    await expect.poll(async () => slideThumbs(page).count()).toBeGreaterThan(5);
  });
});

test.describe('carousel tools (phone)', () => {
  test.skip(({ isMobile }) => !isMobile, 'Touch layout only');

  test('photo dump on a phone, then shuffle a collage from the toolbar', async ({ app: page }) => {
    await open(page, '/');
    await page.getByRole('button', { name: /Smart photo dump/ }).tap();
    await pickInFlow(page, 5);
    await page
      .getByRole('dialog')
      .getByRole('radio', { name: /^Chaotic/ })
      .tap();
    await page.getByTestId('flow-create').tap();
    await expect(page.getByTestId('canvas-viewport')).toBeVisible();
    await page.getByRole('button', { name: 'Layers', exact: true }).tap();
    await page.getByTestId('layers-panel').getByRole('button', { name: 'Photo', exact: true }).last().tap();
    const actions = page.getByRole('navigation', { name: 'Selection actions' });
    await expect(actions.getByRole('button', { name: 'Shuffle' })).toBeVisible();
    await actions.getByRole('button', { name: 'Shuffle' }).tap();
    await expect(actions).toBeVisible();
  });
});
