import { beforeEach, describe, expect, it, vi } from 'vitest';

const fs = vi.hoisted(() => ({
  writeFile: vi.fn(async (_o: { path: string; data: string; directory: string; recursive?: boolean }) => ({ uri: '' })),
  appendFile: vi.fn(async (_o: { path: string; data: string; directory: string }) => undefined),
  getUri: vi.fn(async (o: { path: string; directory: string }) => ({ uri: `file:///${o.directory}/${o.path}` })),
}));
const share = vi.hoisted(() => ({ share: vi.fn(async (_o: unknown) => ({ activityType: '' })) }));

vi.mock('@capacitor/filesystem', () => ({
  Directory: { Documents: 'DOCUMENTS', Cache: 'CACHE' },
  Filesystem: fs,
}));
vi.mock('@capacitor/share', () => ({ Share: share }));

import { Directory } from '@capacitor/filesystem';
import { saveToDevice, shareFiles, writeBlob } from './files';

const decode = (b64: string) => Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));

beforeEach(() => {
  vi.clearAllMocks();
});

describe('saveToDevice', () => {
  it('writes the file into Documents/Stardeck as base64', async () => {
    await saveToDevice(new Blob(['hello']), 'My design.png');
    expect(fs.writeFile).toHaveBeenCalledTimes(1);
    const call = fs.writeFile.mock.calls[0]![0];
    expect(call).toMatchObject({ path: 'Stardeck/My design.png', directory: 'DOCUMENTS', recursive: true });
    expect(new TextDecoder().decode(decode(call.data))).toBe('hello');
    expect(fs.appendFile).not.toHaveBeenCalled();
  });

  it('keeps file names inside the folder', async () => {
    await saveToDevice(new Blob(['x']), '../a/b:c?.png');
    expect(fs.writeFile.mock.calls[0]![0].path).toBe('Stardeck/..-a-b-c-.png');
  });

  it('writes big files in slices that join back into the original bytes', async () => {
    const bytes = new Uint8Array(40).map((_, i) => (i * 31) % 256);
    await writeBlob(new Blob([bytes]), 'Stardeck/video.mp4', Directory.Documents, 12);
    expect(fs.writeFile).toHaveBeenCalledTimes(1);
    expect(fs.appendFile).toHaveBeenCalledTimes(3);
    const parts = [fs.writeFile.mock.calls[0]![0].data, ...fs.appendFile.mock.calls.map((c) => c[0].data)].map(decode);
    expect(parts.map((p) => p.length)).toEqual([12, 12, 12, 4]);
    expect(Uint8Array.from(parts.flatMap((p) => [...p]))).toEqual(bytes);
  });

  it('still writes an empty file', async () => {
    await saveToDevice(new Blob([]), 'empty.json');
    expect(fs.writeFile).toHaveBeenCalledTimes(1);
    expect(fs.writeFile.mock.calls[0]![0].data).toBe('');
  });
});

describe('shareFiles', () => {
  it('copies the files to the app cache and opens the share sheet with them', async () => {
    const files = [new File(['a'], 'slide-1.png'), new File(['b'], 'slide-2.png')];
    await shareFiles(files, 'Carousel');
    expect(fs.writeFile.mock.calls.map((c) => [c[0].path, c[0].directory])).toEqual([
      ['share/slide-1.png', 'CACHE'],
      ['share/slide-2.png', 'CACHE'],
    ]);
    expect(share.share).toHaveBeenCalledWith({
      title: 'Carousel',
      dialogTitle: 'Carousel',
      files: ['file:///CACHE/share/slide-1.png', 'file:///CACHE/share/slide-2.png'],
    });
  });

  it('turns closing the share sheet into an AbortError', async () => {
    share.share.mockRejectedValueOnce(new Error('Share canceled'));
    await expect(shareFiles([new File(['a'], 'a.png')], 'x')).rejects.toMatchObject({ name: 'AbortError' });
  });

  it('passes other failures through', async () => {
    share.share.mockRejectedValueOnce(new Error('No app can handle this'));
    await expect(shareFiles([new File(['a'], 'a.png')], 'x')).rejects.toThrow('No app can handle this');
  });
});
