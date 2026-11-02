import type { DesignDocument, DesignElement, ImageElement, Shadow, ShapeElement, Stroke, TextElement } from '@/types/document';
import { SIZE_PRESETS } from '@/projects/formats';
import { measureTextHeight } from '@/canvas/render/text';
import { regenerateCollage, regeneratePanorama, type DimsLookup } from '@/layouts/apply';

/**
 * Smart resize: adapts a design to another size (4:5 ↔ 1:1 ↔ 9:16 ↔ 16:9 …)
 * instead of just scaling it. On each slide:
 *
 * - full-bleed pieces (backgrounds, cover photos) stretch to fill the new slide
 *   — photos re-crop, since frames always cover-fit;
 * - full-width or full-height bands stretch along that side;
 * - everything else keeps its shape, scaled to fit, and stays anchored to the
 *   edge (or centre) it sat nearest — a logo in a corner stays in the corner;
 * - text scales with its box and re-wraps; collages and panoramas are
 *   regenerated for the new shape.
 *
 * Pure and deterministic; the editor wraps it in one undo step or a new copy.
 */

const BLEED = 0.04;
const BAND = 0.9;

interface Axis {
  /** Old and new slide length along this axis. */
  from: number;
  to: number;
  /** Uniform scale used for margins. */
  s: number;
}

/** New start of an element along one axis, keeping it near the edge (or centre) it was anchored to. */
function place(start: number, size: number, next: number, a: Axis): number {
  const centre = start + size / 2;
  const frac = centre / a.from;
  let out: number;
  if (frac < 1 / 3) out = start * a.s;
  else if (frac > 2 / 3) out = a.to - (a.from - (start + size)) * a.s - next;
  else out = frac * a.to - next / 2;
  // Keep elements that were inside the slide inside it.
  const inside = start >= -1 && start + size <= a.from + 1;
  if (inside && next <= a.to) out = Math.max(0, Math.min(a.to - next, out));
  return out;
}

const scaleStroke = (s: Stroke | undefined, f: number): Stroke | undefined => (s ? { ...s, width: s.width * f } : s);
const scaleShadow = (s: Shadow | undefined, f: number): Shadow | undefined =>
  s ? { ...s, blur: s.blur * f, x: s.x * f, y: s.y * f } : s;

/** Size-dependent properties (strokes, radii, text size…) scaled by `f`. */
function scaleDetails<T extends DesignElement>(el: T, f: number): T {
  const out = { ...el, shadow: scaleShadow(el.shadow, f) } as T;
  if (!el.shadow) delete (out as { shadow?: Shadow }).shadow;
  switch (el.type) {
    case 'text': {
      const t = out as TextElement;
      t.fontSize = Math.max(1, Math.round(el.fontSize * f * 10) / 10);
      if (el.stroke) t.stroke = scaleStroke(el.stroke, f);
      if (el.highlight) t.highlight = { ...el.highlight, padding: el.highlight.padding * f, radius: el.highlight.radius * f };
      break;
    }
    case 'shape': {
      const sh = out as ShapeElement;
      if (el.stroke) sh.stroke = scaleStroke(el.stroke, f);
      if (el.cornerRadius !== undefined) sh.cornerRadius = el.cornerRadius * f;
      if (el.dash) sh.dash = el.dash.map((d) => d * f);
      break;
    }
    case 'image': {
      const im = out as ImageElement;
      if (el.stroke) im.stroke = scaleStroke(el.stroke, f);
      if (el.cornerRadius !== undefined) im.cornerRadius = el.cornerRadius * f;
      break;
    }
    case 'sticker':
      break;
  }
  return out;
}

/** Re-fits a text box's height to its (re-wrapped) text; never shorter than the scaled box. */
function refitText(el: TextElement, minHeight: number): TextElement {
  const needed = measureTextHeight(el);
  return { ...el, height: Math.ceil(Math.max(minHeight, needed)) };
}

function resizeElement(el: DesignElement, doc: DesignDocument, W2: number, H2: number): DesignElement {
  const W = doc.slideWidth;
  const H = doc.slideHeight;
  const sx = W2 / W;
  const sy = H2 / H;
  const s = Math.min(sx, sy);
  const slide = Math.max(0, Math.min(doc.slides.length - 1, Math.floor((el.x + el.width / 2) / W)));
  const lx = el.x - slide * W;
  const fixedShape =
    el.type === 'text' ||
    el.type === 'sticker' ||
    (el.type === 'shape' &&
      (el.shape === 'star' || el.shape === 'polygon' || el.shape === 'ellipse') &&
      Math.abs(el.width - el.height) < 1);

  // Pieces that run across slide boundaries (seamless carousels): map the strip as a whole.
  const spans = lx < -0.1 * W || lx + el.width > 1.1 * W;
  if (spans) {
    if (fixedShape) {
      const w = el.width * s;
      const h = el.height * s;
      return scaleDetails(
        { ...el, x: (el.x + el.width / 2) * sx - w / 2, y: (el.y + el.height / 2) * sy - h / 2, width: w, height: h },
        s,
      );
    }
    return scaleDetails({ ...el, x: el.x * sx, y: el.y * sy, width: el.width * sx, height: el.height * sy }, s);
  }

  const coversX = lx <= BLEED * W && lx + el.width >= (1 - BLEED) * W;
  const coversY = el.y <= BLEED * H && el.y + el.height >= (1 - BLEED) * H;
  const x0 = slide * W2;
  const ax: Axis = { from: W, to: W2, s };
  const ay: Axis = { from: H, to: H2, s };

  // Full bleed: stretch both ways (photos re-crop; text and stickers don't distort).
  if (coversX && coversY && !fixedShape) {
    return scaleDetails({ ...el, x: x0 + lx * sx, y: el.y * sy, width: el.width * sx, height: el.height * sy }, s);
  }

  let w: number;
  let h: number;
  let x: number;
  let y: number;
  const wideBand = el.width >= BAND * W && el.type !== 'sticker';
  const tallBand = el.height >= BAND * H && !fixedShape;
  if (wideBand) {
    w = el.width * sx;
    h = el.type === 'text' ? el.height * s : el.height * (tallBand ? sy : s);
    x = x0 + lx * sx;
    y = tallBand ? el.y * sy : place(el.y, el.height, h, ay);
  } else if (tallBand) {
    h = el.height * sy;
    w = el.width * s;
    y = el.y * sy;
    x = x0 + place(lx, el.width, w, ax);
  } else {
    w = el.width * s;
    h = el.height * s;
    x = x0 + place(lx, el.width, w, ax);
    y = place(el.y, el.height, h, ay);
  }
  let out = scaleDetails({ ...el, x, y, width: w, height: h }, s);
  if (out.type === 'text') out = refitText(out, h);
  return out;
}

export interface ResizeOptions {
  /** Pixel sizes of photos, so regenerated collages keep their proportions. */
  dims?: DimsLookup;
}

export function resizeDocument(doc: DesignDocument, width: number, height: number, options: ResizeOptions = {}): DesignDocument {
  if (width === doc.slideWidth && height === doc.slideHeight) return doc;
  const sx = width / doc.slideWidth;
  const sy = height / doc.slideHeight;
  let out: DesignDocument = {
    ...doc,
    slideWidth: width,
    slideHeight: height,
    elements: doc.elements.map((el) => resizeElement(el, doc, width, height)),
    layouts: doc.layouts?.map((l) =>
      l.kind === 'collage'
        ? { ...l, frame: { x: l.frame.x * sx, y: l.frame.y * sy, width: l.frame.width * sx, height: l.frame.height * sy } }
        : l,
    ),
  };
  const dims: DimsLookup = options.dims ?? (() => null);
  for (const l of out.layouts ?? []) {
    out = l.kind === 'collage' ? regenerateCollage(out, l.id, {}, dims) : regeneratePanorama(out, l.id, {}, dims);
  }
  return out;
}

export { formatForSize } from '@/projects/formats';

/** Sizes the resize tool offers (the four from the brief first). */
export const RESIZE_TARGETS = [
  'ig-portrait',
  'ig-square',
  'story',
  'yt-thumbnail',
  'ig-landscape',
  'pinterest',
  'poster',
] as const;
export type ResizeTarget = (typeof RESIZE_TARGETS)[number];

export const sizeLabel = (id: ResizeTarget) => `${SIZE_PRESETS[id].label} · ${SIZE_PRESETS[id].ratio}`;
