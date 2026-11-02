import { IDBFactory } from 'fake-indexeddb';
import { beforeEach, describe, expect, it } from 'vitest';
import { setStorageForTesting } from '@/storage/db';
import * as repo from '@/projects/repository';
import * as versions from '@/projects/versions';
import { insertSlide } from '@/projects/document';
import { createHistory } from './history';
import { useEditor } from './store';
import { afterSave, endVersionSession, saveVersion, startVersionSession } from './versioning';

beforeEach(() => {
  globalThis.indexedDB = new IDBFactory();
  setStorageForTesting(null);
  endVersionSession();
});

describe('version history for the open design', () => {
  it('keeps the design as opened, even when Ctrl+S runs before the first edit is saved', async () => {
    const { meta, doc } = await repo.createProject({ format: 'post' });
    startVersionSession(meta.id, doc);
    const edited = insertSlide(doc, 1);
    useEditor.setState({ meta, history: createHistory(edited) });

    // Ctrl+S first, the autosave of the edit second.
    const manual = await saveVersion();
    await afterSave(meta.id, edited);

    const list = await versions.listVersions(meta.id);
    expect(list.map((v) => v.kind)).toEqual(['manual', 'opened']);
    expect(list[1]!.doc.slides).toHaveLength(1);
    expect(manual!.doc.slides).toHaveLength(2);
  });

  it('takes nothing extra when the design is unchanged', async () => {
    const { meta, doc } = await repo.createProject({ format: 'post' });
    startVersionSession(meta.id, doc);
    useEditor.setState({ meta, history: createHistory(doc) });
    await saveVersion();
    expect((await versions.listVersions(meta.id)).map((v) => v.kind)).toEqual(['manual']);
  });
});
