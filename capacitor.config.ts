import type { CapacitorConfig } from '@capacitor/cli';

/**
 * The Android app: the same static export (`out/`) packed into an APK, so it
 * runs fully offline with nothing hosted. Build with `npm run android:sync`,
 * then Gradle (see docs/ANDROID.md).
 */
const config: CapacitorConfig = {
  appId: 'com.stardustgamings.stardeck',
  appName: 'Stardeck',
  webDir: 'out',
  backgroundColor: '#101012',
  plugins: {
    SystemBars: {
      style: 'DARK',
      initialViewportFitValueHint: 'cover',
    },
  },
};

export default config;
