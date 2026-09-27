import fs from 'node:fs';
import path from 'node:path';
import type { Page } from '@playwright/test';
import { expect, makePng, open, test } from './fixtures';

/** Opens a new single-slide post in the editor. */
async function newPost(page: Page) {
  await open(page, '/');
  await page.getByRole('button', { name: /^New Post:/ }).click();
  await page.getByTestId('create-project').click();
  await expect(page.getByTestId('canvas-viewport')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Undo' })).toBeVisible();
}

const field = (page: Page, label: string) => page.getByRole('textbox', { name: label, exact: true });

/** Waits until an element stops moving (e.g. while a side panel animates open and shifts the canvas). */
async function settle(page: Page, testId: string) {
  let prev: { x: number; y: number } | null = null;
  for (let i = 0; i < 40; i++) {
    const box = await page.getByTestId(testId).boundingBox();
    if (box && prev && Math.abs(box.x - prev.x) < 0.5 && Math.abs(box.y - prev.y) < 0.5) return;
    prev = box;
    await page.waitForTimeout(50);
  }
}

async function addRectangle(page: Page) {
  await page.getByRole('button', { name: 'Shapes', exact: true }).first().click();
  await page.getByRole('button', { name: 'Add Rectangle' }).click();
  await expect(page.getByTestId('selection-frame')).toBeVisible();
  await settle(page, 'selection-frame');
}

async function frameCenter(page: Page) {
  const box = (await page.getByTestId('selection-frame').boundingBox())!;
  return { x: box.x + box.width / 2, y: box.y + box.height / 2, box };
}

async function drag(page: Page, from: { x: number; y: number }, to: { x: number; y: number }, modifiers: string[] = []) {
  for (const m of modifiers) await page.keyboard.down(m);
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(to.x, to.y, { steps: 8 });
  await page.mouse.up();
  for (const m of modifiers) await page.keyboard.up(m);
}

test.describe('canvas editor (desktop)', () => {
  test.skip(({ isMobile }) => isMobile, 'Mouse-driven editing; phones are covered below');

  test('adds text from the text panel and edits it in place', async ({ app: page }) => {
    await newPost(page);
    await page.getByRole('button', { name: 'Text', exact: true }).first().click();
    await page.getByTestId('text-panel').getByRole('button', { name: 'Add a heading' }).click();
    await expect(page.getByTestId('properties-panel')).toBeVisible();

    const { x, y } = await frameCenter(page);
    await page.mouse.dblclick(x, y);
    const editor = page.getByRole('textbox', { name: 'Edit text' });
    await expect(editor).toBeFocused();
    await page.keyboard.type('Hello Stardeck');
    await page.keyboard.press('Escape');
    await expect(editor).toBeHidden();

    await page.getByRole('tab', { name: 'Layers' }).click();
    await expect(page.getByTestId('layers-panel').getByText('Hello Stardeck')).toBeVisible();

    // Typing is a single undo step.
    await page.keyboard.press('ControlOrMeta+z');
    await expect(page.getByTestId('layers-panel').getByText('Add a heading')).toBeVisible();
  });

  test('text tool: click to place and type straight away', async ({ app: page }) => {
    await newPost(page);
    await page.keyboard.press('t');
    const vp = (await page.getByTestId('canvas-viewport').boundingBox())!;
    await page.mouse.click(vp.x + vp.width / 2, vp.y + vp.height / 3);
    await expect(page.getByRole('textbox', { name: 'Edit text' })).toBeFocused();
    await page.keyboard.type('Placed here');
    await page.keyboard.press('Escape');
    await page.getByRole('tab', { name: 'Layers' }).click();
    await expect(page.getByTestId('layers-panel').getByText('Placed here')).toBeVisible();
  });

  test('moves with the mouse (one undo step) and snaps to the slide centre', async ({ app: page }) => {
    await newPost(page);
    await addRectangle(page);
    const x0 = Number(await field(page, 'X').inputValue());
    const { x, y } = await frameCenter(page);
    await drag(page, { x, y }, { x: x - 120, y: y + 40 });
    const x1 = Number(await field(page, 'X').inputValue());
    expect(x1).toBeLessThan(x0);

    await page.keyboard.press('ControlOrMeta+z');
    await expect(field(page, 'X')).toHaveValue(String(x0));

    // Dragging near the centre snaps it exactly back to centre.
    const c = await frameCenter(page);
    await drag(page, c, { x: c.x + 3, y: c.y });
    await expect(field(page, 'X')).toHaveValue(String(x0));
  });

  test('resizes and rotates with handles', async ({ app: page }) => {
    await newPost(page);
    await addRectangle(page);
    const w0 = Number(await field(page, 'Width').inputValue());
    const se = (await page.locator('[data-handle="se"]').boundingBox())!;
    await drag(page, { x: se.x + se.width / 2, y: se.y + se.height / 2 }, { x: se.x + 90, y: se.y + 60 });
    expect(Number(await field(page, 'Width').inputValue())).toBeGreaterThan(w0);

    const rot = (await page.locator('[data-handle="rotate"] circle').boundingBox())!;
    const { x, y } = await frameCenter(page);
    await drag(page, { x: rot.x + rot.width / 2, y: rot.y + rot.height / 2 }, { x: x + 200, y }, ['Shift']);
    await expect(field(page, 'Rotation')).toHaveValue('90');
  });

  test('keyboard: nudge, duplicate, group, delete', async ({ app: page }) => {
    await newPost(page);
    await addRectangle(page);
    const x0 = Number(await field(page, 'X').inputValue());
    await page.keyboard.press('ArrowRight');
    await expect(field(page, 'X')).toHaveValue(String(x0 + 1));
    await page.keyboard.press('Shift+ArrowRight');
    await expect(field(page, 'X')).toHaveValue(String(x0 + 11));

    await page.keyboard.press('ControlOrMeta+d');
    await page.getByRole('tab', { name: 'Layers' }).click();
    const layers = page.getByTestId('layers-panel').getByRole('button', { name: /^Rectangle$/ });
    await expect(layers).toHaveCount(2);

    await page.keyboard.press('ControlOrMeta+a');
    await page.keyboard.press('ControlOrMeta+g');
    await page.getByRole('tab', { name: 'Design' }).click();
    await expect(page.getByRole('button', { name: 'Ungroup' })).toBeVisible();
    await page.keyboard.press('ControlOrMeta+Shift+g');
    await expect(page.getByRole('button', { name: 'Group', exact: true })).toBeVisible();

    await page.keyboard.press('Delete');
    await page.getByRole('tab', { name: 'Layers' }).click();
    await expect(page.getByText('No layers yet')).toBeVisible();
  });

  test('marquee selects several elements; context menu duplicates', async ({ app: page }) => {
    await newPost(page);
    await addRectangle(page);
    await page.getByRole('button', { name: 'Add Circle' }).click();
    await page.keyboard.press('Escape');
    const vp = (await page.getByTestId('canvas-viewport').boundingBox())!;
    await drag(page, { x: vp.x + 30, y: vp.y + 30 }, { x: vp.x + vp.width - 30, y: vp.y + vp.height - 30 });
    await expect(page.getByTestId('properties-panel').getByText('2 selected')).toBeVisible();

    const { x, y } = await frameCenter(page);
    await page.mouse.click(x, y, { button: 'right' });
    await page.getByRole('menuitem', { name: 'Duplicate' }).click();
    await page.getByRole('tab', { name: 'Layers' }).click();
    await expect(page.getByTestId('layers-panel').locator('li')).toHaveCount(4);
  });

  test('copy & paste through the clipboard', async ({ app: page, context }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await newPost(page);
    await addRectangle(page);
    const { x, y } = await frameCenter(page);
    await page.mouse.click(x, y, { button: 'right' });
    await page.getByRole('menuitem', { name: 'Copy' }).click();
    await page.mouse.click(x, y, { button: 'right' });
    await page.getByRole('menuitem', { name: 'Paste' }).click();
    await page.getByRole('tab', { name: 'Layers' }).click();
    await expect(page.getByTestId('layers-panel').locator('li')).toHaveCount(2);
  });

  test('stickers, layers lock and properties', async ({ app: page }) => {
    await newPost(page);
    await page.getByRole('button', { name: 'Stickers', exact: true }).first().click();
    await page.getByRole('textbox', { name: 'Search stickers' }).fill('heart');
    await page.getByRole('button', { name: 'Add Heart sticker' }).click();
    await expect(page.getByTestId('properties-panel').getByText('Heart', { exact: true })).toBeVisible();

    await field(page, 'Rotation').fill('15');
    await field(page, 'Rotation').press('Enter');
    await expect(field(page, 'Rotation')).toHaveValue('15');

    await page.getByRole('tab', { name: 'Layers' }).click();
    await page.getByRole('button', { name: 'Lock Heart' }).click();
    await expect(page.getByRole('button', { name: 'Unlock Heart' })).toHaveAttribute('aria-pressed', 'true');
    await page.getByRole('tab', { name: 'Design' }).click();
    await expect(page.getByText('Locked items can’t be moved or edited.')).toBeVisible();
  });

  test('pans and zooms the canvas; rulers create guides', async ({ app: page }) => {
    await newPost(page);
    const zoom = page.getByTestId('zoom-menu');
    const before = await zoom.textContent();
    const vp = (await page.getByTestId('canvas-viewport').boundingBox())!;
    await page.mouse.move(vp.x + vp.width / 2, vp.y + vp.height / 2);
    await page.keyboard.down('Control');
    await page.mouse.wheel(0, -300);
    await page.keyboard.up('Control');
    await expect(zoom).not.toHaveText(before!);
    await page.keyboard.press('Shift+1');
    await expect(zoom).toHaveText(before!);

    await page.keyboard.press('Shift+r');
    await drag(page, { x: vp.x + vp.width / 2, y: vp.y + 10 }, { x: vp.x + vp.width / 2, y: vp.y + vp.height / 2 });
    await expect(page.locator('[data-guide="y"]')).toHaveCount(1);
  });

  test('edits survive a reload (autosave)', async ({ app: page }) => {
    await newPost(page);
    await addRectangle(page);
    await field(page, 'Width').fill('333');
    await field(page, 'Width').press('Enter');
    await expect(page.getByTestId('save-indicator')).toHaveAttribute('data-state', 'saved', { timeout: 5000 });
    await page.reload();
    await page.getByRole('tab', { name: 'Layers' }).click();
    await page.getByTestId('layers-panel').getByRole('button', { name: 'Rectangle', exact: true }).click();
    await page.getByRole('tab', { name: 'Design' }).click();
    await expect(field(page, 'Width')).toHaveValue('333');
  });
});

test.describe('curved text (desktop)', () => {
  test.skip(({ isMobile }) => isMobile, 'Properties panel on desktop');

  test('arc, wave, bulge and rise; the box grows to hold the curve; undo straightens it', async ({ app: page }) => {
    await newPost(page);
    await page.getByRole('button', { name: 'Text', exact: true }).first().click();
    await page.getByRole('button', { name: 'Add a heading' }).click();
    const frame = page.getByTestId('selection-frame');
    const straight = (await frame.boundingBox())!.height;
    const warps = page.getByRole('radiogroup', { name: 'Text warp' });
    await expect(warps.getByRole('radio', { name: 'None' })).toHaveAttribute('aria-checked', 'true');

    await warps.getByRole('radio', { name: 'Arc' }).click();
    await expect.poll(async () => (await frame.boundingBox())!.height).toBeGreaterThan(straight * 1.2);
    const bend = page.getByRole('slider', { name: 'Curve bend' });
    await bend.focus();
    await page.keyboard.press('End');
    await expect(page.getByText('Bend · +100')).toBeVisible();
    const arched = (await frame.boundingBox())!.height;
    expect(arched).toBeGreaterThan(straight * 1.5);

    for (const style of ['Wave', 'Bulge', 'Rise']) {
      await warps.getByRole('radio', { name: style }).click();
      await expect(warps.getByRole('radio', { name: style })).toHaveAttribute('aria-checked', 'true');
      await expect(page.getByRole('slider', { name: 'Warp strength' })).toBeVisible();
    }
    await warps.getByRole('radio', { name: 'None' }).click();
    await expect.poll(async () => (await frame.boundingBox())!.height).toBeLessThan(straight * 1.05);

    // Undo brings the curve back (quick changes to the same control are one undo step).
    await page.keyboard.press('ControlOrMeta+z');
    await expect(warps.getByRole('radio', { name: 'None' })).toHaveAttribute('aria-checked', 'false');
    await expect.poll(async () => (await frame.boundingBox())!.height).toBeGreaterThan(straight * 1.05);
  });
});

test.describe('fonts from this device (desktop)', () => {
  test.skip(({ isMobile }) => isMobile, 'Properties panel on desktop');

  test('adds a font file, uses it, keeps it after a reload, and removes it', async ({ app: page }) => {
    await newPost(page);
    await page.getByRole('button', { name: 'Text', exact: true }).first().click();
    await page.getByRole('button', { name: 'Add a heading' }).click();
    await page.getByRole('button', { name: /^Font: / }).click();

    const file = fs.readFileSync(path.resolve('public/fonts/anton/anton-latin-400-normal.woff2'));
    await page
      .getByTestId('font-upload')
      .setInputFiles({ name: 'HeadlineFont-Regular.woff2', mimeType: 'font/woff2', buffer: file });
    await expect(page.getByText('Added Headline Font')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Font: Headline Font' })).toBeVisible();
    await expect.poll(() => page.evaluate(() => document.fonts.check('32px "Headline Font"'))).toBe(true);

    // Not a font: refused with a reason.
    await page.getByRole('button', { name: 'Font: Headline Font' }).click();
    await page
      .getByTestId('font-upload')
      .setInputFiles({ name: 'notes.woff2', mimeType: 'font/woff2', buffer: Buffer.from('hello') });
    await expect(page.getByText('Couldn’t add that font')).toBeVisible();
    await page.keyboard.press('Escape');

    // After a reload the design still uses it, and it's registered again on demand.
    await page.waitForTimeout(1200); // autosave
    await page.reload();
    await expect(page.getByTestId('canvas-viewport')).toBeVisible();
    await expect.poll(() => page.evaluate(() => document.fonts.check('32px "Headline Font"'))).toBe(true);

    await page.getByRole('tab', { name: 'Layers' }).click();
    await page.getByTestId('layers-panel').getByText('Add a heading').click();
    await page.getByRole('tab', { name: 'Design' }).click();
    const picker = page.getByRole('button', { name: 'Font: Headline Font' });
    await expect(picker).toBeVisible();
    await picker.click();
    await page.getByRole('button', { name: 'Yours', exact: true }).click();
    await expect(page.getByRole('button', { name: /^Headline Font Yours/ })).toBeVisible();
    await page.getByRole('button', { name: 'Remove Headline Font from this device' }).click();
    await page.getByRole('button', { name: 'Remove', exact: true }).click();
    await expect(page.getByText('Headline Font removed')).toBeVisible();
    await expect(page.getByText('Fonts you add show up here.')).toBeVisible();
  });
});

test.describe('photo-filled text (desktop)', () => {
  test.skip(({ isMobile }) => isMobile, 'Properties panel on desktop');

  /** Strongly coloured pixels of the scene inside the selected element's frame (the test photo is vivid; text is dark). */
  async function vividPixels(page: Page): Promise<number> {
    const f = (await page.getByTestId('selection-frame').boundingBox())!;
    return page.evaluate((f) => {
      const c = document.querySelector<HTMLCanvasElement>('[data-testid="scene-canvas"]')!;
      const r = c.getBoundingClientRect();
      const dpr = c.width / r.width;
      const d = c
        .getContext('2d')!
        .getImageData(
          Math.round((f.x - r.left) * dpr),
          Math.round((f.y - r.top) * dpr),
          Math.round(f.width * dpr),
          Math.round(f.height * dpr),
        ).data;
      let n = 0;
      for (let i = 0; i < d.length; i += 4)
        if (Math.max(d[i]!, d[i + 1]!, d[i + 2]!) - Math.min(d[i]!, d[i + 1]!, d[i + 2]!) > 120) n++;
      return n;
    }, f);
  }

  test('a photo shows through the letters, and can be moved, zoomed and switched off', async ({ app: page }) => {
    await newPost(page);
    // A photo in the library (not on the slide).
    await page
      .getByTestId('photo-input')
      .setInputFiles({ name: 'sunset.png', mimeType: 'image/png', buffer: await makePng(page, 'gradient', 900, 600) });
    await expect(page.getByTestId('selection-frame')).toBeVisible();
    await page.keyboard.press('Delete');
    await expect(page.getByTestId('selection-frame')).toBeHidden();

    await page.getByRole('button', { name: 'Text', exact: true }).first().click();
    await page.getByRole('button', { name: 'Add a heading' }).click();
    await settle(page, 'selection-frame');
    expect(await vividPixels(page)).toBe(0);

    const toggle = page.getByRole('switch', { name: 'Photo fill' });
    await toggle.click();
    await expect(toggle).toHaveAttribute('aria-checked', 'true');
    await expect(page.getByRole('button', { name: 'Fill the text with this photo' })).toHaveAttribute('aria-pressed', 'true');
    await expect.poll(() => vividPixels(page), { timeout: 10_000 }).toBeGreaterThan(200);

    const zoom = page.getByRole('slider', { name: 'Photo zoom' });
    await zoom.focus();
    await page.keyboard.press('End');
    await expect(page.getByText('Zoom · 400%')).toBeVisible();
    await page.getByRole('slider', { name: 'Photo position across' }).focus();
    await page.keyboard.press('Home');
    await expect(page.getByText('Across · 0%')).toBeVisible();
    await expect.poll(() => vividPixels(page)).toBeGreaterThan(200);

    await toggle.click();
    await expect(toggle).toHaveAttribute('aria-checked', 'false');
    await expect.poll(() => vividPixels(page)).toBe(0);
    await page.keyboard.press('ControlOrMeta+z');
    await expect(toggle).toHaveAttribute('aria-checked', 'true');
  });
});

test.describe('canvas editor (phone)', () => {
  test.skip(({ isMobile }) => !isMobile, 'Touch layout only');

  test('adds, edits and deselects with the bottom toolbar', async ({ app: page }) => {
    await newPost(page);
    await page.getByRole('navigation', { name: 'Tools' }).getByRole('button', { name: 'Text', exact: true }).click();
    const sheet = page.getByTestId('mobile-sheet');
    await expect(sheet).toBeVisible();
    await sheet.getByRole('button', { name: 'Add a heading' }).click();

    const actions = page.getByRole('navigation', { name: 'Selection actions' });
    await expect(actions).toBeVisible();
    await actions.getByRole('button', { name: 'Edit' }).click();
    await expect(page.getByTestId('mobile-sheet').getByTestId('properties-panel')).toBeVisible();
    await actions.getByRole('button', { name: 'Duplicate' }).click();
    await actions.getByRole('button', { name: 'Done' }).click();
    await expect(page.getByRole('navigation', { name: 'Tools' })).toBeVisible();

    await page.getByRole('navigation', { name: 'Tools' }).getByRole('button', { name: 'Layers', exact: true }).click();
    await expect(page.getByTestId('mobile-sheet').getByTestId('layers-panel').locator('li')).toHaveCount(2);
  });

  test('tap selects and deselects', async ({ app: page }) => {
    await newPost(page);
    await page.getByRole('navigation', { name: 'Tools' }).getByRole('button', { name: 'Shapes', exact: true }).click();
    await page.getByRole('button', { name: 'Add Circle' }).click();
    await page.getByRole('button', { name: 'Close panel' }).click();
    await expect(page.getByTestId('mobile-sheet')).toBeHidden();
    const { x, y } = await frameCenter(page);
    // Tap empty space to deselect, then tap the shape again.
    const vp = (await page.getByTestId('canvas-viewport').boundingBox())!;
    await page.touchscreen.tap(vp.x + 10, vp.y + vp.height - 10);
    await expect(page.getByTestId('selection-frame')).toBeHidden();
    await page.waitForTimeout(400); // outside the double-tap window
    await page.touchscreen.tap(x, y);
    await expect(page.getByTestId('selection-frame')).toBeVisible();
  });

  test('double-tap edits text; a corner handle resizes by touch; two fingers pan', async ({ app: page }) => {
    await newPost(page);
    const cdp = await page.context().newCDPSession(page);
    const touch = (type: string, points: { x: number; y: number }[]) =>
      cdp.send('Input.dispatchTouchEvent', { type, touchPoints: points.map((p, id) => ({ ...p, id })) });

    // A heading: double-tap opens it for editing.
    await page.getByRole('navigation', { name: 'Tools' }).getByRole('button', { name: 'Text', exact: true }).click();
    await page.getByTestId('mobile-sheet').getByRole('button', { name: 'Add a heading' }).click();
    await page.getByRole('navigation', { name: 'Selection actions' }).getByRole('button', { name: 'Done' }).click();
    await expect(page.getByTestId('selection-frame')).toBeHidden();
    const vp = (await page.getByTestId('canvas-viewport').boundingBox())!;
    const text = { x: vp.x + vp.width / 2, y: vp.y + vp.height / 2 };
    await page.waitForTimeout(400);
    await page.touchscreen.tap(text.x, text.y);
    await page.touchscreen.tap(text.x, text.y);
    await expect(page.getByRole('textbox', { name: 'Edit text' })).toBeFocused();
    await page.keyboard.press('Escape');
    await page.keyboard.press('Escape');

    // A rectangle: drag its bottom-right handle outwards.
    await page.getByRole('navigation', { name: 'Tools' }).getByRole('button', { name: 'Shapes', exact: true }).click();
    await page.getByRole('button', { name: 'Add Rectangle' }).click();
    await page.getByRole('button', { name: 'Close panel' }).click();
    await expect(page.getByTestId('mobile-sheet')).toBeHidden();
    const box = (await page.getByTestId('selection-frame').boundingBox())!;
    const corner = { x: box.x + box.width, y: box.y + box.height };
    await touch('touchStart', [corner]);
    for (let i = 1; i <= 6; i++) await touch('touchMove', [{ x: corner.x + i * 6, y: corner.y + i * 6 }]);
    await touch('touchEnd', []);
    await expect
      .poll(async () => (await page.getByTestId('selection-frame').boundingBox())!.width)
      .toBeGreaterThan(box.width + 20);

    // Two fingers moving together pan the view: the frame moves on screen but keeps its size.
    const before = (await page.getByTestId('selection-frame').boundingBox())!;
    const mid = { x: vp.x + vp.width / 2, y: vp.y + vp.height - 80 };
    await touch('touchStart', [
      { x: mid.x - 40, y: mid.y },
      { x: mid.x + 40, y: mid.y },
    ]);
    for (let i = 1; i <= 6; i++)
      await touch('touchMove', [
        { x: mid.x - 40 + i * 10, y: mid.y - i * 5 },
        { x: mid.x + 40 + i * 10, y: mid.y - i * 5 },
      ]);
    await touch('touchEnd', []);
    await expect.poll(async () => (await page.getByTestId('selection-frame').boundingBox())!.x).toBeGreaterThan(before.x + 30);
    const after = (await page.getByTestId('selection-frame').boundingBox())!;
    expect(Math.abs(after.width - before.width)).toBeLessThan(before.width * 0.05);
  });

  test('one-finger drag moves; two-finger pinch zooms', async ({ app: page }) => {
    await newPost(page);
    await page.getByRole('navigation', { name: 'Tools' }).getByRole('button', { name: 'Shapes', exact: true }).click();
    await page.getByRole('button', { name: 'Add Rectangle' }).click();
    await page.getByRole('button', { name: 'Close panel' }).click();
    await expect(page.getByTestId('mobile-sheet')).toBeHidden();
    const cdp = await page.context().newCDPSession(page);
    const touch = (type: string, points: { x: number; y: number }[]) =>
      cdp.send('Input.dispatchTouchEvent', { type, touchPoints: points.map((p, id) => ({ ...p, id })) });

    const start = await frameCenter(page);
    await touch('touchStart', [start]);
    for (let i = 1; i <= 6; i++) await touch('touchMove', [{ x: start.x - i * 8, y: start.y + i * 6 }]);
    await touch('touchEnd', []);
    const moved = await frameCenter(page);
    expect(moved.x).toBeLessThan(start.x - 30);

    const before = moved.box.width;
    const mid = { x: moved.x, y: moved.y + 120 };
    await touch('touchStart', [
      { x: mid.x - 30, y: mid.y },
      { x: mid.x + 30, y: mid.y },
    ]);
    for (let i = 1; i <= 6; i++)
      await touch('touchMove', [
        { x: mid.x - 30 - i * 15, y: mid.y },
        { x: mid.x + 30 + i * 15, y: mid.y },
      ]);
    await touch('touchEnd', []);
    await expect.poll(async () => (await page.getByTestId('selection-frame').boundingBox())!.width).toBeGreaterThan(before * 1.5);
  });
});
