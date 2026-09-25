'use client';

import { create } from 'zustand';
import type { DesignDocument } from '@/types/document';
import type { ProjectMeta } from '@/types/project';
import * as repo from '@/projects/repository';
import { useProjects } from '@/projects/store';
import { renderThumbnail } from '@/canvas/thumbnail';
import { clamp } from '@/utils/math';
import { createHistory, pushHistory, redoHistory, undoHistory, type History } from './history';

export type SaveState = 'saved' | 'dirty' | 'saving' | 'error';

interface EditorState {
  status: 'idle' | 'loading' | 'ready' | 'missing';
  meta: ProjectMeta | null;
  history: History<DesignDocument> | null;
  saveState: SaveState;
  lastSavedAt: number | null;
  activeSlide: number;
  /** `null` = fit to viewport. */
  zoom: number | null;
  showGrid: boolean;
  showSafeArea: boolean;

  load: (id: string, prefs: { showGrid: boolean; showSafeArea: boolean }) => Promise<void>;
  reset: () => void;
  /** Apply an edit as one undoable step. */
  apply: (recipe: (doc: DesignDocument) => DesignDocument) => void;
  undo: () => void;
  redo: () => void;
  save: () => Promise<void>;
  rename: (name: string) => Promise<void>;
  setActiveSlide: (index: number) => void;
  setZoom: (zoom: number | null) => void;
  toggleGrid: () => void;
  toggleSafeArea: () => void;
}

let saveTimer: ReturnType<typeof setTimeout> | undefined;
let thumbTimer: ReturnType<typeof setTimeout> | undefined;
const AUTOSAVE_DELAY = 700;
const THUMB_DELAY = 1500;

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

  const commit = (history: History<DesignDocument>) => {
    const count = history.present.slides.length;
    set({ history, saveState: 'dirty', activeSlide: clamp(get().activeSlide, 0, count - 1) });
    scheduleSave();
  };

  return {
    status: 'idle',
    meta: null,
    history: null,
    saveState: 'saved',
    lastSavedAt: null,
    activeSlide: 0,
    zoom: null,
    showGrid: false,
    showSafeArea: true,

    load: async (id, prefs) => {
      clearTimeout(saveTimer);
      set({ status: 'loading', meta: null, history: null, activeSlide: 0, zoom: null, ...prefs });
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
      // Flush edits made inside the autosave window before tearing down.
      if (get().saveState === 'dirty') void get().save();
      clearTimeout(saveTimer);
      set({ status: 'idle', meta: null, history: null, saveState: 'saved' });
    },

    apply: (recipe) => {
      const { history } = get();
      if (!history) return;
      const next = recipe(history.present);
      if (next === history.present) return;
      commit(pushHistory(history, next));
    },

    undo: () => {
      const { history } = get();
      if (history?.past.length) commit(undoHistory(history));
    },

    redo: () => {
      const { history } = get();
      if (history?.future.length) commit(redoHistory(history));
    },

    save: async () => {
      clearTimeout(saveTimer);
      const { meta, history, saveState } = get();
      if (!meta || !history || saveState === 'saving') return;
      const doc = history.present;
      set({ saveState: 'saving' });
      try {
        const saved = await repo.saveDocument(meta.id, doc);
        useProjects.getState().upsert(saved);
        scheduleThumbnail(meta.id, doc);
        // The editor may have closed (or opened another project) while writing.
        if (get().meta?.id !== meta.id) return;
        // Only mark clean if nothing changed while we were writing.
        const stillCurrent = get().history?.present === doc;
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
    setZoom: (zoom) => set({ zoom }),
    toggleGrid: () => set((s) => ({ showGrid: !s.showGrid })),
    toggleSafeArea: () => set((s) => ({ showSafeArea: !s.showSafeArea })),
  };
});

export const selectDoc = (s: EditorState) => s.history?.present ?? null;
