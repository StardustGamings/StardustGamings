import type { FormatId } from './project';

export type ThemePreference = 'system' | 'dark' | 'light' | 'oled';
export type ResolvedTheme = 'dark' | 'light' | 'oled';
export type MotionPreference = 'system' | 'full' | 'reduced' | 'off';
export type ResolvedMotion = 'full' | 'reduced' | 'off';
export type ExportFormat = 'png' | 'jpg' | 'webp' | 'pdf' | 'mp4' | 'gif';
export type ExportQuality = 'standard' | 'high' | 'max';

export interface Settings {
  theme: ThemePreference;
  motion: MotionPreference;
  /** Root font scale, 0.875 – 1.25. */
  uiScale: number;
  highContrast: boolean;
  /** Animated aurora + stardust particles in the background. */
  ambientEffects: boolean;
  /** Frosted-glass blur on panels (can be costly on low-end GPUs). */
  glass: boolean;
  onboarded: boolean;
  displayName: string;
  editor: {
    defaultFormat: FormatId;
    carouselSlides: number;
    showGrid: boolean;
    showSafeArea: boolean;
  };
  export: {
    format: ExportFormat;
    quality: ExportQuality;
  };
  privacy: {
    /** Opt-in for any feature that would send data off the device. Off by default. */
    cloudFeatures: boolean;
  };
}
