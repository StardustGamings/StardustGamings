import type { Page } from '@playwright/test';
import { createCarousel, expect, makePng, open, test } from './fixtures';

/**
 * The optional AI tools, as a build without an AI server ships them: the
 * editor's Magic tool (captions, palettes, font pairing, background concepts,
 * resize), smart resize as a copy and in place, Auto in the photo dump, the
 * colour picker's RGB / HSL modes and Settings → AI. Everything here runs on
 * the device, so each test also checks nothing leaves it.
 */

/** Records every request that goes anywhere but this site. */
function watchOffsite(page: Page) {
  const offsite: string[] = [];
  page.on('request', (r) => {
    const url = new URL(r.url());
    if (!['data:', 'blob:'].includes(url.protocol) && url.hostname !== '127.0.0.1') offsite.push(r.url());
  });
  return offsite;
}

async function openQuoteCard(page: Page) {
  await open(page, '/templates/');
  await page.getByRole('button', { name: 'Template Quote Card' }).first().click();
  await page.getByTestId('template-use').click();
  await expect(page).toHaveURL(/\/editor\/\?id=prj_/);
  await expect(page.getByTestId('canvas-viewport')).toBeVisible();
}

async function openMagic(page: Page) {
  await page.getByRole('button', { name: 'Magic', exact: true }).first().click();
  const panel = page.getByTestId('magic-panel');
  await expect(panel).toBeVisible();
  return panel;
}

/** The background's HEX, as the Background tool shows it. */
async function backgroundHex(page: Page) {
  await page.getByRole('button', { name: 'Background', exact: true }).first().click();
  const hex = page.getByTestId('background-panel').getByRole('textbox', { name: 'HEX colour' }).first();
  await expect(hex).toBeVisible();
  return hex.inputValue();
}

async function photoFiles(page: Page) {
  const files = [];
  for (let i = 0; i < 5; i++) {
    files.push({ name: `pic-${i + 1}.png`, mimeType: 'image/png', buffer: await makePng(page, 'gradient', 900, 600, i * 61) });
  }
  // The same picture at another size: a near-duplicate Auto should leave out.
  files.push({ name: 'pic-1-again.png', mimeType: 'image/png', buffer: await makePng(page, 'gradient', 960, 640, 0) });
  return files;
}

test.describe('AI tools (desktop)', () => {
  test.skip(({ isMobile }) => isMobile, 'Phones are covered below');
  test.use({ permissions: ['clipboard-read', 'clipboard-write'] });

  test('captions come from the design’s own words, copy and drop in as text', async ({ app: page }) => {
    const offsite = watchOffsite(page);
    await openQuoteCard(page);
    const panel = await openMagic(page);
    await expect(panel.getByTestId('ai-privacy-note')).toContainText('Every tool here runs on this device');

    await panel.getByTestId('caption-write').click();
    const cards = panel.getByTestId('caption-card');
    await expect(cards).toHaveCount(4);
    await expect(panel.getByTestId('ai-source').first()).toHaveText(/On this device/);
    // The headline is the quote, not the big decorative quote mark.
    await expect(cards.filter({ hasText: 'Make the thing you wish existed' }).first()).toBeVisible();
    for (const text of await cards.allTextContents()) {
      expect(text).not.toContain('“');
      expect(text).not.toMatch(/#(make|thing|yourhandle)\b/);
    }

    const first = (await cards.first().locator('p').first().textContent())!;
    await panel.getByRole('button', { name: 'Copy caption 1' }).click();
    await expect(page.getByText('Caption copied')).toBeVisible();
    expect(await page.evaluate(() => navigator.clipboard.readText())).toContain(first);

    // Another tone writes different lines.
    await panel.getByRole('radiogroup', { name: 'Caption tone' }).getByRole('radio', { name: 'Hype' }).click();
    await panel.getByTestId('caption-write').click();
    await expect(cards.first().locator('p').first()).not.toHaveText(first);
    await panel.getByRole('button', { name: 'More ideas' }).click();
    await expect(cards).toHaveCount(4);

    await page.getByRole('tab', { name: 'Layers' }).click();
    const layers = page.getByRole('list', { name: 'Layers — drag to reorder' }).getByRole('listitem');
    const before = await layers.count();
    await panel.getByRole('button', { name: 'Add caption 1 to the design' }).click();
    await expect(layers).toHaveCount(before + 1);
    expect(offsite).toEqual([]);
  });

  test('palettes recolour the design in one undo step; fonts and backgrounds apply', async ({ app: page }) => {
    const offsite = watchOffsite(page);
    await openQuoteCard(page);
    const original = await backgroundHex(page);

    let panel = await openMagic(page);
    const rows = panel.getByTestId('palette-row');
    for (const name of ['Complementary', 'Monochromatic', 'Analogous', 'Cinematic', 'Pastel', 'Neon', 'Y2K', 'Dark luxury']) {
      await expect(rows.filter({ hasText: name })).toHaveCount(1);
    }
    await panel.getByRole('button', { name: 'Recolour with Dark luxury' }).click();
    await expect(page.getByText('Dark luxury colours applied')).toBeVisible();
    const recoloured = await backgroundHex(page);
    expect(recoloured).not.toBe(original);
    await page.keyboard.press('ControlOrMeta+z');
    await expect(page.getByTestId('background-panel').getByRole('textbox', { name: 'HEX colour' }).first()).toHaveValue(original);

    panel = await openMagic(page);
    await panel.getByTestId('fonts-suggest').click();
    const pairings = panel.getByTestId('pairing-row');
    await expect(pairings.first()).toBeVisible();
    expect(await pairings.count()).toBeGreaterThanOrEqual(3);
    await expect(pairings.first()).toContainText('Make the thing you');
    const label = (await pairings.nth(1).getAttribute('aria-label'))!;
    const [, heading, body] = /^Use (.+) with (.+)$/.exec(label)!;
    await pairings.nth(1).click();
    await expect(page.getByText(`Set in ${heading} + ${body}`)).toBeVisible();

    await panel.getByTestId('backgrounds-suggest').click();
    const concepts = panel.getByTestId('concept-card');
    await expect(concepts).toHaveCount(4);
    // Spotlight is a fill alone; the others add shapes.
    const name = (await concepts.filter({ hasNotText: 'Spotlight' }).first().locator('p').textContent())!;
    await panel.getByRole('button', { name: `${name} on this slide` }).click();
    await expect(page.getByText(`${name} background on this slide`)).toBeVisible();
    await page.getByRole('tab', { name: 'Layers' }).click();
    await expect(
      page
        .getByTestId('layers-panel')
        .getByRole('button', { name: /Background art/ })
        .first(),
    ).toBeVisible();
    expect(offsite).toEqual([]);
  });

  test('background concepts go on every slide of a carousel', async ({ app: page }) => {
    await createCarousel(page, 3);
    const panel = await openMagic(page);
    await panel.getByTestId('backgrounds-suggest').click();
    const card = panel.getByTestId('concept-card').filter({ hasNotText: 'Spotlight' }).first();
    const name = (await card.locator('p').textContent())!;
    await card.getByRole('button', { name: `${name} on every slide` }).click();
    await expect(page.getByText(`${name} background on every slide`)).toBeVisible();
    await page.getByRole('tab', { name: 'Layers' }).click();
    await expect(page.getByTestId('layers-panel').getByRole('button', { name: 'Background art' }).first()).toBeVisible();
  });

  test('resize makes a 9:16 copy, or resizes in place with one undo', async ({ app: page }) => {
    await openQuoteCard(page);
    const firstUrl = page.url();
    let panel = await openMagic(page);
    await panel.getByRole('button', { name: 'Resize to 9:16' }).click();
    let dialog = page.getByRole('dialog', { name: 'Resize design' });
    await expect(dialog.getByRole('radio', { name: /^9:16/ })).toHaveAttribute('aria-checked', 'true');
    await expect(dialog.getByTestId('resize-preview')).toContainText('1080 × 1920');
    await dialog.getByTestId('resize-apply').click();
    await expect(page).not.toHaveURL(firstUrl);
    await expect(page.getByTestId('canvas-viewport')).toBeVisible();
    await expect(page.getByRole('textbox', { name: 'Project name' })).toHaveValue(/Quote Card \(.*9:16\)/);
    await expect(page.getByText('1080 × 1920', { exact: true })).toBeVisible();

    // In place, from the ⋯ menu, to 1:1 — then undo.
    await page.getByTestId('editor-more').click();
    await page.getByRole('menuitem', { name: 'Resize design…' }).click();
    dialog = page.getByRole('dialog', { name: 'Resize design' });
    await dialog.getByRole('radio', { name: /^1:1/ }).click();
    await dialog.getByRole('radio', { name: 'Resize this one' }).click();
    await dialog.getByTestId('resize-apply').click();
    await expect(dialog).toBeHidden();
    await expect(page.getByText('1080 × 1080', { exact: true })).toBeVisible();
    await page.keyboard.press('ControlOrMeta+z');
    await expect(page.getByText('1080 × 1920', { exact: true })).toBeVisible();
    // Nothing to resize to when it's that size already.
    panel = await openMagic(page);
    await panel.getByRole('button', { name: 'Resize to 9:16' }).click();
    await expect(page.getByRole('dialog', { name: 'Resize design' }).getByTestId('resize-apply')).toBeDisabled();
  });

  test('the colour picker takes HEX, RGB and HSL', async ({ app: page }) => {
    await createCarousel(page, 1);
    await page.getByRole('button', { name: 'Background', exact: true }).first().click();
    const picker = page.getByTestId('background-panel');
    const format = picker.getByRole('radiogroup', { name: 'Colour format' }).first();
    await format.getByRole('radio', { name: 'rgb' }).click();
    await picker.getByRole('spinbutton', { name: 'Red' }).fill('255');
    await picker.getByRole('spinbutton', { name: 'Green' }).fill('0');
    await picker.getByRole('spinbutton', { name: 'Blue' }).fill('0');
    await format.getByRole('radio', { name: 'hsl' }).click();
    await expect(picker.getByRole('spinbutton', { name: 'Hue' })).toHaveValue('0');
    await expect(picker.getByRole('spinbutton', { name: 'Saturation' })).toHaveValue('100');
    await expect(picker.getByRole('spinbutton', { name: 'Lightness' })).toHaveValue('50');
    await picker.getByRole('spinbutton', { name: 'Hue' }).fill('240');
    await format.getByRole('radio', { name: 'hex' }).click();
    await expect(picker.getByRole('textbox', { name: 'HEX colour' }).first()).toHaveValue('#0000FF');
  });

  test('Auto plans the photo dump from the photos, on the device', async ({ app: page }) => {
    const offsite = watchOffsite(page);
    await open(page, '/');
    await page.getByRole('button', { name: /Smart photo dump/ }).click();
    const dialog = page.getByRole('dialog', { name: 'Smart photo dump' });
    await page.getByTestId('flow-photo-input').setInputFiles(await photoFiles(page));
    await expect(page.getByTestId('photo-chooser').getByRole('checkbox', { checked: true })).toHaveCount(6, {
      timeout: 20_000,
    });
    await page.getByTestId('flow-next').click();

    await dialog.getByTestId('dump-auto').getByRole('button', { name: 'Auto' }).click();
    const reason = dialog.getByTestId('dump-auto-reason');
    await expect(reason).toContainText('On this device');
    await expect(reason).toContainText('1 near-duplicate left out');
    await expect(dialog.getByRole('radiogroup', { name: 'Photo dump style' }).getByRole('radio', { checked: true })).toHaveCount(
      1,
    );
    await expect(dialog.getByRole('textbox', { name: 'Cover title' })).not.toHaveValue('');

    await dialog.getByTestId('flow-create').click();
    await expect(page.getByTestId('canvas-viewport')).toBeVisible();
    await page.getByRole('tab', { name: 'Layers' }).click();
    await expect(page.getByTestId('layers-panel').getByRole('button', { name: 'Photo', exact: true })).toHaveCount(5);
    expect(offsite).toEqual([]);
  });

  test('Settings explains the AI tools and that no AI server is set up', async ({ app: page }) => {
    await open(page, '/settings/');
    const section = page.locator('#ai');
    await expect(section.getByRole('heading', { name: 'AI tools' })).toBeVisible();
    await expect(section.getByText('On your device — always available, nothing uploaded')).toBeVisible();
    await expect(section.getByText('Smart resize to 4:5, 1:1, 9:16, 16:9 and more')).toBeVisible();
    await expect(section.getByText('Not set up', { exact: true })).toBeVisible();
    await expect(section.getByRole('switch', { name: 'Use the AI server' })).toHaveCount(0);
  });
});

test.describe('AI tools (phone)', () => {
  test.skip(({ isMobile }) => !isMobile, 'Touch layout only');

  test('Magic on a phone: captions, a palette and a resized copy', async ({ app: page }) => {
    const offsite = watchOffsite(page);
    await open(page, '/');
    await page.getByRole('button', { name: /^New Post:/ }).tap();
    await page.getByTestId('create-project').tap();
    await expect(page.getByTestId('canvas-viewport')).toBeVisible();
    await page.getByRole('button', { name: 'Magic', exact: true }).tap();
    const panel = page.getByTestId('mobile-sheet').getByTestId('magic-panel');
    await expect(panel).toBeVisible();

    await panel.getByTestId('caption-write').tap();
    await expect(panel.getByTestId('caption-card')).toHaveCount(4);
    await panel.getByRole('button', { name: 'Recolour with Pastel' }).tap();
    await expect(page.getByText('Pastel colours applied')).toBeVisible();

    await panel.getByRole('button', { name: 'Resize to 1:1' }).tap();
    const dialog = page.getByRole('dialog', { name: 'Resize design' });
    await expect(dialog.getByTestId('resize-preview')).toContainText('1080 × 1080');
    await dialog.getByTestId('resize-apply').tap();
    await expect(dialog).toBeHidden();
    await expect(page.getByTestId('canvas-viewport')).toBeVisible();
    await expect(page.getByRole('textbox', { name: 'Project name' })).toHaveValue(/\(.*1:1\)/);
    expect(offsite).toEqual([]);
  });
});
