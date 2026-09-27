import { beforeEach, describe, expect, it } from 'vitest';
import { MemoryStorage, setStorageForTesting } from '@/storage/db';
import {
  addUserFont,
  deleteUserFont,
  familyFromFileName,
  FontImportError,
  listUserFonts,
  sniffFontFormat,
  uniqueFamily,
} from './user-fonts';

beforeEach(() => setStorageForTesting(new MemoryStorage()));

const bytes = (tag: string, extra = 0) => new Uint8Array([...tag].map((c) => c.charCodeAt(0)).concat(Array(32 + extra).fill(7)));
const fontFile = (name: string, tag = 'wOF2', extra = 0) => new File([bytes(tag, extra)], name, { type: 'font/woff2' });

describe('fonts people add', () => {
  it('recognises font files by their bytes, not their names', () => {
    expect(sniffFontFormat(bytes('wOF2'))).toBe('woff2');
    expect(sniffFontFormat(bytes('wOFF'))).toBe('woff');
    expect(sniffFontFormat(bytes('OTTO'))).toBe('otf');
    expect(sniffFontFormat(new Uint8Array([0, 1, 0, 0, 5]))).toBe('ttf');
    expect(sniffFontFormat(bytes('true'))).toBe('ttf');
    expect(sniffFontFormat(bytes('ttcf'))).toBeNull(); // collections aren't supported
    expect(sniffFontFormat(new TextEncoder().encode('<html>'))).toBeNull();
  });

  it('names a family from its file name, never clashing with a bundled or existing one', () => {
    expect(familyFromFileName('PlayfairDisplay-BoldItalic.ttf')).toBe('Playfair Display');
    expect(familyFromFileName('Inter[wght].woff2')).toBe('Inter');
    expect(familyFromFileName('my_brand-font-Regular.otf')).toBe('my brand font');
    expect(familyFromFileName('✦✦✦.woff')).toBe('My font');
    expect(uniqueFamily('Brand Sans', [])).toBe('Brand Sans');
    expect(uniqueFamily('Brand Sans', ['brand sans'])).toBe('Brand Sans 2');
    expect(uniqueFamily('Anton', [])).toBe('Anton 2'); // a bundled family keeps its name
  });

  it('keeps added fonts on the device, once each, and removes them', async () => {
    const first = await addUserFont(fontFile('BrandSans-Bold.woff2'));
    expect(first.reused).toBe(false);
    expect(first.font).toMatchObject({ family: 'Brand Sans', format: 'woff2', fileName: 'BrandSans-Bold.woff2' });
    // The same file again is the same font.
    const again = await addUserFont(fontFile('copy.woff2'));
    expect(again).toMatchObject({ reused: true, font: { id: first.font.id } });
    // A different file with the same family name gets its own name.
    const other = await addUserFont(fontFile('Brand Sans.otf', 'OTTO'));
    expect(other.font.family).toBe('Brand Sans 2');
    expect((await listUserFonts()).map((f) => f.family)).toEqual(['Brand Sans', 'Brand Sans 2']);
    await deleteUserFont(first.font.id);
    expect((await listUserFonts()).map((f) => f.family)).toEqual(['Brand Sans 2']);
  });

  it('refuses files that aren’t fonts, empty files and very large ones', async () => {
    await expect(addUserFont(new File([new TextEncoder().encode('<svg/>')], 'evil.ttf'))).rejects.toBeInstanceOf(FontImportError);
    await expect(addUserFont(new File([], 'empty.ttf'))).rejects.toMatchObject({ code: 'empty' });
    await expect(addUserFont(fontFile('huge.woff2', 'wOF2', 13 * 1024 * 1024))).rejects.toMatchObject({ code: 'too-large' });
  });
});
