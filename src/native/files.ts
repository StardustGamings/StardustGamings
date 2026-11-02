import { Directory, Filesystem } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';

/**
 * File saving and sharing inside the Android app, where the WebView can't do
 * browser downloads or `navigator.share`. Files go to the phone's own storage
 * (Documents/Stardeck, or the app cache while sharing) — nothing is uploaded.
 * Loaded on demand, so browsers never download this code.
 */

const FOLDER = 'Stardeck';
/** Written in slices so big videos and backups never sit in memory as one base64 string. Multiple of 3 so slices encode cleanly. */
const CHUNK = 3 * 1024 * 1024;

function safeName(name: string): string {
  return name.replace(/[\\/:*?"<>|\u0000-\u001f]+/g, '-').trim() || 'stardeck-file';
}

function base64Of(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const url = String(reader.result);
      resolve(url.slice(url.indexOf(',') + 1));
    };
    reader.onerror = () => reject(reader.error ?? new Error('Couldn’t read the file'));
    reader.readAsDataURL(blob);
  });
}

/** Writes a blob to a file slice by slice; returns its `file://` URI. `chunk` must be a multiple of 3. */
export async function writeBlob(blob: Blob, path: string, directory: Directory, chunk = CHUNK): Promise<string> {
  let offset = 0;
  do {
    const data = await base64Of(blob.slice(offset, offset + chunk));
    if (offset === 0) await Filesystem.writeFile({ path, data, directory, recursive: true });
    else await Filesystem.appendFile({ path, data, directory });
    offset += chunk;
  } while (offset < blob.size);
  return (await Filesystem.getUri({ path, directory })).uri;
}

/** Saves a file into Documents/Stardeck, where the gallery and the Files app can see it. */
export async function saveToDevice(blob: Blob, fileName: string): Promise<void> {
  await writeBlob(blob, `${FOLDER}/${safeName(fileName)}`, Directory.Documents);
}

/** Opens the Android share sheet with these files. Rejects with an `AbortError` when it's closed. */
export async function shareFiles(files: File[], title: string): Promise<void> {
  const uris: string[] = [];
  for (const file of files) uris.push(await writeBlob(file, `share/${safeName(file.name)}`, Directory.Cache));
  try {
    await Share.share({ title, files: uris, dialogTitle: title });
  } catch (e) {
    if (/cancel/i.test(e instanceof Error ? e.message : String(e))) {
      throw new DOMException('Share canceled', 'AbortError');
    }
    throw e;
  }
}
