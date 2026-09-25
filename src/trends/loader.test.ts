import { describe, expect, it, vi } from 'vitest';
import { BUNDLED_PACK, loadLatestTrendPack, sanitizePack } from './loader';
import { trendPackSchema } from './schema';

const json = (body: unknown, ok = true) => ({ ok, json: async () => body }) as Response;

describe('trend packs', () => {
  it('bundles a valid pack whose references all resolve', () => {
    expect(BUNDLED_PACK.templates.length).toBeGreaterThan(0);
    expect(BUNDLED_PACK.typography.length).toBeGreaterThan(0);
    expect(sanitizePack(BUNDLED_PACK)).toEqual(BUNDLED_PACK);
  });

  it('loads the newest pack from the index', async () => {
    const fresh = { ...BUNDLED_PACK, id: '2026-10', title: 'October Drop' };
    const fetchMock = vi.fn(async (url: RequestInfo | URL) =>
      String(url).endsWith('index.json')
        ? json({ version: 1, packs: [{ id: '2026-10', path: '/trends/2026/october.json' }] })
        : json(fresh),
    );
    const pack = await loadLatestTrendPack(fetchMock as unknown as typeof fetch);
    expect(pack.title).toBe('October Drop');
    expect(fetchMock).toHaveBeenCalledWith('/trends/2026/october.json', expect.anything());
  });

  it('falls back to the bundled pack when offline or invalid', async () => {
    const offline = vi.fn(async () => {
      throw new TypeError('Failed to fetch');
    });
    expect(await loadLatestTrendPack(offline as unknown as typeof fetch)).toBe(BUNDLED_PACK);
    const garbage = vi.fn(async () => json({ nope: true }));
    expect(await loadLatestTrendPack(garbage as unknown as typeof fetch)).toBe(BUNDLED_PACK);
  });

  it('drops references to unknown templates and stickers', () => {
    const pack = sanitizePack({
      ...BUNDLED_PACK,
      templates: [...BUNDLED_PACK.templates, { templateId: 'does-not-exist', label: 'x', heat: 1 }],
      stickers: [...BUNDLED_PACK.stickers, 'vector:nope'],
    });
    expect(pack.templates.some((t) => t.templateId === 'does-not-exist')).toBe(false);
    expect(pack.stickers).not.toContain('vector:nope');
  });

  it('rejects CSS injection in effect filters', () => {
    const bad = structuredClone(BUNDLED_PACK);
    bad.effects[0]!.css = 'blur(2px); background: url(https://evil.example)';
    expect(trendPackSchema.safeParse(bad).success).toBe(false);
  });
});
