import { z } from 'zod';
import type { DesignElement } from '@/types/document';
import { elementSchema } from '@/projects/schema';

const MARKER = 'stardeck/elements+json:';
const payloadSchema = z.object({ v: z.literal(1), elements: z.array(elementSchema).min(1).max(500) });

let internal: DesignElement[] | null = null;

export function serializeElements(elements: DesignElement[]): string {
  return MARKER + JSON.stringify({ v: 1, elements });
}

/** Parses clipboard text produced by `serializeElements`; anything else returns null. */
export function parseElements(text: string): DesignElement[] | null {
  if (!text.startsWith(MARKER)) return null;
  try {
    const parsed = payloadSchema.safeParse(JSON.parse(text.slice(MARKER.length)));
    return parsed.success ? (parsed.data.elements as DesignElement[]) : null;
  } catch {
    return null;
  }
}

/** Copies to an in-app clipboard and, when permitted, the system clipboard (for other tabs). */
export async function writeClipboard(elements: DesignElement[]): Promise<void> {
  internal = structuredClone(elements);
  try {
    await navigator.clipboard?.writeText(serializeElements(elements));
  } catch {
    /* Permission denied or insecure context — the in-app clipboard still works. */
  }
}

export type ClipboardContent = { kind: 'elements'; elements: DesignElement[] } | { kind: 'text'; text: string } | null;

/**
 * The system clipboard wins when readable (it reflects what the user copied most
 * recently, even in another app); the in-app copy is the fallback when access is denied.
 */
export async function readClipboard(): Promise<ClipboardContent> {
  let text: string | null = null;
  try {
    text = (await navigator.clipboard?.readText()) ?? null;
  } catch {
    text = null;
  }
  if (text) {
    const elements = parseElements(text);
    if (elements) return { kind: 'elements', elements };
    if (text.trim()) return { kind: 'text', text: text.slice(0, 2000) };
  }
  return internal ? { kind: 'elements', elements: structuredClone(internal) } : null;
}
