// Renders the PWA / home-screen icons and the iOS launch screens from the brand mark using
// headless Chromium. Run with `npm run icons` after changing the logo. Output is committed.
import { chromium } from '@playwright/test';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { iconHtml, loadFonts, splashHtml } from './brand.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = path.join(root, 'public/icons');

const targets = [
  { file: 'icon-192.png', size: 192, inset: 0.78, radius: 0.22 },
  { file: 'icon-512.png', size: 512, inset: 0.78, radius: 0.22 },
  { file: 'maskable-512.png', size: 512, inset: 0.62, radius: 0 },
  { file: 'apple-touch-icon.png', size: 180, inset: 0.72, radius: 0 },
];

const browser = await chromium.launch(
  process.env.PLAYWRIGHT_CHROMIUM_PATH ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH } : {},
);
const page = await browser.newPage({ deviceScaleFactor: 1 });
for (const t of targets) {
  await page.setViewportSize({ width: t.size, height: t.size });
  await page.setContent(iconHtml(t.size, t));
  const png = await page.screenshot({ omitBackground: true, clip: { x: 0, y: 0, width: t.size, height: t.size } });
  await writeFile(path.join(out, t.file), png);
  console.log('wrote', t.file);
}

/* ───────────── iOS launch screens ─────────────
   Android and desktop build their splash from the manifest (name, icon, background colour);
   iOS shows an image that exactly matches the device, or a blank screen. */

const fonts = await loadFonts(root);

const { screens } = JSON.parse(await readFile(path.join(root, 'src/app/splash-screens.json'), 'utf8'));
const splashDir = path.join(root, 'public/splash');
await rm(splashDir, { recursive: true, force: true });
await mkdir(splashDir, { recursive: true });
const shots = screens.flatMap((s) => {
  const portrait = { w: s.width * s.ratio, h: s.height * s.ratio };
  return s.ipad ? [portrait, { w: portrait.h, h: portrait.w }] : [portrait];
});
for (const { w, h } of shots) {
  await page.setViewportSize({ width: w, height: h });
  await page.setContent(splashHtml(w, h, fonts));
  await page.evaluate(() => document.fonts.ready);
  const png = await page.screenshot({ clip: { x: 0, y: 0, width: w, height: h } });
  const file = `splash-${w}x${h}.png`;
  await writeFile(path.join(splashDir, file), png);
  console.log('wrote', `splash/${file}`, `${Math.round(png.length / 1024)} KB`);
}
await browser.close();
