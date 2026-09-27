import type { DesignDocument } from '@/types/document';
import type { FormatId, SizePresetId } from '@/types/project';
import catalog from './catalog.generated.json';
import { templateSchema, type TemplateDefinition, type TemplateStyle } from './schema';

/** A template ready to use: bundled with the app or saved by the user. */
export interface Template extends TemplateDefinition {
  doc: DesignDocument;
  source: 'stardeck' | 'user';
  /** User templates only: it still shows the user's own photos (kept on this device). */
  keepsPhotos?: boolean;
  createdAt?: number;
  updatedAt?: number;
}

/** Light metadata for every bundled template, available before the library loads. */
export interface TemplateSummary {
  id: string;
  name: string;
  format: FormatId;
  sizeId: SizePresetId;
  style: TemplateStyle;
  description: string;
  tags: string[];
  palette: string[];
  width: number;
  height: number;
  slides: number;
  photoSlots: number;
  /** Ships with entrance animations (plays in MP4 / GIF exports). */
  animated: boolean;
}

export const TEMPLATE_CATALOG = catalog as TemplateSummary[];

const catalogIds = new Set(TEMPLATE_CATALOG.map((t) => t.id));
export const hasBundledTemplate = (id: string): boolean => catalogIds.has(id);

/** Validates raw template JSON; malformed templates are skipped rather than crashing the UI. */
export function parseTemplates(raw: unknown[]): Template[] {
  const out: Template[] = [];
  for (const item of raw) {
    const parsed = templateSchema.safeParse(item);
    if (parsed.success) out.push({ ...(parsed.data as TemplateDefinition & { doc: DesignDocument }), source: 'stardeck' });
    else if (process.env.NODE_ENV !== 'production') console.warn('Invalid template skipped', parsed.error.issues[0]);
  }
  return out;
}

let library: Promise<Template[]> | null = null;

/**
 * The bundled template library. It's a separate chunk, fetched the first time
 * something needs a template (and precached by the service worker for offline use).
 */
export function loadBundledTemplates(): Promise<Template[]> {
  library ??= import('./library/index')
    .then((m) => parseTemplates(m.LIBRARY))
    .catch((error: unknown) => {
      library = null;
      throw error;
    });
  return library;
}

export async function loadBundledTemplate(id: string): Promise<Template | undefined> {
  return (await loadBundledTemplates()).find((t) => t.id === id);
}
