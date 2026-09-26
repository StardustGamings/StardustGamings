import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BUNDLED_PACK, clearTrendCache, loadDrop, loadTrendFeed, parsePack, readTrendCache, resolveEntryUrl } from './loader';
import { formatCategory, isLive, localDay, newestFirst, sanitizePack } from './pack';
import { trendIndexSchema, trendPackSchema, type TrendPack } from './schema';

const json = (body: unknown, ok = true) => ({ ok, status: ok ? 200 : 404, json: async () => body }) as Response;
const day = (iso: string) => new Date(`${iso}T12:00:00`).getTime();

/** A fake feed: index + packs by path. */
function feed(index: unknown, packs: Record<string, unknown>) {
  return vi.fn(async (url: RequestInfo | URL) => {
    const path = new URL(String(url), 'http://localhost').pathname;
    if (path.endsWith('index.json')) return json(index);
    return path in packs ? json(packs[path]) : json({}, false);
  });
}

const pack = (id: string, publishedAt: string, extra: Partial<TrendPack> = {}): TrendPack => ({
  ...structuredClone(BUNDLED_PACK),
  id,
  title: `Drop ${id}`,
  publishedAt,
  ...extra,
});

beforeEach(() => clearTrendCache());
afterEach(() => clearTrendCache());

describe('trend packs', () => {
  it('bundles a valid pack whose references all resolve', () => {
    expect(BUNDLED_PACK.templates.length).toBeGreaterThan(0);
    expect(BUNDLED_PACK.typography.length).toBeGreaterThan(0);
    expect(sanitizePack(BUNDLED_PACK)).toEqual(BUNDLED_PACK);
  });

  it('still reads version 1 packs (new sections empty)', () => {
    const v1 = { ...structuredClone(BUNDLED_PACK), version: 1 } as Record<string, unknown>;
    for (const key of ['looks', 'stickerArt', 'layoutRules', 'styles', 'cover']) delete v1[key];
    const parsed = parsePack(v1)!;
    expect(parsed.looks).toEqual([]);
    expect(parsed.styles).toEqual([]);
    expect(parsed.stickerArt).toEqual([]);
  });

  it('drops references to unknown templates, stickers, looks and kit parts', () => {
    const p = sanitizePack({
      ...BUNDLED_PACK,
      templates: [...BUNDLED_PACK.templates, { templateId: 'does-not-exist', label: 'x', heat: 1 }],
      stickers: [...BUNDLED_PACK.stickers, 'vector:nope', 'art:nope'],
      effects: [{ ...BUNDLED_PACK.effects[0]!, look: 'not-a-look' }],
      looks: [{ id: 'film', name: 'Shadow', description: 'x', swatch: ['#000000', '#FFFFFF'], adjust: {}, heat: 1 }],
      styles: [{ id: 'k', name: 'Kit', vibe: 'x', description: 'x', palette: 'nope', typography: 'nope', stickers: [], heat: 1 }],
    });
    expect(p.templates.some((t) => t.templateId === 'does-not-exist')).toBe(false);
    expect(p.stickers).not.toContain('vector:nope');
    expect(p.stickers).not.toContain('art:nope');
    expect(p.effects[0]!.look).toBeUndefined();
    // A pack look may not shadow a built-in one.
    expect(p.looks).toEqual([]);
    expect(p.styles).toEqual([]);
  });

  it('rejects CSS injection in effect filters and markup in sticker art', () => {
    const bad = structuredClone(BUNDLED_PACK);
    bad.effects[0]!.css = 'blur(2px); background: url(https://evil.example)';
    expect(trendPackSchema.safeParse(bad).success).toBe(false);
    const art = structuredClone(BUNDLED_PACK);
    art.stickerArt = [{ id: 'x', name: 'X', defaultTint: '#FFFFFF', layers: [{ d: '<script>alert(1)</script>' }] }];
    expect(trendPackSchema.safeParse(art).success).toBe(false);
  });

  it('classifies formats by category or kind', () => {
    expect(formatCategory({ kind: 'meme format' })).toBe('meme');
    expect(formatCategory({ kind: 'social format' })).toBe('social');
    expect(formatCategory({ kind: 'carousel style' })).toBe('carousel');
    expect(formatCategory({ kind: 'anything', category: 'social' })).toBe('social');
  });
});

describe('drop scheduling', () => {
  it('goes live on its day, in local time', () => {
    expect(isLive('2026-10-01', day('2026-09-30'))).toBe(false);
    expect(isLive('2026-10-01', day('2026-10-01'))).toBe(true);
    expect(isLive(undefined, day('2026-01-01'))).toBe(true);
    expect(localDay(day('2026-10-01'))).toBe('2026-10-01');
  });

  it('orders drops newest first, undated ones last', () => {
    const list = newestFirst([{ id: 'a' }, { id: 'b', publishedAt: '2026-08-01' }, { id: 'c', publishedAt: '2026-09-01' }]);
    expect(list.map((x) => x.id)).toEqual(['c', 'b', 'a']);
  });

  it('only accepts pack paths under /trends/ or next to the index, on the same site', () => {
    const ok = (path: string) => trendIndexSchema.safeParse({ version: 2, packs: [{ id: 'x', path }] }).success;
    expect(ok('/trends/2026/october.json')).toBe(true);
    expect(ok('2026/october.json')).toBe(true);
    expect(ok('//evil.example/x.json')).toBe(false);
    expect(ok('/elsewhere/x.json')).toBe(false);
    expect(ok('../x.json')).toBe(false);
    expect(resolveEntryUrl('2026/october.json', 'https://feed.example/trends/index.json')).toBe(
      'https://feed.example/trends/2026/october.json',
    );
  });
});

describe('loading the feed', () => {
  const index = {
    version: 2,
    packs: [
      { id: '2030-03', path: '/trends/2030/march.json', publishedAt: '2030-03-01' },
      { id: '2030-02', path: '/trends/2030/february.json', publishedAt: '2030-02-01' },
      { id: '2030-01', path: '/trends/2030/january.json', publishedAt: '2030-01-01' },
    ],
  };
  const packs = {
    '/trends/2030/march.json': pack('2030-03', '2030-03-01'),
    '/trends/2030/february.json': pack('2030-02', '2030-02-01'),
    '/trends/2030/january.json': pack('2030-01', '2030-01-01'),
  };

  it('shows the newest live drop and hides scheduled ones', async () => {
    const fetchMock = feed(index, packs);
    const result = await loadTrendFeed({ fetchImpl: fetchMock as unknown as typeof fetch, now: day('2030-02-15') });
    expect(result.latest.id).toBe('2030-02');
    expect(result.source).toBe('network');
    expect(result.entries.map((e) => e.id).slice(0, 2)).toEqual(['2030-02', '2030-01']);
    expect(result.entries.some((e) => e.id === '2030-03')).toBe(false);
    expect(fetchMock).not.toHaveBeenCalledWith(expect.stringContaining('march'), expect.anything());
  });

  it('keeps the last drop it downloaded for offline use', async () => {
    await loadTrendFeed({ fetchImpl: feed(index, packs) as unknown as typeof fetch, now: day('2030-02-15') });
    expect(readTrendCache()?.packs['2030-02']).toBeTruthy();
    const offline = vi.fn(async () => {
      throw new TypeError('Failed to fetch');
    });
    const result = await loadTrendFeed({ fetchImpl: offline as unknown as typeof fetch, now: day('2030-02-16') });
    expect(result.latest.id).toBe('2030-02');
    expect(result.source).toBe('cache');
    expect(result.error).toBe('offline');
  });

  it('falls back to the bundled pack when offline or invalid', async () => {
    const offline = vi.fn(async () => {
      throw new TypeError('Failed to fetch');
    });
    const a = await loadTrendFeed({ fetchImpl: offline as unknown as typeof fetch });
    expect(a.latest).toBe(BUNDLED_PACK);
    expect(a.source).toBe('bundled');
    const garbage = vi.fn(async () => json({ nope: true }));
    const b = await loadTrendFeed({ fetchImpl: garbage as unknown as typeof fetch });
    expect(b.latest).toBe(BUNDLED_PACK);
    expect(b.error).toBe('invalid');
  });

  it('skips a broken newest pack for the one before it', async () => {
    const broken = { ...packs, '/trends/2030/february.json': { title: 'nope' } };
    const result = await loadTrendFeed({ fetchImpl: feed(index, broken) as unknown as typeof fetch, now: day('2030-02-15') });
    expect(result.latest.id).toBe('2030-01');
  });

  it('never contacts the feed when trend updates are off', async () => {
    const fetchMock = feed(index, packs);
    const result = await loadTrendFeed({ fetchImpl: fetchMock as unknown as typeof fetch, network: false });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(result.latest).toBe(BUNDLED_PACK);
  });

  it('loads an older drop from the archive on demand', async () => {
    const fetchMock = feed(index, packs);
    const result = await loadTrendFeed({ fetchImpl: fetchMock as unknown as typeof fetch, now: day('2030-02-15') });
    const older = await loadDrop(result.entries[1]!, fetchMock as unknown as typeof fetch);
    expect(older.id).toBe('2030-01');
  });
});
