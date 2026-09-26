import { z } from 'zod';
import bundled from './bundled.generated.json';
import { isLive, newestFirst, sanitizePack } from './pack';
import { trendIndexSchema, trendPackSchema, type TrendPack } from './schema';

/**
 * Where trend drops come from, in order of preference:
 *
 * 1. The feed — `/trends/index.json` on this site (or NEXT_PUBLIC_TRENDS_URL,
 *    e.g. for the native app, whose own files can't change after install).
 *    The newest live pack is always re-downloaded so a fixed pack is picked up.
 * 2. A local cache of what the feed last returned, so the newest drop keeps
 *    working offline and without a service worker.
 * 3. The packs bundled into the build — trends always render on first launch.
 *
 * A drop dated in the future stays hidden until that day (local time), so
 * packs can be published ahead of time.
 */

export const TRENDS_INDEX_URL = process.env.NEXT_PUBLIC_TRENDS_URL || '/trends/index.json';

export interface DropEntry {
  id: string;
  /** Resolved URL of the pack file. */
  url: string;
  publishedAt?: string;
  title?: string;
}

export type TrendSource = 'bundled' | 'cache' | 'network';

export interface TrendFeed {
  /** Live drops, newest first. */
  entries: DropEntry[];
  /** Every pack available right now (bundled, cached or just downloaded), by id. */
  packs: Map<string, TrendPack>;
  latest: TrendPack;
  source: TrendSource;
  checkedAt: number | null;
  /** Set when the feed couldn't be reached or was invalid. */
  error?: 'offline' | 'invalid';
}

/** Validates and sanitises a pack; null if it isn't one. */
export function parsePack(raw: unknown): TrendPack | null {
  const r = trendPackSchema.safeParse(raw);
  return r.success ? sanitizePack(r.data) : null;
}

/* ───────────── Bundled ───────────── */

interface BundledTrends {
  index: { id: string; path: string; publishedAt?: string; title?: string }[];
  packs: Record<string, unknown>;
}

const BUNDLED_DATA = bundled as BundledTrends;
const bundledPacks = new Map<string, TrendPack>();
for (const [id, raw] of Object.entries(BUNDLED_DATA.packs)) {
  const pack = parsePack(raw);
  if (pack && pack.id === id) bundledPacks.set(id, pack);
}
const bundledEntries: DropEntry[] = BUNDLED_DATA.index
  .filter((e) => bundledPacks.has(e.id))
  .map((e) => ({ id: e.id, url: e.path, publishedAt: e.publishedAt ?? bundledPacks.get(e.id)!.publishedAt, title: e.title }));

function newestBundled(now: number): TrendPack {
  const live = newestFirst(bundledEntries).find((e) => isLive(e.publishedAt, now));
  const pack = (live && bundledPacks.get(live.id)) ?? bundledPacks.values().next().value;
  if (!pack) throw new Error('No bundled trend pack — run `npm run trends`.');
  return pack;
}

/**
 * The first pack shown: the newest bundled pack that was live when the app was
 * built. Pre-rendered pages and the browser's first render must agree, so this
 * can't depend on today's date — the store switches to the right drop for
 * today (bundled, cached or downloaded) right after the page loads.
 */
const BUILD_TIME = Number(process.env.NEXT_PUBLIC_BUILD_TIME) || Date.now();
export const BUNDLED_PACK: TrendPack = newestBundled(BUILD_TIME);
export const bundledPack = (id: string): TrendPack | undefined => bundledPacks.get(id);

/* ───────────── Cache ───────────── */

const CACHE_KEY = 'stardeck:trends';
const MAX_CACHED = 8;

const cacheSchema = z.object({
  entries: z.array(
    z.object({
      id: z.string().max(32),
      url: z.string().max(400),
      publishedAt: z.string().max(10).optional(),
      title: z.string().max(60).optional(),
    }),
  ),
  packs: z.record(z.string(), z.unknown()),
  checkedAt: z.number(),
});
type TrendCache = z.infer<typeof cacheSchema>;

export function readTrendCache(): TrendCache | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const r = cacheSchema.safeParse(JSON.parse(raw));
    return r.success ? r.data : null;
  } catch {
    return null;
  }
}

function writeTrendCache(cache: TrendCache): void {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
  } catch {
    /* storage full or blocked: the feed is simply fetched again next time */
  }
}

export function clearTrendCache(): void {
  try {
    localStorage.removeItem(CACHE_KEY);
  } catch {
    /* nothing to clear */
  }
}

/* ───────────── Network ───────────── */

function baseUrl(indexUrl: string): URL {
  const origin = typeof location !== 'undefined' ? location.origin : 'http://localhost';
  return new URL(indexUrl, origin);
}

/** Resolves an index entry's path against the index, refusing anything on another origin. */
export function resolveEntryUrl(path: string, indexUrl: string): string | null {
  const base = baseUrl(indexUrl);
  const url = new URL(path, base);
  return url.origin === base.origin ? url.href : null;
}

export async function fetchTrendIndex(fetchImpl: typeof fetch, indexUrl: string): Promise<DropEntry[]> {
  const res = await fetchImpl(indexUrl, { cache: 'no-cache' });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const index = trendIndexSchema.parse(await res.json());
  return index.packs.flatMap((e) => {
    const url = resolveEntryUrl(e.path, indexUrl);
    return url ? [{ id: e.id, url, publishedAt: e.publishedAt, title: e.title }] : [];
  });
}

export async function fetchTrendPack(fetchImpl: typeof fetch, entry: DropEntry): Promise<{ pack: TrendPack; raw: unknown }> {
  const res = await fetchImpl(entry.url, { cache: 'no-cache' });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const raw: unknown = await res.json();
  const pack = parsePack(raw);
  if (!pack || pack.id !== entry.id) throw new Error('Invalid trend pack');
  return { pack, raw };
}

/** Joins entry lists by id; later lists win (network over cache over bundled). */
function mergeEntries(...lists: (DropEntry[] | undefined)[]): DropEntry[] {
  const byId = new Map<string, DropEntry>();
  for (const list of lists) for (const e of list ?? []) byId.set(e.id, { ...byId.get(e.id), ...e });
  return [...byId.values()];
}

/** Fills in dates the index left out from the packs themselves. */
function dated(entries: DropEntry[], packs: Map<string, TrendPack>): DropEntry[] {
  return entries.map((e) => (e.publishedAt ? e : { ...e, publishedAt: packs.get(e.id)?.publishedAt }));
}

export interface LoadOptions {
  fetchImpl?: typeof fetch;
  now?: number;
  indexUrl?: string;
  /** Contact the feed (off when the user turned trend updates off). */
  network?: boolean;
}

/** Loads the drop list and the newest live pack: feed, then cache, then bundled. */
export async function loadTrendFeed(options: LoadOptions = {}): Promise<TrendFeed> {
  const { fetchImpl = fetch, now = Date.now(), indexUrl = TRENDS_INDEX_URL, network = true } = options;
  const cache = readTrendCache();
  const packs = new Map(bundledPacks);
  const cachedRaw: Record<string, unknown> = {};
  for (const [id, raw] of Object.entries(cache?.packs ?? {})) {
    const pack = parsePack(raw);
    if (pack && pack.id === id) {
      packs.set(id, pack);
      cachedRaw[id] = raw;
    }
  }
  let entries = mergeEntries(bundledEntries, cache?.entries);
  let source: TrendSource = cache ? 'cache' : 'bundled';
  let checkedAt = cache?.checkedAt ?? null;
  let error: TrendFeed['error'];

  if (network) {
    try {
      const remote = await fetchTrendIndex(fetchImpl, indexUrl);
      entries = mergeEntries(entries, remote);
      checkedAt = now;
      // The newest live drop is always fetched fresh; fall back through older ones.
      for (const entry of newestFirst(dated(remote, packs))) {
        if (entry.publishedAt && !isLive(entry.publishedAt, now)) continue;
        try {
          const { pack, raw } = await fetchTrendPack(fetchImpl, entry);
          if (!isLive(pack.publishedAt, now)) continue;
          packs.set(pack.id, pack);
          cachedRaw[pack.id] = raw;
          source = 'network';
          break;
        } catch {
          if (packs.has(entry.id)) break;
        }
      }
      const keep = new Set(
        newestFirst(dated(remote, packs))
          .slice(0, MAX_CACHED)
          .map((e) => e.id),
      );
      writeTrendCache({
        entries: remote,
        packs: Object.fromEntries(Object.entries(cachedRaw).filter(([id]) => keep.has(id))),
        checkedAt: now,
      });
    } catch (e) {
      error = e instanceof z.ZodError || e instanceof SyntaxError ? 'invalid' : 'offline';
    }
  }

  const live = newestFirst(dated(entries, packs)).filter((e) => isLive(e.publishedAt, now));
  const latestEntry = live.find((e) => packs.has(e.id));
  const latest = (latestEntry && packs.get(latestEntry.id)) ?? newestBundled(now);
  return { entries: live, packs, latest, source, checkedAt, error };
}

/** An older drop picked from the archive: from memory, the cache or the feed. */
export async function loadDrop(entry: DropEntry, fetchImpl: typeof fetch = fetch): Promise<TrendPack> {
  const bundledCopy = bundledPacks.get(entry.id);
  try {
    const { pack, raw } = await fetchTrendPack(fetchImpl, entry);
    const cache = readTrendCache();
    if (cache) writeTrendCache({ ...cache, packs: { ...cache.packs, [pack.id]: raw } });
    return pack;
  } catch (e) {
    const cached = readTrendCache()?.packs[entry.id];
    const pack = (cached !== undefined ? parsePack(cached) : null) ?? bundledCopy;
    if (pack) return pack;
    throw e;
  }
}
