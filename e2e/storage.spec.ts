import { readFile } from 'node:fs/promises';
import type { Browser, Download, Page } from '@playwright/test';
import { createCarousel, expect, frameBox, open, scenePixel, test } from './fixtures';

/**
 * Offline storage: version history, folders, project files, backups, the
 * Storage settings, two tabs editing at once, and running out of space.
 */

async function newPost(page: Page) {
  await open(page, '/');
  await page.getByRole('button', { name: /^New Post:/ }).click();
  await page.getByTestId('create-project').click();
  await expect(page.getByTestId('canvas-viewport')).toBeVisible();
}

let textRow = 0;
/** Places a text with the text tool and types into it. */
async function addText(page: Page, text: string) {
  await page.keyboard.press('Escape');
  await page.keyboard.press('t');
  const vp = (await page.getByTestId('canvas-viewport').boundingBox())!;
  await page.mouse.click(vp.x + vp.width / 2, vp.y + vp.height * (0.25 + 0.12 * (textRow++ % 5)));
  await page.keyboard.type(text);
  await page.keyboard.press('Escape');
  await page.keyboard.press('Escape');
}

const saved = (page: Page) =>
  expect(page.getByTestId('save-indicator')).toHaveAttribute('data-state', 'saved', { timeout: 10_000 });

async function layers(page: Page) {
  const tab = page.getByRole('tab', { name: 'Layers' });
  if ((await tab.getAttribute('aria-selected')) !== 'true') await tab.click();
  return page.getByTestId('layers-panel');
}

/** Blue photo, painted in the page. */
async function photo(page: Page) {
  const data = await page.evaluate(() => {
    const c = document.createElement('canvas');
    c.width = 800;
    c.height = 1000;
    const x = c.getContext('2d')!;
    x.fillStyle = '#2F6BD8';
    x.fillRect(0, 0, 800, 1000);
    return c.toDataURL('image/png').split(',')[1]!;
  });
  return { name: 'sky.png', mimeType: 'image/png', buffer: Buffer.from(data, 'base64') };
}

/** Entry names of a stored ZIP. */
function zipNames(b: Buffer): string[] {
  const end = b.length - 22;
  const count = b.readUInt16LE(end + 10);
  let p = b.readUInt32LE(end + 16);
  const names: string[] = [];
  for (let i = 0; i < count; i++) {
    const nameLength = b.readUInt16LE(p + 28);
    names.push(b.subarray(p + 46, p + 46 + nameLength).toString('utf8'));
    p += 46 + nameLength;
  }
  return names;
}

/** A second, empty browser profile — "another device". Collects its errors too. */
async function otherDevice(browser: Browser) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await context.addInitScript(() => {
    if (!localStorage.getItem('stardeck.settings')) {
      localStorage.setItem('stardeck.settings', JSON.stringify({ state: { onboarded: true }, version: 1 }));
    }
  });
  const page = await context.newPage();
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  return { context, page, errors };
}

const read = async (download: Download) => readFile((await download.path())!);

test.describe('storage (desktop)', () => {
  test.skip(({ isMobile }) => isMobile, 'Phones are covered below');

  test('version history: Ctrl+S keeps a version, name one, restore an earlier one and undo it', async ({ app: page }) => {
    await newPost(page);
    await addText(page, 'First draft');
    await saved(page);
    await page.keyboard.press('ControlOrMeta+s');
    await expect(page.getByText('This version is kept in History.')).toBeVisible();

    await addText(page, 'Second thought');
    await saved(page);
    await page.getByTestId('open-history').click();
    const dialog = page.getByRole('dialog', { name: 'Version history' });
    await expect(dialog).toBeVisible();
    const rows = dialog.getByTestId('version-row');
    await expect(rows).toHaveCount(2);
    await expect(rows.nth(0)).toContainText('Saved version');
    await expect(rows.nth(1)).toContainText('When you opened it');

    // Name the current design.
    await dialog.getByLabel('Version name').fill('Final ✦');
    await dialog.getByTestId('save-version').click();
    await expect(rows).toHaveCount(3);
    await expect(rows.nth(0)).toContainText('Final ✦');

    // Restore the Ctrl+S version: one undo step, and the current design is kept first.
    await rows.filter({ hasText: 'Saved version' }).click();
    await expect(dialog.getByTestId('version-preview')).toContainText('Saved version');
    await dialog.getByTestId('restore-version').click();
    await expect(dialog).toBeHidden();
    await expect(page.getByText(/^Restored the .* version$/)).toBeVisible();
    const panel = await layers(page);
    await expect(panel.getByText('First draft')).toBeVisible();
    await expect(panel.getByText('Second thought')).toBeHidden();

    await page.keyboard.press('ControlOrMeta+z');
    await expect(panel.getByText('Second thought')).toBeVisible();
    await saved(page);

    // History survives a reload; renaming and deleting versions works.
    await page.reload();
    await expect(page.getByTestId('canvas-viewport')).toBeVisible();
    await page.getByTestId('open-history').click();
    await expect(rows.first()).toBeVisible();
    await expect(rows.filter({ hasText: 'Final ✦' })).toHaveCount(1);
    await rows.filter({ hasText: 'Final ✦' }).click();
    await dialog.getByRole('button', { name: 'Rename version' }).click();
    await dialog.getByLabel('Rename version').fill('Launch cut');
    await dialog.getByRole('button', { name: 'Save name' }).click();
    await expect(rows.filter({ hasText: 'Launch cut' })).toHaveCount(1);
    const before = await rows.count();
    await dialog.getByRole('button', { name: 'Delete version' }).click();
    await page.getByRole('dialog', { name: 'Delete this version?' }).getByRole('button', { name: 'Delete version' }).click();
    await expect(rows).toHaveCount(before - 1);
    await expect(rows.filter({ hasText: 'Launch cut' })).toHaveCount(0);
  });

  test('folders: create, move by menu and by dragging, filter, edit and delete (projects stay)', async ({ app: page }) => {
    await createCarousel(page, 2);
    await page.getByRole('link', { name: 'Back to home' }).click();
    await newPost(page);
    await open(page, '/projects/');
    await expect(page.getByTestId('project-card')).toHaveCount(2);

    await page.getByRole('button', { name: 'New folder' }).click();
    const create = page.getByRole('dialog', { name: 'New folder' });
    await create.getByLabel('Folder name').fill('Client work');
    await create.getByRole('radio', { name: 'Pink' }).click();
    await create.getByTestId('folder-save').click();
    const folders = page.getByRole('group', { name: 'Folders' });
    const chip = folders.getByRole('button', { name: /^Client work/ });
    await expect(chip).toBeVisible();

    // Move the carousel with its menu.
    const carousel = page.getByTestId('project-card').filter({ hasText: /^Carousel/ });
    await carousel.getByRole('button', { name: /^Actions for/ }).click();
    await page.getByRole('menuitem', { name: 'Move to folder…' }).click();
    const move = page.getByRole('dialog', { name: /^Move “/ });
    await move.getByRole('radio', { name: 'Client work' }).click();
    await move.getByTestId('move-confirm').click();
    await expect(page.getByText(/^Moved “Carousel.*” to Client work$/)).toBeVisible();
    await expect(carousel).toContainText('Client work');

    // Drag the post onto the folder.
    const post = page.getByTestId('project-card').filter({ hasText: /^Post/ });
    await post.getByRole('link').dragTo(chip);
    await expect(page.getByText(/^Moved “Post.*” to Client work$/)).toBeVisible();

    await chip.click();
    await expect(chip).toHaveAttribute('aria-pressed', 'true');
    await expect(page).toHaveURL(/folder=fld_/);
    await expect(page.getByTestId('folder-header')).toContainText('Client work');
    await expect(page.getByTestId('project-card')).toHaveCount(2);

    // Survives a reload.
    await page.reload();
    await expect(page.getByTestId('folder-header')).toContainText('Client work');

    await page.getByRole('button', { name: 'Edit folder' }).click();
    const edit = page.getByRole('dialog', { name: 'Edit folder' });
    await edit.getByLabel('Folder name').fill('Brands');
    await edit.getByTestId('folder-save').click();
    await expect(folders.getByRole('button', { name: /^Brands/ })).toBeVisible();

    await page.getByRole('button', { name: 'Delete folder' }).click();
    await page
      .getByRole('dialog', { name: /^Delete the folder/ })
      .getByRole('button', { name: 'Delete folder' })
      .click();
    await expect(page.getByText('Folder deleted')).toBeVisible();
    await expect(folders.getByRole('button', { name: /^Brands/ })).toHaveCount(0);
    await expect(page.getByTestId('project-card')).toHaveCount(2);
  });

  test('project files carry a design and its photos to another device', async ({ app: page, browser }) => {
    await newPost(page);
    await page.getByTestId('photo-input').setInputFiles(await photo(page));
    await expect(page.getByTestId('selection-frame')).toBeVisible();
    await saved(page);
    await page.getByTestId('editor-more').click();
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.getByRole('menuitem', { name: 'Download project file' }).click(),
    ]);
    expect(download.suggestedFilename()).toMatch(/^post-.+\.stardeck$/);
    const bytes = await read(download);
    const names = zipNames(bytes);
    expect(names[0]).toBe('stardeck.json');
    expect(names.some((n) => /^projects\/prj_.+\.json$/.test(n))).toBe(true);
    expect(names.filter((n) => /^assets\/as_[^/]+\/(original|preview|thumb)\.\w+$/.test(n))).toHaveLength(3);
    await expect(page.getByText(/includes 1 photo/)).toBeVisible();

    const device = await otherDevice(browser);
    try {
      await open(device.page, '/projects/');
      await expect(device.page.getByRole('heading', { name: 'No designs yet 👀' })).toBeVisible();
      await device.page
        .getByTestId('project-file-input')
        .setInputFiles({ name: download.suggestedFilename(), mimeType: 'application/zip', buffer: bytes });
      await expect(device.page.getByText('Added 1 design, 1 photo')).toBeVisible();
      const card = device.page.getByTestId('project-card');
      await expect(card).toHaveCount(1);
      await card.getByRole('link').click();
      await expect(device.page.getByTestId('canvas-viewport')).toBeVisible();
      // The photo came along: the middle of the design is the blue photo.
      const vp = (await device.page.getByTestId('canvas-viewport').boundingBox())!;
      await expect
        .poll(async () => (await scenePixel(device.page, { x: vp.x + vp.width / 2, y: vp.y + vp.height / 2 }))[2]!, {
          timeout: 15_000,
        })
        .toBeGreaterThan(150);

      // Opening the same file again adds nothing.
      await open(device.page, '/projects/');
      await device.page
        .getByTestId('project-file-input')
        .setInputFiles({ name: 'again.stardeck', mimeType: 'application/zip', buffer: bytes });
      await expect(device.page.getByText('Everything in that file is already here')).toBeVisible();
      await expect(device.page.getByTestId('project-card')).toHaveCount(1);

      // Not a Stardeck file: a friendly refusal.
      await device.page
        .getByTestId('project-file-input')
        .setInputFiles({ name: 'photo.zip', mimeType: 'application/zip', buffer: Buffer.from('nope') });
      await expect(device.page.getByText('Couldn’t open photo.zip')).toBeVisible();
      expect(device.errors).toEqual([]);
    } finally {
      await device.context.close();
    }
  });

  test('back up everything and restore it on another device', async ({ app: page, browser }) => {
    await newPost(page);
    await addText(page, 'Backed up ✦');
    await saved(page);
    await page.getByTestId('open-history').click();
    const history = page.getByRole('dialog', { name: 'Version history' });
    await history.getByLabel('Version name').fill('Keeper');
    await history.getByTestId('save-version').click();
    await expect(history.getByTestId('version-row').filter({ hasText: 'Keeper' })).toBeVisible();
    await page.keyboard.press('Escape');

    await open(page, '/projects/');
    await page.getByRole('button', { name: 'New folder' }).click();
    await page.getByRole('dialog', { name: 'New folder' }).getByLabel('Folder name').fill('Archive');
    await page.getByRole('dialog', { name: 'New folder' }).getByTestId('folder-save').click();
    const card = page.getByTestId('project-card').first();
    await card.getByRole('button', { name: /^Actions for/ }).click();
    await page.getByRole('menuitem', { name: 'Move to folder…' }).click();
    await page
      .getByRole('dialog', { name: /^Move “/ })
      .getByRole('radio', { name: 'Archive' })
      .click();
    await page.getByTestId('move-confirm').click();
    await expect(page.getByText(/^Moved “.*” to Archive$/)).toBeVisible();

    await open(page, '/settings/');
    const [download] = await Promise.all([page.waitForEvent('download'), page.getByTestId('backup-all').click()]);
    expect(download.suggestedFilename()).toMatch(/^stardeck-backup-\d{4}-\d\d-\d\d\.stardeck$/);
    await expect(page.getByText('Backup saved')).toBeVisible();
    const bytes = await read(download);

    const device = await otherDevice(browser);
    try {
      await open(device.page, '/settings/');
      await device.page
        .getByTestId('restore-input')
        .setInputFiles({ name: download.suggestedFilename(), mimeType: 'application/zip', buffer: bytes });
      await expect(device.page.getByText('Added 1 design, 1 folder')).toBeVisible();
      await expect(device.page.getByTestId('storage-usage')).toBeVisible();

      await open(device.page, '/projects/?folder=all');
      const chip = device.page.getByRole('group', { name: 'Folders' }).getByRole('button', { name: /^Archive/ });
      await expect(chip).toContainText('1');
      await device.page.getByTestId('project-card').getByRole('link').click();
      await expect(device.page.getByTestId('canvas-viewport')).toBeVisible();
      await expect((await layers(device.page)).getByText('Backed up ✦')).toBeVisible();
      await device.page.getByTestId('open-history').click();
      await expect(
        device.page.getByRole('dialog', { name: 'Version history' }).getByTestId('version-row').filter({ hasText: 'Keeper' }),
      ).toBeVisible();
      expect(device.errors).toEqual([]);
    } finally {
      await device.context.close();
    }
  });

  test('two tabs stay in step, and a clash asks before overwriting', async ({ app: page, context }) => {
    await newPost(page);
    await addText(page, 'Tab A');
    await expect((await layers(page)).getByText('Tab A')).toBeVisible();
    await saved(page);

    const other = await context.newPage();
    const list = await context.newPage();
    await open(list, '/projects/');
    await other.goto(page.url());
    await expect(other.getByTestId('canvas-viewport')).toBeVisible();
    await expect((await layers(other)).getByText('Tab A')).toBeVisible();

    // An edit in the other tab shows up here.
    await addText(other, 'From tab B');
    await saved(other);
    await expect(page.getByText('Updated with changes from another tab')).toBeVisible();
    await expect((await layers(page)).getByText('From tab B')).toBeVisible();

    // Renames reach the projects list in a third tab.
    await page.getByLabel('Project name').fill('Synced ✦');
    await page.getByLabel('Project name').press('Enter');
    await expect(list.getByRole('link', { name: 'Synced ✦' })).toBeVisible();

    // Mid-drag here while the other tab saves: nothing is overwritten until we choose.
    const panel = await layers(page);
    await panel.getByText('Tab A').click();
    const f = await frameBox(page);
    await page.mouse.move(f.cx, f.cy);
    await page.mouse.down();
    await page.mouse.move(f.cx + 40, f.cy + 30, { steps: 4 });
    await addText(other, 'Again B');
    await saved(other);
    const alert = page.getByTestId('editor-alert');
    await expect(alert).toContainText('This design was changed in another tab');
    await page.mouse.up();
    // Our drag isn't saved over theirs while the question is open.
    await expect(page.getByTestId('save-indicator')).toHaveAttribute('data-state', 'dirty');
    await alert.getByTestId('conflict-theirs').click();
    await expect(alert).toBeHidden();
    await expect(panel.getByText('Again B')).toBeVisible();
    await other.close();
    await list.close();
  });

  test('Settings → Storage shows what’s stored and clears version history', async ({ app: page }) => {
    await newPost(page);
    await addText(page, 'Counted');
    await saved(page);
    await page.keyboard.press('ControlOrMeta+s');
    await expect(page.getByText('This version is kept in History.')).toBeVisible();

    await open(page, '/settings/');
    const usage = page.getByTestId('storage-usage');
    await expect(usage).toContainText('Designs');
    await expect(usage).toContainText('Version history');
    const row = page.locator('#storage').getByText(/^\d+ versions? ·/);
    await expect(row).toContainText('2 versions');
    await expect(page.getByRole('button', { name: 'Empty trash' })).toBeDisabled();
    await page.locator('#storage').getByRole('button', { name: 'Clear', exact: true }).click();
    await page.getByRole('dialog', { name: 'Clear version history?' }).getByRole('button', { name: 'Clear history' }).click();
    await expect(page.getByText('Cleared 2 versions')).toBeVisible();
    await expect(row).toContainText('0 versions');
  });

  test('a full device never loses work: a rescue copy, then saving resumes', async ({ app: page }) => {
    // Simulate a full disk: IndexedDB writes to the documents store fail while the flag is set.
    await page.addInitScript(() => {
      const put = IDBObjectStore.prototype.put;
      IDBObjectStore.prototype.put = function (this: IDBObjectStore, ...args: Parameters<typeof put>) {
        if ((window as unknown as { __diskFull?: boolean }).__diskFull && this.name === 'documents') {
          throw new DOMException('The quota has been exceeded.', 'QuotaExceededError');
        }
        return put.apply(this, args);
      };
    });
    await newPost(page);
    await saved(page);
    await page.evaluate(() => ((window as unknown as { __diskFull: boolean }).__diskFull = true));
    await addText(page, 'Unsaved idea');
    const alert = page.getByTestId('editor-alert');
    await expect(alert).toContainText('Your device is out of space');
    await expect(page.getByTestId('save-indicator')).toHaveAttribute('data-state', 'error');

    const [download] = await Promise.all([
      page.waitForEvent('download'),
      alert.getByRole('button', { name: 'Download a copy' }).click(),
    ]);
    expect(download.suggestedFilename()).toMatch(/\.stardeck$/);
    const entry = zipNames(await read(download)).find((n) => n.startsWith('projects/'))!;
    expect(entry).toBeTruthy();
    // The rescue copy has the unsaved edit in it.
    expect((await read(download)).toString('utf8')).toContain('Unsaved idea');

    await page.evaluate(() => ((window as unknown as { __diskFull: boolean }).__diskFull = false));
    await alert.getByRole('button', { name: 'Try again' }).click();
    await saved(page);
    await expect(alert).toBeHidden();
    await page.reload();
    await expect((await layers(page)).getByText('Unsaved idea')).toBeVisible();
  });
});

test.describe('storage (phone)', () => {
  test.skip(({ isMobile }) => !isMobile, 'Phone flow');

  test('version history and project files from the More menu; folders on the projects screen', async ({ app: page }) => {
    await newPost(page);
    await page.getByTestId('editor-more').click();
    await page.getByRole('menuitem', { name: 'Save a version' }).click();
    await expect(page.getByText(/^(Version saved|Already saved)$/)).toBeVisible();
    await page.getByTestId('editor-more').click();
    await page.getByRole('menuitem', { name: 'Version history' }).click();
    const dialog = page.getByRole('dialog', { name: 'Version history' });
    await expect(dialog.getByTestId('version-current')).toBeVisible();
    await page.keyboard.press('Escape');

    await open(page, '/projects/');
    await page.getByRole('button', { name: 'New folder' }).click();
    await page.getByRole('dialog', { name: 'New folder' }).getByLabel('Folder name').fill('Phone pics');
    await page.getByRole('dialog', { name: 'New folder' }).getByTestId('folder-save').click();
    const card = page.getByTestId('project-card').first();
    await card.getByRole('button', { name: /^Actions for/ }).click();
    await page.getByRole('menuitem', { name: 'Move to folder…' }).click();
    await page
      .getByRole('dialog', { name: /^Move “/ })
      .getByRole('radio', { name: 'Phone pics' })
      .click();
    await page.getByTestId('move-confirm').click();
    await page
      .getByRole('group', { name: 'Folders' })
      .getByRole('button', { name: /^Phone pics/ })
      .click();
    await expect(page.getByTestId('project-card')).toHaveCount(1);
    await expect(page.getByTestId('folder-header')).toContainText('Phone pics');
  });
});
