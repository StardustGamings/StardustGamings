import type { DesignDocument, DesignElement, ImageElement, ShapeElement, StickerElement } from '@/types/document';
import { resolveSticker } from '@/stickers/library';
import { degToRad } from '@/utils/math';
import { withAlpha } from '@/utils/color';
import { contentLayout } from '@/images/content';
import { effectiveVignette } from '@/filters/compose';
import { createFillStyle, fillPrimaryColor } from './fill';
import { roundRectPath, traceClip, traceShape } from './shapes';
import { drawText } from './text';
import { textPhotoFrame } from './text-photo';
import type { Ctx2D, ImageResolver, Rect, ResolvedImage } from './types';
import { noise, poseAt, REST, type Pose } from '@/animations/engine';
import { homeSlide, slideDuration } from '@/animations/sequence';

export interface RenderOptions {
  /** Area of the strip to draw, in design units. Defaults to the whole strip. */
  region?: Rect;
  /** Device pixels per design unit. */
  scale: number;
  images?: ImageResolver;
  /** Draw drop-zone glyphs for empty image frames (off for final exports). */
  placeholders?: boolean;
  /** Elements to leave out (e.g. the text box being edited in place). */
  skip?: ReadonlySet<string>;
  /**
   * Motion: ms into each slide, by slide index (see src/animations). Omitted, or
   * `undefined` for a slide, draws the resting design — what stills export.
   */
  time?: (slide: number) => number | undefined;
  /** Paint the background and slide fills (default). Off for a layer drawn over another. */
  background?: boolean;
  /** Draw only the elements this accepts (by position in `doc.elements`) — for cached layers. */
  include?: (index: number) => boolean;
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

/** Draws the photo in element space according to its fit/zoom/focus/straighten/flip/turns. */
function drawPhoto(ctx: Ctx2D, el: ImageElement, img: ResolvedImage): void {
  const l = contentLayout(el, img.width, img.height);
  ctx.translate(el.width / 2, el.height / 2);
  if (l.angle) ctx.rotate(l.angle);
  ctx.translate(l.offsetX, l.offsetY);
  if (el.flipX || el.flipY) ctx.scale(el.flipX ? -1 : 1, el.flipY ? -1 : 1);
  if (el.turns) ctx.rotate((el.turns * Math.PI) / 2);
  const w = img.width * l.scale;
  const h = img.height * l.scale;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(img.source, -w / 2, -h / 2, w, h);
}

/**
 * Vignette follows the visible frame (not the whole photo), so it stays put
 * when the photo is cropped or zoomed. Same falloff as the develop shader:
 * smoothstep(0.35, 1.05, d) × |amount| × 0.8, darkening (or lightening) the edges.
 */
function drawVignette(ctx: Ctx2D, el: ImageElement): void {
  const v = Math.max(-1, Math.min(1, effectiveVignette(el) / 100));
  if (!v || typeof ctx.createRadialGradient !== 'function') return;
  const ink = v > 0 ? '0, 0, 0' : '255, 255, 255';
  ctx.save();
  ctx.translate(el.width / 2, el.height / 2);
  ctx.scale(el.width / 2, el.height / 2);
  const g = ctx.createRadialGradient(0, 0, 0, 0, 0, Math.SQRT2);
  for (let i = 0; i <= 10; i++) {
    const t = i / 10;
    const s = Math.max(0, Math.min(1, (t - 0.35) / 0.7));
    g.addColorStop(t, `rgba(${ink}, ${(s * s * (3 - 2 * s) * Math.abs(v) * 0.8).toFixed(3)})`);
  }
  ctx.fillStyle = g;
  ctx.fillRect(-1, -1, 2, 2);
  ctx.restore();
}

type LayerCanvas = HTMLCanvasElement | OffscreenCanvas;
let layerCanvas: LayerCanvas | null = null;

function scratchCanvas(w: number, h: number): LayerCanvas | null {
  if (!layerCanvas) {
    if (typeof OffscreenCanvas !== 'undefined') layerCanvas = new OffscreenCanvas(w, h);
    else if (typeof document !== 'undefined') layerCanvas = document.createElement('canvas');
    else return null;
  }
  if (layerCanvas.width !== w) layerCanvas.width = w;
  if (layerCanvas.height !== h) layerCanvas.height = h;
  return layerCanvas;
}

/**
 * Transparent content (cut-outs, PNG stickers, `contain` fits) casts its shadow
 * from its own pixels, and its vignette must not tint the empty areas: render the
 * clipped photo into a scratch layer, then draw that layer (with the shadow on).
 */
function drawAsLayer(ctx: Ctx2D, el: ImageElement, img: ResolvedImage, pixelScale: number, applyShadow: () => void) {
  const scale = Math.min(pixelScale, 4096 / Math.max(el.width, el.height, 1));
  const lw = Math.max(1, Math.ceil(el.width * scale));
  const lh = Math.max(1, Math.ceil(el.height * scale));
  const canvas = scratchCanvas(lw, lh);
  const lctx = canvas?.getContext('2d') as Ctx2D | null | undefined;
  if (!canvas || !lctx) return false;
  lctx.setTransform(1, 0, 0, 1, 0, 0);
  lctx.clearRect(0, 0, lw, lh);
  lctx.scale(lw / el.width, lh / el.height);
  traceClip(lctx, el.clip ?? 'rect', el.width, el.height, el.cornerRadius ?? 0);
  lctx.clip();
  lctx.save();
  drawPhoto(lctx, el, img);
  lctx.restore();
  // Only tint pixels that exist (a cut-out's transparent surroundings stay clear).
  lctx.globalCompositeOperation = 'source-atop';
  drawVignette(lctx, el);
  lctx.globalCompositeOperation = 'source-over';
  applyShadow();
  ctx.drawImage(canvas, 0, 0, el.width, el.height);
  ctx.shadowColor = 'transparent';
  return true;
}

function drawImage(
  ctx: Ctx2D,
  el: ImageElement,
  opts: RenderOptions,
  pixelScale: number,
  applyShadow: () => void,
  time: number | undefined,
): void {
  const { width: w, height: h } = el;
  const radius = el.cornerRadius ?? 0;
  const clip = el.clip ?? 'rect';
  const resolved = el.assetId ? opts.images?.(el, pixelScale, time) : null;

  if (resolved && resolved.width > 0 && resolved.height > 0) {
    const transparent = resolved.alpha || el.fit === 'contain';
    const layered = transparent && (el.shadow || effectiveVignette(el));
    if (!(layered && drawAsLayer(ctx, el, resolved, pixelScale, applyShadow))) {
      ctx.save();
      traceClip(ctx, clip, w, h, radius);
      if (el.shadow && !transparent) {
        applyShadow();
        ctx.fillStyle = '#000';
        ctx.fill(); // casts the shadow in the frame's shape
        ctx.shadowColor = 'transparent';
      }
      ctx.clip();
      ctx.save();
      drawPhoto(ctx, el, resolved);
      ctx.restore();
      if (!transparent) drawVignette(ctx, el);
      ctx.restore();
    }
  } else {
    const loading = resolved === undefined && el.assetId !== null && opts.images !== undefined;
    const fill = el.placeholder?.fill ?? { type: 'solid' as const, color: '#D9D6E8' };
    ctx.save();
    traceClip(ctx, clip, w, h, radius);
    applyShadow();
    ctx.fillStyle = loading ? 'rgba(140, 136, 160, 0.28)' : createFillStyle(ctx, fill, 0, 0, w, h);
    ctx.fill();
    ctx.shadowColor = 'transparent';
    if (!loading && opts.placeholders !== false) drawPlaceholderGlyph(ctx, el, fillPrimaryColor(fill));
    ctx.restore();
  }

  if (el.stroke && el.stroke.width > 0) {
    ctx.shadowColor = 'transparent';
    traceClip(ctx, clip, w, h, radius);
    ctx.strokeStyle = el.stroke.color;
    ctx.lineWidth = el.stroke.width;
    ctx.lineJoin = 'round';
    ctx.stroke();
  }
}

function drawSticker(ctx: Ctx2D, el: StickerElement): void {
  const resolved = resolveSticker(el.stickerId, el.art);
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

function drawElement(
  ctx: Ctx2D,
  el: DesignElement,
  opts: RenderOptions,
  pixelScale: number,
  pose: Pose = REST,
  time?: number,
): void {
  ctx.save();
  ctx.globalAlpha *= el.opacity * pose.opacity;
  ctx.translate(el.x + el.width / 2 + pose.dx, el.y + el.height / 2 + pose.dy);
  if (el.rotation || pose.rotate) ctx.rotate(degToRad(el.rotation + pose.rotate));
  if (pose.scale !== 1 || pose.scaleX !== 1) ctx.scale(pose.scale * pose.scaleX, pose.scale);
  ctx.translate(-el.width / 2, -el.height / 2);
  if (pose.blur > 0 && 'filter' in ctx) ctx.filter = `blur(${(pose.blur * pixelScale * pose.scale).toFixed(2)}px)`;
  // Wipe-in for everything that isn't text (text types itself out instead).
  if (pose.reveal < 1 && el.type !== 'text') {
    ctx.beginPath();
    ctx.rect(0, -el.height, el.width * Math.max(0, pose.reveal), el.height * 3);
    ctx.clip();
  }

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

  const body = () => {
    switch (el.type) {
      case 'text': {
        // Photo-filled text: the photo shows through the letters once it's loaded; `fill` stands in until then.
        const frame = el.photoFill && opts.images ? textPhotoFrame(el) : null;
        const photo = frame ? opts.images!(frame, pixelScale, time) : null;
        const paint =
          frame && photo && photo.width > 0 && photo.height > 0 ? (c: Ctx2D) => drawPhoto(c, frame, photo) : undefined;
        drawText(ctx, el, applyShadow, clearShadow, pose.reveal, paint);
        break;
      }
      case 'shape':
        applyShadow();
        drawShape(ctx, el);
        break;
      case 'image':
        drawImage(ctx, el, opts, pixelScale, applyShadow, time);
        break;
      case 'sticker':
        applyShadow();
        drawSticker(ctx, el);
        break;
    }
  };

  if (pose.glitch > 0) drawGlitched(ctx, el, pose, body);
  else body();
  ctx.restore();
}

/** Digital glitch: horizontal bands knocked sideways, plus a faint offset ghost. */
function drawGlitched(ctx: Ctx2D, el: DesignElement, pose: Pose, body: () => void): void {
  const bands = 7;
  const reach = el.width * 0.16 * pose.glitch;
  for (let b = 0; b < bands; b++) {
    const y = (b / bands) * el.height;
    const shift = noise(pose.seed * 13 + b) > 0.45 ? (noise(pose.seed * 7 + b * 3) - 0.5) * 2 * reach : 0;
    ctx.save();
    ctx.beginPath();
    ctx.rect(-el.width, y, el.width * 3, el.height / bands + 0.5);
    ctx.clip();
    ctx.translate(shift, 0);
    body();
    ctx.restore();
  }
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.globalAlpha *= 0.3 * pose.glitch;
  ctx.translate(reach * 0.25, 0);
  body();
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

  if (opts.background !== false) {
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
  }

  for (let index = 0; index < doc.elements.length; index++) {
    const el = doc.elements[index]!;
    if (opts.include && !opts.include(index)) continue;
    if (el.hidden || el.opacity <= 0 || opts.skip?.has(el.id)) continue;
    let pose: Pose | null = REST;
    let t: number | undefined;
    if (opts.time) {
      const home = homeSlide(doc, el);
      t = opts.time(home);
      if (t !== undefined) {
        pose = poseAt(el, t, { width: doc.slideWidth, height: doc.slideHeight, duration: slideDuration(doc, home) });
      }
    }
    if (!pose) continue;
    // Moving elements may travel in from outside the region, so only resting ones are culled.
    if (pose === REST && !intersects(elementBounds(el), region)) continue;
    drawElement(ctx, el, opts, pixelScale, pose, t);
  }
  ctx.restore();
}

/**
 * Crop mode: draws an image element's entire photo faintly (so you can see
 * what's outside the frame), then the framed part at full strength on top.
 * `ctx` must already map design units at `scale` from the design origin.
 */
export function renderCropPreview(
  ctx: Ctx2D,
  doc: DesignDocument,
  id: string,
  opts: { scale: number; images?: ImageResolver },
): void {
  const el = doc.elements.find((e): e is ImageElement => e.id === id && e.type === 'image');
  if (!el) return;
  ctx.save();
  ctx.scale(opts.scale, opts.scale);
  const t = ctx.getTransform();
  const resolved = opts.images?.(el, Math.hypot(t.a, t.b));
  if (!resolved) {
    ctx.restore();
    return;
  }
  ctx.translate(el.x + el.width / 2, el.y + el.height / 2);
  if (el.rotation) ctx.rotate(degToRad(el.rotation));
  ctx.translate(-el.width / 2, -el.height / 2);
  ctx.save();
  ctx.globalAlpha = 0.38;
  drawPhoto(ctx, el, resolved);
  ctx.restore();
  traceClip(ctx, el.clip ?? 'rect', el.width, el.height, el.cornerRadius ?? 0);
  ctx.clip();
  ctx.save();
  drawPhoto(ctx, el, resolved);
  ctx.restore();
  if (!resolved.alpha) drawVignette(ctx, el);
  ctx.restore();
}
