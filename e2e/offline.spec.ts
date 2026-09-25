import { expect, test } from './fixtures';

test('works offline after the first visit (PWA)', async ({ app: page, context, isMobile }) => {
  test.skip(isMobile, 'Service-worker behaviour is identical across viewports');
  await page.goto('/');
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  // Wait for the worker to control the page, then warm up.
  await page.reload();
  await expect.poll(() => page.evaluate(() => Boolean(navigator.serviceWorker.controller))).toBe(true);

  await context.setOffline(true);
  await page.reload();
  await expect(page.getByRole('status').filter({ hasText: 'Offline Mode' })).toBeVisible();

  // Navigate and create a project entirely offline.
  await page.goto('/projects/');
  await expect(page.getByRole('heading', { name: 'Projects', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'New design' }).first().click();
  await page.getByTestId('create-project').click();
  await expect(page.getByTestId('canvas-viewport')).toBeVisible();
  await expect(page.getByTestId('save-indicator')).toHaveAttribute('data-state', 'saved');
  await context.setOffline(false);
});

test('ships an installable manifest', async ({ request }) => {
  const res = await request.get('/manifest.webmanifest');
  expect(res.ok()).toBe(true);
  const manifest = await res.json();
  expect(manifest.display).toBe('standalone');
  expect(manifest.icons.some((i: { purpose: string }) => i.purpose === 'maskable')).toBe(true);
  expect((await request.get('/sw.js')).ok()).toBe(true);
});
