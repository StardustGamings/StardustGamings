import { expect, test } from './fixtures';

test('uses a rail on desktop and a bottom bar on phones', async ({ app: page, isMobile }) => {
  await page.goto('/');
  const navs = page.getByRole('navigation', { name: 'Main' });
  const visible = await navs.evaluateAll((els) =>
    els.filter((e) => getComputedStyle(e).display !== 'none').map((e) => e.getBoundingClientRect()),
  );
  expect(visible).toHaveLength(1);
  const rect = visible[0]!;
  const viewport = page.viewportSize()!;
  if (isMobile) expect(rect.bottom).toBeGreaterThan(viewport.height - 120);
  else expect(rect.left).toBeLessThan(40);
});

test('no horizontal page overflow on any main screen', async ({ app: page }) => {
  for (const path of ['/', '/projects/', '/discover/', '/settings/']) {
    await page.goto(path);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow, `overflow on ${path}`).toBeLessThanOrEqual(1);
  }
});

test('editor shows the toolbar that fits the device', async ({ app: page, isMobile }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'New design' }).first().click();
  await page.getByTestId('create-project').click();
  await expect(page.getByTestId('canvas-viewport')).toBeVisible();
  const tools = page.getByRole('navigation', { name: 'Tools' });
  const visibleCount = await tools.evaluateAll((els) => els.filter((e) => getComputedStyle(e).display !== 'none').length);
  expect(visibleCount).toBe(1);
  if (isMobile) {
    await page.getByRole('button', { name: 'Background', exact: true }).click();
    await expect(page.getByRole('dialog', { name: 'Background' })).toBeVisible();
  }
});
