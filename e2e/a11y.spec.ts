import path from 'node:path';
import type { Page } from '@playwright/test';
import { expect, open, test } from './fixtures';

/**
 * Accessibility: every main screen, the editor's tools and the main dialogs pass
 * axe (WCAG 2.1 A/AA and best practices) in the dark and light themes and on a
 * phone; the keyboard reaches everything; reduced motion is honoured.
 */

const AXE = path.resolve('node_modules/axe-core/axe.min.js');

interface Violation {
  id: string;
  impact: string | null;
  nodes: string[];
}

async function audit(page: Page, where: string) {
  // Contrast is measured on final colours: wait for fonts (samples are dimmed until theirs loads)
  // and for entrance animations (not the endless ambient ones) to finish.
  await page.evaluate(async () => {
    await document.fonts.ready;
    const finite = document.getAnimations().filter((a) => a.effect?.getTiming().iterations !== Infinity);
    const settled = Promise.all(finite.map((a) => a.finished.catch(() => undefined)));
    await Promise.race([settled, new Promise((r) => setTimeout(r, 2000))]); // paused animations never finish
  });
  await page.waitForTimeout(500);
  if (!(await page.evaluate(() => 'axe' in window))) await page.addScriptTag({ path: AXE });
  const violations: Violation[] = await page.evaluate(async () => {
    const axe = (
      window as unknown as {
        axe: {
          run: (
            ctx: Document,
            opts: object,
          ) => Promise<{
            violations: { id: string; impact: string | null; nodes: { target: string[]; failureSummary?: string }[] }[];
          }>;
        };
      }
    ).axe;
    const result = await axe.run(document, {
      runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'best-practice'] },
      resultTypes: ['violations'],
    });
    return result.violations.map((v) => ({
      id: v.id,
      impact: v.impact,
      nodes: v.nodes.slice(0, 5).map((n) => `${n.target.join(' ')} — ${n.failureSummary?.split('\n')[1]?.trim() ?? ''}`),
    }));
  });
  expect(violations, `${where}: ${JSON.stringify(violations, null, 1)}`).toEqual([]);
}

async function useTheme(page: Page, theme: 'dark' | 'light') {
  await page.addInitScript(
    (t) => localStorage.setItem('stardeck.settings', JSON.stringify({ state: { onboarded: true, theme: t }, version: 1 })),
    theme,
  );
}

for (const theme of ['dark', 'light'] as const) {
  test.describe(`accessibility (${theme})`, () => {
    test.beforeEach(async ({ page }) => useTheme(page, theme));

    test('main screens pass axe', async ({ app: page }) => {
      for (const path of ['/', '/templates/', '/discover/', '/projects/', '/settings/']) {
        await open(page, path);
        await audit(page, `${theme} ${path}`);
      }
    });

    test('the editor, its tools and dialogs pass axe', async ({ app: page, isMobile }) => {
      test.setTimeout(90_000);
      await open(page, '/');
      await page
        .getByRole('button', { name: /^New Post:/ })
        .first()
        .click();
      await audit(page, `${theme} new design dialog`);
      await page.getByTestId('create-project').click();
      await expect(page.getByTestId('canvas-viewport')).toBeVisible();
      await audit(page, `${theme} editor`);
      const tools = isMobile
        ? ['Text', 'Photos', 'Magic']
        : ['Templates', 'Text', 'Background', 'Filters', 'Animate', 'Trends', 'Magic'];
      for (const tool of tools) {
        await page.getByRole('button', { name: tool, exact: true }).first().click();
        await audit(page, `${theme} editor · ${tool}`);
        if (isMobile) await page.getByRole('button', { name: 'Close panel' }).click();
      }
      if (!isMobile) {
        await page.keyboard.press('Escape');
        await page.keyboard.press('t');
        const vp = (await page.getByTestId('canvas-viewport').boundingBox())!;
        await page.mouse.click(vp.x + vp.width / 2, vp.y + vp.height / 3);
        await page.keyboard.type('Hello');
        await page.keyboard.press('Escape');
        await audit(page, `${theme} editor · text selected`);
        await page.getByTestId('open-export').click();
        await expect(page.getByTestId('export-options')).toBeVisible();
        await audit(page, `${theme} export dialog`);
      }
    });
  });
}

test.describe('keyboard and motion', () => {
  test('a skip link leads to the content, and dialogs keep focus inside', async ({ app: page, isMobile }) => {
    test.skip(isMobile, 'Keyboard navigation is a desktop concern');
    await open(page, '/');
    await page.keyboard.press('Tab');
    const skip = page.getByRole('link', { name: 'Skip to content' });
    await expect(skip).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/#main$/);

    await page.keyboard.press('ControlOrMeta+k');
    const palette = page.getByRole('dialog', { name: 'Command palette' });
    await expect(palette).toBeVisible();
    for (let i = 0; i < 6; i++) {
      await page.keyboard.press('Tab');
      expect(await palette.evaluate((d) => d.contains(document.activeElement))).toBe(true);
    }
    await page.keyboard.press('Escape');
    await expect(palette).toBeHidden();
  });

  test('reduced motion is honoured', async ({ app: page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await open(page, '/');
    await expect(page.locator('html')).toHaveAttribute('data-motion', 'reduced');
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await expect(page.locator('html')).toHaveAttribute('data-motion', 'full');
  });
});
