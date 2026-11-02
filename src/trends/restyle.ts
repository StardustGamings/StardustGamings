import type { DesignDocument, DesignElement, TextElement } from '@/types/document';
import type { LookDefinition } from '@/filters/looks';
import { lookFilter } from '@/filters/looks';
import { autoAnimate, type AutoVibe } from '@/animations/auto';
import { derivePalette } from '@/templates/describe';
import { remixDocument } from '@/templates/remix';
import { measureTextHeight, measureTextWidth } from '@/canvas/render/text';
import { supportedWeight } from '@/typography/fonts';
import { homeSlide } from '@/animations/sequence';
import { resolveStyle } from './pack';
import type { TrendPack, TrendStyle, TrendTypography } from './schema';

/**
 * Restyling a whole design with a trend kit — or just one part of one: its
 * colours (a palette remix that keeps light-on-dark contrast), its type (the
 * biggest text on each slide takes the heading font, the rest the body font),
 * a filter on every photo and empty frame, and motion. Pure: the editor wraps
 * it in one undo step.
 */

export interface RestyleKit {
  palette?: string[];
  typography?: TrendTypography;
  look?: LookDefinition;
  lookIntensity?: number;
  animate?: AutoVibe;
}

/** Colours: every colour in the design, lightest to darkest, onto the palette, lightest to darkest. */
export function restyleColors(doc: DesignDocument, palette: string[]): DesignDocument {
  return remixDocument(doc, derivePalette(doc, 64), palette);
}

/** Headlines: on each slide, the largest text (and anything within 80% of its size). */
export function headlineIds(doc: DesignDocument): Set<string> {
  const bySlide = new Map<number, TextElement[]>();
  for (const el of doc.elements) {
    if (el.type !== 'text' || el.locked) continue;
    const slide = homeSlide(doc, el);
    bySlide.set(slide, [...(bySlide.get(slide) ?? []), el]);
  }
  const out = new Set<string>();
  for (const texts of bySlide.values()) {
    const max = Math.max(...texts.map((t) => t.fontSize));
    // A slide of equal-size text (a single caption) is body copy, not a headline.
    if (texts.length > 1 && texts.every((t) => t.fontSize === max)) continue;
    for (const t of texts) if (t.fontSize >= max * 0.8) out.add(t.id);
  }
  return out;
}

/**
 * Shrinks text whose longest word no longer fits its box (a wider font), and
 * grows the box if the text needs more height — never shrinks it, so text
 * centred in a box (a label on a pill) stays centred.
 */
function fitWords(el: TextElement): TextElement {
  const words = el.text.split(/\s+/).filter(Boolean);
  let widest = 0;
  for (const word of words) widest = Math.max(widest, measureTextWidth({ ...el, text: word }));
  const next =
    widest > el.width ? { ...el, fontSize: Math.max(el.fontSize * 0.6, Math.floor((el.fontSize * el.width) / widest)) } : el;
  const needed = measureTextHeight(next);
  return needed > next.height ? { ...next, height: Math.ceil(needed) } : next;
}

export function restyleFonts(doc: DesignDocument, typography: TrendTypography): DesignDocument {
  const headlines = headlineIds(doc);
  const elements = doc.elements.map((el): DesignElement => {
    if (el.type !== 'text' || el.locked) return el;
    const spec = headlines.has(el.id) ? typography.heading : typography.body;
    const next: TextElement = {
      ...el,
      fontFamily: spec.family,
      fontWeight: supportedWeight(spec.family, spec.weight),
      fontStyle: spec.style ?? 'normal',
    };
    // A pairing that doesn't say keeps each text's own case.
    if (spec.transform === 'none') delete next.textTransform;
    else if (spec.transform) next.textTransform = spec.transform;
    return fitWords(next);
  });
  return { ...doc, elements };
}

/** Puts a look on every photo and empty photo frame (so photos dropped in later arrive styled). */
export function restyleLook(doc: DesignDocument, look: LookDefinition, intensity = 85): DesignDocument {
  return {
    ...doc,
    elements: doc.elements.map((el) =>
      el.type === 'image' && !el.locked && !el.video ? { ...el, filter: lookFilter(look, Math.round(intensity)) } : el,
    ),
  };
}

export interface RestyleParts {
  colors?: boolean;
  fonts?: boolean;
  look?: boolean;
  motion?: boolean;
}

export function restyleDocument(doc: DesignDocument, kit: RestyleKit, parts: RestyleParts = {}): DesignDocument {
  const { colors = true, fonts = true, look = true, motion = true } = parts;
  let out = doc;
  if (colors && kit.palette?.length) out = restyleColors(out, kit.palette);
  if (fonts && kit.typography) out = restyleFonts(out, kit.typography);
  if (look && kit.look) out = restyleLook(out, kit.look, kit.lookIntensity);
  if (motion && kit.animate)
    out = autoAnimate(
      out,
      out.slides.map((_, i) => i),
      kit.animate,
    );
  return out;
}

/** A pack's kit as restyle input. */
export function styleKit(pack: TrendPack, style: TrendStyle): RestyleKit {
  const { palette, typography, look } = resolveStyle(pack, style);
  return { palette: palette.colors, typography, look, lookIntensity: style.lookIntensity, animate: style.animate };
}
