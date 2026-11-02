// The brand mark and the page templates used to render icons and launch screens
// (scripts/generate-icons.mjs for the web app, scripts/generate-android-icons.mjs for the APK).
// Flat colours only: ink, paper and vermilion, matching src/components/ui/Logo.tsx.
import { readFile } from 'node:fs/promises';
import path from 'node:path';

export const INK = '#151311';
export const PAPER = '#EFE7DA';
export const VERMILION = '#FF6B35';

export const mark = `
  <rect x="6.5" y="7.5" width="18" height="24" rx="3.5" fill="${PAPER}" transform="rotate(-11 15.5 19.5)"/>
  <rect x="14" y="8" width="19.5" height="25.5" rx="3.5" fill="${VERMILION}" transform="rotate(7 23.75 20.75)"/>
  <path d="M23.9 14.2c.45 3.3 1.55 4.4 4.85 4.85-3.3.45-4.4 1.55-4.85 4.85-.45-3.3-1.55-4.4-4.85-4.85 3.3-.45 4.4-1.55 4.85-4.85Z" fill="${INK}" transform="rotate(7 23.75 20.75)"/>`;

/** `inset` is the fraction of the canvas the mark occupies (maskable icons need ≤ 0.8 safe zone). */
export function iconHtml(size, { inset, radius }) {
  const markSize = size * inset;
  return `<!doctype html><html><body style="margin:0;background:transparent">
  <div style="width:${size}px;height:${size}px;border-radius:${radius * size}px;overflow:hidden;position:relative;background:${INK};">
    <svg viewBox="0 0 40 40" width="${markSize}" height="${markSize}" style="position:absolute;left:${(size - markSize) / 2}px;top:${(size - markSize) / 2}px">${mark}</svg>
  </div></body></html>`;
}

/** The display and body fonts as base64, for launch screens. */
export async function loadFonts(root) {
  const font = async (file) => (await readFile(path.join(root, 'public/fonts', file))).toString('base64');
  const [display, body] = await Promise.all([
    font('instrument-serif/instrument-serif-latin-400-normal.woff2'),
    font('archivo/archivo-latin-wght-normal.woff2'),
  ]);
  return { display, body };
}

export function splashHtml(w, h, { display, body }) {
  const unit = Math.min(w, h);
  const markSize = unit * 0.2;
  return `<!doctype html><html><head><style>
    @font-face { font-family: Display; src: url(data:font/woff2;base64,${display}) format('woff2'); font-weight: 400; }
    @font-face { font-family: Body; src: url(data:font/woff2;base64,${body}) format('woff2'); font-weight: 100 900; }
    html, body { margin: 0; }
  </style></head><body>
  <div style="width:${w}px;height:${h}px;position:relative;overflow:hidden;background:${INK};
    display:flex;flex-direction:column;align-items:center;justify-content:center;gap:${unit * 0.03}px">
    <svg viewBox="0 0 40 40" width="${markSize}" height="${markSize}" style="position:relative">${mark}</svg>
    <div style="position:relative;font-family:Display;font-size:${unit * 0.11}px;letter-spacing:-0.01em;
      line-height:1;color:#F2EEE8">Stardeck</div>
    <div style="position:relative;font-family:Body;font-weight:500;font-size:${unit * 0.032}px;letter-spacing:0.14em;
      text-transform:uppercase;color:#A29C93">Create · Swipe · Flex</div>
  </div></body></html>`;
}
