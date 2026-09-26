'use client';

import { create } from 'zustand';
import type { DesignDocument } from '@/types/document';
import type { ProjectMeta } from '@/types/project';
import * as repo from '@/projects/repository';
import { useProjects } from '@/projects/store';
import { renderThumbnail } from '@/canvas/thumbnail';
import { clearDevelopCache } from '@/images/develop';
import { releaseAllPlayers } from '@/assets/video';
import { clamp } from '@/utils/math';
import { createHistory, HISTORY_LIMIT, pushHistory, redoHistory, undoHistory, type History } from './history';
import { afterSave, endVersionSession, startVersionSession } from './versioning';
import { sameDocument } from '@/projects/versions';
import { toast } from '@/components/ui/toast-store';

export type SaveState = 'saved' | 'dirty' | 'saving' | 'error';
/** Why the last save failed: the device is full, or something else (retried automatically). */
export type SaveError = 'quota' | 'failed';
/** The open design was changed or trashed in another tab while this one had unsaved edits. */
export type Conflict = 'changed' | 'trashed';
export type Tool = 'select' | 'text' | 'hand';
export type PanelId =
  | 'templates'
  | 'design'
  | 'text'
  | 'shapes'
  | 'stickers'
  | 'photos'
  | 'filters'
  | 'layouts'
  | 'animate'
  | 'trends'
  | 'layers'
  | 'properties';

interface ApplyOptions {
  /** Consecutive edits with the same key (e.g. dragging a colour picker) merge into one undo step. */
  coalesce?: string;
}

interface EditorState {
  status: 'idle' | 'loading' | 'ready' | 'missing';
  meta: ProjectMeta | null;
  history: History<DesignDocument> | null;
  saveState: SaveState;
  saveError: SaveError | null;
  conflict: Conflict | null;
  lastSavedAt: number | null;
  activeSlide: number;

  selection: string[];
  editingTextId: string | null;
  /** Image element whose photo is being cropped/positioned on the canvas. */
  croppingId: string | null;
  tool: Tool;
  panel: PanelId | null;
  showGrid: boolean;
  showSafeArea: boolean;
  showRulers: boolean;
  snapping: boolean;

  load: (id: string, prefs: { showGrid: boolean; showSafeArea: boolean }) => Promise<void>;
  reset: () => void;
  /** Apply an edit as one undoable step. */
  apply: (recipe: (doc: DesignDocument) => DesignDocument, options?: ApplyOptions) => void;
  /**
   * Gesture transactions: `preview` repeatedly recomputes the document from the
   * state at the start of the gesture; `commit` records a single undo step.
   */
  preview: (recipe: (base: DesignDocument) => DesignDocument) => void;
  commit: () => void;
  cancel: () => void;
  undo: () => void;
  redo: () => void;
  save: () => Promise<void>;
  /** Another tab changed this project: pick up its changes, or flag a conflict when there are local edits. */
  externalChange: (id: string) => Promise<void>;
  /** Resolve a conflict: `theirs` loads the stored design, `mine` keeps editing (and saves over it). */
  resolveConflict: (keep: 'theirs' | 'mine') => Promise<void>;
  rename: (name: string) => Promise<void>;
  setActiveSlide: (index: number) => void;

  select: (ids: string[]) => void;
  clearSelection: () => void;
  setEditingText: (id: string | null) => void;
  setCropping: (id: string | null) => void;
  setTool: (tool: Tool) => void;
  setPanel: (panel: PanelId | null) => void;
  toggleGrid: () => void;
  toggleSafeArea: () => void;
  toggleRulers: () => void;
  toggleSnapping: () => void;
}

let saveTimer: ReturnType<typeof setTimeout> | undefined;
let retryTimer: ReturnType<typeof setTimeout> | undefined;
let retries = 0;
const RETRY_DELAYS = [2000, 5000, 15000, 30000];
let lastSyncToast = 0;
let thumbTimer: ReturnType<typeof setTimeout> | undefined;
const AUTOSAVE_DELAY = 700;
const THUMB_DELAY = 1500;
const COALESCE_WINDOW = 1200;

/** Document at the start of the running gesture (null when none is in progress). */
let txBase: DesignDocument | null = null;
let lastCoalesce: { key: string; at: number } | null = null;

export const useEditor = create<EditorState>()((set, get) => {
  const scheduleSave = () => {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => void get().save(), AUTOSAVE_DELAY);
  };

  const scheduleThumbnail = (id: string, doc: DesignDocument) => {
    clearTimeout(thumbTimer);
    thumbTimer = setTimeout(async () => {
      const blob = await renderThumbnail(doc);
      if (blob) await useProjects.getState().setThumbnail(id, blob);
    }, THUMB_DELAY);
  };

  /** Keeps selection/editing consistent with the elements that still exist. */
  const reconcile = (doc: DesignDocument) => {
    const ids = new Set(doc.elements.map((e) => e.id));
    const { selection, editingTextId, croppingId, activeSlide } = get();
    const nextSelection = selection.filter((id) => ids.has(id));
    return {
      selection: nextSelection.length === selection.length ? selection : nextSelection,
      editingTextId: editingTextId && ids.has(editingTextId) ? editingTextId : null,
      croppingId: croppingId && ids.has(croppingId) ? croppingId : null,
      activeSlide: clamp(activeSlide, 0, doc.slides.length - 1),
    };
  };

  const commitHistory = (history: History<DesignDocument>) => {
    set({ history, saveState: 'dirty', ...reconcile(history.present) });
    scheduleSave();
  };

  return {
    status: 'idle',
    meta: null,
    history: null,
    saveState: 'saved',
    saveError: null,
    conflict: null,
    lastSavedAt: null,
    activeSlide: 0,
    selection: [],
    editingTextId: null,
    croppingId: null,
    tool: 'select',
    panel: null,
    showGrid: false,
    showSafeArea: true,
    showRulers: false,
    snapping: true,

    load: async (id, prefs) => {
      clearTimeout(saveTimer);
      clearTimeout(retryTimer);
      retries = 0;
      txBase = null;
      set({
        status: 'loading',
        saveError: null,
        conflict: null,
        meta: null,
        history: null,
        activeSlide: 0,
        selection: [],
        editingTextId: null,
        croppingId: null,
        tool: 'select',
        panel: null,
        ...prefs,
      });
      try {
        const project = await repo.getProject(id);
        if (!project || project.meta.deletedAt !== null) {
          set({ status: 'missing' });
          return;
        }
        set({
          status: 'ready',
          meta: project.meta,
          history: createHistory(project.doc),
          saveState: 'saved',
          lastSavedAt: project.meta.updatedAt,
        });
        startVersionSession(project.meta.id, project.doc);
      } catch {
        set({ status: 'missing' });
      }
    },

    reset: () => {
      get().commit();
      // Flush edits made inside the autosave window before tearing down.
      if (get().saveState === 'dirty' && !get().conflict) void get().save();
      clearTimeout(saveTimer);
      clearTimeout(retryTimer);
      endVersionSession();
      // Developed photos are per-design; free them (thumbnails are rendered after this).
      setTimeout(clearDevelopCache, THUMB_DELAY + 2000);
      releaseAllPlayers();
      set({
        status: 'idle',
        meta: null,
        history: null,
        saveState: 'saved',
        selection: [],
        editingTextId: null,
        croppingId: null,
      });
    },

    apply: (recipe, options) => {
      get().commit();
      const { history } = get();
      if (!history) return;
      const next = recipe(history.present);
      if (next === history.present) return;
      const now = Date.now();
      const merge =
        options?.coalesce !== undefined &&
        lastCoalesce?.key === options.coalesce &&
        now - lastCoalesce.at < COALESCE_WINDOW &&
        history.past.length > 0;
      lastCoalesce = options?.coalesce ? { key: options.coalesce, at: now } : null;
      commitHistory(merge ? { ...history, present: next, future: [] } : pushHistory(history, next));
    },

    preview: (recipe) => {
      const { history } = get();
      if (!history) return;
      txBase ??= history.present;
      const next = recipe(txBase);
      set({ history: { ...history, present: next }, ...reconcile(next) });
    },

    commit: () => {
      const { history } = get();
      const base = txBase;
      txBase = null;
      if (!history || !base || base === history.present) return;
      lastCoalesce = null;
      const past = [...history.past, base];
      commitHistory({
        past: past.length > HISTORY_LIMIT ? past.slice(past.length - HISTORY_LIMIT) : past,
        present: history.present,
        future: [],
      });
    },

    cancel: () => {
      const { history } = get();
      const base = txBase;
      txBase = null;
      if (history && base) set({ history: { ...history, present: base }, ...reconcile(base) });
    },

    undo: () => {
      get().commit();
      lastCoalesce = null;
      const { history } = get();
      if (history?.past.length) commitHistory(undoHistory(history));
    },

    redo: () => {
      get().commit();
      lastCoalesce = null;
      const { history } = get();
      if (history?.future.length) commitHistory(redoHistory(history));
    },

    save: async () => {
      clearTimeout(saveTimer);
      clearTimeout(retryTimer);
      const { meta, history, saveState, conflict } = get();
      // Never write over another tab's changes until the person decides.
      if (!meta || !history || saveState === 'saving' || conflict) return;
      // Never persist a half-finished gesture.
      const doc = txBase ?? history.present;
      set({ saveState: 'saving' });
      try {
        const saved = await repo.saveDocument(meta.id, doc, { expectedUpdatedAt: get().lastSavedAt ?? undefined });
        useProjects.getState().upsert(saved);
        scheduleThumbnail(meta.id, doc);
        void afterSave(meta.id, doc);
        // The editor may have closed (or opened another project) while writing.
        if (get().meta?.id !== meta.id) return;
        // Only mark clean if nothing changed while we were writing.
        const stillCurrent = get().history?.present === doc && txBase === null;
        retries = 0;
        set({ meta: saved, saveState: stillCurrent ? 'saved' : 'dirty', saveError: null, lastSavedAt: saved.updatedAt });
        if (!stillCurrent) scheduleSave();
      } catch (e) {
        if (get().meta?.id !== meta.id) return;
        const quota = e instanceof DOMException && (e.name === 'QuotaExceededError' || e.code === 22);
        if (e instanceof repo.ProjectNotFoundError) {
          set({ saveState: 'dirty', conflict: 'trashed' });
          return;
        }
        if (e instanceof repo.SaveConflictError) {
          set({ saveState: 'dirty', conflict: 'changed' });
          return;
        }
        set({ saveState: 'error', saveError: quota ? 'quota' : 'failed' });
        // Transient failures retry on their own; a full device waits for the person to free space.
        if (!quota && retries < RETRY_DELAYS.length) retryTimer = setTimeout(() => void get().save(), RETRY_DELAYS[retries++]);
      }
    },

    externalChange: async (id) => {
      const { meta } = get();
      if (!meta || meta.id !== id || get().status !== 'ready') return;
      const fresh = await repo.getProject(id).catch(() => null);
      if (get().meta?.id !== id) return;
      if (!fresh || fresh.meta.deletedAt !== null) {
        set({ conflict: 'trashed' });
        return;
      }
      const present = get().history?.present;
      if (!present || sameDocument(fresh.doc, present)) {
        // Only the name, favourite or thumbnail changed — we're in step with the stored copy.
        set({ meta: fresh.meta, lastSavedAt: fresh.meta.updatedAt });
        return;
      }
      const busy = get().saveState !== 'saved' || txBase !== null || get().editingTextId !== null || get().croppingId !== null;
      if (busy) {
        set({ conflict: 'changed' });
        return;
      }
      set({
        meta: fresh.meta,
        history: createHistory(fresh.doc),
        lastSavedAt: fresh.meta.updatedAt,
        conflict: null,
        ...reconcile(fresh.doc),
      });
      // Once is enough while the other tab keeps autosaving.
      if (Date.now() - lastSyncToast > 60_000) toast({ title: 'Updated with changes from another tab', duration: 2500 });
      lastSyncToast = Date.now();
    },

    resolveConflict: async (keep) => {
      const { meta, conflict } = get();
      if (!meta || !conflict) return;
      if (keep === 'mine') {
        // Save over whatever is stored now.
        const stored = await repo.getProjectMeta(meta.id);
        if (stored) set({ lastSavedAt: stored.updatedAt });
        if (conflict === 'trashed') {
          const restored = await repo.restoreProject(meta.id).catch(() => null);
          if (!restored) {
            // Deleted for good elsewhere: put it back as it is here.
            const doc = get().history?.present;
            if (doc) await repo.insertProject({ ...meta, folderId: meta.folderId }, doc);
          }
        }
        set({ conflict: null, saveState: 'dirty' });
        await get().save();
        return;
      }
      const fresh = await repo.getProject(meta.id);
      if (!fresh) return;
      txBase = null;
      set({
        meta: fresh.meta,
        history: createHistory(fresh.doc),
        saveState: 'saved',
        saveError: null,
        conflict: null,
        lastSavedAt: fresh.meta.updatedAt,
        ...reconcile(fresh.doc),
      });
    },

    rename: async (name) => {
      const { meta } = get();
      if (!meta) return;
      await useProjects.getState().rename(meta.id, name);
      const updated = useProjects.getState().projects.find((p) => p.id === meta.id);
      if (updated) set({ meta: updated, lastSavedAt: updated.updatedAt });
    },

    setActiveSlide: (index) => {
      const count = get().history?.present.slides.length ?? 1;
      set({ activeSlide: clamp(index, 0, count - 1) });
    },

    select: (ids) => {
      const { selection, editingTextId, croppingId } = get();
      const same = ids.length === selection.length && ids.every((id, i) => id === selection[i]);
      if (!same)
        set({
          selection: ids,
          editingTextId: editingTextId && ids.includes(editingTextId) ? editingTextId : null,
          croppingId: croppingId && ids.length === 1 && ids[0] === croppingId ? croppingId : null,
        });
    },
    clearSelection: () => {
      if (get().selection.length || get().editingTextId || get().croppingId)
        set({ selection: [], editingTextId: null, croppingId: null });
    },
    setEditingText: (id) => set(id ? { editingTextId: id, selection: [id], croppingId: null } : { editingTextId: null }),
    setCropping: (id) => set(id ? { croppingId: id, selection: [id], editingTextId: null } : { croppingId: null }),
    setTool: (tool) => set({ tool }),
    setPanel: (panel) => set({ panel }),
    toggleGrid: () => set((s) => ({ showGrid: !s.showGrid })),
    toggleSafeArea: () => set((s) => ({ showSafeArea: !s.showSafeArea })),
    toggleRulers: () => set((s) => ({ showRulers: !s.showRulers })),
    toggleSnapping: () => set((s) => ({ snapping: !s.snapping })),
  };
});

export const selectDoc = (s: EditorState) => s.history?.present ?? null;
