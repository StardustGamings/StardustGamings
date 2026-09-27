// Bundles the Web Workers into public/workers/ with esbuild, and copies the
// ONNX Runtime WebAssembly binary into public/ml/ort/.
//
// Workers are built outside Next.js on purpose: the app is a static export and
// these scripts must be plain, self-contained files the browser can load from
// our own origin (CSP: worker-src 'self'). Run automatically by `dev` and `build`.
import { build } from 'esbuild';
import { copyFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = path.join(root, 'public/workers');
const watch = process.argv.includes('--watch');

const common = {
  bundle: true,
  minify: !watch,
  sourcemap: false,
  target: ['es2020', 'safari15'],
  tsconfig: path.join(root, 'tsconfig.json'),
  logLevel: 'warning',
  legalComments: 'eof',
  define: { 'process.env.NODE_ENV': '"production"' },
};

// Classic workers (widest support) for decode/develop.
await build({
  ...common,
  format: 'iife',
  entryPoints: {
    process: path.join(root, 'src/assets/process.worker.ts'),
    develop: path.join(root, 'src/images/develop.worker.ts'),
    encode: path.join(root, 'src/export/encode.worker.ts'),
  },
  outdir: out,
});

// The cut-out worker is an ES module worker: ONNX Runtime relies on import.meta.
await build({
  ...common,
  format: 'esm',
  entryPoints: { cutout: path.join(root, 'src/images/cutout/cutout.worker.ts') },
  outdir: out,
  // Silence esbuild's note about ORT's optional Node.js branches.
  platform: 'browser',
  external: ['fs', 'path', 'url', 'worker_threads', 'module'],
});

const ortDir = path.join(root, 'public/ml/ort');
await mkdir(ortDir, { recursive: true });
await copyFile(
  path.join(root, 'node_modules/onnxruntime-web/dist/ort-wasm-simd-threaded.wasm'),
  path.join(ortDir, 'ort-wasm-simd-threaded.wasm'),
);

console.log('workers: built process, develop, encode, cutout · ONNX Runtime wasm copied');
