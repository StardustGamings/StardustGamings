'use client';

import { create } from 'zustand';
import type { Rect } from '@/canvas/render/types';
import type { SnapLine } from '../core/snapping';

/** Transient, high-frequency interaction state rendered by the overlay. */
interface InteractionState {
  snapLines: SnapLine[];
  marquee: Rect | null;
  hoverId: string | null;
  /** A live read-out shown near the pointer while transforming ("1080 × 540", "45°"). */
  readout: { text: string; x: number; y: number } | null;
  spaceHeld: boolean;
  /** Image frame highlighted while something is dragged over it. */
  dropTargetId: string | null;
  gesture: 'none' | 'pan' | 'move' | 'resize' | 'rotate' | 'marquee' | 'guide' | 'pinch' | 'crop';
  set: (patch: Partial<Omit<InteractionState, 'set'>>) => void;
}

export const useInteraction = create<InteractionState>()((set) => ({
  snapLines: [],
  marquee: null,
  hoverId: null,
  readout: null,
  spaceHeld: false,
  dropTargetId: null,
  gesture: 'none',
  set: (patch) => set(patch),
}));
