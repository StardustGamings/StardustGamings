import { describe, expect, it } from 'vitest';
import { createDocument } from '@/projects/document';
import { elementSchema } from '@/projects/schema';
import { SHAPE_PRESETS, TEXT_PRESETS, createShape, createSticker, createText, slideCenter } from './factory';
import { parseElements, serializeElements } from './clipboard';

describe('element factories', () => {
  const dark = createDocument({ width: 1080, height: 1350, slideCount: 2, background: { type: 'solid', color: '#0B0A12' } });
  const light = createDocument({ width: 1080, height: 1350 });

  it('creates valid, centred, legible text for every preset', () => {
    for (const preset of TEXT_PRESETS) {
      const t = createText(dark, slideCenter(dark, 1), preset);
      expect(elementSchema.safeParse(t).success).toBe(true);
      expect(t.x + t.width / 2).toBeCloseTo(1080 + 540, -1);
    }
    const onDark = createText(dark, slideCenter(dark, 0));
    const onLight = createText(light, slideCenter(light, 0));
    expect(onDark.fill).toEqual({ type: 'solid', color: '#FFFFFF' });
    expect(onLight.fill).toEqual({ type: 'solid', color: '#0B0A12' });
  });

  it('covers the typography styles from the brief', () => {
    const names = TEXT_PRESETS.map((p) => p.name);
    for (const style of [
      'Editorial',
      'Luxury',
      'Streetwear',
      'Y2K',
      'Minimal',
      'Cyber',
      'Meme',
      'Magazine',
      'Newspaper',
      'Brutalist',
      'Futuristic',
      'Soft',
      'Retro',
    ]) {
      expect(names).toContain(style);
    }
  });

  it('creates valid shapes and stickers', () => {
    for (const preset of SHAPE_PRESETS)
      expect(elementSchema.safeParse(createShape(light, { x: 540, y: 675 }, preset)).success).toBe(true);
    const sticker = createSticker(light, { x: 540, y: 675 }, 'vector:heart');
    expect(sticker.tint).toBe('#FF4F8B');
    expect(elementSchema.safeParse(createSticker(light, { x: 0, y: 0 }, 'emoji:🔥')).success).toBe(true);
  });
});

describe('clipboard payloads', () => {
  it('round-trips elements and rejects anything else', () => {
    const doc = createDocument({ width: 1080, height: 1080 });
    const els = [createShape(doc, { x: 100, y: 100 })];
    expect(parseElements(serializeElements(els))).toEqual(els);
    expect(parseElements('hello')).toBeNull();
    expect(parseElements('stardeck/elements+json:{"v":1,"elements":[{"type":"evil"}]}')).toBeNull();
    expect(parseElements('stardeck/elements+json:not json')).toBeNull();
  });
});
