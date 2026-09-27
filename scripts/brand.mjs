// The brand mark and the page templates used to render icons and launch screens
// (scripts/generate-icons.mjs for the web app, scripts/generate-android-icons.mjs for the APK).
import { readFile } from 'node:fs/promises';
import path from 'node:path';

export const mark = `
  <defs>
    <linearGradient id="f" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#D8FF6B"/><stop offset="1" stop-color="#3CF0C8"/></linearGradient>
    <linearGradient id="b" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#A06BFF"/><stop offset="1" stop-color="#FF5CAA"/></linearGradient>
  </defs>
  <rect x="6" y="7" width="19" height="24" rx="6" fill="url(#b)" transform="rotate(-14 15.5 19)" opacity="0.92"/>
  <rect x="13" y="8" width="20" height="25" rx="6.5" fill="url(#f)" transform="rotate(8 23 20.5)"/>
  <path d="M23.6 13.2c.5 3.6 1.7 4.8 5.3 5.3-3.6.5-4.8 1.7-5.3 5.3-.5-3.6-1.7-4.8-5.3-5.3 3.6-.5 4.8-1.7 5.3-5.3Z" fill="#0B0A12" transform="rotate(8 23 20.5)"/>`;

/** `inset` is the fraction of the canvas the mark occupies (maskable icons need ≤ 0.8 safe zone). */
export function iconHtml(size, { inset, radius }) {
  const markSize = size * inset;
  return `<!doctype html><html><body style="margin:0;background:transparent">
  <div style="width:${size}px;height:${size}px;border-radius:${radius * size}px;overflow:hidden;position:relative;
    background: radial-gradient(circle at 20% 15%, rgba(160,107,255,0.55), transparent 55%),
                radial-gradient(circle at 85% 90%, rgba(60,240,200,0.35), transparent 50%), #0A0A11;">
    <svg viewBox="0 0 40 40" width="${markSize}" height="${markSize}" style="position:absolute;left:${(size - markSize) / 2}px;top:${(size - markSize) / 2}px">${mark}</svg>
  </div></body></html>`;
}

/** The display and body fonts as base64, for launch screens. */
export async function loadFonts(root) {
  const font = async (file) => (await readFile(path.join(root, 'public/fonts', file))).toString('base64');
  const [display, body] = await Promise.all([
    font('bricolage-grotesque/bricolage-grotesque-latin-wght-normal.woff2'),
    font('manrope/manrope-latin-wght-normal.woff2'),
  ]);
  return { display, body };
}

export function splashHtml(w, h, { display, body }) {
  const unit = Math.min(w, h);
  const markSize = unit * 0.24;
  return `<!doctype html><html><head><style>
    @font-face { font-family: Display; src: url(data:font/woff2;base64,${display}) format('woff2'); font-weight: 200 800; }
    @font-face { font-family: Body; src: url(data:font/woff2;base64,${body}) format('woff2'); font-weight: 200 800; }
    html, body { margin: 0; }
  </style></head><body>
  <div style="width:${w}px;height:${h}px;position:relative;overflow:hidden;background:#0A0A11;
    display:flex;flex-direction:column;align-items:center;justify-content:center;gap:${unit * 0.035}px">
    <svg viewBox="0 0 40 40" width="${markSize}" height="${markSize}" style="position:relative">${mark}</svg>
    <div style="position:relative;font-family:Display;font-weight:800;font-size:${unit * 0.1}px;letter-spacing:-0.045em;
      line-height:1;color:#F5F4FF">stardeck</div>
    <div style="position:relative;font-family:Body;font-weight:600;font-size:${unit * 0.036}px;letter-spacing:0.02em;
      color:#A8A6C1">Create. Swipe. Flex.</div>
  </div></body></html>`;
}
