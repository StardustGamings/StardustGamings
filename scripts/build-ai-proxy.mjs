// Bundles the optional AI server (server/ai-proxy) into single files:
//   server/dist/ai-proxy.mjs   — Node:  `npm run ai-proxy`
//   server/dist/ai-worker.mjs  — Fetch-API runtimes (Cloudflare Workers …)
// The static app never imports these; the model API key only ever lives in the
// server's environment. See docs/AI.md.
import { build } from 'esbuild';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const common = {
  bundle: true,
  format: 'esm',
  tsconfig: path.join(root, 'tsconfig.json'),
  logLevel: 'warning',
  legalComments: 'none',
};
await build({
  ...common,
  entryPoints: [path.join(root, 'server/ai-proxy/node.ts')],
  outfile: path.join(root, 'server/dist/ai-proxy.mjs'),
  platform: 'node',
  target: 'node20',
  banner: { js: "import { createRequire } from 'node:module'; const require = createRequire(import.meta.url);" },
});
await build({
  ...common,
  entryPoints: [path.join(root, 'server/ai-proxy/worker.ts')],
  outfile: path.join(root, 'server/dist/ai-worker.mjs'),
  platform: 'browser',
  target: 'es2022',
  conditions: ['worker', 'browser'],
});
console.log('ai-proxy: built server/dist/ai-proxy.mjs and server/dist/ai-worker.mjs');
