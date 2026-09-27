// Trend pack tooling.
//
// Trend packs are plain JSON in public/trends/ (listed newest-first in
// public/trends/index.json) and are fetched at run time, so a new drop needs no
// rebuild. This script:
//   1. validates the index and every pack it lists against the app's schema,
//      strictly (templates, stickers, looks, fonts and text styles must exist);
//   2. writes src/trends/bundled.generated.json — the packs compiled into the
//      app, so trends render offline on first launch;
//   3. writes public/trends/pack.schema.json for editors that validate JSON.
//
// `npm run trends:check` only validates (and fails if the generated files are
// out of date); dev and build run the full script after the templates step.
import { build } from 'esbuild';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const trendsDir = path.join(root, 'public/trends');
const bundledFile = path.join(root, 'src/trends/bundled.generated.json');
const schemaFile = path.join(trendsDir, 'pack.schema.json');
const checkOnly = process.argv.includes('--check');

async function loadTooling() {
  const tmp = path.join(root, 'node_modules/.cache/stardeck-trends');
  await mkdir(tmp, { recursive: true });
  const outfile = path.join(tmp, 'validate.mjs');
  await build({
    entryPoints: [path.join(root, 'src/trends/validate.ts')],
    outfile,
    bundle: true,
    platform: 'node',
    format: 'esm',
    tsconfig: path.join(root, 'tsconfig.json'),
    logLevel: 'warning',
    define: { 'process.env.NODE_ENV': '"production"' },
  });
  const mod = await import(`${pathToFileURL(outfile).href}?t=${Date.now()}`);
  await rm(outfile, { force: true });
  return mod;
}

const { checkFeed, packJsonSchema } = await loadTooling();

const indexRaw = JSON.parse(await readFile(path.join(trendsDir, 'index.json'), 'utf8'));
const readPack = (p) => {
  const rel = p.replace(/^\/trends\//, '');
  const file = path.join(trendsDir, rel);
  if (!file.startsWith(trendsDir)) throw new Error('outside public/trends');
  return JSON.parse(readFileSync(file, 'utf8'));
};
const { index, packs, problems } = checkFeed(indexRaw, readPack);

if (problems.length) {
  for (const p of problems) console.error(`trends: ${p}`);
  console.error(`trends: ${problems.length} problem(s) — fix the pack files in public/trends/.`);
  process.exit(1);
}

const bundled = {
  index: index.packs.map((e) => ({ ...e, publishedAt: e.publishedAt ?? packs.get(e.id).publishedAt })),
  packs: Object.fromEntries(index.packs.map((e) => [e.id, readPack(e.path)])),
};
const bundledText = `${JSON.stringify(bundled)}\n`;
const schemaText = `${JSON.stringify(packJsonSchema(), null, 2)}\n`;

if (checkOnly) {
  const stale = [];
  for (const [file, text] of [
    [bundledFile, bundledText],
    [schemaFile, schemaText],
  ]) {
    const current = await readFile(file, 'utf8').catch(() => '');
    if (current !== text) stale.push(path.relative(root, file));
  }
  if (stale.length) {
    console.error(`trends: out of date: ${stale.join(', ')} — run \`npm run trends\`.`);
    process.exit(1);
  }
  console.log(`trends: ${packs.size} pack(s) OK`);
} else {
  await writeFile(bundledFile, bundledText);
  await writeFile(schemaFile, schemaText);
  console.log(`trends: validated and bundled ${packs.size} pack(s)`);
}
