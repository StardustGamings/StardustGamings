import { z } from 'zod';
import type { DesignDocument, DesignElement, ImageElement } from '@/types/document';
import type { FormatId, SizePresetId } from '@/types/project';
import { sanitizeName } from '@/projects/repository';
import { createId } from '@/utils/id';
import { derivePalette } from './describe';
import { templateSchema, type TemplateDefinition, type TemplateStyle } from './schema';

/** A template the user saved. Stored in IndexedDB next to their projects. */
export interface UserTemplate extends TemplateDefinition {
  createdAt: number;
  updatedAt: number;
  /** Whether it still shows the user's own photos (they stay on this device). */
  keepsPhotos: boolean;
}

export const MAX_TEMPLATE_FILE_BYTES = 5 * 1024 * 1024;
export const TEMPLATE_FILE_KIND = 'stardeck-template';
export const TEMPLATE_FILE_EXTENSION = '.stardeck-template.json';

export const newUserTemplateId = () =>
  `my-${createId()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')}`;

/**
 * Turns photos into empty photo frames. The frame keeps its shape, border and
 * "look" (adjustments and curves) so whatever photo goes in next gets the same
 * treatment; crop, cut-out and other photo-specific edits are dropped.
 * `keep` protects asset ids (e.g. the user's own stickers) and `drop` removes
 * their elements entirely (for files leaving the device).
 */
export function stripPhotos(doc: DesignDocument, options: { keep?: Set<string>; drop?: Set<string> } = {}): DesignDocument {
  const elements: DesignElement[] = [];
  const broken = new Set<string>();
  for (const el of doc.elements) {
    if (el.type !== 'image' || !el.assetId || options.keep?.has(el.assetId)) {
      elements.push(el);
      continue;
    }
    if (el.layout) broken.add(el.layout.id);
    if (options.drop?.has(el.assetId)) continue;
    const {
      assetId: _asset,
      cutout: _cutout,
      focusX: _fx,
      focusY: _fy,
      zoom: _zoom,
      straighten: _straighten,
      flipX: _flipX,
      flipY: _flipY,
      turns: _turns,
      perspective: _perspective,
      layout: _layout,
      ...frame
    } = el;
    const slot: ImageElement = {
      ...frame,
      assetId: null,
      placeholder: frame.placeholder ?? { fill: { type: 'solid', color: '#D9D4E4' } },
    };
    if (slot.name && !/^photo|^frame/i.test(slot.name)) delete slot.name;
    elements.push(slot);
  }
  // Collages and panoramas need their photos to re-generate; without them the frames and decor stay put.
  const detached = elements.map((el) => {
    if (!el.layout || !broken.has(el.layout.id)) return el;
    const { layout: _layout, ...rest } = el;
    return rest as DesignElement;
  });
  const layouts = doc.layouts?.filter((l) => !broken.has(l.id));
  const stripped: DesignDocument = { ...doc, elements: detached };
  if (layouts?.length) stripped.layouts = layouts;
  else delete stripped.layouts;
  return stripped;
}

export interface SaveTemplateInput {
  name: string;
  description?: string;
  style: TemplateStyle;
  tags?: string[];
  format: FormatId;
  sizeId: SizePresetId;
  doc: DesignDocument;
  keepPhotos: boolean;
  /** Asset ids that are the user's stickers (kept even when photos are removed). */
  stickerAssetIds?: Set<string>;
}

const cleanText = (text: string, max: number) =>
  text
    .replace(/[\u0000-\u001F\u007F]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max);

export function cleanTags(tags: string[]): string[] {
  const out = new Set<string>();
  for (const t of tags) {
    const tag = t
      .toLowerCase()
      .replace(/[^\p{L}\p{N} -]/gu, '')
      .trim()
      .slice(0, 32);
    if (tag) out.add(tag);
  }
  return [...out].slice(0, 12);
}

/** Builds a validated user template from a design. Throws if the design can't be a template. */
export function buildUserTemplate(input: SaveTemplateInput, now = Date.now()): UserTemplate {
  const doc = structuredClone(input.keepPhotos ? input.doc : stripPhotos(input.doc, { keep: input.stickerAssetIds }));
  delete doc.guides;
  const definition = templateSchema.parse({
    id: newUserTemplateId(),
    name: sanitizeName(input.name, 'My template').slice(0, 60),
    format: input.format,
    // Custom sizes aren't a preset; the document still carries the exact size.
    sizeId: input.sizeId,
    style: input.style,
    description: cleanText(input.description ?? '', 240),
    tags: cleanTags(input.tags ?? []),
    palette: derivePalette(doc),
    doc,
  });
  return { ...definition, createdAt: now, updatedAt: now, keepsPhotos: input.keepPhotos };
}

/* ───────────── Files ───────────── */

const fileSchema = z.object({
  kind: z.literal(TEMPLATE_FILE_KIND),
  version: z.literal(1),
  template: templateSchema,
});

export class TemplateFileError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TemplateFileError';
  }
}

/**
 * A shareable template file. Photos never leave the device: they become empty
 * frames, and elements using the user's own stickers are left out.
 */
export function serializeTemplateFile(template: TemplateDefinition, options: { stickerAssetIds?: Set<string> } = {}): string {
  const { id, name, format, sizeId, style, description, tags, palette } = template;
  const doc = stripPhotos(template.doc, { drop: options.stickerAssetIds });
  return JSON.stringify({
    kind: TEMPLATE_FILE_KIND,
    version: 1,
    template: { id, name, format, sizeId, style, description, tags, palette, doc },
  });
}

/** Reads a template file into a new user template (fresh id). Throws `TemplateFileError` with a friendly message. */
export function parseTemplateFile(text: string, now = Date.now()): UserTemplate {
  if (text.length > MAX_TEMPLATE_FILE_BYTES) throw new TemplateFileError('That template file is too big (5 MB max).');
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    throw new TemplateFileError('That file isn’t a Stardeck template.');
  }
  const parsed = fileSchema.safeParse(json);
  if (!parsed.success) {
    const kind = (json as { kind?: unknown } | null)?.kind;
    throw new TemplateFileError(
      kind === TEMPLATE_FILE_KIND
        ? 'This template file is damaged or from a newer version of Stardeck.'
        : 'That file isn’t a Stardeck template.',
    );
  }
  const t = parsed.data.template;
  // Whatever the file says, it can't point at photos on this device.
  const doc = stripPhotos(t.doc);
  return { ...t, id: newUserTemplateId(), doc, createdAt: now, updatedAt: now, keepsPhotos: false };
}

export const templateFileName = (name: string) =>
  `${
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '') || 'template'
  }${TEMPLATE_FILE_EXTENSION}`;
