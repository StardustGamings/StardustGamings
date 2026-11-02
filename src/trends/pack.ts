import type { StickerArt } from '@/types/document';
import type { DumpStyle } from '@/layouts/dump-styles';
import { hasBundledTemplate } from '@/templates/registry';
import { resolveSticker } from '@/stickers/library';
import { getLook, isBuiltInLook, type LookDefinition } from '@/filters/looks';
import type {
  FormatCategory,
  TrendFormat,
  TrendLayoutRule,
  TrendPack,
  TrendPalette,
  TrendStyle,
  TrendTypography,
} from './schema';

/**
 * Pure helpers around a validated trend pack: dropping references this build
 * can't resolve, turning pack data into the app's own building blocks (looks,
 * sticker art, photo-dump styles), and deciding which drops are live.
 */

/* ───────────── References ───────────── */

function stickerResolves(pack: Pick<TrendPack, 'stickerArt'>, ref: string): boolean {
  if (ref.startsWith('art:')) return pack.stickerArt.some((a) => a.id === ref.slice(4));
  return resolveSticker(ref) !== null;
}

/** A look by id: built into the app, or defined by this pack. */
export function findLook(pack: Pick<TrendPack, 'looks'>, id: string | undefined): LookDefinition | undefined {
  if (!id) return undefined;
  const builtIn = getLook(id);
  if (builtIn) return builtIn;
  const own = pack.looks.find((l) => l.id === id);
  return own && packLook(own);
}

export function packLook(look: TrendPack['looks'][number]): LookDefinition {
  return {
    id: look.id,
    name: look.name,
    description: look.description,
    swatch: look.swatch,
    adjust: look.adjust,
    curves: look.curves,
    effects: look.effects,
  };
}

/**
 * Drops references to templates, stickers, looks, palettes and type pairings
 * this build doesn't know about, so a pack written for a newer app still shows
 * everything it can instead of failing.
 */
export function sanitizePack(pack: TrendPack): TrendPack {
  // Pack looks may not shadow built-in ones (a photo's look id must mean one thing).
  const looks = pack.looks.filter((l, i, all) => !isBuiltInLook(l.id) && all.findIndex((o) => o.id === l.id) === i);
  const stickerArt = pack.stickerArt.filter((a, i, all) => all.findIndex((o) => o.id === a.id) === i);
  const base = { ...pack, looks, stickerArt };
  const sticker = (ref: string) => stickerResolves(base, ref);
  const lookOk = (id: string | undefined) => !!id && !!findLook(base, id);
  const palettes = new Set(pack.palettes.map((p) => p.id));
  const typography = new Set(pack.typography.map((t) => t.id));
  return {
    ...base,
    cover: pack.cover && {
      ...pack.cover,
      typography: pack.cover.typography && typography.has(pack.cover.typography) ? pack.cover.typography : undefined,
      palette: pack.cover.palette && palettes.has(pack.cover.palette) ? pack.cover.palette : undefined,
      stickers: pack.cover.stickers.filter(sticker),
    },
    templates: pack.templates.filter((t) => hasBundledTemplate(t.templateId)),
    layouts: pack.layouts.filter((l) => hasBundledTemplate(l.templateId)),
    formats: pack.formats.filter((f) => hasBundledTemplate(f.templateId)),
    stickers: pack.stickers.filter(sticker),
    // A pack may name looks from a newer app version; those effects fall back to their CSS preview.
    effects: pack.effects.map((e) => (e.look && !lookOk(e.look) ? { ...e, look: undefined } : e)),
    layoutRules: pack.layoutRules.map((r) => ({ ...r, rule: { ...r.rule, stickers: r.rule.stickers.filter(sticker) } })),
    styles: pack.styles
      .filter((s) => palettes.has(s.palette) && typography.has(s.typography))
      .map((s) => ({
        ...s,
        look: lookOk(s.look) ? s.look : undefined,
        stickers: s.stickers.filter(sticker),
      })),
  };
}

/* ───────────── Building blocks ───────────── */

export const packLooks = (pack: TrendPack): LookDefinition[] => pack.looks.map(packLook);

export const packStickerArt = (pack: TrendPack): { id: string; art: StickerArt }[] =>
  pack.stickerArt.map(({ id, ...art }) => ({ id, art }));

/** Carousel style, meme format or social format. */
export function formatCategory(f: Pick<TrendFormat, 'category' | 'kind'>): FormatCategory {
  if (f.category) return f.category;
  const kind = f.kind.toLowerCase();
  return kind.includes('meme') ? 'meme' : kind.includes('social') ? 'social' : 'carousel';
}

/** Photo-dump style ids for pack rules are prefixed so they never collide with built-in ones. */
export const ruleStyleId = (ruleId: string) => `trend-${ruleId}`;

/** A pack's layout rule as a Smart photo dump style. */
export function ruleToDumpStyle(rule: TrendLayoutRule): DumpStyle {
  const r = rule.rule;
  return {
    id: ruleStyleId(rule.id),
    name: rule.name,
    emoji: rule.emoji || '✦',
    blurb: rule.blurb,
    background: r.background,
    tintSlides: r.tintSlides,
    cover: r.cover,
    perSlide: r.perSlide,
    collage: r.collage,
    margin: r.margin,
    title: r.title,
    caption: r.caption,
    stickers: r.stickers,
    coverStickers: r.coverStickers,
    adjust: r.adjust,
    letterbox: r.letterbox,
  };
}

export const paletteById = (pack: TrendPack, id: string | undefined): TrendPalette | undefined =>
  id ? pack.palettes.find((p) => p.id === id) : undefined;

export const typographyById = (pack: TrendPack, id: string | undefined): TrendTypography | undefined =>
  id ? pack.typography.find((t) => t.id === id) : undefined;

/** Everything a trend kit needs, resolved (sanitised packs always resolve palette and type). */
export function resolveStyle(pack: TrendPack, style: TrendStyle) {
  return {
    style,
    palette: paletteById(pack, style.palette)!,
    typography: typographyById(pack, style.typography)!,
    look: findLook(pack, style.look),
  };
}

/* ───────────── Scheduling ───────────── */

/** The viewer's local calendar day, `YYYY-MM-DD` — drops go live at local midnight. */
export function localDay(now: number = Date.now()): string {
  const d = new Date(now);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export const isLive = (publishedAt: string | undefined, now: number = Date.now()): boolean =>
  !publishedAt || publishedAt <= localDay(now);

/** Newest first; drops without a date keep their listed order after dated ones. */
export function newestFirst<T extends { publishedAt?: string }>(list: T[]): T[] {
  return list
    .map((item, i) => ({ item, i }))
    .sort((a, b) => (b.item.publishedAt ?? '').localeCompare(a.item.publishedAt ?? '') || a.i - b.i)
    .map((x) => x.item);
}
