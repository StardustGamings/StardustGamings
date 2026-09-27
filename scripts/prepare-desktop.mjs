// Copies the static export (`out/`) into desktop/web for the Electron app. Run `npm run build` first.
import { cpSync, existsSync, rmSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = path.join(root, 'out');
const web = path.join(root, 'desktop/web');

if (!existsSync(path.join(out, 'index.html'))) {
  console.error('No build found in out/. Run `npm run build` first.');
  process.exit(1);
}
rmSync(web, { recursive: true, force: true });
// iOS launch screens aren't needed on a PC.
cpSync(out, web, { recursive: true, filter: (src) => path.relative(out, src).split(path.sep)[0] !== 'splash' });
console.log('Copied out/ → desktop/web');
