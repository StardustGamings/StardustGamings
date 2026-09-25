'use client';

import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { Settings } from '@/types/settings';
import { isFormatId, MAX_SLIDES } from '@/projects/formats';
import { clamp } from '@/utils/math';
import { DEFAULT_SETTINGS, SETTINGS_STORAGE_KEY, UI_SCALE_RANGE } from './defaults';

interface SettingsState extends Settings {
  hasHydrated: boolean;
  update: (patch: Partial<Settings>) => void;
  updateEditor: (patch: Partial<Settings['editor']>) => void;
  updateExport: (patch: Partial<Settings['export']>) => void;
  updatePrivacy: (patch: Partial<Settings['privacy']>) => void;
  reset: () => void;
}

const THEMES = new Set(['system', 'dark', 'light', 'oled']);
const MOTIONS = new Set(['system', 'full', 'reduced', 'off']);

/** Defensive merge: persisted data is user-controlled, so every field is validated. */
export function sanitizeSettings(input: unknown): Settings {
  const raw = (input && typeof input === 'object' ? input : {}) as Partial<Settings>;
  const d = DEFAULT_SETTINGS;
  const editor = (raw.editor ?? {}) as Partial<Settings['editor']>;
  const exp = (raw.export ?? {}) as Partial<Settings['export']>;
  const privacy = (raw.privacy ?? {}) as Partial<Settings['privacy']>;
  const bool = (v: unknown, fallback: boolean) => (typeof v === 'boolean' ? v : fallback);
  return {
    theme: THEMES.has(raw.theme as string) ? raw.theme! : d.theme,
    motion: MOTIONS.has(raw.motion as string) ? raw.motion! : d.motion,
    uiScale:
      typeof raw.uiScale === 'number' && Number.isFinite(raw.uiScale)
        ? clamp(raw.uiScale, UI_SCALE_RANGE.min, UI_SCALE_RANGE.max)
        : d.uiScale,
    highContrast: bool(raw.highContrast, d.highContrast),
    ambientEffects: bool(raw.ambientEffects, d.ambientEffects),
    glass: bool(raw.glass, d.glass),
    onboarded: bool(raw.onboarded, d.onboarded),
    displayName: typeof raw.displayName === 'string' ? raw.displayName.slice(0, 40) : d.displayName,
    editor: {
      defaultFormat: isFormatId(editor.defaultFormat) ? editor.defaultFormat : d.editor.defaultFormat,
      carouselSlides:
        typeof editor.carouselSlides === 'number' && Number.isFinite(editor.carouselSlides)
          ? clamp(Math.round(editor.carouselSlides), 1, MAX_SLIDES)
          : d.editor.carouselSlides,
      showGrid: bool(editor.showGrid, d.editor.showGrid),
      showSafeArea: bool(editor.showSafeArea, d.editor.showSafeArea),
    },
    export: {
      format: ['png', 'jpg', 'webp'].includes(exp.format as string) ? exp.format! : d.export.format,
      quality: ['standard', 'high', 'max'].includes(exp.quality as string) ? exp.quality! : d.export.quality,
    },
    privacy: { cloudFeatures: bool(privacy.cloudFeatures, d.privacy.cloudFeatures) },
  };
}

export const useSettings = create<SettingsState>()(
  persist(
    (set) => ({
      ...DEFAULT_SETTINGS,
      hasHydrated: false,
      update: (patch) => set((s) => sanitizeSettings({ ...s, ...patch })),
      updateEditor: (patch) => set((s) => ({ editor: sanitizeSettings({ ...s, editor: { ...s.editor, ...patch } }).editor })),
      updateExport: (patch) => set((s) => ({ export: sanitizeSettings({ ...s, export: { ...s.export, ...patch } }).export })),
      updatePrivacy: (patch) => set((s) => ({ privacy: { ...s.privacy, ...patch } })),
      reset: () => set({ ...DEFAULT_SETTINGS, onboarded: true }),
    }),
    {
      name: SETTINGS_STORAGE_KEY,
      version: 1,
      storage: createJSONStorage(() => localStorage),
      // Hydrate after mount so the static HTML and first client render agree.
      skipHydration: true,
      partialize: ({ hasHydrated: _h, update: _u, updateEditor: _e, updateExport: _x, updatePrivacy: _p, reset: _r, ...rest }) =>
        rest,
      merge: (persisted, current) => ({ ...current, ...sanitizeSettings(persisted) }),
      onRehydrateStorage: () => () => {
        useSettings.setState({ hasHydrated: true });
      },
    },
  ),
);
