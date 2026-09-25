// Generates out/sw.js with a precache manifest of the static export so the whole
// app (pages, JS, CSS, fonts, icons, templates, trend packs) works offline.
import { createHash } from 'node:crypto';
import { readdir, readFile, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outDir = path.join(root, 'out');

async function walk(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = await Promise.all(
    entries.map((e) => (e.isDirectory() ? walk(path.join(dir, e.name)) : [path.join(dir, e.name)])),
  );
  return files.flat();
}

const EXCLUDE = [/\/sw\.js$/, /\/_headers$/, /\.map$/, /\/LICENSE\.txt$/, /\/_not-found\//];

const files = (await walk(outDir))
  .map((f) => '/' + path.relative(outDir, f).split(path.sep).join('/'))
  .filter((url) => !EXCLUDE.some((re) => re.test(url)))
  .sort();

const pages = files.filter((f) => f.endsWith('/index.html')).map((f) => f.replace(/index\.html$/, ''));
// Pages are cached under their pretty URL ("/projects/") — that's what navigations request.
const assets = [...new Set(files.map((f) => (f.endsWith('/index.html') ? f.replace(/index\.html$/, '') : f)))];

const hash = createHash('sha256');
let totalBytes = 0;
for (const f of files) {
  const buf = await readFile(path.join(outDir, f));
  totalBytes += (await stat(path.join(outDir, f))).size;
  hash.update(f).update(buf);
}
const template = await readFile(path.join(root, 'scripts/sw-template.js'), 'utf8');
hash.update(template);
const version = hash.digest('hex').slice(0, 12);
const sw = template
  .replace('__VERSION__', version)
  .replace('__ASSETS__', JSON.stringify(assets))
  .replace('__PAGES__', JSON.stringify(pages));
await writeFile(path.join(outDir, 'sw.js'), sw);

console.log(`sw.js: ${assets.length} files precached (${(totalBytes / 1024 / 1024).toFixed(2)} MB), version ${version}`);
