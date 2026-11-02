// Checks every bundled template's text against the real bundled fonts in
// Chromium: no word may be wider than its text box, and each box must be tall
// enough for its lines. The authoring kit only estimates glyph widths, so run
// this after adding or editing templates: `npm run templates:check [id]`.
import { chromium } from 'playwright';
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const lib = path.join(root, 'src/templates/library');
const only = process.argv[2];
const templates = [];
for (const dir of readdirSync(lib, { withFileTypes: true }).filter((d) => d.isDirectory()))
  for (const f of readdirSync(path.join(lib, dir.name)))
    if (f.endsWith('.json')) templates.push(JSON.parse(readFileSync(path.join(lib, dir.name, f), 'utf8')));
const catalog = JSON.parse(readFileSync(path.join(root, 'src/typography/font-catalog.json'), 'utf8')).fonts;
const files = JSON.parse(readFileSync(path.join(root, 'src/typography/font-files.generated.json'), 'utf8'));
const faces = catalog.flatMap((f) => (files[f.id] ?? []).map((ff) => ({ family: f.family, ...ff })));

const browser = await chromium.launch();
const page = await browser.newPage();
await page.route('http://fonts.test/**', (route) => {
  const p = new URL(route.request().url()).pathname;
  route.fulfill({ body: readFileSync(path.join(root, 'public', p)), contentType: 'font/woff2' });
});
await page.setContent('<html><body></body></html>');
const report = await page.evaluate(
  async ({ faces, templates, only }) => {
    for (const f of faces) {
      const face = new FontFace(f.family, `url(http://fonts.test${f.file})`, { style: f.style, weight: f.weight });
      try {
        document.fonts.add(await face.load());
      } catch {
        /* ignore */
      }
    }
    const ctx = document.createElement('canvas').getContext('2d');
    const out = [];
    for (const t of templates) {
      if (only && t.id !== only) continue;
      for (const el of t.doc.elements) {
        if (el.type !== 'text') continue;
        ctx.font = `${el.fontStyle} ${el.fontWeight} ${el.fontSize}px "${el.fontFamily}"`;
        const sp = el.letterSpacing * el.fontSize;
        const m = (s) => (s ? ctx.measureText(s).width + sp * Math.max(0, [...s].length - 1) : 0);
        const text = el.textTransform === 'uppercase' ? el.text.toUpperCase() : el.text;
        let lines = 0;
        const broken = [];
        for (const para of text.split('\n')) {
          const words = para.split(/\s+/).filter(Boolean);
          for (const w of words) if (m(w) > el.width) broken.push(`${w} (${Math.round(m(w))}>${Math.round(el.width)})`);
          let line = '';
          let n = 1;
          for (const w of words) {
            const cand = line ? `${line} ${w}` : w;
            if (line && m(cand) > el.width) {
              n++;
              line = w;
            } else line = cand;
          }
          lines += n;
        }
        const need = lines * el.fontSize * el.lineHeight;
        const issues = [];
        if (broken.length) issues.push(`BROKEN ${broken.join(', ')}`);
        if (need > el.height + 4) issues.push(`TALLER need ${Math.round(need)} > box ${Math.round(el.height)} (${lines} lines)`);
        if (issues.length) out.push(`${t.id} ${el.id} "${el.text.slice(0, 30).replace(/\n/g, '⏎')}" ${issues.join(' | ')}`);
      }
    }
    return out;
  },
  { faces, templates, only },
);
await browser.close();
if (report.length) {
  console.error(report.join('\n'));
  process.exit(1);
}
console.log(`templates: text fits in all ${templates.length} templates`);
