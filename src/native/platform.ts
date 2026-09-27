/**
 * The Android app is this same web app inside a WebView (Capacitor), which
 * injects `window.Capacitor` before any page script runs. Browsers never have it.
 */
export function isNativeApp(): boolean {
  if (typeof window === 'undefined') return false;
  const cap = (window as Window & { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor;
  return cap?.isNativePlatform?.() === true;
}

/** The Windows app (Electron) serves the same export from its own `app://` scheme. */
export function isDesktopApp(): boolean {
  return typeof window !== 'undefined' && window.location.protocol === 'app:';
}

/** Running as an installed app (Android or Windows) rather than in a browser. */
export function isInstalledApp(): boolean {
  return isNativeApp() || isDesktopApp();
}

/** Where the Android app saves files: the phone's shared Documents folder. */
export const NATIVE_SAVE_FOLDER = 'Documents/Stardeck';
