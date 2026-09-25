import type { DesignDocument, Fill } from '@/types/document';
import { luminance, normalizeHex } from '@/utils/color';

/**
 * Re-colours a document from its source palette to a target palette. Colours are
 * matched by luminance rank (lightest→lightest, darkest→darkest) so contrast
 * relationships — dark text on a light background — survive the swap.
 */
export function buildPaletteMap(source: string[], target: string[]): Map<string, string> {
  const map = new Map<string, string>();
  if (source.length === 0 || target.length === 0) return map;
  const byLum = (list: string[]) => [...list].sort((a, b) => luminance(b) - luminance(a));
  const src = byLum(source);
  const dst = byLum(target);
  src.forEach((color, i) => {
    const rank = src.length === 1 ? 0 : i / (src.length - 1);
    const key = normalizeHex(color);
    if (key) map.set(key, dst[Math.round(rank * (dst.length - 1))]!);
  });
  return map;
}

export function remixDocument(doc: DesignDocument, source: string[], target: string[]): DesignDocument {
  const map = buildPaletteMap(source, target);
  const swap = (color: string) => map.get(normalizeHex(color) ?? '') ?? color;
  const swapFill = (fill: Fill): Fill =>
    fill.type === 'solid'
      ? { ...fill, color: swap(fill.color) }
      : { ...fill, stops: fill.stops.map((s) => ({ ...s, color: swap(s.color) })) };

  return {
    ...doc,
    background: swapFill(doc.background),
    slides: doc.slides.map((s) => ({ ...s, fill: s.fill ? swapFill(s.fill) : null })),
    elements: doc.elements.map((el) => {
      switch (el.type) {
        case 'text':
          return {
            ...el,
            fill: swapFill(el.fill),
            stroke: el.stroke && { ...el.stroke, color: swap(el.stroke.color) },
            highlight: el.highlight && { ...el.highlight, fill: swapFill(el.highlight.fill) },
          };
        case 'shape':
          return {
            ...el,
            fill: el.fill && swapFill(el.fill),
            stroke: el.stroke && { ...el.stroke, color: swap(el.stroke.color) },
          };
        case 'image':
          return {
            ...el,
            stroke: el.stroke && { ...el.stroke, color: swap(el.stroke.color) },
            placeholder: el.placeholder && { ...el.placeholder, fill: swapFill(el.placeholder.fill) },
          };
        case 'sticker':
          return el.tint ? { ...el, tint: swap(el.tint) } : el;
      }
    }),
  };
}
