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

export type Paint = 'subject' | 'gradient';

/** A PNG made in-page: a red disc on a pale studio background, or a colour gradient. */
export async function makePng(page: Page, paint: Paint, w = 1200, h = 900, hue = 0): Promise<Buffer> {
  const dataUrl = await page.evaluate(
    ({ paint, w, h, hue }) => {
      const c = document.createElement('canvas');
      c.width = w;
      c.height = h;
      const x = c.getContext('2d')!;
      if (paint === 'subject') {
        x.fillStyle = '#F2F2F5';
        x.fillRect(0, 0, w, h);
        x.fillStyle = '#D0342C';
        x.beginPath();
        x.arc(w / 2, h / 2, Math.min(w, h) * 0.3, 0, Math.PI * 2);
        x.fill();
      } else {
        // Hue 0 is the reference gradient the photo tests sample; other hues make distinct files.
        const stops = hue
          ? [`hsl(${hue + 340}, 90%, 58%)`, `hsl(${hue + 50}, 95%, 55%)`, `hsl(${hue + 210}, 90%, 52%)`]
          : ['#FF2D55', '#FFD60A', '#0A84FF'];
        const g = x.createLinearGradient(0, 0, w, 0);
        stops.forEach((c, i) => g.addColorStop(i / 2, c));
        x.fillStyle = g;
        x.fillRect(0, 0, w, h);
      }
      return c.toDataURL('image/png');
    },
    { paint, w, h, hue },
  );
  return Buffer.from(dataUrl.split(',')[1]!, 'base64');
}
