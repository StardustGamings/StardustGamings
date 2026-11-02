import { afterEach, describe, expect, it, vi } from 'vitest';

const saveToDevice = vi.hoisted(() => vi.fn(async (_blob: Blob, _name: string) => undefined));
vi.mock('@/native/files', () => ({ saveToDevice }));

import { downloadBlob, savedToNote } from './download';

type CapWindow = Window & { Capacitor?: { isNativePlatform: () => boolean } };

afterEach(() => {
  delete (window as CapWindow).Capacitor;
  vi.restoreAllMocks();
  saveToDevice.mockClear();
});

describe('downloadBlob', () => {
  it('uses a normal browser download on the web', async () => {
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:x');
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
    await downloadBlob(new Blob(['a']), 'a.png');
    expect(click).toHaveBeenCalledTimes(1);
    expect(saveToDevice).not.toHaveBeenCalled();
    expect(savedToNote()).toBe('');
  });

  it('saves onto the phone inside the Android app', async () => {
    (window as CapWindow).Capacitor = { isNativePlatform: () => true };
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click');
    const blob = new Blob(['a']);
    await downloadBlob(blob, 'a.png');
    expect(saveToDevice).toHaveBeenCalledWith(blob, 'a.png');
    expect(click).not.toHaveBeenCalled();
    expect(savedToNote()).toBe(' Saved to Documents/Stardeck.');
  });

  it('reports a failed save to the caller', async () => {
    (window as CapWindow).Capacitor = { isNativePlatform: () => true };
    saveToDevice.mockRejectedValueOnce(new Error('disk full'));
    await expect(downloadBlob(new Blob(['a']), 'a.png')).rejects.toThrow('disk full');
  });
});
