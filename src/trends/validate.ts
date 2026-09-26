import { z } from 'zod';
import { TEXT_PRESETS } from '@/editor/core/factory';
import { hasBundledTemplate } from '@/templates/registry';
import { resolveSticker } from '@/stickers/library';
import { getLook } from '@/filters/looks';
import { trendIndexSchema, trendPackSchema, type TrendIndex, type TrendPack } from './schema';

/**
 * Strict checks for pack authors (`npm run trends:check`, and the unit tests).
 * The app itself is lenient — it drops references it can't resolve so a pack
 * made for a newer version still shows what it can — but a pack published
 * with this build should resolve completely.
 */

const presetIds = new Set(TEXT_PRESETS.map((p) => p.id));

function issues(error: { issues: { path: PropertyKey[]; message: string }[] }): string[] {
  return error.issues.map((i) => `${i.path.map(String).join('.') || '(root)'}: ${i.message}`);
}

/** Problems with one pack file (empty when it's good). */
export function checkPack(raw: unknown): { pack: TrendPack | null; problems: string[] } {
  const parsed = trendPackSchema.safeParse(raw);
  if (!parsed.success) return { pack: null, problems: issues(parsed.error) };
  const pack = parsed.data;
  const problems: string[] = [];
  const art = new Set(pack.stickerArt.map((a) => a.id));
  const looks = new Set(pack.looks.map((l) => l.id));
  const palettes = new Set(pack.palettes.map((p) => p.id));
  const typography = new Set(pack.typography.map((t) => t.id));
  const sticker = (ref: string, where: string) => {
    const ok = ref.startsWith('art:') ? art.has(ref.slice(4)) : resolveSticker(ref) !== null;
    if (!ok) problems.push(`${where}: unknown sticker "${ref}"`);
  };
  const template = (id: string, where: string) => {
    if (!hasBundledTemplate(id)) problems.push(`${where}: unknown template "${id}"`);
  };
  const look = (id: string | undefined, where: string) => {
    if (id && !getLook(id) && !looks.has(id)) problems.push(`${where}: unknown look "${id}"`);
  };
  const unique = (list: { id: string }[], where: string) => {
    const seen = new Set<string>();
    for (const { id } of list) {
      if (seen.has(id)) problems.push(`${where}: duplicate id "${id}"`);
      seen.add(id);
    }
  };

  unique(pack.layouts, 'layouts');
  unique(pack.layoutRules, 'layoutRules');
  unique(pack.typography, 'typography');
  unique(pack.palettes, 'palettes');
  unique(pack.looks, 'looks');
  unique(pack.effects, 'effects');
  unique(pack.stickerArt, 'stickerArt');
  unique(pack.formats, 'formats');
  unique(pack.styles, 'styles');

  pack.templates.forEach((t, i) => template(t.templateId, `templates.${i}`));
  pack.layouts.forEach((l, i) => template(l.templateId, `layouts.${i}`));
  pack.formats.forEach((f, i) => template(f.templateId, `formats.${i}`));
  pack.stickers.forEach((s, i) => sticker(s, `stickers.${i}`));
  pack.effects.forEach((e, i) => look(e.look, `effects.${i}.look`));
  pack.looks.forEach((l, i) => {
    if (getLook(l.id)) problems.push(`looks.${i}: "${l.id}" is a built-in look id — pick another`);
  });
  pack.layoutRules.forEach((r, i) => {
    if (!presetIds.has(r.rule.title.preset))
      problems.push(`layoutRules.${i}.rule.title.preset: unknown text style "${r.rule.title.preset}"`);
    if (r.rule.caption && !presetIds.has(r.rule.caption.preset))
      problems.push(`layoutRules.${i}.rule.caption.preset: unknown text style "${r.rule.caption.preset}"`);
    r.rule.stickers.forEach((s, j) => sticker(s, `layoutRules.${i}.rule.stickers.${j}`));
  });
  pack.styles.forEach((s, i) => {
    if (!palettes.has(s.palette)) problems.push(`styles.${i}.palette: no palette "${s.palette}" in this pack`);
    if (!typography.has(s.typography)) problems.push(`styles.${i}.typography: no typography "${s.typography}" in this pack`);
    look(s.look, `styles.${i}.look`);
    s.stickers.forEach((ref, j) => sticker(ref, `styles.${i}.stickers.${j}`));
  });
  if (pack.cover) {
    if (pack.cover.palette && !palettes.has(pack.cover.palette))
      problems.push(`cover.palette: no palette "${pack.cover.palette}"`);
    if (pack.cover.typography && !typography.has(pack.cover.typography))
      problems.push(`cover.typography: no typography "${pack.cover.typography}"`);
    pack.cover.stickers.forEach((s, i) => sticker(s, `cover.stickers.${i}`));
  }
  return { pack, problems };
}

/** Problems with the index and every pack it lists, by file. */
export function checkFeed(
  indexRaw: unknown,
  readPack: (path: string) => unknown,
): { index: TrendIndex | null; packs: Map<string, TrendPack>; problems: string[] } {
  const parsed = trendIndexSchema.safeParse(indexRaw);
  if (!parsed.success) return { index: null, packs: new Map(), problems: issues(parsed.error).map((p) => `index.json ${p}`) };
  const index = parsed.data;
  const problems: string[] = [];
  const packs = new Map<string, TrendPack>();
  const ids = new Set<string>();
  for (const entry of index.packs) {
    if (ids.has(entry.id)) problems.push(`index.json: "${entry.id}" is listed twice`);
    ids.add(entry.id);
    let raw: unknown;
    try {
      raw = readPack(entry.path);
    } catch (e) {
      problems.push(`${entry.path}: can't read (${(e as Error).message})`);
      continue;
    }
    const { pack, problems: own } = checkPack(raw);
    problems.push(...own.map((p) => `${entry.path} ${p}`));
    if (!pack) continue;
    if (pack.id !== entry.id) problems.push(`${entry.path}: id "${pack.id}" doesn't match the index ("${entry.id}")`);
    if (entry.publishedAt && entry.publishedAt !== pack.publishedAt)
      problems.push(`${entry.path}: publishedAt ${pack.publishedAt} doesn't match the index (${entry.publishedAt})`);
    packs.set(entry.id, pack);
  }
  return { index, packs, problems };
}

/** JSON Schema for pack files (published next to the packs so editors can validate while you write). */
export function packJsonSchema(): unknown {
  return {
    ...(z.toJSONSchema(trendPackSchema, { io: 'input', unrepresentable: 'any' }) as object),
    title: 'Stardeck trend pack',
    description: 'A trend drop for Stardeck. See docs/TRENDS.md.',
  };
}
