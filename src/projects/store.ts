'use client';

import { create } from 'zustand';
import type { Folder, FormatId, ProjectMeta, SizePresetId } from '@/types/project';
import { renderThumbnail } from '@/canvas/thumbnail';
import * as folderRepo from './folders';
import * as repo from './repository';

type Status = 'idle' | 'loading' | 'ready' | 'error';

interface ProjectsState {
  status: Status;
  projects: ProjectMeta[];
  folders: Folder[];
  /** Object URLs for stored thumbnails, keyed by project id. */
  thumbnails: Record<string, string>;
  storageKind: 'indexeddb' | 'memory' | null;
  load: () => Promise<void>;
  create: (input: repo.CreateProjectInput) => Promise<ProjectMeta>;
  duplicate: (id: string) => Promise<ProjectMeta>;
  rename: (id: string, name: string) => Promise<void>;
  setSize: (id: string, sizeId: SizePresetId, format: FormatId) => Promise<ProjectMeta>;
  toggleFavorite: (id: string) => Promise<void>;
  trash: (id: string) => Promise<void>;
  restore: (id: string) => Promise<void>;
  deleteForever: (id: string) => Promise<void>;
  emptyTrash: () => Promise<number>;
  /** Merge a meta record updated elsewhere (e.g. by the editor's autosave). */
  upsert: (meta: ProjectMeta) => void;
  setThumbnail: (id: string, blob: Blob) => Promise<void>;
  clearAll: () => Promise<void>;
  createFolder: (name: string, color?: string) => Promise<Folder>;
  updateFolder: (id: string, patch: { name?: string; color?: string }) => Promise<void>;
  /** Deletes a folder; its projects stay. Returns how many moved out. */
  deleteFolder: (id: string) => Promise<number>;
  moveToFolder: (ids: string[], folderId: string | null) => Promise<void>;
  /** Re-reads one project (and its thumbnail) after another tab changed it. */
  refresh: (id: string) => Promise<void>;
  /** Re-reads everything after a bulk change (import, another tab's cleanup…). */
  reload: () => Promise<void>;
}

const sortByUpdated = (list: ProjectMeta[]) => [...list].sort((a, b) => b.updatedAt - a.updatedAt);

function revoke(url: string | undefined) {
  if (url && typeof URL !== 'undefined' && URL.revokeObjectURL) URL.revokeObjectURL(url);
}

function toUrl(blob: Blob | null): string | null {
  if (!blob || typeof URL === 'undefined' || !URL.createObjectURL) return null;
  return URL.createObjectURL(blob);
}

export const useProjects = create<ProjectsState>()((set, get) => {
  const replace = (meta: ProjectMeta) =>
    set((s) => ({ projects: sortByUpdated([meta, ...s.projects.filter((p) => p.id !== meta.id)]) }));

  const dropThumb = (id: string) =>
    set((s) => {
      revoke(s.thumbnails[id]);
      const { [id]: _removed, ...rest } = s.thumbnails;
      return { thumbnails: rest };
    });

  const loadThumb = async (id: string) => {
    const url = toUrl(await repo.getThumbnail(id));
    if (!url) return;
    set((s) => {
      revoke(s.thumbnails[id]);
      return { thumbnails: { ...s.thumbnails, [id]: url } };
    });
  };

  return {
    status: 'idle',
    projects: [],
    folders: [],
    thumbnails: {},
    storageKind: null,

    load: async () => {
      if (get().status === 'loading') return;
      set({ status: 'loading' });
      try {
        await repo.purgeExpiredTrash();
        const [projects, folders, kind] = await Promise.all([repo.listProjects(), folderRepo.listFolders(), repo.storageKind()]);
        set({ projects, folders, status: 'ready', storageKind: kind });
        // Thumbnails stream in after the list so the dashboard paints immediately.
        for (const p of projects) {
          if (get().thumbnails[p.id]) continue;
          const url = toUrl(await repo.getThumbnail(p.id));
          if (url) set((s) => ({ thumbnails: { ...s.thumbnails, [p.id]: url } }));
        }
      } catch {
        set({ status: 'error' });
      }
    },

    create: async (input) => {
      const project = await repo.createProject(input);
      replace(project.meta);
      void renderThumbnail(project.doc).then((blob) => (blob ? get().setThumbnail(project.meta.id, blob) : undefined));
      return project.meta;
    },

    duplicate: async (id) => {
      const project = await repo.duplicateProject(id);
      replace(project.meta);
      const url = toUrl(await repo.getThumbnail(project.meta.id));
      if (url) set((s) => ({ thumbnails: { ...s.thumbnails, [project.meta.id]: url } }));
      return project.meta;
    },

    rename: async (id, name) => replace(await repo.renameProject(id, name)),

    setSize: async (id, sizeId, format) => {
      const meta = await repo.setProjectSize(id, sizeId, format);
      replace(meta);
      return meta;
    },

    toggleFavorite: async (id) => {
      const current = get().projects.find((p) => p.id === id);
      if (!current) return;
      const meta = await repo.setFavorite(id, !current.favorite);
      set((s) => ({ projects: s.projects.map((p) => (p.id === id ? meta : p)) }));
    },

    trash: async (id) => {
      const meta = await repo.trashProject(id);
      set((s) => ({ projects: s.projects.map((p) => (p.id === id ? meta : p)) }));
    },

    restore: async (id) => {
      const meta = await repo.restoreProject(id);
      set((s) => ({ projects: s.projects.map((p) => (p.id === id ? meta : p)) }));
    },

    deleteForever: async (id) => {
      await repo.deleteProjectForever(id);
      set((s) => ({ projects: s.projects.filter((p) => p.id !== id) }));
      dropThumb(id);
    },

    emptyTrash: async () => {
      const trashed = get().projects.filter((p) => p.deletedAt !== null);
      const count = await repo.emptyTrash();
      set((s) => ({ projects: s.projects.filter((p) => p.deletedAt === null) }));
      trashed.forEach((p) => dropThumb(p.id));
      return count;
    },

    upsert: (meta) => replace(meta),

    setThumbnail: async (id, blob) => {
      await repo.saveThumbnail(id, blob);
      const url = toUrl(blob);
      if (!url) return;
      set((s) => {
        revoke(s.thumbnails[id]);
        return { thumbnails: { ...s.thumbnails, [id]: url } };
      });
    },

    clearAll: async () => {
      await repo.clearAllProjects();
      Object.values(get().thumbnails).forEach(revoke);
      set({ projects: [], folders: [], thumbnails: {} });
    },

    createFolder: async (name, color) => {
      const folder = await folderRepo.createFolder(name, color);
      set({ folders: await folderRepo.listFolders() });
      return folder;
    },

    updateFolder: async (id, patch) => {
      await folderRepo.updateFolder(id, patch);
      set({ folders: await folderRepo.listFolders() });
    },

    deleteFolder: async (id) => {
      const moved = await folderRepo.deleteFolder(id);
      const [projects, folders] = await Promise.all([repo.listProjects(), folderRepo.listFolders()]);
      set({ projects, folders });
      return moved;
    },

    moveToFolder: async (ids, folderId) => {
      const moved = await repo.moveProjects(ids, folderId);
      const byId = new Map(moved.map((m) => [m.id, m]));
      set((s) => ({ projects: s.projects.map((p) => byId.get(p.id) ?? p) }));
    },

    refresh: async (id) => {
      if (get().status !== 'ready') return;
      const meta = await repo.getProjectMeta(id);
      if (!meta) {
        set((s) => ({ projects: s.projects.filter((p) => p.id !== id) }));
        dropThumb(id);
        return;
      }
      replace(meta);
      await loadThumb(id);
    },

    reload: async () => {
      if (get().status !== 'ready') return;
      const [projects, folders] = await Promise.all([repo.listProjects(), folderRepo.listFolders()]);
      const ids = new Set(projects.map((p) => p.id));
      Object.keys(get().thumbnails)
        .filter((id) => !ids.has(id))
        .forEach(dropThumb);
      set({ projects, folders });
      for (const p of projects) if (!get().thumbnails[p.id]) await loadThumb(p.id);
    },
  };
});
