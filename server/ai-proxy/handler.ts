import Anthropic from '@anthropic-ai/sdk';
import { betaZodOutputFormat } from '@anthropic-ai/sdk/helpers/beta/zod';
import { AI_TASKS, type AiTask } from '../../src/ai/schemas';
import { SYSTEM_PROMPT, taskPrompt } from './prompts';

/**
 * The optional AI server for Stardeck, as a Fetch-API handler (runs on Node via
 * ./node.ts, on Cloudflare Workers / Deno / edge runtimes via ./worker.ts).
 *
 * - The model API key lives here, in the server's environment — never in the app.
 * - Only listed origins may call it (CORS), each client is rate-limited, bodies
 *   are size-capped, and requests and replies are validated with the same
 *   schemas the app uses.
 * - It receives text and numbers only (design text, colours, photo
 *   measurements) — the app never sends photos.
 */

export const DEFAULT_MODEL = 'claude-opus-5';
const MAX_BODY_BYTES = 16 * 1024;

type Messages = Pick<Anthropic['beta']['messages'], 'parse'>;

export interface AiProxyConfig {
  /** An Anthropic client (credentials come from its environment). Injected so tests can fake it. */
  client: { beta: { messages: Messages } };
  /** Exact origins allowed to call the server, e.g. `https://stardeck.example`. */
  allowedOrigins: string[];
  model?: string;
  /** Requests per client per window (default 20 per minute). */
  rateLimit?: { requests: number; windowMs: number };
  now?: () => number;
  log?: (event: { level: 'info' | 'warn' | 'error'; message: string; task?: string; status?: number }) => void;
}

const isTask = (name: string): name is AiTask => Object.hasOwn(AI_TASKS, name);

/** Fixed-window counter per client key. In-memory: per process / isolate. */
function rateLimiter(requests: number, windowMs: number, now: () => number) {
  const windows = new Map<string, { start: number; count: number }>();
  return (key: string): number | null => {
    const t = now();
    if (windows.size > 10_000) for (const [k, w] of windows) if (t - w.start >= windowMs) windows.delete(k);
    const w = windows.get(key);
    if (!w || t - w.start >= windowMs) {
      windows.set(key, { start: t, count: 1 });
      return null;
    }
    if (w.count >= requests) return Math.ceil((w.start + windowMs - t) / 1000);
    w.count++;
    return null;
  };
}

async function readBody(request: Request): Promise<string | null> {
  const declared = Number(request.headers.get('content-length') ?? '0');
  if (declared > MAX_BODY_BYTES) return null;
  const text = await request.text();
  return new TextEncoder().encode(text).length > MAX_BODY_BYTES ? null : text;
}

export function createAiHandler(config: AiProxyConfig) {
  const model = config.model || DEFAULT_MODEL;
  const now = config.now ?? Date.now;
  const limit = rateLimiter(config.rateLimit?.requests ?? 20, config.rateLimit?.windowMs ?? 60_000, now);
  const allowed = new Set(config.allowedOrigins.map((o) => o.replace(/\/+$/, '')));
  const log = config.log ?? (() => {});

  return async function handle(request: Request, clientKey = 'anonymous'): Promise<Response> {
    const origin = request.headers.get('origin') ?? '';
    const originOk = allowed.has('*') || allowed.has(origin);
    const cors: Record<string, string> = originOk
      ? {
          'Access-Control-Allow-Origin': allowed.has('*') ? '*' : origin,
          'Access-Control-Allow-Methods': 'POST, OPTIONS',
          'Access-Control-Allow-Headers': 'content-type',
          'Access-Control-Max-Age': '600',
          Vary: 'Origin',
        }
      : { Vary: 'Origin' };
    const reply = (status: number, body: unknown, extra: Record<string, string> = {}) =>
      new Response(JSON.stringify(body), {
        status,
        headers: {
          'content-type': 'application/json; charset=utf-8',
          'cache-control': 'no-store',
          'x-content-type-options': 'nosniff',
          ...cors,
          ...extra,
        },
      });

    const task = new URL(request.url).pathname.split('/').filter(Boolean).pop() ?? '';
    if (request.method === 'OPTIONS')
      return originOk ? new Response(null, { status: 204, headers: cors }) : reply(403, { error: 'origin' });
    if (!isTask(task)) return reply(404, { error: 'not-found' });
    if (request.method !== 'POST') return reply(405, { error: 'method' }, { allow: 'POST, OPTIONS' });
    if (!originOk) return reply(403, { error: 'origin' });
    if (!(request.headers.get('content-type') ?? '').includes('application/json')) return reply(415, { error: 'content-type' });

    const retryAfter = limit(clientKey);
    if (retryAfter !== null) return reply(429, { error: 'rate-limited' }, { 'retry-after': String(retryAfter) });

    const text = await readBody(request);
    if (text === null) return reply(413, { error: 'too-large' });
    let json: unknown;
    try {
      json = JSON.parse(text);
    } catch {
      return reply(400, { error: 'invalid-json' });
    }
    const input = AI_TASKS[task].request.safeParse(json);
    if (!input.success) return reply(400, { error: 'invalid-request' });

    try {
      const message = await config.client.beta.messages.parse({
        model,
        max_tokens: 16000,
        // If the model declines, Anthropic re-runs the request on its recommended fallback model.
        betas: ['server-side-fallback-2026-07-01'],
        fallbacks: 'default',
        // Identical on every request, so it can be served from the prompt cache once it's long enough.
        system: [{ type: 'text', text: SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } }],
        // Small, well-specified tasks: low effort keeps them quick.
        output_config: { effort: 'low', format: betaZodOutputFormat(AI_TASKS[task].result) },
        messages: [{ role: 'user', content: taskPrompt(task, input.data as never) }],
      });
      if (message.stop_reason === 'refusal') {
        log({ level: 'info', message: 'declined', task, status: 422 });
        return reply(422, { error: 'declined' });
      }
      if (message.stop_reason === 'max_tokens' || !message.parsed_output) {
        log({ level: 'warn', message: `unusable reply (${message.stop_reason})`, task, status: 502 });
        return reply(502, { error: 'unusable-reply' });
      }
      // Validated again with the app's own schema (the helper parses; this also applies refinements).
      const result = AI_TASKS[task].result.safeParse(message.parsed_output);
      if (!result.success) {
        log({ level: 'warn', message: 'reply failed validation', task, status: 502 });
        return reply(502, { error: 'unusable-reply' });
      }
      return reply(200, result.data);
    } catch (error) {
      // Most specific first; upstream details are logged, never sent to the browser.
      if (error instanceof Anthropic.RateLimitError) {
        log({ level: 'warn', message: 'upstream rate limit', task, status: 429 });
        return reply(429, { error: 'rate-limited' }, { 'retry-after': '30' });
      }
      if (error instanceof Anthropic.AuthenticationError || error instanceof Anthropic.PermissionDeniedError) {
        log({ level: 'error', message: 'model API credentials rejected — check the server environment', task, status: 500 });
        return reply(500, { error: 'misconfigured' });
      }
      if (error instanceof Anthropic.APIError) {
        log({ level: 'error', message: `upstream error ${error.status ?? ''}`.trim(), task, status: 502 });
        return reply(502, { error: 'upstream' });
      }
      log({ level: 'error', message: error instanceof Error ? error.message : 'unknown error', task, status: 500 });
      return reply(500, { error: 'internal' });
    }
  };
}
