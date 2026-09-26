import { describe, expect, it } from 'vitest';
import { applyPalette, GIFEncoder, quantize } from 'gifenc';
import { createDocument } from '@/projects/document';
import { MAX_GIF_MS, motionFileName, motionFps, motionSize } from './motion-plan';

describe('animated export planning', () => {
  const portrait = createDocument({ width: 1080, height: 1350, slideCount: 3 });
  const story = createDocument({ width: 1080, height: 1920 });

  it('sizes videos in even pixels (encoders need them), capped per quality', () => {
    expect(motionSize(portrait, 'mp4', 'standard')).toMatchObject({ width: 1080, height: 1350 });
    expect(motionSize(portrait, 'mp4', 'high')).toMatchObject({ width: 1620, height: 2024 });
    const max = motionSize(story, 'mp4', 'max');
    expect(Math.max(max.width, max.height)).toBeLessThanOrEqual(3840);
    for (const q of ['standard', 'high', 'max'] as const) {
      for (const f of ['mp4', 'gif'] as const) {
        const s = motionSize(portrait, f, q);
        expect(s.width % 2).toBe(0);
        expect(s.height % 2).toBe(0);
      }
    }
    expect(motionSize(portrait, 'gif', 'standard')).toMatchObject({ width: 384, height: 480 });
  });

  it('uses 30 fps for MP4 and lighter rates for GIF', () => {
    expect(motionFps('mp4', 'standard')).toBe(30);
    expect([motionFps('gif', 'standard'), motionFps('gif', 'high'), motionFps('gif', 'max')]).toEqual([15, 20, 24]);
    expect(MAX_GIF_MS).toBe(30_000);
  });

  it('names files after the design (and the slide, for one slide)', () => {
    expect(motionFileName('Summer Dump ✦', 'mp4', undefined, portrait)).toBe('summer-dump.mp4');
    expect(motionFileName('Summer Dump', 'gif', [1], portrait)).toBe('summer-dump-02.gif');
    expect(motionFileName('Post', 'mp4', [0], story)).toBe('post.mp4');
  });
});

describe('GIF encoding', () => {
  it('writes a looping GIF89a with every frame', () => {
    const gif = GIFEncoder();
    for (const shade of [0, 128, 255]) {
      const rgba = new Uint8ClampedArray(8 * 8 * 4).fill(shade);
      const palette = quantize(rgba, 256);
      gif.writeFrame(applyPalette(rgba, palette), 8, 8, { palette, delay: 66 });
    }
    gif.finish();
    const bytes = gif.bytes();
    const text = new TextDecoder('latin1').decode(bytes);
    expect(text.startsWith('GIF89a')).toBe(true);
    expect(text).toContain('NETSCAPE2.0');
    expect(text.split('!ù').length - 1).toBe(3); // one graphic control extension per frame
    expect(bytes[bytes.length - 1]).toBe(0x3b);
  });
});
