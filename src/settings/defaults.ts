import type { Settings } from '@/types/settings';

export const SETTINGS_STORAGE_KEY = 'stardeck.settings';
export const UI_SCALE_RANGE = { min: 0.875, max: 1.25, step: 0.0625 } as const;

export const DEFAULT_SETTINGS: Settings = {
  theme: 'dark',
  motion: 'system',
  uiScale: 1,
  highContrast: false,
  ambientEffects: true,
  glass: true,
  onboarded: false,
  displayName: '',
  editor: {
    defaultFormat: 'carousel',
    carouselSlides: 5,
    showGrid: false,
    showSafeArea: true,
  },
  export: {
    format: 'png',
    quality: 'high',
  },
  privacy: {
    cloudFeatures: false,
  },
};
