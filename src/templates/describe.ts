import type { DesignDocument, Fill, ImageElement } from '@/types/document';
import { slideIndexOf } from '@/projects/document';
import { normalizeHex } from '@/utils/color';
import { resolveLook } from '@/filters/looks';

/** What a template is made of — shown in the template preview and checked by tests. */
export interface TemplateFacts {
  width: number;
  height: number;
  slides: number;
  fonts: string[];
  colors: string[];
  photoSlots: number;
  texts: number;
  stickers: string[];
  /** Names of the filters its photo frames apply. */
  looks: string[];
}

/** Empty photo frames in reading order: slide by slide, then top to bottom, then left to right. */
export function photoSlots(doc: DesignDocument): ImageElement[] {
  const slots = doc.elements.filter((e): e is ImageElement => e.type === 'image' && !e.assetId && !e.hidden);
  const row = doc.slideHeight / 12;
  return slots
    .map((el) => ({ el, slide: slideIndexOf(el, doc), band: Math.round((el.y + el.height / 2) / row) }))
    .sort((a, b) => a.slide - b.slide || a.band - b.band || a.el.x - b.el.x)
    .map((s) => s.el);
}

function fillColors(fill: Fill | null | undefined): string[] {
  if (!fill) return [];
  return fill.type === 'solid' ? [fill.color] : fill.stops.map((s) => s.color);
}

/**
 * The colours a design uses, most prominent first (weighted by area), so a
 * saved design can be re-coloured with the same palette remix as templates.
 */
export function derivePalette(doc: DesignDocument, max = 6): string[] {
  const weight = new Map<string, number>();
  const add = (color: string, w: number) => {
    const hex = normalizeHex(color)?.slice(0, 7);
    if (hex) weight.set(hex, (weight.get(hex) ?? 0) + w);
  };
  const strip = doc.slideWidth * doc.slides.length * doc.slideHeight;
  fillColors(doc.background).forEach((c) => add(c, strip));
  doc.slides.forEach((s) => fillColors(s.fill).forEach((c) => add(c, doc.slideWidth * doc.slideHeight)));
  for (const el of doc.elements) {
    const area = Math.max(1, el.width * el.height);
    switch (el.type) {
      case 'text':
        // Text is small but defines the look — weight it up.
        fillColors(el.fill).forEach((c) => add(c, area * 3));
        if (el.highlight) fillColors(el.highlight.fill).forEach((c) => add(c, area));
        break;
      case 'shape':
        fillColors(el.fill).forEach((c) => add(c, area));
        if (el.stroke) add(el.stroke.color, area * 0.2);
        break;
      case 'image':
        if (el.stroke) add(el.stroke.color, area * 0.2);
        if (!el.assetId && el.placeholder) fillColors(el.placeholder.fill).forEach((c) => add(c, area * 0.5));
        break;
      case 'sticker':
        if (el.tint) add(el.tint, area);
        break;
    }
  }
  return [...weight.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, max)
    .map(([c]) => c);
}

export function describeTemplate(doc: DesignDocument): TemplateFacts {
  const fonts = new Set<string>();
  const stickers = new Set<string>();
  const looks = new Set<string>();
  let texts = 0;
  for (const el of doc.elements) {
    if (el.type === 'text') {
      fonts.add(el.fontFamily);
      texts++;
    } else if (el.type === 'sticker') stickers.add(el.stickerId);
    else if (el.type === 'image') {
      const look = resolveLook(el.filter);
      if (look) looks.add(look.name);
    }
  }
  return {
    width: doc.slideWidth,
    height: doc.slideHeight,
    slides: doc.slides.length,
    fonts: [...fonts],
    colors: derivePalette(doc),
    photoSlots: photoSlots(doc).length,
    texts,
    stickers: [...stickers],
    looks: [...looks],
  };
}
