import type { Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { expect, makePng, open, test } from './fixtures';

/**
 * Template engine: browsing and searching the library, previewing (swipe,
 * colourways), using templates with your photos, the editor's Templates panel,
 * and saving / exporting / importing your own templates.
 */

const slides = (page: Page) => page.getByTestId('slide-strip').getByRole('button', { name: /^Slide \d+$/ });
const cards = (page: Page) => page.getByTestId('template-card');

async function newBlank(page: Page, kind: RegExp) {
  await open(page, '/');
  await page.getByRole('button', { name: kind }).click();
  await page.getByTestId('create-project').click();
  await expect(page.getByTestId('canvas-viewport')).toBeVisible();
}

test.describe('templates (desktop)', () => {
  test.skip(({ isMobile }) => isMobile, 'Desktop flows; phones are covered below');

  test('browse, search and filter the library, then preview and use a template', async ({ app: page }) => {
    await open(page, '/templates/');
    await expect(cards(page)).toHaveCount(63);

    await page.getByRole('textbox', { name: 'Search templates' }).fill('polaroid');
    await expect(page.getByRole('button', { name: 'Template Polaroid Wall' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Template Date Stamp' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Template Cyber Grid' })).toBeHidden();
    await page.getByRole('group', { name: 'Filter by format' }).getByRole('button', { name: 'Post', exact: true }).click();
    await expect(cards(page)).toHaveCount(1);
    await page.getByRole('textbox', { name: 'Search templates' }).fill('zzzz');
    await expect(page.getByText('Nothing matches that')).toBeVisible();
    await page.getByRole('button', { name: 'Clear filters' }).click();
    await page.getByRole('group', { name: 'Filter by style' }).getByRole('button', { name: 'Y2K' }).click();
    const y2k = await cards(page).count();
    expect(y2k).toBeGreaterThanOrEqual(3);
    expect(y2k).toBeLessThan(63);

    await page.getByRole('button', { name: 'Template Y2K Era' }).click();
    const dialog = page.getByRole('dialog', { name: 'Y2K Era' });
    await expect(dialog.getByText('3 slides')).toBeVisible();
    await expect(dialog.getByText('Unbounded')).toBeVisible();
    // Swipe preview + a different colourway.
    const preview = dialog.getByTestId('carousel-preview');
    await expect(preview.getByText('1 / 3')).toBeVisible();
    await dialog.getByRole('tab', { name: 'Go to slide 3' }).click();
    await expect(preview.getByText('3 / 3')).toBeVisible();
    await dialog.getByRole('radio', { name: 'Old Money' }).click();
    await expect(dialog.getByRole('radio', { name: 'Old Money' })).toHaveAttribute('aria-checked', 'true');
    await dialog.getByTestId('template-use').click();
    await expect(page).toHaveURL(/\/editor\/\?id=prj_/);
    await expect(slides(page)).toHaveCount(3);
    await expect(page.getByRole('textbox', { name: 'Project name' })).toHaveValue('Y2K Era');
  });

  test('use a template with your own photos', async ({ app: page }) => {
    await open(page, '/templates/');
    await page.getByRole('button', { name: 'Template Gilded Frame' }).click();
    const dialog = page.getByRole('dialog', { name: 'Gilded Frame' });
    await dialog.getByTestId('template-with-photos').click();
    await expect(dialog.getByText('Pick up to 1 photos')).toBeVisible();
    await expect(dialog.getByTestId('template-use')).toBeDisabled();
    await page.getByTestId('flow-photo-input').setInputFiles({
      name: 'portrait.png',
      mimeType: 'image/png',
      buffer: await makePng(page, 'subject', 800, 1000),
    });
    await expect(dialog.getByTestId('template-use')).toHaveText(/Use template · 1 photo/, { timeout: 20_000 });
    await dialog.getByTestId('template-use').click();
    await expect(page.getByTestId('canvas-viewport')).toBeVisible();
    await page.getByRole('tab', { name: 'Layers' }).click();
    await expect(page.getByTestId('layers-panel').getByRole('button', { name: 'Photo', exact: true })).toHaveCount(1);
  });

  test('the editor’s Templates panel fills a blank design, adds slides and replaces — all undoable', async ({ app: page }) => {
    await newBlank(page, /^New Post:/);
    // A single-slide post shows no slide strip until it has more slides.
    const strip = page.getByTestId('slide-strip');
    await expect(strip).toBeHidden();
    await page.getByRole('button', { name: 'Templates', exact: true }).first().click();
    const panel = page.getByTestId('templates-panel');
    await expect(panel.getByRole('button', { name: 'Template Quote Card' })).toBeVisible();

    // A blank design takes the template's place.
    await panel.getByRole('button', { name: 'Template Quote Card' }).click();
    await page.getByRole('dialog', { name: 'Quote Card' }).getByTestId('template-use').click();
    await expect(page.getByRole('dialog')).toBeHidden();
    await page.getByRole('tab', { name: 'Layers' }).click();
    await expect(page.getByTestId('layers-panel').getByText('Note to self')).toBeVisible();

    // Otherwise its slides go in after the current one (the panel stays open).
    await panel.getByRole('button', { name: 'Template Five Tips' }).click();
    const tips = page.getByRole('dialog', { name: 'Five Tips' });
    await expect(tips.getByTestId('template-use')).toHaveText('Add 5 slides');
    await tips.getByTestId('template-use').click();
    await expect(slides(page)).toHaveCount(6);
    await page.keyboard.press('ControlOrMeta+z');
    await expect(strip).toBeHidden();

    // Replace swaps the content (and can be undone too).
    await panel.getByRole('button', { name: 'Template Five Tips' }).click();
    await page.getByRole('dialog', { name: 'Five Tips' }).getByRole('button', { name: 'Replace design' }).click();
    await expect(slides(page)).toHaveCount(5);
    await page.keyboard.press('ControlOrMeta+z');
    await expect(strip).toBeHidden();
    await expect(page.getByTestId('layers-panel').getByText('Note to self')).toBeVisible();

    // "All sizes" includes templates made for other canvases.
    const fit = await panel.getByRole('button', { name: /^Template / }).count();
    await panel.getByRole('radio', { name: 'All sizes' }).click();
    await expect.poll(() => panel.getByRole('button', { name: /^Template / }).count()).toBeGreaterThan(fit);
  });

  test('save a design as your own template, then rename, export, delete, undo and import it', async ({ app: page }) => {
    await newBlank(page, /^New Post:/);
    await page.getByRole('button', { name: 'Text', exact: true }).first().click();
    await page.getByTestId('text-panel').getByRole('button', { name: 'Add a heading' }).click();
    await page.getByRole('button', { name: 'Save as template' }).first().click();
    const save = page.getByRole('dialog', { name: 'Save as template' });
    await save.getByRole('textbox', { name: 'Template name' }).fill('Launch post');
    await save.getByRole('radio', { name: 'Big type' }).click();
    await save.getByRole('textbox', { name: 'Tags' }).fill('launch, promo');
    await save.getByTestId('save-template').click();
    await expect(page.getByText('Saved “Launch post” to your templates')).toBeVisible();

    // It shows up in the editor panel and on the Templates page.
    await page.getByRole('button', { name: 'Templates', exact: true }).first().click();
    await expect(page.getByTestId('templates-panel').getByRole('button', { name: 'Template Launch post' })).toBeVisible();
    await open(page, '/templates/?tab=yours');
    await expect(cards(page)).toHaveCount(1);
    await page.getByRole('textbox', { name: 'Search templates' }).fill('promo');
    await expect(cards(page)).toHaveCount(1);

    await page.getByRole('button', { name: 'Template Launch post' }).click();
    let dialog = page.getByRole('dialog', { name: 'Launch post' });
    await expect(dialog.getByText('Yours')).toBeVisible();
    await dialog.getByRole('button', { name: 'Rename' }).click();
    await dialog.getByRole('textbox', { name: 'Template name' }).fill('Launch day');
    await dialog.getByRole('button', { name: 'Save', exact: true }).click();
    dialog = page.getByRole('dialog', { name: 'Launch day' });
    await expect(dialog).toBeVisible();

    const [download] = await Promise.all([
      page.waitForEvent('download'),
      dialog.getByRole('button', { name: 'Export file' }).click(),
    ]);
    expect(download.suggestedFilename()).toBe('launch-day.stardeck-template.json');
    const file = await download.path();
    const json = JSON.parse(readFileSync(file!, 'utf8'));
    expect(json).toMatchObject({ kind: 'stardeck-template', version: 1, template: { name: 'Launch day', style: 'bold' } });

    await dialog.getByRole('button', { name: 'Delete' }).click();
    await expect(page.getByRole('dialog')).toBeHidden();
    await page.getByRole('button', { name: 'Undo' }).click();
    await expect(page.getByRole('button', { name: 'Template Launch day' })).toBeVisible();

    await page.getByRole('textbox', { name: 'Search templates' }).fill('');
    await page.getByTestId('template-import-input').setInputFiles(file!);
    await expect(page.getByText('Added “Launch day” to your templates')).toBeVisible();
    await expect(cards(page)).toHaveCount(2);

    // A file that isn't a template is refused politely.
    await page
      .getByTestId('template-import-input')
      .setInputFiles({ name: 'notes.json', mimeType: 'application/json', buffer: Buffer.from('{"hello":1}') });
    await expect(page.getByText('That file isn’t a Stardeck template.')).toBeVisible();
    await expect(cards(page)).toHaveCount(2);
  });

  test('any project can be saved as a template from its menu', async ({ app: page }) => {
    await newBlank(page, /^New Story:/);
    await open(page, '/projects/');
    await page
      .getByRole('button', { name: /^Actions for / })
      .first()
      .click();
    await page.getByRole('menuitem', { name: 'Save as template' }).click();
    const save = page.getByRole('dialog', { name: 'Save as template' });
    await save.getByRole('textbox', { name: 'Template name' }).fill('Blank story');
    await save.getByTestId('save-template').click();
    await expect(page.getByText('Saved “Blank story” to your templates')).toBeVisible();
    await page.getByRole('button', { name: 'View' }).click();
    await expect(page).toHaveURL(/\/templates\/\?tab=yours/);
    await expect(page.getByRole('button', { name: 'Template Blank story' })).toBeVisible();
  });
});

test.describe('templates (phone)', () => {
  test.skip(({ isMobile }) => !isMobile, 'Touch layout only');

  test('browse templates from the tab bar and start a design', async ({ app: page }) => {
    await open(page, '/');
    await page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'Templates' }).tap();
    await expect(page).toHaveURL(/\/templates\//);
    await page.getByRole('button', { name: 'Template This or That' }).tap();
    const dialog = page.getByRole('dialog', { name: 'This or That' });
    await expect(dialog.getByTestId('template-preview')).toBeVisible();
    await dialog.getByTestId('template-use').tap();
    await expect(page.getByTestId('canvas-viewport')).toBeVisible();
    await expect(page.getByRole('textbox', { name: 'Project name' })).toHaveValue('This or That');
  });
});
