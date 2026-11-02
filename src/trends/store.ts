'use client';

import { useMemo } from 'react';
import { create } from 'zustand';
import type { LookDefinition } from '@/filters/looks';
import { useSettings } from '@/settings/store';
import { registerStickerArt } from '@/stickers/library';
import { registerDumpStyles } from '@/layouts/dump-styles';
import { BUNDLED_PACK, loadDrop, loadTrendFeed, type DropEntry, type TrendFeed, type TrendSource } from './loader';
import { packLooks, packStickerArt, ruleToDumpStyle, sanitizePack } from './pack';
import type { TrendPack } from './schema';
import { checkPack } from './validate';

/**
 * The trend drops this browser knows about, and the one being shown. Discover,
 * the home screen, the editor's Trends tool, the photo-dump styles and the
 * sticker picker all read `pack`; picking an older drop from the archive (or
 * previewing a pack file) swaps it for this session.
 */

const SEEN_KEY = 'stardeck:trends-seen';

function readSeen(): string | null {
  try {
    return localStorage.getItem(SEEN_KEY);
  } catch {
    return null;
  }
}

function writeSeen(id: string): void {
  try {
    localStorage.setItem(SEEN_KEY, id);
  } catch {
    /* the "new" badge just shows again next time */
  }
}

/** Makes a pack's own stickers and layout rules usable by the pickers and generators. */
function activate(pack: TrendPack): void {
  registerStickerArt(packStickerArt(pack));
  registerDumpStyles(pack.layoutRules.map(ruleToDumpStyle));
}

activate(BUNDLED_PACK);

let known = new Map<string, TrendPack>([[BUNDLED_PACK.id, BUNDLED_PACK]]);
let feedSource: TrendSource = 'bundled';

export type PackSource = TrendSource | 'file';

interface TrendState {
  /** The drop shown everywhere. */
  pack: TrendPack;
  /** The newest live drop. */
  latest: TrendPack;
  /** Live drops, newest first. */
  drops: DropEntry[];
  source: PackSource;
  checkedAt: number | null;
  error: TrendFeed['error'] | null;
  status: 'idle' | 'loading' | 'ready';
  /** The newest drop, when it arrived since the drops were last looked at. */
  newDrop: { id: string; title: string } | null;
  /** A drop being fetched from the archive. */
  loadingDrop: string | null;
  refresh: (options?: { force?: boolean }) => Promise<void>;
  selectDrop: (id: string) => Promise<boolean>;
  markSeen: () => void;
  /** Shows a pack file (for pack authors) until the preview ends; returns what's wrong with it, if anything. */
  previewPack: (raw: unknown) => { ok: boolean; problems: string[] };
  endPreview: () => void;
}

export const useTrends = create<TrendState>()((set, get) => ({
  pack: BUNDLED_PACK,
  latest: BUNDLED_PACK,
  drops: [],
  source: 'bundled',
  checkedAt: null,
  error: null,
  status: 'idle',
  newDrop: null,
  loadingDrop: null,

  refresh: async ({ force = false } = {}) => {
    const { status } = get();
    if (status === 'loading' || (status === 'ready' && !force)) return;
    set({ status: 'loading' });
    const feed = await loadTrendFeed({ network: useSettings.getState().privacy.trendUpdates });
    known = feed.packs;
    feedSource = feed.source;
    const seen = readSeen();
    if (!seen) writeSeen(feed.latest.id);
    const previewing = get().source === 'file';
    const pack = previewing ? get().pack : feed.latest;
    activate(pack);
    set({
      pack,
      latest: feed.latest,
      drops: feed.entries,
      source: previewing ? 'file' : feed.source,
      checkedAt: feed.checkedAt,
      error: feed.error ?? null,
      status: 'ready',
      newDrop: seen && seen !== feed.latest.id ? { id: feed.latest.id, title: feed.latest.title } : null,
    });
  },

  selectDrop: async (id) => {
    const entry = get().drops.find((d) => d.id === id);
    let pack = known.get(id);
    if (!pack && entry) {
      set({ loadingDrop: id });
      try {
        pack = await loadDrop(entry);
        known.set(id, pack);
      } catch {
        pack = undefined;
      } finally {
        set({ loadingDrop: null });
      }
    }
    if (!pack) return false;
    activate(pack);
    set({ pack, source: feedSource });
    return true;
  },

  markSeen: () => {
    writeSeen(get().latest.id);
    if (get().newDrop) set({ newDrop: null });
  },

  previewPack: (raw) => {
    const { pack, problems } = checkPack(raw);
    if (!pack) return { ok: false, problems };
    const clean = sanitizePack(pack);
    activate(clean);
    set({ pack: clean, source: 'file' });
    return { ok: true, problems };
  },

  endPreview: () => {
    const latest = get().latest;
    activate(latest);
    set({ pack: latest, source: feedSource });
  },
}));

/** The shown drop's looks, as filters (for the pickers). */
export function useTrendLooks(): LookDefinition[] {
  const pack = useTrends((s) => s.pack);
  return useMemo(() => packLooks(pack), [pack]);
}
