import { describe, expect, it } from 'vitest';
import { NO_EFFECTS } from '@/effects/effects';
import { pixelParams } from './adjustments';
import { blurPixels, developCpu, resample, type Pixels } from './develop-cpu';
import { adjustmentsFromStats, imageStats } from './auto';
import { colourKeyMask, removeSpecks } from './cutout/colour-key';
import { grayGuide, guidedFilter, resizeMap } from './cutout/guided-filter';

function image(w: number, h: number, paint: (x: number, y: number) => [number, number, number, number?]): Pixels {
  const data = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const [r, g, b, a = 255] = paint(x, y);
      data.set([r, g, b, a], (y * w + x) * 4);
    }
  return { data, width: w, height: h };
}

const at = (p: Pixels, x: number, y: number) => [...p.data.slice((y * p.width + x) * 4, (y * p.width + x) * 4 + 4)];
const neutral = {
  params: pixelParams(undefined),
  lut: null,
  warp: null,
  sharpen: 0,
  blur: 0,
  effects: NO_EFFECTS,
  glowRadius: 0,
  cutout: null,
};

describe('CPU develop pipeline', () => {
  it('passes pixels through untouched when nothing is set', () => {
    const src = image(8, 6, (x, y) => [x * 30, y * 40, 128]);
    expect([...developCpu({ ...neutral, source: src }).data]).toEqual([...src.data]);
  });

  it('applies tone adjustments and curves', () => {
    const src = image(4, 4, () => [100, 100, 100]);
    const brighter = developCpu({ ...neutral, source: src, params: pixelParams({ exposure: 60 }) });
    expect(at(brighter, 1, 1)[0]!).toBeGreaterThan(100);
    const invert = new Uint8Array(1024);
    for (let i = 0; i < 256; i++) invert.set([255 - i, 255 - i, 255 - i, 255], i * 4);
    const inverted = developCpu({ ...neutral, source: src, lut: invert });
    expect(at(inverted, 0, 0)[0]).toBe(155);
  });

  it('blurs without shifting a flat colour or bleeding transparent black', () => {
    const flat = image(20, 20, () => [200, 50, 10]);
    expect(at(blurPixels(flat, 6), 10, 10)).toEqual([200, 50, 10, 255]);
    // Opaque red next to transparent black: blurred edge pixels stay red (premultiplied blur).
    const half = image(20, 4, (x) => (x < 10 ? [255, 0, 0, 255] : [0, 0, 0, 0]));
    const edge = at(blurPixels(half, 4), 10, 2);
    expect(edge[0]).toBeGreaterThan(240);
    expect(edge[3]).toBeGreaterThan(0);
    expect(edge[3]).toBeLessThan(255);
  });

  it('cuts out with a mask and composites over a backdrop', () => {
    const src = image(10, 10, () => [0, 0, 255]);
    const mask = image(10, 10, (x) => (x < 5 ? [255, 255, 255] : [0, 0, 0]));
    const transparent = developCpu({ ...neutral, source: src, cutout: { mask, feather: 0, backdrop: { kind: 'none' } } });
    expect(at(transparent, 2, 5)[3]).toBe(255);
    expect(at(transparent, 8, 5)[3]).toBe(0);
    const over = developCpu({
      ...neutral,
      source: src,
      cutout: { mask, feather: 0, backdrop: { kind: 'image', pixels: image(10, 10, () => [255, 255, 0]) } },
    });
    expect(at(over, 8, 5)).toEqual([255, 255, 0, 255]);
    expect(at(over, 2, 5)).toEqual([0, 0, 255, 255]);
  });

  it('makes the portrait-blur backdrop from the background only', () => {
    // Red subject on a green background: the blurred backdrop must stay green (no red halo).
    const src = image(24, 24, (x, y) => (Math.hypot(x - 12, y - 12) < 6 ? [255, 0, 0] : [0, 200, 0]));
    const mask = image(24, 24, (x, y) => (Math.hypot(x - 12, y - 12) < 6 ? [255, 255, 255] : [0, 0, 0]));
    const out = developCpu({ ...neutral, source: src, cutout: { mask, feather: 0, backdrop: { kind: 'blur', radius: 4 } } });
    const justOutside = at(out, 12, 12 + 7);
    expect(justOutside[3]).toBe(255);
    expect(justOutside[0]!).toBeLessThan(40);
    expect(justOutside[1]!).toBeGreaterThan(150);
  });

  it('resamples through an identity warp', () => {
    const src = image(6, 6, (x, y) => [x * 40, y * 40, 0]);
    expect([...resample(src, 6, 6).data]).toEqual([...src.data]);
  });
});

describe('colour-key background removal', () => {
  it('keeps the subject and removes a plain background', () => {
    const w = 60;
    const h = 40;
    const src = image(w, h, (x, y) =>
      x > 20 && x < 40 && y > 10 && y < 30 ? [200, 30, 40] : [245 - Math.round(y / 4), 245 - Math.round(y / 4), 248],
    );
    const alpha = colourKeyMask(src.data, w, h);
    expect(alpha[20 * w + 30]).toBe(1);
    expect(alpha[2 * w + 2]).toBeLessThan(0.1);
    expect(alpha[35 * w + 55]).toBeLessThan(0.1);
  });

  it('keeps enclosed regions and drops tiny specks', () => {
    const alpha = new Float32Array(100);
    alpha[55] = 1; // a single isolated pixel
    for (let i = 0; i < 30; i++) alpha[i] = 1;
    removeSpecks(alpha, 10, 10, 3);
    expect(alpha[55]).toBe(0);
    expect(alpha[5]).toBe(1);
  });
});

describe('guided filter', () => {
  it('keeps a constant mask constant and follows guide edges', () => {
    const w = 30;
    const h = 10;
    const guide = image(w, h, (x) => (x < 15 ? [0, 0, 0] : [255, 255, 255]));
    const g = grayGuide(guide.data, w * h);
    const constant = guidedFilter(g, new Float32Array(w * h).fill(0.7), w, h, 3, 1e-3);
    expect(constant[5 * w + 10]).toBeCloseTo(0.7, 3);
    // A blurry step mask becomes crisp at the guide's edge.
    const blurry = Float32Array.from({ length: w * h }, (_, i) => Math.min(1, Math.max(0, ((i % w) - 10) / 10)));
    const refined = guidedFilter(g, blurry, w, h, 4, 1e-4);
    expect(refined[5 * w + 12]!).toBeLessThan(blurry[5 * w + 12]!);
    expect(refined[5 * w + 17]!).toBeGreaterThan(blurry[5 * w + 17]!);
  });

  it('resizes maps bilinearly', () => {
    const out = resizeMap(new Float32Array([0, 1, 0, 1]), 2, 2, 4, 4);
    expect(out[0]).toBe(0);
    expect(out[3]).toBe(1);
    expect(out[1]!).toBeGreaterThan(0);
    expect(out[1]!).toBeLessThan(1);
  });
});

describe('auto-enhance', () => {
  it('brightens a dark, flat photo and leaves a balanced one alone', () => {
    const dark = image(16, 16, (x) => [30 + x, 32 + x, 35 + x]);
    const auto = adjustmentsFromStats(imageStats(dark.data)!)!;
    expect(auto.exposure!).toBeGreaterThan(0);
    expect(auto.contrast!).toBeGreaterThan(0);
    expect(imageStats(new Uint8ClampedArray(16))).toBeNull(); // fully transparent
    expect(adjustmentsFromStats({ mean: 0.48, p02: 0.02, p10: 0.1, p98: 0.96, saturation: 0.4, red: 0.5, blue: 0.5 })).toBeNull();
  });
});
