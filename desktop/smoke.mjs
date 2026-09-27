// Smoke test for the Windows app: launches it with Electron and checks that pages load offline from
// app://stardeck/, a full page load opens the right page, nothing trips the Content-Security-Policy,
// the service worker stays off, Settings shows "Installed", a new design opens in the editor and
// exports, and downloads land in the Downloads folder.
// Run with `npm run desktop:smoke` after `npm run build`.
import { _electron as electron } from '@playwright/test';
import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, readdirSync, readFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const profile = mkdtempSync(path.join(os.tmpdir(), 'stardeck-profile-'));
// STARDECK_APP can point at a packaged app.asar to test the build instead of the source folder.
const args = [process.env.STARDECK_APP ?? import.meta.dirname, `--user-data-dir=${profile}`];
// Chromium refuses to run as root without this (CI containers); Windows never needs it.
if (process.platform === 'linux' && process.getuid?.() === 0) args.unshift('--no-sandbox');

const app = await electron.launch({ args });
try {
  const downloads = mkdtempSync(path.join(os.tmpdir(), 'stardeck-downloads-'));
  await app.evaluate(({ app }, dir) => app.setPath('downloads', dir), downloads);
  assert.equal(await app.evaluate(({ app }) => app.getPath('userData')), profile);

  const page = await app.firstWindow();
  const problems = [];
  page.on('pageerror', (e) => problems.push(e.message));
  page.on('console', (m) => m.type() === 'error' && problems.push(m.text()));

  const ready = () => page.waitForSelector('html[data-ready="true"]', { timeout: 60_000 });
  await ready();
  assert.equal(page.url(), 'app://stardeck/');
  assert.match(await page.locator('h1').first().innerText(), /Create/);

  // A full page load (not an in-app link) must open that page, not Home.
  await page.goto('app://stardeck/projects/');
  await ready();
  assert.equal(await page.locator('h1').first().innerText(), 'Projects');
  assert.equal(await page.title(), 'Projects · Stardeck');

  assert.equal(await page.evaluate(() => navigator.serviceWorker?.controller ?? null), null);

  await page.goto('app://stardeck/settings/');
  await ready();
  await page.getByText('Installed', { exact: true }).waitFor();

  await page.evaluate(() => {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob(['saved by the smoke test']));
    a.download = 'smoke.txt';
    document.body.append(a);
    a.click();
  });
  const file = path.join(downloads, 'smoke.txt');
  for (let i = 0; i < 50 && !existsSync(file); i++) await new Promise((r) => setTimeout(r, 200));
  assert.equal(readFileSync(file, 'utf8'), 'saved by the smoke test');

  // Skip the intro tour, then make a post and export it as a PNG.
  await page.evaluate(() =>
    localStorage.setItem('stardeck.settings', JSON.stringify({ state: { onboarded: true }, version: 1 })),
  );
  await page.goto('app://stardeck/');
  await ready();
  await page.getByRole('button', { name: /^New Post:/ }).click();
  await page.getByTestId('create-project').click();
  await page.getByTestId('canvas-viewport').waitFor();
  await page.getByTestId('open-export').click();
  await page.getByTestId('export-start').click();
  await page.getByTestId('export-done').waitFor({ timeout: 60_000 });
  let png;
  for (let i = 0; i < 50 && !png; i++) {
    png = readdirSync(downloads).find((f) => f.endsWith('.png'));
    if (!png) await new Promise((r) => setTimeout(r, 200));
  }
  assert.ok(png, 'the export saved a PNG to Downloads');
  const bytes = readFileSync(path.join(downloads, png));
  assert.deepEqual([...bytes.subarray(0, 4)], [0x89, 0x50, 0x4e, 0x47]);

  assert.deepEqual(problems, [], `Errors in the app:\n${problems.join('\n')}`);
  console.log('Desktop smoke test passed');
} finally {
  await app.close();
}
