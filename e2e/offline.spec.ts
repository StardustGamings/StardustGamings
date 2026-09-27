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

  // …and export it, still offline: everything is made on the device.
  await page.getByTestId('open-export').click();
  const dialog = page.getByRole('dialog', { name: 'Export' });
  await dialog.getByRole('radio', { name: 'PNG', exact: true }).click();
  const [download] = await Promise.all([page.waitForEvent('download'), dialog.getByTestId('export-start').click()]);
  expect(download.suggestedFilename()).toMatch(/\.(png|zip)$/);
  await expect(page.getByTestId('export-done')).toBeVisible();
  await page.keyboard.press('Escape');

  // …and save it as a project file to carry it to another device.
  await page.getByTestId('editor-more').click();
  const [projectFile] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('menuitem', { name: 'Download project file' }).click(),
  ]);
  expect(projectFile.suggestedFilename()).toMatch(/\.stardeck$/);
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

test('iOS launch screens: one per device size, exactly its pixel size, not pre-downloaded', async ({
  app: page,
  request,
  isMobile,
}) => {
  test.skip(isMobile, 'Markup is the same on every device');
  await page.goto('/');
  const links = await page
    .locator('link[rel="apple-touch-startup-image"]')
    .evaluateAll((els) => els.map((el) => ({ href: el.getAttribute('href')!, media: el.getAttribute('media')! })));
  expect(links.length).toBeGreaterThanOrEqual(19);
  for (const { href, media } of links) {
    const m =
      /device-width: (\d+)px\) and \(device-height: (\d+)px\) and \(-webkit-device-pixel-ratio: (\d)\) and \(orientation: (\w+)\)/.exec(
        media,
      );
    expect(m, media).not.toBeNull();
    const [w, h, ratio] = [Number(m![1]), Number(m![2]), Number(m![3])];
    const expected = m![4] === 'portrait' ? [w * ratio, h * ratio] : [h * ratio, w * ratio];
    const res = await request.get(href);
    expect(res.ok(), href).toBe(true);
    const png = await res.body();
    // PNG IHDR: width and height are big-endian at bytes 16 and 20.
    expect([png.readUInt32BE(16), png.readUInt32BE(20)], href).toEqual(expected);
  }
  expect(await (await request.get('/sw.js')).text()).not.toContain('/splash/');
});
