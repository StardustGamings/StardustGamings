import { describe, expect, it } from 'vitest';
import type { ImageElement } from '@/types/document';
import { NO_EFFECTS, applyEffects, dustAt, effectParams, leakColor, scanlineFactor } from '@/effects/effects';
import { ADJUSTMENT_KEYS, curvesLut, developSignature, needsDevelop, pixelParams } from '@/images/adjustments';
import { developCpu, type Pixels } from '@/images/develop-cpu';
import { elementSchema } from '@/projects/schema';
import { activeLook, effectiveAdjust, effectiveEffects, effectiveLut, effectiveVignette, hasLookOrEffects } from './compose';
import { LOOKS, getLook } from './looks';

const photo = (over: Partial<ImageElement> = {}): ImageElement => ({
  id: 'p',
  type: 'image',
  x: 0,
  y: 0,
  width: 100,
  height: 100,
  rotation: 0,
  opacity: 1,
  assetId: 'ast_1',
  fit: 'cover',
  ...over,
});

function image(w: number, h: number, paint: (x: number, y: number) => [number, number, number]): Pixels {
  const data = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const [r, g, b] = paint(x, y);
      data.set([r, g, b, 255], (y * w + x) * 4);
    }
  return { data, width: w, height: h };
}
const at = (p: Pixels, x: number, y: number) => [...p.data.slice((y * p.width + x) * 4, (y * p.width + x) * 4 + 3)];
const base = { params: pixelParams(undefined), lut: null, warp: null, sharpen: 0, blur: 0, glowRadius: 2, cutout: null };

describe('built-in looks', () => {
  it('covers the 14 looks from the brief, each valid and distinct', () => {
    expect(LOOKS.map((l) => l.id)).toEqual([
      'cinematic',
      'vintage',
      'film',
      'y2k',
      'cyberpunk',
      'monochrome',
      'vhs',
      'disposable',
      'polaroid',
      'dreamy',
      'dark',
      'street',
      'luxury',
      'minimal',
    ]);
    const signatures = new Set<string>();
    for (const look of LOOKS) {
      for (const [key, value] of Object.entries(look.adjust)) {
        expect(ADJUSTMENT_KEYS, `${look.id}.${key}`).toContain(key);
        expect(Math.abs(value), `${look.id}.${key}`).toBeLessThanOrEqual(100);
      }
      const el = photo({ filter: { id: look.id, intensity: 100 } });
      expect(elementSchema.safeParse(el).success).toBe(true);
      signatures.add(developSignature({ ...el, filter: undefined, adjust: effectiveAdjust(el), effects: effectiveEffects(el) }));
    }
    expect(signatures.size).toBe(LOOKS.length);
  });

  it('ignores looks this version doesn’t know', () => {
    const el = photo({ filter: { id: 'from-the-future', intensity: 80 } });
    expect(getLook('from-the-future')).toBeUndefined();
    expect(activeLook(el)).toBeNull();
    expect(effectiveAdjust(el)).toBeUndefined();
    expect(effectiveLut(el)).toBeNull();
  });
});

describe('intensity blends a look over the photo’s own edits', () => {
  it('0% is untouched and 100% is the full look', () => {
    expect(effectiveAdjust(photo({ filter: { id: 'dark', intensity: 0 } }))).toBeUndefined();
    expect(hasLookOrEffects(photo({ filter: { id: 'dark', intensity: 0 } }))).toBe(false);
    const full = effectiveAdjust(photo({ filter: { id: 'dark', intensity: 100 } }));
    expect(full).toEqual(getLook('dark')!.adjust);
    const half = effectiveAdjust(photo({ filter: { id: 'dark', intensity: 50 } }))!;
    expect(half.exposure).toBe(-8);
    expect(half.vignette).toBe(23);
  });

  it('adds to the user’s sliders and stays within each slider’s range', () => {
    const el = photo({ adjust: { saturation: -60, grain: 90, contrast: 10 }, filter: { id: 'monochrome', intensity: 100 } });
    const a = effectiveAdjust(el)!;
    expect(a.saturation).toBe(-100);
    expect(a.grain).toBe(100);
    expect(a.contrast).toBe(32);
    expect(effectiveVignette(photo({ adjust: { vignette: 80 }, filter: { id: 'dark', intensity: 100 } }))).toBe(100);
  });

  it('applies the look’s curves after the user’s, blended toward identity', () => {
    const plain = photo({ filter: { id: 'cinematic', intensity: 100 } });
    const lut = effectiveLut(plain)!;
    const look = curvesLut(getLook('cinematic')!.curves);
    expect(lut[200 * 4]).toBe(look[200 * 4]);
    const none = effectiveLut(photo({ filter: { id: 'cinematic', intensity: 0 } }));
    expect(none).toBeNull();
    const half = effectiveLut(photo({ filter: { id: 'cinematic', intensity: 50 } }))!;
    expect(half[20 * 4 + 2]).toBeGreaterThan(20);
    expect(half[20 * 4 + 2]).toBeLessThan(look[20 * 4 + 2]!);
    // User curve first: an inverted user curve still gets the look on top.
    const inverted = effectiveLut(
      photo({
        curves: {
          rgb: [
            { x: 0, y: 1 },
            { x: 1, y: 0 },
          ],
        },
        filter: { id: 'cinematic', intensity: 100 },
      }),
    )!;
    expect(inverted[0]).toBe(look[255 * 4]);
  });

  it('adds up effects and keeps the user’s leak style when they set one', () => {
    const el = photo({ effects: { glow: 20 }, filter: { id: 'dreamy', intensity: 50 } });
    expect(effectiveEffects(el)!.glow).toBe(49);
    expect(effectiveEffects(photo({ filter: { id: 'disposable', intensity: 100 } }))!).toMatchObject({
      leak: 45,
      leakStyle: 'amber',
    });
    expect(
      effectiveEffects(photo({ effects: { leak: 10, leakStyle: 'ice' }, filter: { id: 'disposable', intensity: 100 } })),
    ).toMatchObject({
      leak: 55,
      leakStyle: 'ice',
    });
  });

  it('marks filtered photos for the develop pipeline and keys the cache on the look', () => {
    expect(needsDevelop(photo())).toBe(false);
    expect(needsDevelop(photo({ filter: { id: 'film', intensity: 40 } }))).toBe(true);
    expect(needsDevelop(photo({ effects: { scanlines: 10 } }))).toBe(true);
    expect(developSignature(photo({ filter: { id: 'film', intensity: 40 } }))).not.toBe(
      developSignature(photo({ filter: { id: 'film', intensity: 41 } })),
    );
  });

  it('rejects malformed filters and effects', () => {
    expect(elementSchema.safeParse(photo({ filter: { id: 'Bad Id', intensity: 50 } })).success).toBe(false);
    expect(elementSchema.safeParse(photo({ filter: { id: 'film', intensity: 150 } })).success).toBe(false);
    expect(elementSchema.safeParse(photo({ effects: { glow: -5 } })).success).toBe(false);
    expect(elementSchema.safeParse(photo({ effects: { leakStyle: 'neon' as never } })).success).toBe(false);
  });
});

describe('effects (CPU reference maths, mirrored by the shader)', () => {
  it('does nothing when every effect is off', () => {
    expect(applyEffects([0.3, 0.5, 0.7], NO_EFFECTS, 0.5, 0.5, 1, null)).toEqual([0.3, 0.5, 0.7]);
    const src = image(12, 10, (x, y) => [x * 20, y * 25, 90]);
    expect([...developCpu({ ...base, source: src, effects: NO_EFFECTS }).data]).toEqual([...src.data]);
  });

  it('light leaks brighten the edge they come from, in their colour', () => {
    const [r, g, b] = leakColor('amber', 0, 0.2, 1);
    expect(r).toBeGreaterThan(g);
    expect(g).toBeGreaterThan(b);
    const centre = leakColor('amber', 0.55, 0.55, 1);
    expect(centre[0]).toBeLessThan(r);
    const lit = applyEffects([0.2, 0.2, 0.2], effectParams({ leak: 100 }), 0.02, 0.2, 1, null);
    expect(lit[0]).toBeGreaterThan(0.6);
    const ice = leakColor('ice', 1, 0.1, 1);
    expect(ice[2]).toBeGreaterThan(ice[0]);
  });

  it('scanlines darken in a regular pattern, 320 lines per frame', () => {
    expect(scanlineFactor(0, 1)).toBeCloseTo(0.62);
    expect(scanlineFactor(0.5 / 320, 1)).toBeCloseTo(1);
    expect(scanlineFactor(1 / 320, 1)).toBeCloseTo(0.62);
    expect(scanlineFactor(0.3, 0)).toBe(1);
  });

  it('dust adds a few specks and scratches — more as the amount goes up', () => {
    const count = (amount: number) => {
      let n = 0;
      for (let y = 0; y < 200; y++) for (let x = 0; x < 200; x++) if (dustAt(x / 200, y / 200, 1, amount) !== 0) n++;
      return n;
    };
    expect(count(0)).toBe(0);
    const some = count(0.3);
    const lots = count(1);
    expect(some).toBeGreaterThan(0);
    expect(lots).toBeGreaterThan(some);
    expect(lots).toBeLessThan(200 * 200 * 0.2);
  });

  it('RGB split pulls red and blue from either side', () => {
    // A white stripe down the middle of a black photo.
    const src = image(100, 4, (x) => (x >= 48 && x < 52 ? [255, 255, 255] : [0, 0, 0]));
    const out = developCpu({ ...base, source: src, effects: effectParams({ rgbSplit: 100 }) });
    // Red comes from the right, so red fringes appear left of the stripe; blue on the right.
    expect(at(out, 47, 1)[0]!).toBeGreaterThan(200);
    expect(at(out, 47, 1)[2]!).toBeLessThan(40);
    expect(at(out, 52, 1)[2]!).toBeGreaterThan(200);
    expect(at(out, 52, 1)[0]!).toBeLessThan(40);
  });

  it('glow lifts the area around bright highlights', () => {
    const src = image(40, 40, (x, y) => (Math.hypot(x - 20, y - 20) < 4 ? [255, 255, 255] : [40, 40, 40]));
    const plain = developCpu({ ...base, source: src, effects: NO_EFFECTS });
    const glowing = developCpu({ ...base, source: src, glowRadius: 6, effects: effectParams({ glow: 100 }) });
    expect(at(glowing, 20, 26)[0]!).toBeGreaterThan(at(plain, 20, 26)[0]! + 15);
    expect(at(glowing, 1, 1)[0]!).toBeLessThan(at(plain, 1, 1)[0]! + 5);
  });

  it('a whole look renders through the pipeline (VHS: scanlines + split + noise)', () => {
    const el = photo({ filter: { id: 'vhs', intensity: 100 } });
    const src = image(64, 64, () => [128, 128, 128]);
    const out = developCpu({
      ...base,
      source: src,
      params: pixelParams(effectiveAdjust(el)),
      lut: effectiveLut(el),
      effects: effectParams(effectiveEffects(el)),
    });
    const rows = [0, 1, 2, 3, 4, 5, 6, 7].map((y) => at(out, 10, y)[1]!);
    expect(Math.max(...rows) - Math.min(...rows)).toBeGreaterThan(8);
  });
});
