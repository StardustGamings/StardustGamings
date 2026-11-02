// Copies the latin + latin-ext woff2 files for every family in the font catalog
// from the @fontsource packages into public/fonts/<id>/ so they ship with the
// static build (and get precached by the service worker for offline use).
import { copyFile, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const catalog = JSON.parse(await readFile(path.join(root, 'src/typography/font-catalog.json'), 'utf8'));
const outDir = path.join(root, 'public/fonts');

await rm(outDir, { recursive: true, force: true });
await mkdir(outDir, { recursive: true });

const manifest = {};
for (const font of catalog.fonts) {
  const pkgDir = path.join(root, 'node_modules', font.package);
  const filesDir = path.join(pkgDir, 'files');
  const stem = path.basename(font.package);
  const dest = path.join(outDir, font.id);
  await mkdir(dest, { recursive: true });
  const faces = [];
  for (const style of font.styles) {
    for (const subset of ['latin', 'latin-ext']) {
      const variants = font.variable ? ['wght'] : font.weights.map(String);
      for (const variant of variants) {
        const file = `${stem}-${subset}-${variant}-${style}.woff2`;
        if (!existsSync(path.join(filesDir, file))) continue;
        await copyFile(path.join(filesDir, file), path.join(dest, file));
        faces.push({
          file: `/fonts/${font.id}/${file}`,
          subset,
          style,
          weight: font.variable ? `${font.weights[0]} ${font.weights[font.weights.length - 1]}` : variant,
        });
      }
    }
  }
  if (faces.length === 0) throw new Error(`No font files found for ${font.family}`);
  await copyFile(path.join(pkgDir, 'LICENSE'), path.join(dest, 'LICENSE.txt'));
  manifest[font.id] = faces;
}

await writeFile(path.join(root, 'src/typography/font-files.generated.json'), JSON.stringify(manifest, null, 2) + '\n');
console.log(`Synced ${catalog.fonts.length} font families into public/fonts`);
