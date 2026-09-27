import type { TextElement } from '@/types/document';
import { fontStack } from '@/typography/fonts';
import { createFillStyle } from './fill';
import { roundRectPath } from './shapes';
import type { Ctx2D } from './types';

export interface TextLine {
  text: string;
  width: number;
}

export interface TextLayout {
  lines: TextLine[];
  font: string;
  /** Line box height in px. */
  lineHeight: number;
  ascent: number;
  descent: number;
  /** Letter spacing in px. */
  spacing: number;
  blockHeight: number;
}

export function fontString(el: Pick<TextElement, 'fontStyle' | 'fontWeight' | 'fontSize' | 'fontFamily'>): string {
  return `${el.fontStyle} ${el.fontWeight} ${el.fontSize}px ${fontStack(el.fontFamily)}`;
}

export function applyTransform(text: string, transform: TextElement['textTransform']): string {
  if (transform === 'uppercase') return text.toUpperCase();
  if (transform === 'lowercase') return text.toLowerCase();
  return text;
}

const chars = (s: string) => Array.from(s);

function measure(ctx: Ctx2D, text: string, spacing: number): number {
  if (!text) return 0;
  const n = chars(text).length;
  return ctx.measureText(text).width + spacing * Math.max(0, n - 1);
}

/** Greedy word wrap that honours explicit newlines and breaks over-long words. */
export function wrapText(ctx: Ctx2D, text: string, maxWidth: number, spacing: number): TextLine[] {
  const lines: TextLine[] = [];
  const push = (t: string) => lines.push({ text: t, width: measure(ctx, t, spacing) });

  for (const paragraph of text.split('\n')) {
    if (paragraph.trim() === '') {
      push('');
      continue;
    }
    const tokens = paragraph.split(/(\s+)/).filter((t) => t.length > 0);
    let line = '';
    for (const token of tokens) {
      const candidate = line + token;
      if (line && measure(ctx, candidate.trimEnd(), spacing) > maxWidth) {
        push(line.trimEnd());
        line = /^\s+$/.test(token) ? '' : token;
      } else {
        line = candidate;
      }
      // A single token wider than the box gets broken by character.
      if (measure(ctx, line.trimEnd(), spacing) > maxWidth && !/\s/.test(line.trim())) {
        let chunk = '';
        for (const c of chars(line)) {
          if (chunk && measure(ctx, chunk + c, spacing) > maxWidth) {
            push(chunk);
            chunk = c;
          } else chunk += c;
        }
        line = chunk;
      }
    }
    push(line.trimEnd());
  }
  return lines;
}

// Layouts are cached per (immutable) element object. The epoch invalidates every
// cached layout when web fonts finish loading, since glyph metrics change then.
const layoutCache = new WeakMap<TextElement, { epoch: number; layout: TextLayout }>();
let fontEpoch = 0;

export function invalidateTextLayouts(): void {
  fontEpoch++;
}

if (typeof document !== 'undefined' && document.fonts?.addEventListener) {
  document.fonts.addEventListener('loadingdone', invalidateTextLayouts);
}

export function layoutText(ctx: Ctx2D, el: TextElement): TextLayout {
  const cached = layoutCache.get(el);
  if (cached && cached.epoch === fontEpoch) {
    ctx.font = cached.layout.font;
    return cached.layout;
  }
  const font = fontString(el);
  ctx.font = font;
  const spacing = el.letterSpacing * el.fontSize;
  const text = applyTransform(el.text, el.textTransform);
  const lines = wrapText(ctx, text, Math.max(1, el.width), spacing);
  const metrics = ctx.measureText('Hg');
  const ascent = metrics.fontBoundingBoxAscent || el.fontSize * 0.8;
  const descent = metrics.fontBoundingBoxDescent || el.fontSize * 0.2;
  const lineHeight = el.fontSize * el.lineHeight;
  const layout = { lines, font, lineHeight, ascent, descent, spacing, blockHeight: lines.length * lineHeight };
  layoutCache.set(el, { epoch: fontEpoch, layout });
  return layout;
}

let measureCtx: CanvasRenderingContext2D | null | undefined;

function getMeasureCtx(): CanvasRenderingContext2D | null {
  if (measureCtx === undefined) {
    measureCtx = typeof document === 'undefined' ? null : document.createElement('canvas').getContext('2d');
  }
  return measureCtx;
}

/** Widest line of the text without wrapping (for sizing new text boxes to their content). */
export function measureTextWidth(el: TextElement): number {
  const ctx = getMeasureCtx();
  const text = applyTransform(el.text, el.textTransform);
  if (!ctx) return Math.max(...text.split('\n').map((l) => l.length)) * el.fontSize * 0.6;
  ctx.font = fontString(el);
  const spacing = el.letterSpacing * el.fontSize;
  return Math.max(...text.split('\n').map((line) => measure(ctx, line, spacing)));
}

/** Height the text needs at its current width (used for auto-height text boxes). */
export function measureTextHeight(el: TextElement): number {
  getMeasureCtx();
  if (!measureCtx) {
    // No canvas (tests / very old browsers): estimate from explicit line breaks.
    return Math.max(1, el.text.split('\n').length) * el.fontSize * el.lineHeight;
  }
  const layout = layoutText(measureCtx, el);
  if (!isWarped(el)) return layout.blockHeight;
  const { above, below } = warpedGlyphs(measureCtx, el, layout);
  return layout.blockHeight + above + below;
}

/* ───────────── Curved & warped text ───────────── */

export const isWarped = (el: Pick<TextElement, 'warp'>): boolean => !!el.warp && Math.abs(el.warp.amount) >= 0.5;

/** A glyph placed by a warp: drawn centred on (x, y) — y is its baseline — turned by `angle` and stretched by `scaleY`. */
export interface PlacedGlyph {
  text: string;
  x: number;
  y: number;
  width: number;
  angle: number;
  scaleY: number;
  /** Line index (for the typewriter reveal). */
  line: number;
}

const warpCache = new WeakMap<TextElement, { epoch: number; glyphs: PlacedGlyph[]; above: number; below: number }>();

/**
 * Where every glyph goes under the element's warp, for a straight block whose top is at 0,
 * plus how far the warped text reaches above and below that block.
 *
 * - arc: lines follow concentric circles (positive arches up, negative smiles); 100 bends a
 *   full-width line through half a circle.
 * - wave: one sine wave across the box, glyphs tilted along it.
 * - bulge: glyphs grow towards the middle (negative: shrink).
 * - rise: glyphs grow from left to right (negative: right to left).
 */
export function warpedGlyphs(
  ctx: Ctx2D,
  el: TextElement,
  layout: TextLayout,
): { glyphs: PlacedGlyph[]; above: number; below: number } {
  const hit = warpCache.get(el);
  if (hit && hit.epoch === fontEpoch) return hit;
  ctx.font = layout.font;
  const warp = el.warp!;
  const a = Math.max(-1, Math.min(1, warp.amount / 100));
  const { lines, lineHeight, ascent, descent, spacing, blockHeight } = layout;
  const W = Math.max(1, el.width);
  const halfLeading = (lineHeight - (ascent + descent)) / 2;
  const baselines = lines.map((_, i) => i * lineHeight + halfLeading + ascent);
  const yMid = baselines.length ? (baselines[0]! + baselines[baselines.length - 1]!) / 2 : 0;
  const minR = el.fontSize * 0.5;
  const R0 = Math.max(el.fontSize, W / (Math.max(0.001, Math.abs(a)) * Math.PI));
  const centreY = a > 0 ? yMid + R0 : yMid - R0;

  const glyphs: PlacedGlyph[] = [];
  lines.forEach((line, li) => {
    const b = baselines[li]!;
    const x0 = el.align === 'center' ? (W - line.width) / 2 : el.align === 'right' ? W - line.width : 0;
    let prefix = '';
    chars(line.text).forEach((g, k) => {
      const width = ctx.measureText(g).width;
      const cx = x0 + ctx.measureText(prefix).width + k * spacing + width / 2;
      prefix += g;
      const u = (cx - W / 2) / (W / 2);
      let x = cx;
      let y = b;
      let angle = 0;
      let scaleY = 1;
      if (warp.style === 'arc') {
        const r = Math.max(minR, a > 0 ? centreY - b : b - centreY);
        const phi = (cx - W / 2) / r;
        x = W / 2 + r * Math.sin(phi);
        y = a > 0 ? centreY - r * Math.cos(phi) : centreY + r * Math.cos(phi);
        angle = a > 0 ? phi : -phi;
      } else if (warp.style === 'wave') {
        const amp = a * el.fontSize * 0.5;
        y = b + amp * Math.sin(Math.PI * u);
        angle = Math.atan(((amp * Math.PI) / (W / 2)) * Math.cos(Math.PI * u));
      } else if (warp.style === 'bulge') {
        scaleY = Math.max(0.25, 1 + a * 0.6 * (1 - Math.min(1, u * u)));
      } else {
        scaleY = Math.max(0.25, 1 + a * 0.6 * Math.max(-1, Math.min(1, u)));
      }
      glyphs.push({ text: g, x, y, width, angle, scaleY, line: li });
    });
  });

  // How far the placed glyphs (as turned, stretched boxes) reach past the straight block.
  let top = 0;
  let bottom = blockHeight;
  for (const g of glyphs) {
    // Bulge grows around the middle of the capitals; rise and arc/wave around the baseline.
    const pivot = warp.style === 'bulge' ? ascent * 0.35 : 0;
    const up = pivot + (ascent - pivot) * g.scaleY;
    const down = -pivot + (descent + pivot) * g.scaleY;
    const sin = Math.abs(Math.sin(g.angle));
    const cos = Math.abs(Math.cos(g.angle));
    top = Math.min(top, g.y - up * cos - (g.width / 2) * sin);
    bottom = Math.max(bottom, g.y + down * cos + (g.width / 2) * sin);
  }
  // A little room for glyph ink past the font's box (swashes, rounding at steep angles).
  const margin = el.fontSize * 0.06;
  const result = {
    glyphs,
    above: top < 0 ? -top + margin : 0,
    below: bottom > blockHeight ? bottom - blockHeight + margin : 0,
  };
  warpCache.set(el, { epoch: fontEpoch, ...result });
  return result;
}

function drawGlyphs(ctx: Ctx2D, glyphs: PlacedGlyph[], dy: number, pivotUp: number, mode: 'fill' | 'stroke'): void {
  for (const g of glyphs) {
    if (!g.text.trim()) continue;
    ctx.save();
    ctx.translate(g.x, g.y + dy);
    if (g.angle) ctx.rotate(g.angle);
    if (g.scaleY !== 1) {
      ctx.translate(0, -pivotUp);
      ctx.scale(1, g.scaleY);
      ctx.translate(0, pivotUp);
    }
    if (mode === 'fill') ctx.fillText(g.text, -g.width / 2, 0);
    else ctx.strokeText(g.text, -g.width / 2, 0);
    ctx.restore();
  }
}

function drawLine(ctx: Ctx2D, line: TextLine, x: number, baseline: number, spacing: number, mode: 'fill' | 'stroke'): void {
  if (!line.text) return;
  if (spacing === 0) {
    if (mode === 'fill') ctx.fillText(line.text, x, baseline);
    else ctx.strokeText(line.text, x, baseline);
    return;
  }
  // Position each glyph by measuring the prefix, which preserves kerning.
  const glyphs = chars(line.text);
  let prefix = '';
  glyphs.forEach((g, i) => {
    const gx = x + ctx.measureText(prefix).width + i * spacing;
    if (mode === 'fill') ctx.fillText(g, gx, baseline);
    else ctx.strokeText(g, gx, baseline);
    prefix += g;
  });
}

/** Keeps the first `reveal` fraction of the characters (typewriter), line by line. Widths are re-measured. */
function revealLines(ctx: Ctx2D, lines: TextLine[], reveal: number, spacing: number): TextLine[] {
  if (reveal >= 1) return lines;
  const total = lines.reduce((n, l) => n + chars(l.text).length, 0);
  let budget = Math.floor(Math.max(0, reveal) * total + 1e-6);
  return lines.map((l) => {
    const glyphs = chars(l.text);
    const shown = glyphs.slice(0, Math.max(0, budget)).join('');
    budget -= glyphs.length;
    return shown.length === l.text.length ? l : { text: shown, width: measure(ctx, shown, spacing) };
  });
}

/**
 * Draws a text element into its local box (0,0,width,height). `reveal` < 1
 * shows only the first part of the text (typewriter); lines keep the position
 * they have when complete, so the text types out in place.
 */
export function drawText(ctx: Ctx2D, el: TextElement, shadow: () => void, clearShadow: () => void, reveal = 1): void {
  const layout = layoutText(ctx, el);
  if (isWarped(el)) {
    drawWarpedText(ctx, el, layout, shadow, clearShadow, reveal);
    return;
  }
  const { lineHeight, ascent, descent, spacing, blockHeight } = layout;
  const lines = layout.lines;
  const shown = revealLines(ctx, lines, reveal, spacing);
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';

  const top =
    el.verticalAlign === 'middle' ? (el.height - blockHeight) / 2 : el.verticalAlign === 'bottom' ? el.height - blockHeight : 0;
  const halfLeading = (lineHeight - (ascent + descent)) / 2;
  const positioned = lines.map((full, i) => {
    const x = el.align === 'center' ? (el.width - full.width) / 2 : el.align === 'right' ? el.width - full.width : 0;
    return { line: shown[i]!, x, baseline: top + i * lineHeight + halfLeading + ascent };
  });

  let shadowPending = Boolean(el.shadow);
  const withShadowOnce = () => {
    if (shadowPending) {
      shadow();
      shadowPending = false;
    } else clearShadow();
  };

  if (el.highlight) {
    const { padding, radius } = el.highlight;
    ctx.fillStyle = createFillStyle(ctx, el.highlight.fill, 0, 0, el.width, el.height);
    withShadowOnce();
    for (const { line, x, baseline } of positioned) {
      if (!line.text.trim()) continue;
      roundRectPath(
        ctx,
        x - padding,
        baseline - ascent - padding / 2,
        line.width + padding * 2,
        ascent + descent + padding,
        radius,
      );
      ctx.fill();
    }
  }

  if (el.stroke && el.stroke.width > 0) {
    ctx.strokeStyle = el.stroke.color;
    ctx.lineWidth = el.stroke.width * 2;
    ctx.lineJoin = 'round';
    ctx.miterLimit = 2;
    withShadowOnce();
    for (const p of positioned) drawLine(ctx, p.line, p.x, p.baseline, spacing, 'stroke');
  }

  ctx.fillStyle = createFillStyle(ctx, el.fill, 0, 0, el.width, el.height);
  withShadowOnce();
  for (const p of positioned) drawLine(ctx, p.line, p.x, p.baseline, spacing, 'fill');
}

/** Warped text: each glyph placed and turned on its own (see `warpedGlyphs`). */
function drawWarpedText(
  ctx: Ctx2D,
  el: TextElement,
  layout: TextLayout,
  shadow: () => void,
  clearShadow: () => void,
  reveal: number,
): void {
  const { glyphs, above, below } = warpedGlyphs(ctx, el, layout);
  const total = layout.blockHeight + above + below;
  const dy =
    (el.verticalAlign === 'middle' ? (el.height - total) / 2 : el.verticalAlign === 'bottom' ? el.height - total : 0) + above;
  const count = glyphs.length;
  const shown = reveal >= 1 ? glyphs : glyphs.slice(0, Math.floor(Math.max(0, reveal) * count + 1e-6));
  const pivotUp = el.warp!.style === 'bulge' ? layout.ascent * 0.35 : 0;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.font = layout.font;

  let shadowPending = Boolean(el.shadow);
  const withShadowOnce = () => {
    if (shadowPending) {
      shadow();
      shadowPending = false;
    } else clearShadow();
  };

  if (el.stroke && el.stroke.width > 0) {
    ctx.strokeStyle = el.stroke.color;
    ctx.lineWidth = el.stroke.width * 2;
    ctx.lineJoin = 'round';
    ctx.miterLimit = 2;
    withShadowOnce();
    drawGlyphs(ctx, shown, dy, pivotUp, 'stroke');
  }

  if (el.fill.type === 'solid') {
    ctx.fillStyle = el.fill.color;
    withShadowOnce();
    drawGlyphs(ctx, shown, dy, pivotUp, 'fill');
    return;
  }
  // A gradient stays put in the box while the glyphs turn: draw the glyphs as a mask, then fill through it.
  const t = ctx.getTransform();
  const scale = Math.max(0.01, Math.hypot(t.a, t.b));
  const pad = el.fontSize;
  const w = Math.ceil((el.width + pad * 2) * scale);
  const h = Math.ceil((el.height + above + below + pad * 2) * scale);
  const layer = scratch(w, h);
  const lctx = layer?.getContext('2d') as Ctx2D | null | undefined;
  if (!layer || !lctx) {
    ctx.fillStyle = createFillStyle(ctx, el.fill, 0, 0, el.width, el.height);
    withShadowOnce();
    drawGlyphs(ctx, shown, dy, pivotUp, 'fill');
    return;
  }
  lctx.setTransform(1, 0, 0, 1, 0, 0);
  lctx.clearRect(0, 0, w, h);
  lctx.setTransform(scale, 0, 0, scale, pad * scale, pad * scale);
  lctx.font = layout.font;
  lctx.textAlign = 'left';
  lctx.textBaseline = 'alphabetic';
  lctx.fillStyle = '#000';
  drawGlyphs(lctx, shown, dy, pivotUp, 'fill');
  lctx.globalCompositeOperation = 'source-in';
  lctx.fillStyle = createFillStyle(lctx, el.fill, 0, 0, el.width, el.height);
  lctx.fillRect(-pad, -pad, el.width + pad * 2, el.height + above + below + pad * 2);
  lctx.globalCompositeOperation = 'source-over';
  withShadowOnce();
  ctx.drawImage(layer, -pad, -pad, w / scale, h / scale);
}

let scratchCanvas: HTMLCanvasElement | OffscreenCanvas | null = null;

/** A reusable offscreen canvas for gradient-filled warped text. */
function scratch(w: number, h: number): HTMLCanvasElement | OffscreenCanvas | null {
  if (w > 8192 || h > 8192) return null;
  if (!scratchCanvas) {
    if (typeof OffscreenCanvas !== 'undefined') scratchCanvas = new OffscreenCanvas(w, h);
    else if (typeof document !== 'undefined') scratchCanvas = document.createElement('canvas');
    else return null;
  }
  if (scratchCanvas.width < w) scratchCanvas.width = w;
  if (scratchCanvas.height < h) scratchCanvas.height = h;
  return scratchCanvas;
}
