import http from 'node:http';
import Anthropic from '@anthropic-ai/sdk';
import { createAiHandler } from './handler';

/**
 * Stardeck's optional AI server on Node:
 *
 *   ANTHROPIC_API_KEY=… ALLOWED_ORIGINS=https://your-stardeck.example npm run ai-proxy
 *
 * Then build the app with NEXT_PUBLIC_AI_ENDPOINT=https://this-server.example
 * (and add that origin to connect-src in public/_headers). See docs/AI.md.
 */

const port = Number(process.env.PORT ?? 8787);
const allowedOrigins = (process.env.ALLOWED_ORIGINS ?? '')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);
const trustProxy = process.env.TRUST_PROXY === '1';

if (allowedOrigins.length === 0) {
  console.error('Set ALLOWED_ORIGINS to the site(s) allowed to use this server, e.g. https://stardeck.example');
  process.exit(1);
}

if (!process.env.ANTHROPIC_API_KEY && !process.env.ANTHROPIC_AUTH_TOKEN && !process.env.ANTHROPIC_PROFILE) {
  console.warn('No ANTHROPIC_API_KEY in the environment — requests will fail unless another credential source is configured.');
}

const handle = createAiHandler({
  // Credentials come from the environment (ANTHROPIC_API_KEY, or another source the SDK supports).
  client: new Anthropic(),
  allowedOrigins,
  model: process.env.AI_MODEL,
  rateLimit: { requests: Number(process.env.RATE_LIMIT ?? 20), windowMs: 60_000 },
  log: (e) =>
    console[e.level === 'error' ? 'error' : 'log'](`[ai] ${e.status ?? ''} ${e.task ?? ''} ${e.message}`.replace(/\s+/g, ' ')),
});

http
  .createServer((req, res) => {
    const chunks: Buffer[] = [];
    let size = 0;
    req.on('data', (chunk: Buffer) => {
      size += chunk.length;
      if (size > 64 * 1024) req.destroy();
      else chunks.push(chunk);
    });
    req.on('end', async () => {
      const forwarded = trustProxy
        ? String(req.headers['x-forwarded-for'] ?? '')
            .split(',')[0]!
            .trim()
        : '';
      const client = forwarded || req.socket.remoteAddress || 'unknown';
      try {
        const headers = new Headers();
        for (const [k, v] of Object.entries(req.headers)) if (typeof v === 'string') headers.set(k, v);
        const hasBody = req.method !== 'GET' && req.method !== 'HEAD' && req.method !== 'OPTIONS';
        const request = new Request(`http://localhost${req.url ?? '/'}`, {
          method: req.method,
          headers,
          body: hasBody ? Buffer.concat(chunks) : undefined,
        });
        const response = await handle(request, client);
        res.writeHead(response.status, Object.fromEntries(response.headers));
        res.end(Buffer.from(await response.arrayBuffer()));
      } catch {
        // A request the Fetch API can't represent (odd method, bad header): refuse it rather than crash.
        if (!res.headersSent) res.writeHead(400, { 'content-type': 'application/json; charset=utf-8' });
        res.end('{"error":"bad-request"}');
      }
    });
  })
  .listen(port, () =>
    console.log(`Stardeck AI server on http://localhost:${port} (model ${process.env.AI_MODEL || 'claude-opus-5'})`),
  );
