import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import bundled from './bundled.generated.json';
import { checkFeed } from './validate';
import { formatCategory } from './pack';

const trendsDir = path.resolve(__dirname, '../../public/trends');
const read = (p: string) => JSON.parse(readFileSync(path.join(trendsDir, p.replace(/^\/trends\//, '')), 'utf8'));

describe('published trend drops', () => {
  const { index, packs, problems } = checkFeed(read('index.json'), read);

  it('every pack in public/trends validates and every reference resolves', () => {
    expect(problems).toEqual([]);
    expect(packs.size).toBe(index!.packs.length);
  });

  it('the bundled copy matches the files (run `npm run trends` after editing a pack)', () => {
    for (const entry of index!.packs) expect((bundled.packs as Record<string, unknown>)[entry.id]).toEqual(read(entry.path));
    expect(bundled.index.map((e) => e.id)).toEqual(index!.packs.map((e) => e.id));
  });

  it('each drop covers the brief’s categories', () => {
    for (const pack of packs.values()) {
      expect(pack.typography.length, pack.id).toBeGreaterThan(0);
      expect(pack.palettes.length, pack.id).toBeGreaterThan(0);
      expect(pack.stickers.length, pack.id).toBeGreaterThan(0);
      expect(pack.effects.length, pack.id).toBeGreaterThan(0);
      expect(pack.looks.length, pack.id).toBeGreaterThan(0);
      expect(pack.layoutRules.length, pack.id).toBeGreaterThan(0);
      expect(pack.styles.length, pack.id).toBeGreaterThan(0);
      expect(pack.stickerArt.length, pack.id).toBeGreaterThan(0);
      const categories = new Set(pack.formats.map(formatCategory));
      expect(categories.has('meme') && categories.has('social'), pack.id).toBe(true);
    }
  });
});
