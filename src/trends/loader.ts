import bundledPack from '../../public/trends/2026/september.json';
import { getTemplate } from '@/templates/registry';
import { resolveSticker } from '@/stickers/library';
import { trendIndexSchema, trendPackSchema, type TrendPack } from './schema';

/** The pack compiled into the app — guarantees trends render offline on first launch. */
export const BUNDLED_PACK: TrendPack = sanitizePack(trendPackSchema.parse(bundledPack));

/** Drops references to templates/stickers this build doesn't know about. */
export function sanitizePack(pack: TrendPack): TrendPack {
  const hasTemplate = (id: string) => Boolean(getTemplate(id));
  return {
    ...pack,
    templates: pack.templates.filter((t) => hasTemplate(t.templateId)),
    layouts: pack.layouts.filter((l) => hasTemplate(l.templateId)),
    formats: pack.formats.filter((f) => hasTemplate(f.templateId)),
    stickers: pack.stickers.filter((s) => resolveSticker(s) !== null),
  };
}

/**
 * Loads the newest pack listed in /trends/index.json. Falls back to the bundled
 * pack when offline, when the fetch fails, or when the JSON doesn't validate.
 */
export async function loadLatestTrendPack(fetchImpl: typeof fetch = fetch): Promise<TrendPack> {
  try {
    const indexRes = await fetchImpl('/trends/index.json', { cache: 'no-cache' });
    if (!indexRes.ok) return BUNDLED_PACK;
    const index = trendIndexSchema.parse(await indexRes.json());
    // Packs are listed newest-first. Always fetched (not cached by id) so a
    // hot-fixed pack is picked up without shipping a new build.
    const res = await fetchImpl(index.packs[0]!.path, { cache: 'no-cache' });
    if (!res.ok) return BUNDLED_PACK;
    return sanitizePack(trendPackSchema.parse(await res.json()));
  } catch {
    return BUNDLED_PACK;
  }
}
