// Minimal, dependency-free static server for the `out/` export. Used by `npm start`
// and the Playwright suite. It mirrors how a static host (Netlify, Cloudflare Pages,
// GitHub Pages, Capacitor) resolves paths with `trailingSlash: true`.
import { createServer } from 'node:http';
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../out');
const portFlag = process.argv.indexOf('--port');
const port = Number(portFlag > -1 ? process.argv[portFlag + 1] : (process.env.PORT ?? 3000));

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json',
  '.txt': 'text/plain; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
};

// Mirrors public/_headers so tests run under the same Content-Security-Policy as production.
// Next.js' static export relies on inline bootstrap scripts, hence 'unsafe-inline' for scripts.
const CSP = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self'",
  "connect-src 'self'",
  "worker-src 'self' blob:",
  "manifest-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join('; ');

const SECURITY_HEADERS = {
  'Content-Security-Policy': CSP,
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'X-Frame-Options': 'DENY',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
};

async function resolveFile(urlPath) {
  const clean = path.normalize(decodeURIComponent(urlPath)).replace(/^([/\\])+/, '');
  const candidate = path.join(root, clean);
  if (!candidate.startsWith(root)) return null; // path traversal guard
  for (const file of [candidate, path.join(candidate, 'index.html'), `${candidate}.html`]) {
    try {
      const info = await stat(file);
      if (info.isFile()) return file;
    } catch {
      /* try next */
    }
  }
  return null;
}

createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', 'http://localhost');
  let file = await resolveFile(url.pathname);
  let status = 200;
  if (!file) {
    file = await resolveFile('/404.html');
    status = 404;
  }
  if (!file) {
    res.writeHead(404).end('Not found');
    return;
  }
  const ext = path.extname(file);
  const immutable = url.pathname.startsWith('/_next/static/');
  res.writeHead(status, {
    ...SECURITY_HEADERS,
    'Content-Type': TYPES[ext] ?? 'application/octet-stream',
    'Cache-Control': immutable ? 'public, max-age=31536000, immutable' : 'no-cache',
    ...(url.pathname === '/sw.js' ? { 'Service-Worker-Allowed': '/' } : {}),
  });
  createReadStream(file).pipe(res);
}).listen(port, '127.0.0.1', () => {
  console.log(`Stardeck static build served at http://127.0.0.1:${port}`);
});
