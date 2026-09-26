'use client';

import { create } from 'zustand';
import { toast } from '@/components/ui/toast-store';
import { invalidateAsset } from './cache';
import * as repo from './repository';
import { sniffVideoFormat } from './sniff';
import { importVideoFile } from './video';
import type { AssetKind, AssetMeta } from './types';

interface AssetsState {
  status: 'idle' | 'loading' | 'ready';
  assets: AssetMeta[];
  /** Number of files currently being imported (drives progress UI). */
  importing: number;
  load: () => Promise<void>;
  /** Re-reads the library (after an import or another tab's changes). Deleted photos are dropped from the cache. */
  reload: () => Promise<void>;
  /**
   * Imports files into the library, with friendly toasts for anything that
   * can't be used. Resolves with the assets that made it, in the given order.
   */
  importFiles: (files: Iterable<Blob & { name?: string }>, kind?: Exclude<AssetKind, 'mask'>) => Promise<AssetMeta[]>;
  add: (meta: AssetMeta) => void;
  remove: (ids: string[]) => Promise<void>;
}

const IMAGE_ACCEPT = /^image\//;
const VIDEO_ACCEPT = /^video\//;

/** Videos ride along with photos (same pickers, drops and library). */
async function isVideo(file: Blob): Promise<boolean> {
  if (VIDEO_ACCEPT.test(file.type)) return true;
  if (file.type && IMAGE_ACCEPT.test(file.type)) return false;
  return sniffVideoFormat(new Uint8Array(await file.slice(0, 64).arrayBuffer())) !== null;
}

export const useAssets = create<AssetsState>()((set, get) => ({
  status: 'idle',
  assets: [],
  importing: 0,

  load: async () => {
    if (get().status !== 'idle') return;
    set({ status: 'loading' });
    try {
      set({ assets: await repo.listAssets(), status: 'ready' });
    } catch {
      set({ status: 'ready' });
    }
  },

  reload: async () => {
    if (get().status === 'idle') return;
    const assets = await repo.listAssets();
    const ids = new Set(assets.map((a) => a.id));
    get()
      .assets.filter((a) => !ids.has(a.id))
      .forEach((a) => invalidateAsset(a.id));
    set({ assets, status: 'ready' });
  },

  importFiles: async (input, kind = 'photo') => {
    const files = [...input];
    if (files.length === 0) return [];
    set((s) => ({ importing: s.importing + files.length }));
    const imported: AssetMeta[] = [];
    let optimizedToast = false;
    for (const file of files) {
      try {
        if (kind === 'photo' && (await isVideo(file))) {
          const video = await importVideoFile(file);
          imported.push(video.meta);
          get().add(video.meta);
          continue;
        }
        // Browsers sometimes report an empty type for valid photos; the sniffer is the real check.
        if (file.type && !IMAGE_ACCEPT.test(file.type) && file.type !== 'application/octet-stream') {
          throw new repo.ImportError('unsupported');
        }
        if (!optimizedToast && file.size > 15 * 1024 * 1024) {
          optimizedToast = true;
          toast({ title: 'Oops — that image is huge.', description: 'We’re optimizing it for you…', tone: 'info' });
        }
        const result = await repo.importImageFile(file, kind);
        imported.push(result.meta);
        get().add(result.meta);
        if (result.optimized && !optimizedToast) {
          optimizedToast = true;
          toast({
            title: 'Big photo — optimized for smooth editing',
            description: 'The full-resolution original is kept for export.',
            tone: 'info',
          });
        }
      } catch (err) {
        const { title, description } = repo.describeImportError(err);
        toast({ title: files.length > 1 && file.name ? `${file.name}: ${title}` : title, description, tone: 'error' });
      } finally {
        set((s) => ({ importing: Math.max(0, s.importing - 1) }));
      }
    }
    return imported;
  },

  add: (meta) => set((s) => ({ assets: [meta, ...s.assets.filter((a) => a.id !== meta.id)] })),

  remove: async (ids) => {
    await repo.deleteAssets(ids);
    ids.forEach(invalidateAsset);
    set((s) => ({ assets: s.assets.filter((a) => !ids.includes(a.id)) }));
  },
}));
