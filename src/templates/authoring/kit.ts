/**
 * Template authoring kit. Bundled templates are JSON; this kit is how most of
 * them are written — `npm run templates` runs these definitions and writes the
 * JSON into src/templates/library/. Ids are deterministic, so re-running the
 * script produces identical files.
 *
 * Everything here is original artwork built from the app's own primitives
 * (text, shapes, photo frames and the built-in sticker library).
 */
import type {
  DesignElement,
  Fill,
  ImageAdjustments,
  ImageClip,
  ImageElement,
  Shadow,
  ShapeElement,
  ShapeKind,
  StickerElement,
  Stroke,
  TextElement,
} from '@/types/document';
import { SIZE_PRESETS } from '@/projects/formats';
import type { FormatId } from '@/types/project';
import { templateSchema, type TemplateDefinition, type TemplateStyle } from '../schema';

export type Paint = string | Fill;

export const solid = (color: string): Fill => ({ type: 'solid', color });
export const linear = (angle: number, ...colors: string[]): Fill => ({
  type: 'linear',
  angle,
  stops: colors.map((color, i) => ({ offset: colors.length === 1 ? 0 : i / (colors.length - 1), color })),
});
export const radial = (cx: number, cy: number, radius: number, ...colors: string[]): Fill => ({
  type: 'radial',
  cx,
  cy,
  radius,
  stops: colors.map((color, i) => ({ offset: colors.length === 1 ? 0 : i / (colors.length - 1), color })),
});
const paint = (p: Paint): Fill => (typeof p === 'string' ? solid(p) : p);

/** Rough average glyph width per font (in em) — enough to size text boxes and catch overflowing words. */
const GLYPH: Record<string, number> = {
  Anton: 0.47,
  Archivo: 0.58,
  Unbounded: 0.8,
  Syne: 0.66,
  'Bricolage Grotesque': 0.58,
  Manrope: 0.57,
  'Space Grotesk': 0.58,
  'Rubik Mono One': 0.92,
  'Instrument Serif': 0.46,
  'Playfair Display': 0.55,
  'DM Serif Display': 0.53,
  Fraunces: 0.55,
  UnifrakturMaguntia: 0.52,
  'JetBrains Mono': 0.61,
  Silkscreen: 0.8,
  Caveat: 0.42,
  'Permanent Marker': 0.62,
  Pacifico: 0.6,
};

export interface TextOptions {
  x: number;
  y: number;
  w: number;
  h?: number;
  size: number;
  font: string;
  weight?: number;
  italic?: boolean;
  color?: Paint;
  align?: TextElement['align'];
  valign?: TextElement['verticalAlign'];
  lh?: number;
  ls?: number;
  upper?: boolean;
  rot?: number;
  stroke?: Stroke;
  highlight?: { fill: Paint; padding: number; radius: number };
  shadow?: Shadow;
  opacity?: number;
  name?: string;
}

export interface BoxOptions {
  x: number;
  y: number;
  w: number;
  h: number;
  rot?: number;
  opacity?: number;
  shadow?: Shadow;
  name?: string;
  locked?: boolean;
}

export interface ShapeOptions extends BoxOptions {
  fill?: Paint | null;
  stroke?: Stroke;
  radius?: number;
  points?: number;
  inner?: number;
  dash?: number[];
}

export interface PhotoOptions extends BoxOptions {
  fill?: Paint;
  clip?: ImageClip;
  radius?: number;
  stroke?: Stroke;
  adjust?: ImageAdjustments;
  label?: string;
}

export interface StickerOptions {
  x: number;
  y: number;
  size: number;
  rot?: number;
  tint?: string;
  opacity?: number;
}

export interface Kit {
  /** Slide width and height. */
  W: number;
  H: number;
  /** Left edge of slide `i` in strip coordinates. */
  sx: (i: number) => number;
  text: (text: string, o: TextOptions) => TextElement;
  rect: (o: ShapeOptions) => ShapeElement;
  ellipse: (o: ShapeOptions) => ShapeElement;
  shape: (kind: ShapeKind, o: ShapeOptions) => ShapeElement;
  line: (x: number, y: number, w: number, color: string, weight?: number, o?: Partial<ShapeOptions>) => ShapeElement;
  photo: (o: PhotoOptions) => ImageElement;
  sticker: (id: string, o: StickerOptions) => StickerElement;
  /** A white instant-photo print with a photo window and an optional handwritten caption. */
  polaroid: (o: { x: number; y: number; w: number; rot?: number; fill?: Paint; caption?: string; ink?: string }) => void;
  /** Paper with a torn (zig-zag) top and/or bottom edge. */
  tornPaper: (o: {
    x: number;
    y: number;
    w: number;
    h: number;
    color: string;
    top?: boolean;
    bottom?: boolean;
    tooth?: number;
  }) => void;
}

export interface TemplateMeta {
  id: string;
  name: string;
  format: FormatId;
  sizeId: TemplateDefinition['sizeId'];
  style: TemplateStyle;
  description: string;
  tags: string[];
  palette: string[];
  slides?: number;
  background: Paint;
  slideFills?: (Paint | null)[];
}

const base = { rotation: 0, opacity: 1 };

/** Words the estimate thinks may not fit their box — checked for real in the browser (see docs/TEMPLATES.md). */
export const authoringWarnings: string[] = [];

function estimateLines(text: string, o: TextOptions): number {
  const glyph = (GLYPH[o.font] ?? 0.6) * (o.weight && o.weight >= 800 ? 1.06 : 1) * (o.italic ? 0.94 : 1) * (1 + (o.ls ?? 0));
  const perLine = o.w / (o.size * glyph);
  let lines = 0;
  for (const para of (o.upper ? text.toUpperCase() : text).split('\n')) {
    for (const word of para.split(/\s+/)) {
      if (word.length > perLine * 1.05) authoringWarnings.push(`"${word}" may not fit a ${o.w}px box at ${o.size}px ${o.font}`);
    }
    lines += Math.max(1, Math.ceil(para.length / perLine));
  }
  return lines;
}

export function defineTemplate(meta: TemplateMeta, build: (k: Kit) => void): TemplateDefinition {
  const size = meta.sizeId === 'custom' ? null : SIZE_PRESETS[meta.sizeId];
  if (!size) throw new Error(`${meta.id}: templates use a size preset`);
  const W = size.width;
  const H = size.height;
  const slides = meta.slides ?? 1;
  const elements: DesignElement[] = [];
  const prefix = meta.id
    .split('-')
    .map((w) => w[0])
    .join('');
  let n = 0;
  const nextId = () => `${prefix}${(n++).toString(36)}`;
  const push = <T extends DesignElement>(el: T): T => {
    elements.push(el);
    return el;
  };
  const box = (o: BoxOptions) => ({
    ...base,
    id: nextId(),
    x: o.x,
    y: o.y,
    width: o.w,
    height: o.h,
    rotation: o.rot ?? 0,
    opacity: o.opacity ?? 1,
    ...(o.shadow ? { shadow: o.shadow } : {}),
    ...(o.name ? { name: o.name } : {}),
    ...(o.locked ? { locked: true } : {}),
  });

  const shape = (kind: ShapeKind, o: ShapeOptions): ShapeElement =>
    push({
      ...box(o),
      type: 'shape',
      shape: kind,
      fill: o.fill === null ? null : paint(o.fill ?? '#000000'),
      ...(o.stroke ? { stroke: o.stroke } : {}),
      ...(o.radius !== undefined ? { cornerRadius: o.radius } : {}),
      ...(o.points !== undefined ? { points: o.points } : {}),
      ...(o.inner !== undefined ? { innerRadius: o.inner } : {}),
      ...(o.dash ? { dash: o.dash } : {}),
    });

  const photo = (o: PhotoOptions): ImageElement =>
    push({
      ...box(o),
      type: 'image',
      assetId: null,
      fit: 'cover',
      placeholder: { fill: paint(o.fill ?? '#D9D4E4'), ...(o.label ? { label: o.label } : {}) },
      ...(o.clip ? { clip: o.clip } : {}),
      ...(o.radius !== undefined ? { cornerRadius: o.radius } : {}),
      ...(o.stroke ? { stroke: o.stroke } : {}),
      ...(o.adjust ? { adjust: o.adjust } : {}),
    });

  const kit: Kit = {
    W,
    H,
    sx: (i) => i * W,
    text: (text, o) => {
      const lh = o.lh ?? 1.1;
      const lines = estimateLines(text, o);
      const h = o.h ?? Math.ceil(lines * o.size * lh + o.size * 0.12);
      return push({
        ...box({ ...o, h }),
        type: 'text',
        text,
        fontFamily: o.font,
        fontSize: o.size,
        fontWeight: o.weight ?? 400,
        fontStyle: o.italic ? 'italic' : 'normal',
        fill: paint(o.color ?? '#0B0A12'),
        align: o.align ?? 'left',
        verticalAlign: o.valign ?? 'top',
        lineHeight: lh,
        letterSpacing: o.ls ?? 0,
        ...(o.upper ? { textTransform: 'uppercase' as const } : {}),
        ...(o.stroke ? { stroke: o.stroke } : {}),
        ...(o.highlight ? { highlight: { ...o.highlight, fill: paint(o.highlight.fill) } } : {}),
      });
    },
    rect: (o) => shape('rect', o),
    ellipse: (o) => shape('ellipse', o),
    shape,
    line: (x, y, w, color, weight = 2, o = {}) => shape('rect', { x, y, w, h: weight, fill: color, ...o }),
    photo,
    sticker: (id, o) =>
      push({
        ...base,
        id: nextId(),
        type: 'sticker',
        stickerId: id,
        x: o.x,
        y: o.y,
        width: o.size,
        height: o.size,
        rotation: o.rot ?? 0,
        opacity: o.opacity ?? 1,
        ...(o.tint ? { tint: o.tint } : {}),
      }),
    polaroid: ({ x, y, w, rot = 0, fill, caption, ink = '#2B2530' }) => {
      const pad = w * 0.06;
      const h = w * 1.2;
      // Frame and photo share the same centre, so rotating both keeps them aligned.
      shape('rect', {
        x,
        y,
        w,
        h,
        rot,
        fill: '#FBFAF7',
        radius: w * 0.012,
        shadow: { color: 'rgba(20,12,30,0.22)', blur: w * 0.05, x: 0, y: w * 0.02 },
      });
      const cx = x + w / 2;
      const cy = y + h / 2;
      const px = x + pad;
      const py = y + pad;
      const pw = w - pad * 2;
      const ph = pw;
      // Rotate the photo window's centre around the frame's centre.
      const rad = (rot * Math.PI) / 180;
      const dx = px + pw / 2 - cx;
      const dy = py + ph / 2 - cy;
      const pcx = cx + dx * Math.cos(rad) - dy * Math.sin(rad);
      const pcy = cy + dx * Math.sin(rad) + dy * Math.cos(rad);
      photo({ x: pcx - pw / 2, y: pcy - ph / 2, w: pw, h: ph, rot, fill: fill ?? '#D7D2DE' });
      if (caption) {
        const ty = y + pad + ph + pad * 0.3;
        const th = h - (ty - y) - pad * 0.3;
        const tdy = ty + th / 2 - cy;
        const tcx = cx - tdy * Math.sin(rad);
        const tcy = cy + tdy * Math.cos(rad);
        kit.text(caption, {
          x: tcx - pw / 2,
          y: tcy - th / 2,
          w: pw,
          h: th,
          size: w * 0.085,
          font: 'Caveat',
          weight: 600,
          color: ink,
          align: 'center',
          valign: 'middle',
          rot,
        });
      }
    },
    tornPaper: ({ x, y, w, h, color, top = true, bottom = true, tooth = 26 }) => {
      shape('rect', { x, y, w, h, fill: color });
      const count = Math.ceil(w / tooth);
      const step = w / count;
      const d = step / Math.SQRT2;
      for (let i = 0; i < count; i++) {
        // Diamonds straddling the edge read as a torn, zig-zag paper edge.
        const jitter = ((i * 37) % 7) - 3;
        if (top)
          shape('rect', { x: x + i * step + (step - d) / 2, y: y - d / 2 + jitter * 0.6, w: d, h: d, rot: 45, fill: color });
        if (bottom)
          shape('rect', { x: x + i * step + (step - d) / 2, y: y + h - d / 2 - jitter * 0.6, w: d, h: d, rot: 45, fill: color });
      }
    },
  };

  build(kit);

  const slideFills = meta.slideFills ?? [];
  return templateSchema.parse({
    id: meta.id,
    name: meta.name,
    format: meta.format,
    sizeId: meta.sizeId,
    style: meta.style,
    description: meta.description,
    tags: meta.tags,
    palette: meta.palette,
    doc: {
      version: 1,
      slideWidth: W,
      slideHeight: H,
      background: paint(meta.background),
      slides: Array.from({ length: slides }, (_, i) => ({
        id: `s${i}`,
        fill: slideFills[i] ? paint(slideFills[i]!) : null,
      })),
      elements,
    },
  });
}
