import { IDBFactory } from 'fake-indexeddb';
import { beforeEach, describe, expect, it } from 'vitest';
import { createDocument } from '@/projects/document';
import { setStorageForTesting } from '@/storage/db';
import { listUserTemplates } from './repository';
import { TEMPLATE_CATALOG } from './registry';
import { filterTemplates } from './search';
import { findTemplate, restoreUserTemplate, useTemplateLibrary } from './store';
import { buildUserTemplate } from './user';

const make = (name: string) =>
  buildUserTemplate({
    name,
    style: 'soft',
    format: 'post',
    sizeId: 'ig-portrait',
    doc: createDocument({ width: 1080, height: 1350 }),
    keepPhotos: false,
  });

beforeEach(() => {
  globalThis.indexedDB = new IDBFactory();
  setStorageForTesting(null);
  useTemplateLibrary.setState({ bundled: [], user: [], status: 'idle', userStatus: 'idle' });
});

describe('template search', () => {
  it('matches every word across name, tags, style and format', () => {
    const hits = (query: string, extra = {}) => filterTemplates(TEMPLATE_CATALOG, { query, ...extra }).map((t) => t.id);
    expect(hits('polaroid')).toEqual(expect.arrayContaining(['polaroid-wall', 'date-stamp']));
    expect(hits('POLAROID carousel')).toContain('polaroid-wall');
    expect(hits('polaroid carousel')).not.toContain('date-stamp');
    expect(hits('', { style: 'y2k' }).every((id) => TEMPLATE_CATALOG.find((t) => t.id === id)!.style === 'y2k')).toBe(true);
    expect(hits('', { format: 'thumbnail' })).toHaveLength(TEMPLATE_CATALOG.filter((t) => t.format === 'thumbnail').length);
    expect(hits('zzzz-nothing')).toEqual([]);
  });
});

describe('template library store', () => {
  it('loads the bundled library once, even when asked twice at the same time', async () => {
    await Promise.all([useTemplateLibrary.getState().load(), useTemplateLibrary.getState().load()]);
    expect(useTemplateLibrary.getState().status).toBe('ready');
    expect(useTemplateLibrary.getState().bundled).toHaveLength(TEMPLATE_CATALOG.length);
    expect((await findTemplate('film-strip'))?.source).toBe('stardeck');
  });

  it('saves, renames, duplicates and deletes (with undo) your templates', async () => {
    const store = useTemplateLibrary.getState();
    await store.load();
    const saved = await store.saveUser(make('Mine'));
    expect(saved.source).toBe('user');
    expect((await listUserTemplates()).map((t) => t.name)).toEqual(['Mine']);

    await store.updateUser(saved.id, { name: '  Renamed ', tags: ['A', 'a', 'b'] });
    expect(useTemplateLibrary.getState().user[0]).toMatchObject({ name: 'Renamed', tags: ['a', 'b'] });
    expect((await listUserTemplates())[0]).not.toHaveProperty('source');

    const copy = await store.duplicateUser(saved.id);
    expect(copy?.name).toBe('Renamed copy');
    expect(useTemplateLibrary.getState().user).toHaveLength(2);

    const removed = await store.removeUser(saved.id);
    expect(useTemplateLibrary.getState().user.map((t) => t.id)).toEqual([copy!.id]);
    await restoreUserTemplate(removed!);
    expect((await findTemplate(saved.id))?.name).toBe('Renamed');
    expect(await listUserTemplates()).toHaveLength(2);
  });
});
