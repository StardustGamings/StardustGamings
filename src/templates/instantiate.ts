import type { DesignDocument, DesignElement, Fill, LayoutSpec, ShapeElement, Slide } from '@/types/document';
import { createSlide, slideIndexOf } from '@/projects/document';
import { MAX_SLIDES } from '@/projects/formats';
import { scaleElementContent } from '@/editor/core/ops';
import { createId } from '@/utils/id';
import { photoSlots } from './describe';
import { remixDocument } from './remix';

/**
 * Fresh ids for slides, elements, groups and layouts, so a template can be
 * placed any number of times — even into the same design — without clashes.
 */
export function remapIds(doc: DesignDocument): DesignDocument {
  const groups = new Map<string, string>();
  const layouts = new Map<string, string>();
  const layoutId = (id: string) => {
    if (!layouts.has(id)) layouts.set(id, createId('lay'));
    return layouts.get(id)!;
  };
  const copy = structuredClone(doc);
  copy.slides = copy.slides.map((s) => ({ ...s, id: createId('sl') }));
  copy.elements = copy.elements.map((el) => {
    const next: DesignElement = { ...el, id: createId('el') };
    if (el.groupId) {
      if (!groups.has(el.groupId)) groups.set(el.groupId, createId('grp'));
      next.groupId = groups.get(el.groupId)!;
    }
    if (el.layout) next.layout = { ...el.layout, id: layoutId(el.layout.id) };
    return next;
  });
  if (copy.layouts) copy.layouts = copy.layouts.map((l) => ({ ...l, id: layoutId(l.id) }));
  return copy;
}

/** Puts photos into a design's empty photo frames, in reading order. Returns how many were placed. */
export function fillPhotoSlots(doc: DesignDocument, assetIds: string[]): { doc: DesignDocument; filled: number } {
  const slots = photoSlots(doc).slice(0, assetIds.length);
  if (slots.length === 0) return { doc, filled: 0 };
  const byId = new Map(slots.map((el, i) => [el.id, assetIds[i]!]));
  return {
    doc: {
      ...doc,
      elements: doc.elements.map((el) =>
        el.type === 'image' && byId.has(el.id)
          ? { ...el, assetId: byId.get(el.id)!, fit: 'cover', focusX: 0.5, focusY: 0.5 }
          : el,
      ),
    },
    filled: slots.length,
  };
}

export interface InstantiateOptions {
  /** Re-colour with this palette (matched to the template's palette by lightness). */
  palette?: string[];
  /** Photos (asset ids) for the template's photo frames, in order. */
  photos?: string[];
}

export function instantiateTemplate(template: { doc: DesignDocument; palette: string[] }, options: InstantiateOptions = {}) {
  let doc = remapIds(template.doc);
  if (options.palette?.length && template.palette.length) doc = remixDocument(doc, template.palette, options.palette);
  if (options.photos?.length) doc = fillPhotoSlots(doc, options.photos).doc;
  return doc;
}

interface Placement {
  /** Locked shape carrying a gradient that spans several slides (empty otherwise). */
  backdrop: DesignElement[];
  elements: DesignElement[];
  fills: (Fill | null)[];
  layouts: LayoutSpec[];
}

/**
 * Maps a template onto slides of another size, starting at strip slide `at`.
 * Each template slide is scaled uniformly to fit its target slide and centred;
 * the template's own backgrounds fill the target slides edge to edge.
 */
function place(template: DesignDocument, slideW: number, slideH: number, at: number): Placement {
  const src = remapIds(template);
  const tw = src.slideWidth;
  const th = src.slideHeight;
  const s = Math.min(slideW / tw, slideH / th);
  const ox = (slideW - tw * s) / 2;
  const oy = (slideH - th * s) / 2;
  const n = src.slides.length;

  const elements = src.elements.map((el) => {
    const k = slideIndexOf(el, src);
    const scaled = scaleElementContent(el, s);
    return {
      ...scaled,
      x: (at + k) * slideW + ox + (el.x - k * tw) * s,
      y: oy + el.y * s,
      width: el.width * s,
      height: el.height * s,
    };
  });

  // A gradient that flows across several slides is kept seamless as one locked
  // backdrop shape; anything else becomes the slides' own fills.
  const spans = src.background.type !== 'solid' && n > 1;
  const fills = src.slides.map((slide) => slide.fill ?? (spans ? null : src.background));
  const backdrop: DesignElement[] = [];
  if (spans) {
    const rect = (x: number, width: number, fill: Fill, name: string): ShapeElement => ({
      id: createId('el'),
      type: 'shape',
      shape: 'rect',
      name,
      x,
      y: 0,
      width,
      height: slideH,
      rotation: 0,
      opacity: 1,
      locked: true,
      fill,
    });
    backdrop.push(rect(at * slideW, n * slideW, src.background, 'Background'));
  }

  const layouts = (src.layouts ?? []).map((l) =>
    l.kind === 'collage'
      ? { ...l, frame: { x: ox + l.frame.x * s, y: oy + l.frame.y * s, width: l.frame.width * s, height: l.frame.height * s } }
      : l,
  );
  return { backdrop, elements, fills, layouts };
}

/**
 * Adds a template's slides to a design after slide `at - 1` (content on later
 * slides moves right). Returns `null` if the design would exceed the slide limit.
 */
export function insertTemplate(doc: DesignDocument, template: DesignDocument, at: number): DesignDocument | null {
  const n = template.slides.length;
  if (doc.slides.length + n > MAX_SLIDES) return null;
  const index = Math.max(0, Math.min(at, doc.slides.length));
  const placed = place(template, doc.slideWidth, doc.slideHeight, index);
  const shift = n * doc.slideWidth;
  const moved = doc.elements.map((el) => (slideIndexOf(el, doc) >= index ? { ...el, x: el.x + shift } : el));
  const slides: Slide[] = [...doc.slides];
  slides.splice(index, 0, ...placed.fills.map((fill) => createSlide(fill)));
  return {
    ...doc,
    slides,
    elements: [...moved, ...placed.backdrop, ...placed.elements],
    ...(doc.layouts || placed.layouts.length ? { layouts: [...(doc.layouts ?? []), ...placed.layouts] } : {}),
  };
}

/** Swaps a design's content for a template, keeping the design's canvas size (and guides). */
export function replaceWithTemplate(doc: DesignDocument, template: DesignDocument): DesignDocument {
  const placed = place(template, doc.slideWidth, doc.slideHeight, 0);
  const sameSize = template.slideWidth === doc.slideWidth && template.slideHeight === doc.slideHeight;
  return {
    ...doc,
    // Same size: keep the template's strip background exactly (fills stay null where it had none).
    background: sameSize ? template.background : doc.background,
    slides: placed.fills.map((fill, i) => createSlide(sameSize ? (template.slides[i]!.fill ?? null) : fill)),
    elements: sameSize ? placed.elements : [...placed.backdrop, ...placed.elements],
    layouts: placed.layouts,
  };
}
