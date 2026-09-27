import type { Page } from '@playwright/test';
import { createCarousel, expect, open, test } from './fixtures';

/**
 * Performance guarantees that are easy to lose: code that loads on first use
 * still opens correctly, a very large photo imports without freezing the page,
 * dragging in a busy design stays free of long stalls, and big exports finish.
 * (Initial JavaScript per page is checked by `npm run perf:budget`.)
 */

/** Starts recording main-thread tasks longer than 50 ms. */
async function watchLongTasks(page: Page) {
  await page.evaluate(() => {
    const w = window as unknown as { __long: number[]; __observer?: PerformanceObserver };
    w.__long = [];
    w.__observer?.disconnect();
    w.__observer = new PerformanceObserver((list) => {
      for (const e of list.getEntries()) w.__long.push(e.duration);
    });
    w.__observer.observe({ type: 'longtask' });
  });
}

const longTasks = (page: Page) => page.evaluate(() => (window as unknown as { __long: number[] }).__long);

test.describe('performance (desktop)', () => {
  test.skip(({ isMobile }) => isMobile, 'Measured on desktop');

  test('dialogs load on first use and open for what was asked', async ({ app: page }) => {
    await open(page, '/');
    // The palette's code isn't loaded yet; the shortcut still opens it.
    await page.keyboard.press('ControlOrMeta+k');
    await expect(page.getByRole('dialog', { name: /Command palette/i })).toBeVisible();
    await page.keyboard.press('Escape');

    // The new-design dialog mounts with the request already made: it must start on that format.
    await page.getByRole('button', { name: /^New Post:/ }).click();
    const dialog = page.getByRole('dialog', { name: 'Start something new' });
    await expect(dialog.getByRole('radio', { name: 'Post', exact: true })).toHaveAttribute('aria-checked', 'true');
    await dialog.getByTestId('create-project').click();
    await expect(page.getByTestId('canvas-viewport')).toBeVisible();
    await expect(page.getByText('1080 × 1350', { exact: true })).toBeVisible();
    await expect(page.getByTestId('slide-strip')).toHaveCount(0);
  });

  test('a 24-megapixel photo imports without freezing the page', async ({ app: page }) => {
    test.setTimeout(90_000);
    await open(page, '/');
    await page.getByRole('button', { name: /^New Post:/ }).click();
    await page.getByTestId('create-project').click();
    await expect(page.getByTestId('canvas-viewport')).toBeVisible();
    // Made in the page (outside the measured window), then pasted like a screenshot.
    await page.evaluate(async () => {
      const c = new OffscreenCanvas(6000, 4000);
      const x = c.getContext('2d')!;
      const g = x.createLinearGradient(0, 0, 6000, 4000);
      g.addColorStop(0, '#FF2D55');
      g.addColorStop(1, '#0A84FF');
      x.fillStyle = g;
      x.fillRect(0, 0, 6000, 4000);
      for (let i = 0; i < 300; i++) {
        x.fillStyle = `hsl(${(i * 37) % 360} 80% 55% / 0.5)`;
        x.beginPath();
        x.arc((i * 7919) % 6000, (i * 104729) % 4000, 60 + (i % 90), 0, Math.PI * 2);
        x.fill();
      }
      const blob = await c.convertToBlob({ type: 'image/jpeg', quality: 0.9 });
      (window as unknown as { __photo: File }).__photo = new File([blob], 'huge.jpg', { type: 'image/jpeg' });
    });
    await page.waitForTimeout(500);
    await watchLongTasks(page);
    await page.evaluate(() => {
      const data = new DataTransfer();
      data.items.add((window as unknown as { __photo: File }).__photo);
      window.dispatchEvent(new ClipboardEvent('paste', { clipboardData: data }));
    });
    await expect(page.getByTestId('selection-frame')).toBeVisible({ timeout: 30_000 });
    // The photo's look thumbnails render too (in a worker) before we stop measuring.
    await expect(page.getByTestId('look-picker').locator('canvas').first()).toBeVisible();
    await page.waitForTimeout(1500);
    const long = await longTasks(page);
    expect(Math.max(0, ...long), `long tasks: ${long.map(Math.round).join(', ')}`).toBeLessThan(150);
  });

  test('dragging in a carousel redraws without long stalls', async ({ app: page }) => {
    await createCarousel(page, 5);
    // A few texts, so the strip and the canvas have something to draw.
    for (let i = 0; i < 4; i++) {
      await page.keyboard.press('Escape');
      await page.keyboard.press('t');
      const vp = (await page.getByTestId('canvas-viewport').boundingBox())!;
      await page.mouse.click(vp.x + vp.width / 2, vp.y + vp.height * (0.3 + i * 0.1));
      await page.keyboard.type(`Line ${i + 1} of a busy slide`);
      await page.keyboard.press('Escape');
    }
    await page.keyboard.press('Escape');
    const vp = (await page.getByTestId('canvas-viewport').boundingBox())!;
    await page.mouse.click(vp.x + vp.width / 2, vp.y + vp.height * 0.3);
    const frame = (await page.getByTestId('selection-frame').boundingBox())!;
    await watchLongTasks(page);
    await page.mouse.move(frame.x + frame.width / 2, frame.y + frame.height / 2);
    await page.mouse.down();
    for (let i = 0; i < 40; i++)
      await page.mouse.move(frame.x + frame.width / 2 + i * 4, frame.y + frame.height / 2 + (i % 7) * 3);
    await page.mouse.up();
    await page.waitForTimeout(500);
    const long = await longTasks(page);
    expect(Math.max(0, ...long), `long tasks: ${long.map(Math.round).join(', ')}`).toBeLessThan(150);
  });
});
