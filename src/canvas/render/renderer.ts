import type { DesignDocument, DesignElement, ImageElement, ShapeElement, StickerElement } from '@/types/document';
import { resolveSticker } from '@/stickers/library';
import { degToRad } from '@/utils/math';
import { withAlpha } from '@/utils/color';
import { createFillStyle, fillPrimaryColor } from './fill';
import { roundRectPath, traceShape } from './shapes';
import { drawText } from './text';
import type { Ctx2D, DrawableImage, ImageResolver, Rect } from './types';

export interface RenderOptions {
  /** Area of the strip to draw, in design units. Defaults to the whole strip. */
  region?: Rect;
  /** Device pixels per design unit. */
  scale: number;
  images?: ImageResolver;
  /** Draw drop-zone glyphs for empty image frames (off for final exports). */
  placeholders?: boolean;
}

export const EMOJI_FONT = '"Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", "Twemoji Mozilla", sans-serif';

export function slideRegion(doc: DesignDocument, index: number): Rect {
  return { x: index * doc.slideWidth, y: 0, width: doc.slideWidth, height: doc.slideHeight };
}

export function stripRegion(doc: DesignDocument): Rect {
  return { x: 0, y: 0, width: doc.slideWidth * doc.slides.length, height: doc.slideHeight };
}

/** Axis-aligned bounds of a (possibly rotated) element. */
export function elementBounds(el: DesignElement): Rect {
  if (!el.rotation) return { x: el.x, y: el.y, width: el.width, height: el.height };
  const rad = degToRad(el.rotation);
  const cos = Math.abs(Math.cos(rad));
  const sin = Math.abs(Math.sin(rad));
  const w = el.width * cos + el.height * sin;
  const h = el.width * sin + el.height * cos;
  return { x: el.x + el.width / 2 - w / 2, y: el.y + el.height / 2 - h / 2, width: w, height: h };
}

const intersects = (a: Rect, b: Rect) =>
  a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;

const path2dCache = new Map<string, Path2D>();
function path2d(d: string): Path2D | null {
  if (typeof Path2D === 'undefined') return null;
  let p = path2dCache.get(d);
  if (!p) {
    p = new Path2D(d);
    path2dCache.set(d, p);
  }
  return p;
}

function drawShape(ctx: Ctx2D, el: ShapeElement): void {
  const closed = traceShape(ctx, el);
  if (closed && el.fill) {
    ctx.fillStyle = createFillStyle(ctx, el.fill, 0, 0, el.width, el.height);
    ctx.fill();
  }
  if (el.stroke && el.stroke.width > 0) {
    ctx.strokeStyle = el.stroke.color;
    ctx.lineWidth = el.stroke.width;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    if (el.dash?.length) ctx.setLineDash(el.dash);
    // The shadow was already cast by the fill; don't double it on the outline.
    if (closed && el.fill) ctx.shadowColor = 'transparent';
    ctx.stroke();
    ctx.setLineDash([]);
  }
}

function drawPlaceholderGlyph(ctx: Ctx2D, el: ImageElement, background: string): void {
  const size = Math.min(el.width, el.height) * 0.22;
  if (size < 6) return;
  const ink = withAlpha(luminanceIsLight(background) ? '#0B0A12' : '#FFFFFF', 0.35);
  ctx.save();
  ctx.translate(el.width / 2 - size / 2, el.height / 2 - size / 2);
  ctx.strokeStyle = ink;
  ctx.fillStyle = ink;
  ctx.lineWidth = Math.max(1, size * 0.07);
  ctx.lineJoin = 'round';
  roundRectPath(ctx, 0, 0, size, size * 0.8, size * 0.14);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(size * 0.12, size * 0.66);
  ctx.lineTo(size * 0.4, size * 0.38);
  ctx.lineTo(size * 0.6, size * 0.56);
  ctx.lineTo(size * 0.72, size * 0.46);
  ctx.lineTo(size * 0.88, size * 0.66);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(size * 0.7, size * 0.24, size * 0.08, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function luminanceIsLight(color: string): boolean {
  const m = /^#?([0-9a-f]{6})/i.exec(color);
  if (!m) return true;
  const n = parseInt(m[1]!, 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  return 0.299 * r + 0.587 * g + 0.114 * b > 150;
}

function drawImage(ctx: Ctx2D, el: ImageElement, opts: RenderOptions): void {
  const { width: w, height: h } = el;
  const radius = el.cornerRadius ?? 0;
  const source: DrawableImage | null | undefined = el.assetId ? opts.images?.(el.assetId) : null;

  ctx.save();
  roundRectPath(ctx, 0, 0, w, h, radius);
  if (source && source.width > 0 && source.height > 0) {
    ctx.fillStyle = '#000';
    ctx.fill(); // casts the shadow in the frame's shape
    ctx.shadowColor = 'transparent';
    ctx.clip();
    const scale =
      el.fit === 'cover' ? Math.max(w / source.width, h / source.height) : Math.min(w / source.width, h / source.height);
    const dw = source.width * scale;
    const dh = source.height * scale;
    const fx = el.focusX ?? 0.5;
    const fy = el.focusY ?? 0.5;
    ctx.drawImage(source, (w - dw) * fx, (h - dh) * fy, dw, dh);
  } else {
    const fill = el.placeholder?.fill ?? { type: 'solid' as const, color: '#D9D6E8' };
    ctx.fillStyle = createFillStyle(ctx, fill, 0, 0, w, h);
    ctx.fill();
    ctx.shadowColor = 'transparent';
    if (opts.placeholders !== false) drawPlaceholderGlyph(ctx, el, fillPrimaryColor(fill));
  }
  ctx.restore();

  if (el.stroke && el.stroke.width > 0) {
    ctx.shadowColor = 'transparent';
    roundRectPath(ctx, 0, 0, w, h, radius);
    ctx.strokeStyle = el.stroke.color;
    ctx.lineWidth = el.stroke.width;
    ctx.stroke();
  }
}

function drawSticker(ctx: Ctx2D, el: StickerElement): void {
  const resolved = resolveSticker(el.stickerId);
  if (!resolved) return;
  const { width: w, height: h } = el;
  if (resolved.kind === 'emoji') {
    const size = Math.min(w, h) * 0.86;
    ctx.font = `${size}px ${EMOJI_FONT}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#000';
    ctx.fillText(resolved.sticker.char, w / 2, h / 2 + size * 0.04);
    return;
  }
  const s = Math.min(w, h) / 100;
  ctx.translate((w - 100 * s) / 2, (h - 100 * s) / 2);
  ctx.scale(s, s);
  const tint = el.tint ?? resolved.sticker.defaultTint;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  for (const layer of resolved.sticker.layers) {
    const p = path2d(layer.d);
    if (!p) continue;
    if (layer.fill) {
      ctx.fillStyle = layer.fill === 'tint' ? tint : layer.fill;
      ctx.fill(p, 'nonzero');
    }
    if (layer.stroke) {
      ctx.strokeStyle = layer.stroke === 'tint' ? tint : layer.stroke;
      ctx.lineWidth = layer.strokeWidth ?? 3;
      ctx.stroke(p);
    }
  }
}

function drawElement(ctx: Ctx2D, el: DesignElement, opts: RenderOptions, pixelScale: number): void {
  ctx.save();
  ctx.globalAlpha *= el.opacity;
  ctx.translate(el.x + el.width / 2, el.y + el.height / 2);
  if (el.rotation) ctx.rotate(degToRad(el.rotation));
  ctx.translate(-el.width / 2, -el.height / 2);

  // Canvas shadows ignore the transform, so they're scaled to device pixels here.
  const applyShadow = () => {
    if (!el.shadow) return;
    ctx.shadowColor = el.shadow.color;
    ctx.shadowBlur = el.shadow.blur * pixelScale;
    ctx.shadowOffsetX = el.shadow.x * pixelScale;
    ctx.shadowOffsetY = el.shadow.y * pixelScale;
  };
  const clearShadow = () => {
    ctx.shadowColor = 'transparent';
  };

  switch (el.type) {
    case 'text':
      drawText(ctx, el, applyShadow, clearShadow);
      break;
    case 'shape':
      applyShadow();
      drawShape(ctx, el);
      break;
    case 'image':
      applyShadow();
      drawImage(ctx, el, opts);
      break;
    case 'sticker':
      applyShadow();
      drawSticker(ctx, el);
      break;
  }
  ctx.restore();
}

/**
 * Paints (part of) a document. The caller owns the canvas size; this function
 * maps `region` onto the canvas origin at `scale` device pixels per unit.
 */
export function renderDocument(ctx: Ctx2D, doc: DesignDocument, opts: RenderOptions): void {
  const region = opts.region ?? stripRegion(doc);
  ctx.save();
  ctx.scale(opts.scale, opts.scale);
  ctx.translate(-region.x, -region.y);
  const t = ctx.getTransform();
  const pixelScale = Math.hypot(t.a, t.b);

  ctx.beginPath();
  ctx.rect(region.x, region.y, region.width, region.height);
  ctx.clip();

  const full = stripRegion(doc);
  ctx.fillStyle = createFillStyle(ctx, doc.background, full.x, full.y, full.width, full.height);
  ctx.fillRect(region.x, region.y, region.width, region.height);

  doc.slides.forEach((slide, i) => {
    if (!slide.fill) return;
    const r = slideRegion(doc, i);
    if (!intersects(r, region)) return;
    ctx.fillStyle = createFillStyle(ctx, slide.fill, r.x, r.y, r.width, r.height);
    ctx.fillRect(r.x, r.y, r.width, r.height);
  });

  for (const el of doc.elements) {
    if (el.hidden || el.opacity <= 0) continue;
    if (!intersects(elementBounds(el), region)) continue;
    drawElement(ctx, el, opts, pixelScale);
  }
  ctx.restore();
}
