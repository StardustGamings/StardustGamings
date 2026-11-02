import Anthropic from '@anthropic-ai/sdk';
import { createAiHandler } from './handler';

/**
 * Stardeck's optional AI server for Fetch-API runtimes (Cloudflare Workers and
 * similar). Set the ANTHROPIC_API_KEY secret and the ALLOWED_ORIGINS variable.
 * The rate limit is per isolate here; add the platform's own rate limiting for
 * stricter guarantees.
 */

interface Env {
  ANTHROPIC_API_KEY: string;
  ALLOWED_ORIGINS: string;
  AI_MODEL?: string;
}

let handler: ReturnType<typeof createAiHandler> | null = null;

const worker = {
  async fetch(request: Request, env: Env): Promise<Response> {
    handler ??= createAiHandler({
      client: new Anthropic({ apiKey: env.ANTHROPIC_API_KEY }),
      allowedOrigins: env.ALLOWED_ORIGINS.split(',')
        .map((o) => o.trim())
        .filter(Boolean),
      model: env.AI_MODEL,
    });
    return handler(request, request.headers.get('cf-connecting-ip') ?? 'unknown');
  },
};

export default worker;
