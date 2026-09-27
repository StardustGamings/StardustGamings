import { isNativeApp, NATIVE_SAVE_FOLDER } from '@/native/platform';

/**
 * Saves a blob as a file through the browser's normal download flow — or, in the
 * Android app, into Documents/Stardeck on the phone. Nothing is uploaded.
 * Resolves once the file is saved (in browsers, once the download has started).
 */
export async function downloadBlob(blob: Blob, fileName: string): Promise<void> {
  if (isNativeApp()) {
    const { saveToDevice } = await import('@/native/files');
    await saveToDevice(blob, fileName);
    return;
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Where the file went, for the Android app (browsers show their own download bar); empty in browsers. */
export function savedToNote(): string {
  return isNativeApp() ? ` Saved to ${NATIVE_SAVE_FOLDER}.` : '';
}
