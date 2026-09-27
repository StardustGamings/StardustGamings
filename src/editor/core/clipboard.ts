import * as z from 'zod';
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

export type ClipboardContent =
  { kind: 'elements'; elements: DesignElement[] } | { kind: 'text'; text: string } | { kind: 'images'; files: File[] } | null;

/** Image files from a paste event (screenshots, copied photos). */
export function imageFilesFrom(data: DataTransfer | null): File[] {
  if (!data) return [];
  return [...data.files].filter((f) => f.type.startsWith('image/'));
}

/**
 * The system clipboard wins when readable (it reflects what the user copied most
 * recently, even in another app); the in-app copy is the fallback when access is denied.
 */
export async function readClipboard(): Promise<ClipboardContent> {
  let text: string | null = null;
  const images: File[] = [];
  try {
    // Rich read first (images); browsers without it, or without permission, fall back to text.
    for (const item of (await navigator.clipboard?.read?.()) ?? []) {
      const imageType = item.types.find((t) => t.startsWith('image/'));
      if (imageType) images.push(new File([await item.getType(imageType)], 'Pasted image', { type: imageType }));
      else if (item.types.includes('text/plain') && text === null) text = await (await item.getType('text/plain')).text();
    }
  } catch {
    /* fall through to readText */
  }
  if (text === null && images.length === 0) {
    try {
      text = (await navigator.clipboard?.readText()) ?? null;
    } catch {
      text = null;
    }
  }
  if (text && parseElements(text)) return { kind: 'elements', elements: parseElements(text)! };
  if (images.length) return { kind: 'images', files: images };
  if (text) {
    const elements = parseElements(text);
    if (elements) return { kind: 'elements', elements };
    if (text.trim()) return { kind: 'text', text: text.slice(0, 2000) };
  }
  return internal ? { kind: 'elements', elements: structuredClone(internal) } : null;
}
