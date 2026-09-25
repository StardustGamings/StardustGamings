import { test as base, expect, type Page } from '@playwright/test';

/** Marks onboarding as done before the app boots (unless a test opts out). */
export const test = base.extend<{ fresh: boolean; app: Page }>({
  fresh: [false, { option: true }],
  app: async ({ page, fresh }, provide) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    page.on('console', (m) => {
      if (m.type() === 'error') errors.push(m.text());
    });
    if (!fresh) {
      await page.addInitScript(() => {
        if (!localStorage.getItem('stardeck.settings')) {
          localStorage.setItem('stardeck.settings', JSON.stringify({ state: { onboarded: true }, version: 1 }));
        }
      });
    }
    await provide(page);
    expect(errors, 'no uncaught errors or console errors').toEqual([]);
  },
});

export { expect };

/** Navigates and waits until the app has hydrated (keyboard shortcuts are live). */
export async function open(page: Page, path: string) {
  await page.goto(path);
  await expect(page.locator('html')).toHaveAttribute('data-ready', 'true');
}

export async function createCarousel(page: Page, slides = 5) {
  await open(page, '/');
  await page.getByRole('button', { name: /New Carousel: Swipeable/ }).click();
  const dialog = page.getByRole('dialog', { name: 'Start something new' });
  await expect(dialog).toBeVisible();
  const more = dialog.getByRole('button', { name: 'More slides' });
  const fewer = dialog.getByRole('button', { name: 'Fewer slides' });
  for (let i = 5; i < slides; i++) await more.click();
  for (let i = 5; i > slides; i--) await fewer.click();
  await dialog.getByTestId('create-project').click();
  await expect(page).toHaveURL(/\/editor\/\?id=prj_/);
  await expect(page.getByTestId('canvas-viewport')).toBeVisible();
}
