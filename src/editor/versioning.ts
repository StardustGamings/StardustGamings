'use client';

import { create } from 'zustand';
import type { DesignDocument } from '@/types/document';
import type { VersionKind, VersionRecord } from '@/types/project';
import * as versions from '@/projects/versions';
import { selectDoc, useEditor } from './store';

/**
 * Version history for the design open in the editor. Versions are taken:
 * - when a session's first edit is saved — the design as it was when you opened it,
 * - every 10 minutes while you keep editing,
 * - when you press Ctrl/⌘ S or save a (named) version from History,
 * - before big changes: restoring a version or replacing the design with a template.
 */

interface Session {
  projectId: string;
  openedDoc: DesignDocument;
  openedTaken: boolean;
  /** The newest stored version (time and document), to skip duplicates. */
  lastAt: number;
  lastDoc: DesignDocument | null;
  ready: Promise<void>;
}

let session: Session | null = null;
let busy: Promise<unknown> = Promise.resolve();

/** Serialises version writes so rapid saves never race each other. */
const queue = <T>(task: () => Promise<T>): Promise<T> => {
  const next = busy.then(task, task);
  busy = next.catch(() => undefined);
  return next;
};

export function startVersionSession(projectId: string, doc: DesignDocument): void {
  const s: Session = { projectId, openedDoc: doc, openedTaken: false, lastAt: 0, lastDoc: null, ready: Promise.resolve() };
  s.ready = versions
    .latestVersion(projectId)
    .then((latest) => {
      if (latest && session === s) {
        s.lastAt = latest.createdAt;
        s.lastDoc = latest.doc;
      }
    })
    .catch(() => undefined);
  session = s;
}

export function endVersionSession(): void {
  session = null;
}

async function record(s: Session, kind: VersionKind, doc: DesignDocument, extra: { name?: string | null; note?: string } = {}) {
  const version = await versions.createVersion(s.projectId, doc, { kind, ...extra });
  s.lastAt = version.createdAt;
  s.lastDoc = version.doc;
  useVersions.getState().added(version);
  return version;
}

const changedSinceLast = (s: Session, doc: DesignDocument) => !s.lastDoc || !versions.sameDocument(s.lastDoc, doc);

/** Called after every successful save of the open design. */
export function afterSave(projectId: string, doc: DesignDocument): Promise<void> {
  const s = session;
  if (!s || s.projectId !== projectId) return Promise.resolve();
  return queue(async () => {
    await s.ready;
    if (!s.openedTaken) {
      // Nothing changed yet (e.g. an edit that was undone).
      if (versions.sameDocument(s.openedDoc, doc)) return;
      s.openedTaken = true;
      if (changedSinceLast(s, s.openedDoc)) await record(s, 'opened', s.openedDoc);
      return;
    }
    if (Date.now() - s.lastAt >= versions.AUTO_VERSION_INTERVAL && changedSinceLast(s, doc)) await record(s, 'auto', doc);
  }).catch(() => undefined);
}

/**
 * Saves the open design as a version now. Unnamed versions are skipped when
 * nothing changed since the last one; returns null then.
 */
export function saveVersion(
  options: { kind?: VersionKind; name?: string | null; note?: string } = {},
): Promise<VersionRecord | null> {
  const s = session;
  const doc = selectDoc(useEditor.getState());
  if (!s || !doc) return Promise.resolve(null);
  return queue(async () => {
    await s.ready;
    s.openedTaken = true;
    if (!options.name && !changedSinceLast(s, doc)) return null;
    return record(s, options.kind ?? 'manual', doc, { name: options.name, note: options.note });
  });
}

const clock = (t: number) => new Date(t).toLocaleTimeString('en', { hour: 'numeric', minute: '2-digit' });

/**
 * Restores a version as one undoable step. The current design is kept as a
 * version first, so restoring never loses anything.
 */
export async function restoreVersion(version: VersionRecord): Promise<boolean> {
  const ed = useEditor.getState();
  const current = selectDoc(ed);
  if (!current || ed.meta?.id !== version.projectId) return false;
  if (!versions.sameDocument(current, version.doc)) {
    await saveVersion({ kind: 'before', note: `Before restoring the ${clock(version.createdAt)} version` });
  }
  useEditor.getState().commit();
  useEditor.getState().apply(() => structuredClone(version.doc));
  useEditor.getState().clearSelection();
  await useEditor.getState().save();
  return true;
}

/** Keeps a copy before a big change (e.g. replacing the design with a template). */
export function keepBeforeChange(note: string): void {
  void saveVersion({ kind: 'before', note }).catch(() => undefined);
}

interface VersionsState {
  projectId: string | null;
  status: 'idle' | 'loading' | 'ready' | 'error';
  list: VersionRecord[];
  load: (projectId: string) => Promise<void>;
  /** A version saved in this tab. */
  added: (version: VersionRecord) => void;
  rename: (id: string, name: string | null) => Promise<void>;
  remove: (id: string) => Promise<void>;
}

/** The version list for the History dialog. */
export const useVersions = create<VersionsState>()((set, get) => ({
  projectId: null,
  status: 'idle',
  list: [],
  load: async (projectId) => {
    set((s) =>
      s.projectId === projectId ? { status: s.list.length ? 'ready' : 'loading' } : { projectId, status: 'loading', list: [] },
    );
    try {
      const list = await versions.listVersions(projectId);
      if (get().projectId === projectId) set({ list, status: 'ready' });
    } catch {
      if (get().projectId === projectId) set({ status: 'error' });
    }
  },
  added: (version) => {
    if (get().projectId !== version.projectId) return;
    // Re-read: saving may have pruned older versions.
    void get().load(version.projectId);
  },
  rename: async (id, name) => {
    const next = await versions.renameVersion(id, name);
    set((s) => ({ list: s.list.map((v) => (v.id === id ? next : v)) }));
  },
  remove: async (id) => {
    await versions.deleteVersion(id);
    set((s) => ({ list: s.list.filter((v) => v.id !== id) }));
  },
}));
