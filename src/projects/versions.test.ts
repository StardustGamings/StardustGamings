import { IDBFactory } from 'fake-indexeddb';
import { beforeEach, describe, expect, it } from 'vitest';
import { setStorageForTesting } from '@/storage/db';
import { storageBreakdown } from '@/storage/usage';
import { assetUsage } from '@/assets/repository';
import { insertSlide } from './document';
import * as repo from './repository';
import * as versions from './versions';

beforeEach(() => {
  globalThis.indexedDB = new IDBFactory();
  setStorageForTesting(null);
});

const MIN = 60e3;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;

describe('version retention', () => {
  const now = new Date(2026, 8, 26, 18, 0).getTime();
  const v = (id: string, ago: number, name: string | null = null) => ({ id, createdAt: now - ago, name });

  it('keeps everything from the last hour', () => {
    const list = [v('a', 1 * MIN), v('b', 12 * MIN), v('c', 59 * MIN)];
    expect(versions.versionsToPrune(list, now)).toEqual([]);
  });

  it('keeps the newest of each hour for a day, then of each day for 30 days', () => {
    const list = [
      v('h1-new', 2 * HOUR + 5 * MIN),
      v('h1-old', 2 * HOUR + 40 * MIN),
      v('h5', 5 * HOUR + 10 * MIN),
      v('d3-new', 3 * DAY),
      v('d3-old', 3 * DAY + 2 * HOUR),
      v('ancient', 31 * DAY),
    ];
    expect(versions.versionsToPrune(list, now).sort()).toEqual(['ancient', 'd3-old', 'h1-old']);
  });

  it('never drops named versions (up to the cap) and caps unnamed ones', () => {
    const named = v('named', 90 * DAY, 'Final draft');
    const many = Array.from({ length: 70 }, (_, i) => v(`n${i}`, i * 30e3));
    const pruned = versions.versionsToPrune([named, ...many], now);
    expect(pruned).not.toContain('named');
    expect(pruned).toHaveLength(70 - versions.MAX_UNNAMED_VERSIONS);
    expect(pruned).toContain('n69');
    expect(pruned).not.toContain('n0');
  });

  it('titles versions for the history list', () => {
    expect(versions.versionTitle({ kind: 'auto', name: null })).toBe('Auto-saved');
    expect(versions.versionTitle({ kind: 'opened', name: null })).toBe('When you opened it');
    expect(versions.versionTitle({ kind: 'before', name: null, note: 'Before restoring' })).toBe('Before restoring');
    expect(versions.versionTitle({ kind: 'manual', name: 'V2 ✦' })).toBe('V2 ✦');
  });
});

describe('version history (IndexedDB)', () => {
  it('saves, names, lists, copies and deletes versions', async () => {
    const { meta, doc } = await repo.createProject({ format: 'carousel', slideCount: 3 });
    const first = await versions.createVersion(meta.id, doc, { kind: 'opened' }, 1000);
    const edited = insertSlide(doc, 3);
    const second = await versions.createVersion(meta.id, edited, { kind: 'manual', name: '  Final   cut  ' }, 2000);
    expect(second.name).toBe('Final cut');
    expect(second.slideCount).toBe(4);

    const list = await versions.listVersions(meta.id);
    expect(list.map((x) => x.id)).toEqual([second.id, first.id]);
    expect(list[1]!.doc).toEqual(doc);

    await versions.renameVersion(first.id, 'Start');
    expect((await versions.getVersion(first.id))!.name).toBe('Start');

    const copy = await versions.copyVersionToProject(second.id);
    expect(copy.meta.name).toBe(`${meta.name} · Final cut`);
    expect(copy.doc.slides).toHaveLength(4);
    expect(copy.meta.id).not.toBe(meta.id);

    await versions.deleteVersion(first.id);
    expect((await versions.listVersions(meta.id)).map((x) => x.id)).toEqual([second.id]);
  });

  it('clears history but keeps named versions by default', async () => {
    const { meta, doc } = await repo.createProject({ format: 'post' });
    await versions.createVersion(meta.id, doc, { kind: 'auto' });
    await versions.createVersion(meta.id, doc, { kind: 'manual', name: 'Keep me' });
    const cleared = await versions.clearVersions();
    expect(cleared.count).toBe(1);
    expect((await versions.listVersions(meta.id)).map((x) => x.name)).toEqual(['Keep me']);
    await versions.clearVersions({ keepNamed: false });
    expect(await versions.listVersions(meta.id)).toEqual([]);
  });

  it('deletes a project’s history with the project, and counts version photos as in use', async () => {
    const { meta, doc } = await repo.createProject({ format: 'post' });
    const withPhoto = {
      ...doc,
      elements: [
        {
          id: 'img1',
          type: 'image' as const,
          name: 'Photo',
          x: 0,
          y: 0,
          width: 100,
          height: 100,
          rotation: 0,
          opacity: 1,
          assetId: 'as_photo1',
          fit: 'cover' as const,
        },
      ],
    };
    await versions.createVersion(meta.id, withPhoto as typeof doc, { kind: 'auto' });
    expect((await assetUsage()).get('as_photo1')).toEqual([expect.stringMatching(/^version:/)]);

    const breakdown = await storageBreakdown();
    expect(breakdown.versions.count).toBe(1);
    expect(breakdown.projects.count).toBe(1);
    expect(breakdown.versions.bytes).toBeGreaterThan(0);

    await repo.deleteProjectForever(meta.id);
    expect(await versions.listVersions(meta.id)).toEqual([]);
    expect((await storageBreakdown()).versions.count).toBe(0);
  });

  it('detects identical documents', () => {
    const a = {
      version: 1 as const,
      slideWidth: 10,
      slideHeight: 10,
      background: { type: 'solid' as const, color: '#fff' },
      slides: [{ id: 's', fill: null }],
      elements: [],
    };
    expect(versions.sameDocument(a, structuredClone(a))).toBe(true);
    expect(versions.sameDocument(a, { ...a, slideWidth: 11 })).toBe(false);
  });
});
