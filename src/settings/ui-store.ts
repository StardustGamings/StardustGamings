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

/** Template preview: `new` starts a project; `editor` adds to (or replaces) the open design. */
export interface TemplatePreviewRequest {
  id: string;
  target: 'new' | 'editor';
}

/** Export a design: the one open in the editor, or a project from the library. */
export type ExportRequest = { source: 'editor' } | { source: 'project'; projectId: string };

/** Save a design as a template: from the editor (`current`) or a project in the library. */
export type SaveTemplateRequest = { source: 'editor' } | { source: 'project'; projectId: string };

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
  templatePreview: TemplatePreviewRequest | null;
  openTemplate: (id: string, target?: TemplatePreviewRequest['target']) => void;
  closeTemplate: () => void;
  exportRequest: ExportRequest | null;
  openExport: (request: ExportRequest) => void;
  closeExport: () => void;
  saveTemplate: SaveTemplateRequest | null;
  openSaveTemplate: (request: SaveTemplateRequest) => void;
  closeSaveTemplate: () => void;
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
  templatePreview: null,
  openTemplate: (id, target = 'new') => set({ templatePreview: { id, target }, paletteOpen: false, newProject: null }),
  closeTemplate: () => set({ templatePreview: null }),
  exportRequest: null,
  openExport: (exportRequest) => set({ exportRequest, paletteOpen: false }),
  closeExport: () => set({ exportRequest: null }),
  saveTemplate: null,
  openSaveTemplate: (saveTemplate) => set({ saveTemplate, paletteOpen: false }),
  closeSaveTemplate: () => set({ saveTemplate: null }),
}));
