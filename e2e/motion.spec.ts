import { readFile } from 'node:fs/promises';
import type { Download, Page } from '@playwright/test';
import { createCarousel, expect, frameBox, open, scenePixel, test } from './fixtures';

/**
 * Motion: animation presets and timing, auto-animate, the timeline, the
 * in-canvas preview, video clips (trim, speed, sound), animated templates and
 * MP4 / GIF export — each file checked by playing or parsing it.
 */

async function newPost(page: Page) {
  await open(page, '/');
  await page.getByRole('button', { name: /^New Post:/ }).click();
  await page.getByTestId('create-project').click();
  await expect(page.getByTestId('canvas-viewport')).toBeVisible();
}

async function addRectangle(page: Page) {
  await page.getByRole('button', { name: 'Shapes', exact: true }).first().click();
  await page.getByRole('button', { name: 'Add Rectangle' }).click();
  await expect(page.getByTestId('selection-frame')).toBeVisible();
}

async function openAnimate(page: Page) {
  await page.getByRole('button', { name: 'Animate', exact: true }).first().click();
  const panel = page.getByTestId('animate-panel').filter({ visible: true });
  await expect(panel).toBeVisible();
  return panel;
}

const saved = (page: Page) =>
  expect(page.getByTestId('save-indicator')).toHaveAttribute('data-state', 'saved', { timeout: 10_000 });
const read = async (d: Download) => readFile((await d.path())!);

/** Top-level and nested MP4 box types, with handler types for tracks. */
function mp4Boxes(b: Buffer): string[] {
  const out: string[] = [];
  const containers = new Set(['moov', 'trak', 'mdia', 'minf', 'stbl']);
  const walk = (start: number, end: number) => {
    let p = start;
    while (p + 8 <= end) {
      const size = b.readUInt32BE(p);
      const type = b.subarray(p + 4, p + 8).toString('latin1');
      out.push(type === 'hdlr' ? `hdlr:${b.subarray(p + 16, p + 20).toString('latin1')}` : type);
      if (containers.has(type)) walk(p + 8, p + size);
      if (type === 'stsd') walk(p + 16, p + size);
      if (size < 8) break;
      p += size;
    }
  };
  walk(0, b.length);
  return out;
}

/** Plays an exported video in the page: its length and size. */
async function probeVideo(page: Page, bytes: Buffer) {
  return page.evaluate(async (base64) => {
    const data = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
    const v = document.createElement('video');
    v.muted = true;
    v.src = URL.createObjectURL(new Blob([data], { type: 'video/mp4' }));
    await new Promise((resolve, reject) => {
      v.onloadeddata = resolve;
      v.onerror = () => reject(new Error(v.error?.message ?? 'video error'));
    });
    return { duration: v.duration, width: v.videoWidth, height: v.videoHeight };
  }, bytes.toString('base64'));
}

/** Records a short WebM clip in the page (a moving square, with a tone), like a phone recording. */
async function recordClip(page: Page, seconds = 2): Promise<Buffer> {
  const base64 = await page.evaluate(async (ms) => {
    const c = document.createElement('canvas');
    c.width = 320;
    c.height = 240;
    const x = c.getContext('2d')!;
    const stream = c.captureStream(30);
    const ac = new AudioContext();
    const osc = ac.createOscillator();
    const dest = ac.createMediaStreamDestination();
    osc.connect(dest);
    osc.start();
    stream.addTrack(dest.stream.getAudioTracks()[0]!);
    const rec = new MediaRecorder(stream, { mimeType: 'video/webm;codecs=vp8,opus' });
    const chunks: Blob[] = [];
    rec.ondataavailable = (e) => chunks.push(e.data);
    const t0 = performance.now();
    let raf = 0;
    const draw = () => {
      const t = (performance.now() - t0) / ms;
      x.fillStyle = '#2F6BD8';
      x.fillRect(0, 0, 320, 240);
      x.fillStyle = '#FFD60A';
      x.fillRect(20 + t * 240, 90, 60, 60);
      raf = requestAnimationFrame(draw);
    };
    draw();
    rec.start(100);
    await new Promise((r) => setTimeout(r, ms));
    rec.stop();
    await new Promise((r) => (rec.onstop = r));
    cancelAnimationFrame(raf);
    osc.stop();
    const bytes = new Uint8Array(await new Blob(chunks).arrayBuffer());
    let s = '';
    for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
    return btoa(s);
  }, seconds * 1000);
  return Buffer.from(base64, 'base64');
}

test.describe('motion (desktop)', () => {
  test.skip(({ isMobile }) => isMobile, 'Phones are covered below');

  test('entrance presets, timing on the timeline, preview on the canvas, undo', async ({ app: page }) => {
    await newPost(page);
    await addRectangle(page);
    const f = await frameBox(page);
    const centre = { x: f.cx, y: f.cy };
    const rest = await scenePixel(page, centre);

    const panel = await openAnimate(page);
    const presets = panel.getByTestId('enter-presets');
    await presets.getByRole('radio', { name: 'Fade' }).click();
    await expect(presets.getByRole('radio', { name: 'Fade' })).toHaveAttribute('aria-checked', 'true');

    // The timeline shows the entrance; drag it later (one undo step).
    const timeline = page.getByTestId('timeline');
    const bar = timeline.getByTestId('enter-bar');
    await expect(bar).toHaveAccessibleName(/Fade at 0\.0s for 0\.6s/);
    const b = (await bar.boundingBox())!;
    await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
    await page.mouse.down();
    await page.mouse.move(b.x + b.width / 2 + 120, b.y + b.height / 2, { steps: 6 });
    await page.mouse.up();
    await expect(bar).not.toHaveAccessibleName(/Fade at 0\.0s/);
    const moved = (await bar.getAttribute('aria-label'))!;
    const delay = Number(/at ([\d.]+)s/.exec(moved)![1]);
    expect(delay).toBeGreaterThan(0.3);

    // Scrub to the start: the rectangle hasn't faded in yet; after its entrance it's back.
    const ruler = timeline.getByTestId('timeline-ruler');
    const r = (await ruler.boundingBox())!;
    await page.mouse.click(r.x + 2, r.y + r.height / 2);
    await expect.poll(async () => (await scenePixel(page, centre)).join()).not.toBe(rest.join());
    // (The very end of the ruler is the slide-length handle.)
    await page.mouse.click(r.x + r.width * 0.9, r.y + r.height / 2);
    await expect.poll(async () => (await scenePixel(page, centre)).join()).toBe(rest.join());

    // Play runs the clock to the end of the slide.
    await panel.getByTestId('play-slide').click();
    await expect(panel.getByTestId('play-slide')).toHaveText(/Pause/);
    await expect(panel.getByTestId('play-slide')).toHaveText(/Play slide 1/, { timeout: 6000 });

    await page.keyboard.press('ControlOrMeta+z');
    await expect(bar).toHaveAccessibleName(/Fade at 0\.0s/);

    // Exit and loop are independent of the entrance.
    await panel.getByRole('radiogroup', { name: 'Exit' }).getByRole('radio', { name: 'Zoom' }).click();
    await panel.getByRole('radiogroup', { name: 'Loop' }).getByRole('radio', { name: 'Pulse' }).click();
    await expect(panel.getByRole('radiogroup', { name: 'Loop' }).getByRole('radio', { name: 'Pulse' })).toHaveAttribute(
      'aria-checked',
      'true',
    );
    await saved(page);
  });

  test('auto-animate a carousel, pick a transition, then play it as a video', async ({ app: page }) => {
    await createCarousel(page, 3);
    await page.keyboard.press('t');
    const vp = (await page.getByTestId('canvas-viewport').boundingBox())!;
    await page.mouse.click(vp.x + vp.width / 2, vp.y + vp.height / 3);
    await expect(page.getByRole('textbox', { name: 'Edit text' })).toBeFocused();
    await page.keyboard.type('Hello motion');
    await page.keyboard.press('Escape');
    await page.keyboard.press('Escape');

    const panel = await openAnimate(page);
    await panel.getByRole('button', { name: 'Playful' }).click();
    await expect(page.getByText(/^Animated \d+ elements?$/)).toBeVisible();
    await panel.getByRole('radiogroup', { name: 'Transition' }).getByRole('radio', { name: 'Fade' }).click();
    await expect(panel.getByRole('radiogroup', { name: 'Transition' }).getByRole('radio', { name: 'Fade' })).toHaveAttribute(
      'aria-checked',
      'true',
    );

    await page.getByRole('button', { name: 'Swipe preview' }).first().click();
    const dialog = page.getByRole('dialog', { name: 'Swipe preview' });
    await dialog.getByRole('radio', { name: 'Play as video' }).click();
    await expect(dialog.getByTestId('motion-preview')).toBeVisible();
    await expect(dialog.getByRole('slider', { name: 'Video time' })).not.toHaveAttribute('aria-valuenow', '0', { timeout: 5000 });
  });

  test('MP4 and GIF export play back with the right length and size', async ({ app: page }) => {
    await createCarousel(page, 2);
    await addRectangle(page);
    const panel = await openAnimate(page);
    await panel.getByTestId('enter-presets').getByRole('radio', { name: 'Pop' }).click();
    await saved(page);

    await page.getByTestId('open-export').click();
    const dialog = page.getByRole('dialog', { name: 'Export' });
    await dialog.getByRole('radio', { name: 'MP4' }).click();
    await dialog.getByRole('radio', { name: 'Standard' }).click();
    // 2 slides × 3 s, minus the 0.5 s hand-over.
    await expect(dialog.getByTestId('quality-hint')).toHaveText('1080 × 1350 px · 30 fps · 5.5 s.');
    const [mp4] = await Promise.all([
      page.waitForEvent('download', { timeout: 120_000 }),
      dialog.getByTestId('export-start').click(),
    ]);
    expect(mp4.suggestedFilename()).toMatch(/^carousel-.+\.mp4$/);
    await expect(page.getByTestId('export-done')).toContainText('Your video is ready');
    const bytes = await read(mp4);
    const boxes = mp4Boxes(bytes);
    expect(boxes[0]).toBe('ftyp');
    expect(boxes).toContain('hdlr:vide');
    expect(boxes).not.toContain('hdlr:soun'); // nothing in the design makes a sound
    const probe = await probeVideo(page, bytes);
    expect(probe).toMatchObject({ width: 1080, height: 1350 });
    expect(probe.duration).toBeCloseTo(5.5, 1);
    await page.getByRole('button', { name: 'Done', exact: true }).click();

    await page.getByTestId('open-export').click();
    await dialog.getByRole('radio', { name: 'GIF' }).click();
    await dialog.getByRole('radio', { name: 'One slide' }).click();
    const [gif] = await Promise.all([
      page.waitForEvent('download', { timeout: 120_000 }),
      dialog.getByTestId('export-start').click(),
    ]);
    expect(gif.suggestedFilename()).toMatch(/-01\.gif$/);
    const g = await read(gif);
    expect(g.subarray(0, 6).toString('latin1')).toBe('GIF89a');
    expect([g.readUInt16LE(6), g.readUInt16LE(8)]).toEqual([384, 480]);
    expect(g.includes(Buffer.from('NETSCAPE2.0'))).toBe(true);
  });

  test('video clips: add one, trim and speed, sound on or off in the exported MP4', async ({ app: page }) => {
    await newPost(page);
    // Recorded against the wall clock: a busy machine can drop the last frames, so aim for the
    // middle of the "2.x seconds" range the checks below expect.
    const clip = await recordClip(page, 2.4);
    await page.getByTestId('photo-input').setInputFiles({ name: 'clip.webm', mimeType: 'video/webm', buffer: clip });
    await expect(page.getByTestId('selection-frame')).toBeVisible({ timeout: 20_000 });
    const length = page.getByTestId('clip-length');
    await expect(length).toHaveText(/^2\.\ds of 2\.\ds$/);
    await page.getByRole('radio', { name: '2×' }).click();
    await expect(length).toHaveText(/^1\.\ds of 2\.\ds$/);
    await page.getByRole('radio', { name: '1×' }).click();

    // The clip is in the photo library, marked as a video.
    await page.getByRole('button', { name: 'Photos', exact: true }).first().click();
    await expect(page.getByTestId('photo-library').getByRole('button', { name: 'Add clip.webm' })).toBeVisible();
    await page.getByTestId('selection-frame').waitFor();

    const exportMp4 = async () => {
      await page.getByTestId('open-export').click();
      const dialog = page.getByRole('dialog', { name: 'Export' });
      await dialog.getByRole('radio', { name: 'MP4' }).click();
      const [mp4] = await Promise.all([
        page.waitForEvent('download', { timeout: 120_000 }),
        dialog.getByTestId('export-start').click(),
      ]);
      await expect(page.getByTestId('export-done')).toBeVisible();
      const codec = await page.getByTestId('export-codec').textContent();
      await page.getByRole('button', { name: 'Done', exact: true }).click();
      return { bytes: await read(mp4), codec: codec ?? '' };
    };

    const loud = await exportMp4();
    expect(mp4Boxes(loud.bytes)).toContain('hdlr:soun');
    expect(loud.codec).toContain('with sound');
    const probe = await probeVideo(page, loud.bytes);
    expect(probe.duration).toBeCloseTo(3, 1);

    await page.getByRole('switch', { name: 'Sound' }).click();
    await saved(page);
    const quiet = await exportMp4();
    expect(mp4Boxes(quiet.bytes)).not.toContain('hdlr:soun');
  });

  test('animated templates: filter, badge and play before using one', async ({ app: page }) => {
    await open(page, '/templates/');
    await page.getByRole('button', { name: '✦ Animated' }).click();
    const cards = page.getByTestId('template-card');
    await expect(cards.first()).toBeVisible();
    const count = await cards.count();
    expect(count).toBeGreaterThanOrEqual(10);
    await expect(cards.filter({ hasText: 'Animated' })).toHaveCount(count);
    await cards.first().click();
    const dialog = page.getByRole('dialog').filter({ has: page.getByRole('radio', { name: 'Play animation' }) });
    await dialog.getByRole('radio', { name: 'Play animation' }).click();
    await expect(dialog.getByTestId('motion-preview')).toBeVisible();
  });
});

test.describe('motion (phone)', () => {
  test.skip(({ isMobile }) => !isMobile, 'Phone flow');

  test('animate from the selection bar and play the slide', async ({ app: page }) => {
    await newPost(page);
    await page.getByRole('button', { name: 'Shapes', exact: true }).first().click();
    await page.getByRole('button', { name: 'Add Rectangle' }).click();
    await page.getByRole('navigation', { name: 'Selection actions' }).getByRole('button', { name: 'Animate' }).click();
    const sheet = page.getByTestId('mobile-sheet');
    await sheet.getByTestId('enter-presets').getByRole('radio', { name: 'Bounce' }).click();
    await expect(sheet.getByTestId('enter-presets').getByRole('radio', { name: 'Bounce' })).toHaveAttribute(
      'aria-checked',
      'true',
    );
    await sheet.getByTestId('play-slide').click();
    await expect(sheet.getByTestId('playhead-time')).not.toHaveText(/^0\.0s/, { timeout: 4000 });
  });
});
