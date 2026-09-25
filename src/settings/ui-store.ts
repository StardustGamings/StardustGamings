'use client';

import { create } from 'zustand';
import type { FormatId } from '@/types/project';

interface NewProjectRequest {
  format: FormatId;
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
}));
