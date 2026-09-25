'use client';

import { create } from 'zustand';
import type { TrendPack } from './schema';
import { BUNDLED_PACK, loadLatestTrendPack } from './loader';

interface TrendState {
  pack: TrendPack;
  refreshed: boolean;
  refresh: () => Promise<void>;
}

export const useTrends = create<TrendState>()((set, get) => ({
  pack: BUNDLED_PACK,
  refreshed: false,
  refresh: async () => {
    if (get().refreshed) return;
    set({ refreshed: true });
    set({ pack: await loadLatestTrendPack() });
  },
}));
