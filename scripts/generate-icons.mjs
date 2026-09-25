// Renders the PWA / home-screen icons from the brand mark using headless Chromium.
// Run with `npm run icons` after changing the logo. Output is committed.
import { chromium } from '@playwright/test';
import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = path.join(root, 'public/icons');

const mark = `
  <defs>
    <linearGradient id="f" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#D8FF6B"/><stop offset="1" stop-color="#3CF0C8"/></linearGradient>
    <linearGradient id="b" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#A06BFF"/><stop offset="1" stop-color="#FF5CAA"/></linearGradient>
  </defs>
  <rect x="6" y="7" width="19" height="24" rx="6" fill="url(#b)" transform="rotate(-14 15.5 19)" opacity="0.92"/>
  <rect x="13" y="8" width="20" height="25" rx="6.5" fill="url(#f)" transform="rotate(8 23 20.5)"/>
  <path d="M23.6 13.2c.5 3.6 1.7 4.8 5.3 5.3-3.6.5-4.8 1.7-5.3 5.3-.5-3.6-1.7-4.8-5.3-5.3 3.6-.5 4.8-1.7 5.3-5.3Z" fill="#0B0A12" transform="rotate(8 23 20.5)"/>`;

/** `inset` is the fraction of the canvas the mark occupies (maskable icons need ≤ 0.8 safe zone). */
function iconHtml(size, { inset, radius }) {
  const markSize = size * inset;
  return `<!doctype html><html><body style="margin:0;background:transparent">
  <div style="width:${size}px;height:${size}px;border-radius:${radius * size}px;overflow:hidden;position:relative;
    background: radial-gradient(circle at 20% 15%, rgba(160,107,255,0.55), transparent 55%),
                radial-gradient(circle at 85% 90%, rgba(60,240,200,0.35), transparent 50%), #0A0A11;">
    <svg viewBox="0 0 40 40" width="${markSize}" height="${markSize}" style="position:absolute;left:${(size - markSize) / 2}px;top:${(size - markSize) / 2}px">${mark}</svg>
  </div></body></html>`;
}

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
await browser.close();
