import { readFileSync } from 'node:fs';
import path from 'node:path';
import type { Page } from '@playwright/test';
import { expect, makePng, open, pinDate, test } from './fixtures';

/**
 * The trend system: drops loaded from JSON (scheduled by date, cached for
 * offline, switchable from the archive), every trend category on Discover,
 * the editor's Trends tool (suggestions, kits, palettes, fonts, filters,
 * stickers), layout rules in the photo dump, and the pack-author preview.
 */

// Requests for trend files are faked below; the service worker would answer them itself.
test.use({ serviceWorkers: 'block' });

const september = JSON.parse(readFileSync(path.resolve('public/trends/2026/september.json'), 'utf8'));
const testDrop = { ...september, id: 'e2e-drop', title: 'Test Drop', publishedAt: '2026-09-20' };
const testIndex = {
  version: 2,
  packs: [
    { id: 'e2e-drop', path: '/trends/e2e/drop.json', publishedAt: '2026-09-20', title: 'Test Drop' },
    { id: '2026-09', path: '/trends/2026/september.json', publishedAt: '2026-09-01', title: 'September Drop' },
  ],
};

async function serveFeed(page: Page) {
  await page.route('**/trends/index.json', (r) => r.fulfill({ json: testIndex }));
  await page.route('**/trends/e2e/drop.json', (r) => r.fulfill({ json: testDrop }));
}

async function photoFiles(page: Page, count: number) {
  const files = [];
  for (let i = 0; i < count; i++) {
    files.push({ name: `pic-${i + 1}.png`, mimeType: 'image/png', buffer: await makePng(page, 'gradient', 900, 600, i * 53) });
  }
  return files;
}

test.describe('trends (desktop)', () => {
  test.skip(({ isMobile }) => isMobile, 'Phones are covered below');

  test('Discover shows the newest live drop, every category, and the archive', async ({ app: page }) => {
    await pinDate(page, '2026-09-26T12:00:00');
    await open(page, '/discover/');
    await expect(page.getByTestId('drop-title')).toHaveText('September Drop');
    const switcher = page.getByTestId('drop-switcher');
    await expect(switcher.getByRole('radio', { name: /September Drop/ })).toHaveAttribute('aria-checked', 'true');
    await expect(switcher.getByRole('radio', { name: /August Drop/ })).toBeVisible();
    // October is published already, but scheduled for the 1st.
    await expect(switcher.getByRole('radio', { name: /October Drop/ })).toHaveCount(0);

    const nav = page.getByTestId('trend-categories');
    for (const label of [
      'Kits',
      'Templates',
      'Layouts',
      'Fonts',
      'Colours',
      'Filters',
      'Effects',
      'Stickers',
      'Carousel styles',
      'Meme formats',
      'Social formats',
      'Inspiration',
    ]) {
      await expect(nav.getByRole('link', { name: label, exact: true })).toBeVisible();
    }
    await expect(page.getByTestId('kit-card')).toHaveCount(4);
    await expect(page.getByTestId('filter-card').filter({ hasText: 'Honey Hour' })).toBeVisible();
    await expect(page.getByTestId('layout-rule-card').filter({ hasText: 'Notebook Dump' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Download Paper Plane sticker as PNG' })).toBeVisible();
    await expect(page.locator('#meme-formats').getByRole('button', { name: 'Template Nah / Yeah' })).toBeVisible();
    await expect(page.locator('#social-formats').getByRole('button', { name: 'Template Thread' })).toBeVisible();

    // A kit starts a new post, restyled.
    await page
      .getByTestId('kit-card')
      .filter({ hasText: 'Soft Journal' })
      .getByRole('button', { name: /Start a post/ })
      .click();
    await expect(page).toHaveURL(/\/editor\//);
    await expect(page.getByRole('textbox', { name: 'Project name' })).toHaveValue('Soft Journal post');

    // The archive.
    await pinDate(page, '2026-09-26T12:00:00');
    await open(page, '/discover/');
    await page
      .getByTestId('drop-switcher')
      .getByRole('radio', { name: /August Drop/ })
      .click();
    await expect(page.getByTestId('drop-title')).toHaveText('August Drop');
    await expect(page.getByTestId('kit-card').filter({ hasText: 'Pool Day' })).toBeVisible();
    await expect(page.getByTestId('filter-card').filter({ hasText: 'Sunburnt' })).toBeVisible();
  });

  test('a scheduled drop goes live on its day and is flagged as new until opened', async ({ app: page }) => {
    await page.addInitScript(() => localStorage.setItem('stardeck:trends-seen', '2026-09'));
    await pinDate(page, '2026-10-02T09:00:00');
    await open(page, '/');
    await expect(page.getByText('New drop · October Drop')).toBeVisible();
    const dot = page.getByRole('navigation', { name: 'Main' }).getByTestId('new-drop-dot');
    await expect(dot).toHaveCount(1);
    await page
      .getByRole('navigation', { name: 'Main' })
      .getByRole('link', { name: /Discover/ })
      .first()
      .click();
    await expect(page.getByTestId('drop-title')).toHaveText('October Drop');
    await expect(page.getByTestId('drop-header').getByText('Latest')).toBeVisible();
    await expect(page.getByTestId('new-drop-dot')).toHaveCount(0);
  });

  test('trend downloads can be turned off in Settings', async ({ app: page }) => {
    await open(page, '/settings/');
    const toggle = page.getByRole('switch', { name: 'Check for new trend drops' });
    await expect(toggle).toBeChecked();
    await toggle.click();
    await expect(toggle).not.toBeChecked();

    const fetched: string[] = [];
    page.on('request', (r) => r.url().includes('/trends/') && fetched.push(r.url()));
    await open(page, '/discover/');
    await expect(page.getByTestId('trend-source')).toContainText('Trend updates are off');
    await expect(page.getByTestId('drop-title')).toBeVisible();
    expect(fetched).toEqual([]);
  });

  test('pack authors can preview a pack file, checked strictly', async ({ app: page }) => {
    await open(page, '/settings/');
    const input = page.getByTestId('pack-file-input');
    // Not a pack at all.
    await input.setInputFiles({ name: 'nope.json', mimeType: 'application/json', buffer: Buffer.from('{"title":"x"}') });
    await expect(page.getByTestId('pack-problems')).toContainText('version');
    // A pack with a reference this build doesn't have: it loads, with a warning.
    const draft = {
      ...september,
      id: 'draft',
      title: 'Draft Drop',
      templates: [...september.templates, { templateId: 'nope', label: 'x', heat: 1 }],
    };
    await input.setInputFiles({ name: 'draft.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(draft)) });
    await expect(page.getByTestId('pack-problems')).toContainText('unknown template "nope"');
    await page
      .getByRole('navigation', { name: 'Main' })
      .getByRole('link', { name: /Discover/ })
      .first()
      .click();
    await expect(page.getByTestId('drop-title')).toHaveText('Draft Drop');
    await expect(page.getByTestId('drop-header').getByText('Pack file preview')).toBeVisible();
    await page.getByTestId('drop-header').getByRole('button', { name: 'End preview' }).click();
    await expect(page.getByTestId('drop-title')).not.toHaveText('Draft Drop');
  });

  test('the editor’s Trends tool suggests, restyles in one tap and undoes', async ({ app: page }) => {
    await pinDate(page, '2026-09-26T12:00:00');
    await open(page, '/templates/');
    await page.getByRole('button', { name: 'Template Hot Take' }).first().click();
    await page.getByRole('dialog', { name: 'Hot Take' }).getByTestId('template-use').click();
    await expect(page.getByTestId('canvas-viewport')).toBeVisible();

    await page.keyboard.press('r');
    const panel = page.getByTestId('trends-panel');
    await expect(panel).toBeVisible();
    const fonts = panel.getByTestId('trend-suggestion').filter({ hasText: 'Your headline uses Archivo' });
    await expect(fonts).toBeVisible();
    await expect(panel.getByTestId('kit-row')).toHaveCount(4);

    await panel.getByRole('button', { name: 'Restyle as Soft Journal' }).click();
    await expect(page.getByText('Restyled as Soft Journal')).toBeVisible();
    // The headline is now set in a trending pairing, so that suggestion is gone.
    await expect(fonts).toHaveCount(0);
    await page.keyboard.press('ControlOrMeta+z');
    await expect(fonts).toBeVisible();

    // One part at a time: a palette.
    await panel.getByRole('button', { name: 'Recolour with Acid Mint' }).click();
    await expect(page.getByText('Acid Mint colours applied')).toBeVisible();
    await expect(page.getByTestId('save-indicator')).toHaveAttribute('data-state', 'saved', { timeout: 10_000 });
  });

  test('trend filters, stickers and layout rules work in the editor', async ({ app: page }) => {
    await pinDate(page, '2026-09-26T12:00:00');
    await open(page, '/');
    await page.getByRole('button', { name: /^New Post:/ }).click();
    await page.getByTestId('create-project').click();
    await expect(page.getByTestId('canvas-viewport')).toBeVisible();

    // A drop's own filter, on a photo (its recipe travels with the photo).
    await page.getByRole('button', { name: 'Photos', exact: true }).first().click();
    await page
      .getByTestId('photo-input')
      .setInputFiles({ name: 'p.png', mimeType: 'image/png', buffer: await makePng(page, 'subject') });
    await expect(page.getByTestId('selection-frame')).toBeVisible();
    const picker = page.getByTestId('look-picker').first();
    await expect(picker.getByTestId('trend-looks-label')).toContainText('Trending · September Drop');
    await picker.getByRole('radio', { name: 'Honey Hour' }).click();
    await expect(picker.getByRole('radio', { name: 'Honey Hour' })).toHaveAttribute('aria-checked', 'true');

    // A drop's own sticker art.
    await page.getByRole('button', { name: 'Stickers', exact: true }).first().click();
    await page.getByTestId('stickers-panel').getByRole('button', { name: '✦ September Drop' }).click();
    await page.getByRole('button', { name: 'Add Paper Plane sticker' }).click();
    await page.getByRole('tab', { name: 'Layers' }).click();
    await expect(page.getByTestId('layers-panel').getByText('Paper Plane')).toBeVisible();
    await expect(page.getByTestId('save-indicator')).toHaveAttribute('data-state', 'saved', { timeout: 10_000 });

    // Both survive a reload (they're in the design, not in the pack).
    await page.reload();
    await page.getByRole('tab', { name: 'Layers' }).click();
    await expect(page.getByTestId('layers-panel').getByText('Paper Plane')).toBeVisible();

    // A layout rule, run on photos from the library.
    await open(page, '/discover/');
    await page
      .getByTestId('layout-rule-card')
      .filter({ hasText: 'Notebook Dump' })
      .getByRole('button', { name: 'Try with my photos' })
      .click();
    const dialog = page.getByRole('dialog', { name: 'Smart photo dump' });
    await page.getByTestId('flow-photo-input').setInputFiles(await photoFiles(page, 3));
    await expect(page.getByTestId('photo-chooser').getByRole('checkbox', { checked: true })).toHaveCount(3, { timeout: 20_000 });
    await page.getByTestId('flow-next').click();
    await expect(dialog.getByRole('radio', { name: /Notebook Dump/ })).toHaveAttribute('aria-checked', 'true');
    await dialog.getByTestId('flow-create').click();
    await expect(page.getByRole('textbox', { name: 'Project name' })).toHaveValue('Notebook Dump');
  });

  test('meme and social formats are real templates', async ({ app: page }) => {
    await open(page, '/templates/');
    for (const name of ['Tier List', 'Nah / Yeah', 'Starter Pack', 'Thread', 'Text Post Card', 'Rate My…']) {
      await expect(page.getByRole('button', { name: `Template ${name}` }).first()).toBeVisible();
    }
    await page.getByRole('button', { name: 'Template Tier List' }).first().click();
    await page.getByRole('dialog', { name: 'Tier List' }).getByTestId('template-use').click();
    await expect(page.getByTestId('canvas-viewport')).toBeVisible();
  });
});

test.describe('trends feed (desktop)', () => {
  test.skip(({ isMobile }) => isMobile, 'Phones are covered below');
  // Going offline makes the browser log the failed trend requests.
  test.use({ ignoreErrors: [/Failed to load resource/] });

  test('new drops arrive from the feed without a new build, and the last one works offline', async ({ app: page }) => {
    await pinDate(page, '2026-09-26T12:00:00');
    await serveFeed(page);
    await open(page, '/discover/');
    await expect(page.getByTestId('drop-title')).toHaveText('Test Drop');
    await expect(page.getByTestId('trend-source')).toContainText('Checked for new drops');

    // Offline: the feed is unreachable, the downloaded drop is still here.
    await page.unrouteAll();
    await page.route('**/trends/**', (r) => r.abort('internetdisconnected'));
    await open(page, '/discover/');
    await expect(page.getByTestId('drop-title')).toHaveText('Test Drop');
    await expect(page.getByTestId('trend-source')).toContainText('Offline — showing the newest drop saved on this device');
  });
});

test.describe('trends (phone)', () => {
  test.skip(({ isMobile }) => !isMobile, 'Touch layout only');

  test('Discover and the Trends tool on a phone', async ({ app: page }) => {
    await pinDate(page, '2026-09-26T12:00:00');
    await open(page, '/discover/');
    await expect(page.getByTestId('drop-title')).toHaveText('September Drop');
    await expect(page.getByTestId('trend-categories')).toBeVisible();
    await expect(page.getByTestId('kit-card').first()).toBeVisible();

    await open(page, '/');
    await page.getByRole('button', { name: /^New Post:/ }).tap();
    await page.getByTestId('create-project').tap();
    await expect(page.getByTestId('canvas-viewport')).toBeVisible();
    await page.getByRole('button', { name: 'Trends', exact: true }).tap();
    const panel = page.getByTestId('mobile-sheet').getByTestId('trends-panel');
    await expect(panel).toBeVisible();
    await panel.getByRole('button', { name: 'Recolour with Acid Mint' }).tap();
    await expect(page.getByText('Acid Mint colours applied')).toBeVisible();
  });
});
