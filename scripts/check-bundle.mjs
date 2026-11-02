// Checks the JavaScript each page loads up front against a budget (run after `npm run build`).
// Everything else (dialogs, editor tools, export, templates, AI) loads on demand and isn't counted.
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = path.join(root, 'out');

// Budgets in KB, gzipped (what travels over the network).
const BUDGETS = {
  '/': 430,
  '/editor/': 510,
  '/templates/': 420,
  '/discover/': 430,
  '/projects/': 430,
  '/settings/': 440,
};

let failed = false;
for (const [route, budget] of Object.entries(BUDGETS)) {
  const html = await readFile(path.join(out, route, 'index.html'), 'utf8');
  const scripts = [...new Set([...html.matchAll(/\/_next\/static\/chunks\/[^"']+\.js/g)].map((m) => m[0]))];
  let raw = 0;
  const parts = [];
  for (const s of scripts) {
    const file = path.join(out, s);
    raw += (await stat(file)).size;
    parts.push(await readFile(file));
  }
  const gz = gzipSync(Buffer.concat(parts), { level: 9 }).length;
  const kb = Math.round(gz / 1024);
  const ok = kb <= budget;
  failed ||= !ok;
  console.log(
    `${ok ? '✓' : '✗'} ${route.padEnd(12)} ${String(kb).padStart(4)} KB gzip (budget ${budget}) · ${Math.round(raw / 1024)} KB raw · ${scripts.length} files`,
  );
}
if (failed) {
  console.error(
    '\nA page loads more JavaScript up front than its budget. Load the new code on demand (see docs/PERFORMANCE.md).',
  );
  process.exit(1);
}
