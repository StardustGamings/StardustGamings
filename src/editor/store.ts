'use client';

import { create } from 'zustand';
import type { DesignDocument } from '@/types/document';
import type { ProjectMeta } from '@/types/project';
import * as repo from '@/projects/repository';
import { useProjects } from '@/projects/store';
import { renderThumbnail } from '@/canvas/thumbnail';
import { clearDevelopCache } from '@/images/develop';
import { clamp } from '@/utils/math';
import { createHistory, HISTORY_LIMIT, pushHistory, redoHistory, undoHistory, type History } from './history';

export type SaveState = 'saved' | 'dirty' | 'saving' | 'error';
export type Tool = 'select' | 'text' | 'hand';
export type PanelId = 'design' | 'text' | 'shapes' | 'stickers' | 'photos' | 'layers' | 'properties';

interface ApplyOptions {
  /** Consecutive edits with the same key (e.g. dragging a colour picker) merge into one undo step. */
  coalesce?: string;
}

interface EditorState {
  status: 'idle' | 'loading' | 'ready' | 'missing';
  meta: ProjectMeta | null;
  history: History<DesignDocument> | null;
  saveState: SaveState;
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
      txBase = null;
      set({
        status: 'loading',
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
      } catch {
        set({ status: 'missing' });
      }
    },

    reset: () => {
      get().commit();
      // Flush edits made inside the autosave window before tearing down.
      if (get().saveState === 'dirty') void get().save();
      clearTimeout(saveTimer);
      // Developed photos are per-design; free them (thumbnails are rendered after this).
      setTimeout(clearDevelopCache, THUMB_DELAY + 2000);
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
      const { meta, history, saveState } = get();
      if (!meta || !history || saveState === 'saving') return;
      // Never persist a half-finished gesture.
      const doc = txBase ?? history.present;
      set({ saveState: 'saving' });
      try {
        const saved = await repo.saveDocument(meta.id, doc);
        useProjects.getState().upsert(saved);
        scheduleThumbnail(meta.id, doc);
        // The editor may have closed (or opened another project) while writing.
        if (get().meta?.id !== meta.id) return;
        // Only mark clean if nothing changed while we were writing.
        const stillCurrent = get().history?.present === doc && txBase === null;
        set({ meta: saved, saveState: stillCurrent ? 'saved' : 'dirty', lastSavedAt: saved.updatedAt });
        if (!stillCurrent) scheduleSave();
      } catch {
        if (get().meta?.id === meta.id) set({ saveState: 'error' });
      }
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
