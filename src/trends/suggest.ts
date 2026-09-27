import type { DesignDocument, ImageElement } from '@/types/document';
import { resolveLook, type LookDefinition } from '@/filters/looks';
import { hasAnimation } from '@/animations/engine';
import { findLook, formatCategory, resolveStyle } from './pack';
import { headlineIds } from './restyle';
import type { TrendPack, TrendStyle, TrendTypography } from './schema';

/**
 * Trend-driven suggestions for the design in the editor: small, specific,
 * one-tap ideas from the current drop, chosen by looking at what the design
 * already has. Rules only — nothing leaves the device.
 */

export type Suggestion =
  | { kind: 'look'; key: string; title: string; detail: string; look: LookDefinition; intensity: number }
  | { kind: 'fonts'; key: string; title: string; detail: string; typography: TrendTypography }
  | { kind: 'motion'; key: string; title: string; detail: string; vibe: 'smooth' | 'playful' | 'glitchy' }
  | { kind: 'kit'; key: string; title: string; detail: string; style: TrendStyle }
  | { kind: 'format'; key: string; title: string; detail: string; templateId: string }
  | { kind: 'dump'; key: string; title: string; detail: string; ruleId: string };

const byHeat = <T extends { heat?: number }>(list: T[]) => [...list].sort((a, b) => (b.heat ?? 0) - (a.heat ?? 0));
const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

/** The drop's headline filter: its own hottest look, else the hottest effect that maps to a filter. */
export function topLook(pack: TrendPack): { look: LookDefinition; intensity: number } | null {
  const own = byHeat(pack.looks)[0];
  if (own) return { look: findLook(pack, own.id)!, intensity: 85 };
  for (const e of byHeat(pack.effects)) {
    const look = findLook(pack, e.look);
    if (look) return { look, intensity: e.intensity ?? 85 };
  }
  return null;
}

export function suggestTrends(doc: DesignDocument, pack: TrendPack, max = 4): Suggestion[] {
  const out: Suggestion[] = [];
  const photos = doc.elements.filter((e): e is ImageElement => e.type === 'image' && !!e.assetId && !e.hidden && !e.video);
  const bare = photos.filter((p) => !resolveLook(p.filter));
  const kits = byHeat(pack.styles);

  // 1. A trend kit restyles everything at once.
  const kit = kits[0];
  if (kit && doc.elements.length > 0) {
    const { palette, typography } = resolveStyle(pack, kit);
    out.push({
      kind: 'kit',
      key: `kit-${kit.id}`,
      title: `Restyle as ${kit.name}`,
      detail: `${palette.name} colours, ${typography.name} type${kit.look ? ' and its filter' : ''} — one tap, one undo.`,
      style: kit,
    });
  }

  // 2. Photos without a filter.
  const look = topLook(pack);
  if (look && bare.length > 0) {
    out.push({
      kind: 'look',
      key: `look-${look.look.id}`,
      title: `Try ${look.look.name} on your photos`,
      detail: `${plural(bare.length, 'photo')} ${bare.length === 1 ? 'has' : 'have'} no filter yet. ${look.look.name} is this drop’s look.`,
      look: look.look,
      intensity: look.intensity,
    });
  }

  // 3. Headline type that isn't part of any trending pairing.
  const headlines = headlineIds(doc);
  const headline = doc.elements.find((e) => e.type === 'text' && headlines.has(e.id));
  const typo = byHeat(pack.typography)[0];
  if (headline?.type === 'text' && typo && !pack.typography.some((t) => t.heading.family === headline.fontFamily)) {
    out.push({
      kind: 'fonts',
      key: `fonts-${typo.id}`,
      title: `Set it in ${typo.name}`,
      detail: `Your headline uses ${headline.fontFamily}. Trending now: ${typo.heading.family} with ${typo.body.family}.`,
      typography: typo,
    });
  }

  // 4. Nothing moves yet.
  const movable = doc.elements.filter((e) => !e.hidden).length;
  if (movable >= 2 && !doc.elements.some(hasAnimation)) {
    const vibe = kit?.animate ?? 'smooth';
    out.push({
      kind: 'motion',
      key: `motion-${vibe}`,
      title: `Add ${vibe[0]!.toUpperCase()}${vibe.slice(1)} motion`,
      detail: 'Nothing moves yet. Motion plays in MP4 and GIF exports — stills stay as they are.',
      vibe,
    });
  }

  // 5. Lots of photos: a layout rule turns them into a dump.
  const rule = byHeat(pack.layoutRules)[0];
  if (rule && photos.length >= 3) {
    out.push({
      kind: 'dump',
      key: `dump-${rule.id}`,
      title: `Make a ${rule.name}`,
      detail: `${rule.blurb} Adds new slides from your photos.`,
      ruleId: rule.id,
    });
  }

  // 6. A single post: a trending meme or social format to start a new slide from.
  const format = byHeat(pack.formats.filter((f) => formatCategory(f) !== 'carousel'))[0];
  if (format && doc.slides.length === 1) {
    out.push({
      kind: 'format',
      key: `format-${format.id}`,
      title: `Try the ${format.name} format`,
      detail: format.description,
      templateId: format.templateId,
    });
  }

  return out.slice(0, max);
}
