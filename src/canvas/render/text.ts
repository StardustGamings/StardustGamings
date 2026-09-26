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
  return layoutText(measureCtx, el).blockHeight;
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
