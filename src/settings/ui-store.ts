'use client';

import { create } from 'zustand';
import type { FormatId } from '@/types/project';
import type { CollageFamily } from '@/types/document';

interface NewProjectRequest {
  format: FormatId;
}

export type PhotoFlowMode = 'dump' | 'seamless' | 'collage';

/** The "make something from my photos" flows (photo dump, seamless swipe, collage). */
export interface PhotoFlowRequest {
  mode: PhotoFlowMode;
  /** `new` creates a project; `current` adds to the design open in the editor. */
  target: 'new' | 'current';
  /** Collage style to start with. */
  family?: CollageFamily;
}

interface UiState {
  paletteOpen: boolean;
  setPaletteOpen: (open: boolean) => void;
  newProject: NewProjectRequest | null;
  openNewProject: (format: FormatId) => void;
  closeNewProject: () => void;
  onboardingReplay: boolean;
  setOnboardingReplay: (open: boolean) => void;
  /** Project currently being renamed (global dialog). */
  renameId: string | null;
  setRenameId: (id: string | null) => void;
  /** Project awaiting permanent-delete confirmation. */
  purgeId: string | null;
  setPurgeId: (id: string | null) => void;
  photoFlow: PhotoFlowRequest | null;
  openPhotoFlow: (mode: PhotoFlowMode, target: PhotoFlowRequest['target'], family?: CollageFamily) => void;
  closePhotoFlow: () => void;
  /** Full-screen swipe preview of the carousel open in the editor. */
  carouselPreview: boolean;
  setCarouselPreview: (open: boolean) => void;
}

export const useUi = create<UiState>()((set) => ({
  paletteOpen: false,
  setPaletteOpen: (paletteOpen) => set({ paletteOpen }),
  newProject: null,
  openNewProject: (format) => set({ newProject: { format }, paletteOpen: false }),
  closeNewProject: () => set({ newProject: null }),
  onboardingReplay: false,
  setOnboardingReplay: (onboardingReplay) => set({ onboardingReplay }),
  renameId: null,
  setRenameId: (renameId) => set({ renameId }),
  purgeId: null,
  setPurgeId: (purgeId) => set({ purgeId }),
  photoFlow: null,
  openPhotoFlow: (mode, target, family) => set({ photoFlow: { mode, target, family }, paletteOpen: false, newProject: null }),
  closePhotoFlow: () => set({ photoFlow: null }),
  carouselPreview: false,
  setCarouselPreview: (carouselPreview) => set({ carouselPreview }),
}));
