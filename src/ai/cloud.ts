import { AI_TASKS, type AiRequest, type AiResult, type AiTask } from './schemas';

/**
 * The browser side of the optional AI server. It exists only when the site is
 * built with NEXT_PUBLIC_AI_ENDPOINT (the server holds the model API key —
 * never the browser), and is used only after the person turns it on in
 * Settings → AI. It sends text and numbers (the design's words, colours,
 * photo measurements) — never photos — and every reply is validated before use.
 */

export const AI_ENDPOINT = (process.env.NEXT_PUBLIC_AI_ENDPOINT ?? '').replace(/\/+$/, '');

export function aiServerHost(endpoint = AI_ENDPOINT): string | null {
  if (!endpoint) return null;
  try {
    return new URL(endpoint, typeof location !== 'undefined' ? location.origin : 'http://localhost').host;
  } catch {
    return null;
  }
}

export type AiServerErrorKind = 'offline' | 'rate-limited' | 'declined' | 'invalid' | 'server' | 'not-configured';

const MESSAGES: Record<AiServerErrorKind, string> = {
  offline: 'The AI server couldn’t be reached.',
  'rate-limited': 'The AI server is busy — try again in a minute.',
  declined: 'The AI server declined that request.',
  invalid: 'The AI server sent back something unusable.',
  server: 'The AI server had a problem.',
  'not-configured': 'No AI server is set up for this site.',
};

export class AiServerError extends Error {
  constructor(readonly kind: AiServerErrorKind) {
    super(MESSAGES[kind]);
    this.name = 'AiServerError';
  }
}

export interface CallOptions {
  signal?: AbortSignal;
  fetchImpl?: typeof fetch;
  endpoint?: string;
  timeoutMs?: number;
}

export async function callAiServer<T extends AiTask>(
  task: T,
  request: AiRequest<T>,
  options: CallOptions = {},
): Promise<AiResult<T>> {
  const { fetchImpl = fetch, endpoint = AI_ENDPOINT, timeoutMs = 60_000 } = options;
  if (!endpoint) throw new AiServerError('not-configured');
  const body = AI_TASKS[task].request.parse(request);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const onAbort = () => controller.abort();
  options.signal?.addEventListener('abort', onAbort);
  let res: Response;
  try {
    res = await fetchImpl(`${endpoint}/${task}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal,
      credentials: 'omit',
      cache: 'no-store',
    });
  } catch (e) {
    if (options.signal?.aborted) throw e;
    throw new AiServerError('offline');
  } finally {
    clearTimeout(timer);
    options.signal?.removeEventListener('abort', onAbort);
  }
  if (res.status === 429) throw new AiServerError('rate-limited');
  if (res.status === 422) throw new AiServerError('declined');
  if (!res.ok) throw new AiServerError('server');
  let json: unknown;
  try {
    json = await res.json();
  } catch {
    throw new AiServerError('invalid');
  }
  const parsed = AI_TASKS[task].result.safeParse(json);
  if (!parsed.success) throw new AiServerError('invalid');
  return parsed.data as AiResult<T>;
}
