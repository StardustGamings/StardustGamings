// Renders the Android app's launcher icons (legacy, round and adaptive layers) and its
// pre-Android-12 launch screens from the brand mark, using headless Chromium.
// Run with `npm run icons:android` after changing the logo. Output is committed.
import { chromium } from '@playwright/test';
import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { iconHtml, loadFonts, mark, splashHtml } from './brand.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const res = path.join(root, 'android/app/src/main/res');

const DENSITIES = { mdpi: 1, hdpi: 1.5, xhdpi: 2, xxhdpi: 3, xxxhdpi: 4 };

/** The mark alone on a transparent canvas: the adaptive icon's foreground layer. */
function markHtml(size, inset) {
  const markSize = size * inset;
  return `<!doctype html><html><body style="margin:0;background:transparent">
  <svg viewBox="0 0 40 40" width="${markSize}" height="${markSize}"
    style="position:absolute;left:${(size - markSize) / 2}px;top:${(size - markSize) / 2}px">${mark}</svg>
  </body></html>`;
}

const shots = [];
for (const [density, scale] of Object.entries(DENSITIES)) {
  const icon = 48 * scale;
  const layer = 108 * scale;
  shots.push(
    { file: `mipmap-${density}/ic_launcher.png`, w: icon, h: icon, html: iconHtml(icon, { inset: 0.78, radius: 0.22 }) },
    { file: `mipmap-${density}/ic_launcher_round.png`, w: icon, h: icon, html: iconHtml(icon, { inset: 0.7, radius: 0.5 }) },
    // Adaptive icons: 108dp layers, of which the launcher mask may show only the middle 66dp.
    { file: `mipmap-${density}/ic_launcher_foreground.png`, w: layer, h: layer, html: markHtml(layer, 0.58) },
    { file: `mipmap-${density}/ic_launcher_background.png`, w: layer, h: layer, html: iconHtml(layer, { inset: 0, radius: 0 }) },
  );
}

// Android 12+ draws its own launch screen from the icon; older versions show these.
const fonts = await loadFonts(root);
const SPLASH = [
  ['drawable', 480, 320],
  ['drawable-land-mdpi', 480, 320],
  ['drawable-land-hdpi', 800, 480],
  ['drawable-land-xhdpi', 1280, 720],
  ['drawable-land-xxhdpi', 1600, 960],
  ['drawable-land-xxxhdpi', 1920, 1280],
  ['drawable-port-mdpi', 320, 480],
  ['drawable-port-hdpi', 480, 800],
  ['drawable-port-xhdpi', 720, 1280],
  ['drawable-port-xxhdpi', 960, 1600],
  ['drawable-port-xxxhdpi', 1280, 1920],
];
for (const [dir, w, h] of SPLASH) shots.push({ file: `${dir}/splash.png`, w, h, html: splashHtml(w, h, fonts), opaque: true });

const browser = await chromium.launch(
  process.env.PLAYWRIGHT_CHROMIUM_PATH ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH } : {},
);
const page = await browser.newPage({ deviceScaleFactor: 1 });
for (const s of shots) {
  await page.setViewportSize({ width: s.w, height: s.h });
  await page.setContent(s.html);
  await page.evaluate(() => document.fonts.ready);
  const png = await page.screenshot({ omitBackground: !s.opaque, clip: { x: 0, y: 0, width: s.w, height: s.h } });
  await writeFile(path.join(res, s.file), png);
  console.log('wrote', s.file, `${Math.round(png.length / 1024)} KB`);
}
await browser.close();
