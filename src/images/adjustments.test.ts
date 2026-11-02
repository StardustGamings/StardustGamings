import { describe, expect, it } from 'vitest';
import type { ImageElement } from '@/types/document';
import {
  adjustPixel,
  applyMatrix,
  cleanAdjustments,
  curvesLut,
  curveTable,
  developSignature,
  hasAdjustments,
  hasCurves,
  needsDevelop,
  perspectiveMatrix,
  pixelParams,
  squareToQuad,
} from './adjustments';

const neutral = pixelParams(undefined);
const px = (rgb: [number, number, number], adjust: Parameters<typeof pixelParams>[0], u = 0.5, v = 0.5) =>
  adjustPixel(rgb, pixelParams(adjust), u, v, 3, 4, 1);

describe('tone curves', () => {
  it('is the identity without points', () => {
    const t = curveTable(undefined);
    for (let i = 0; i < 256; i++) expect(t[i]).toBe(i);
  });

  it('passes through control points and stays monotone', () => {
    const t = curveTable([
      { x: 0, y: 0 },
      { x: 0.25, y: 0.15 },
      { x: 0.75, y: 0.9 },
      { x: 1, y: 1 },
    ]);
    expect(Math.abs(t[64]! - 0.15 * 255)).toBeLessThanOrEqual(3);
    expect(Math.abs(t[191]! - 0.9 * 255)).toBeLessThanOrEqual(3);
    for (let i = 1; i < 256; i++) expect(t[i]!).toBeGreaterThanOrEqual(t[i - 1]!);
  });

  it('never overshoots on steep curves', () => {
    const t = curveTable([
      { x: 0, y: 0 },
      { x: 0.5, y: 0.02 },
      { x: 0.55, y: 1 },
      { x: 1, y: 1 },
    ]);
    expect(Math.max(...t)).toBeLessThanOrEqual(255);
    expect(Math.min(...t)).toBeGreaterThanOrEqual(0);
  });

  it('combines master and channel curves in one table', () => {
    const lut = curvesLut({
      rgb: [
        { x: 0, y: 1 },
        { x: 1, y: 0 },
      ],
      r: [
        { x: 0, y: 0 },
        { x: 1, y: 0.5 },
      ],
    });
    // Input 0 → master 255 → red curve halves it.
    expect(lut[0]).toBe(128);
    expect(lut[1]).toBe(255);
    expect(
      hasCurves({
        rgb: [
          { x: 0, y: 0 },
          { x: 1, y: 1 },
        ],
      }),
    ).toBe(false);
    expect(
      hasCurves({
        g: [
          { x: 0, y: 0.2 },
          { x: 1, y: 1 },
        ],
      }),
    ).toBe(true);
  });
});

describe('perspective', () => {
  it('maps the unit square onto the given quad', () => {
    const quad: [number, number][] = [
      [0.1, 0],
      [0.9, 0.05],
      [1, 1],
      [0, 0.95],
    ];
    const m = squareToQuad(quad);
    const corners: [number, number][] = [
      [0, 0],
      [1, 0],
      [1, 1],
      [0, 1],
    ];
    corners.forEach(([u, v], i) => {
      const [x, y] = applyMatrix(m, u, v);
      expect(x).toBeCloseTo(quad[i]![0], 9);
      expect(y).toBeCloseTo(quad[i]![1], 9);
    });
  });

  it('is the identity at zero and samples inside the photo otherwise', () => {
    const id = perspectiveMatrix({ vertical: 0, horizontal: 0 });
    expect(applyMatrix(id, 0.3, 0.7)).toEqual([0.3, 0.7]);
    const m = perspectiveMatrix({ vertical: 100, horizontal: -60 });
    for (const [u, v] of [
      [0, 0],
      [1, 0],
      [1, 1],
      [0, 1],
      [0.5, 0.5],
    ] as const) {
      const [x, y] = applyMatrix(m, u, v);
      expect(x).toBeGreaterThanOrEqual(-1e-9);
      expect(x).toBeLessThanOrEqual(1 + 1e-9);
      expect(y).toBeGreaterThanOrEqual(-1e-9);
      expect(y).toBeLessThanOrEqual(1 + 1e-9);
    }
    // Positive vertical correction narrows the sampled top edge.
    expect(applyMatrix(m, 0, 0)[0]).toBeGreaterThan(0);
  });
});

describe('per-pixel adjustments', () => {
  it('leaves pixels untouched when neutral', () => {
    const out = adjustPixel([0.2, 0.5, 0.8], neutral, 0.1, 0.9, 5, 6, 1.5);
    expect(out[0]).toBeCloseTo(0.2, 9);
    expect(out[1]).toBeCloseTo(0.5, 9);
    expect(out[2]).toBeCloseTo(0.8, 9);
  });

  it('brightens with exposure and brightness, keeping black and white anchored for brightness', () => {
    expect(px([0.4, 0.4, 0.4], { exposure: 50 })[0]).toBeGreaterThan(0.4);
    expect(px([0.4, 0.4, 0.4], { exposure: -50 })[0]).toBeLessThan(0.4);
    expect(px([0.4, 0.4, 0.4], { brightness: 60 })[0]).toBeGreaterThan(0.4);
    expect(px([0, 0, 0], { brightness: 60 })[0]).toBe(0);
    expect(px([1, 1, 1], { brightness: -60 })[0]).toBe(1);
  });

  it('adds contrast around mid-grey', () => {
    expect(px([0.7, 0.7, 0.7], { contrast: 50 })[0]).toBeGreaterThan(0.7);
    expect(px([0.3, 0.3, 0.3], { contrast: 50 })[0]).toBeLessThan(0.3);
    expect(px([0.5, 0.5, 0.5], { contrast: 80 })[0]).toBeCloseTo(0.5, 9);
  });

  it('lifts shadows without touching highlights (and vice versa)', () => {
    expect(px([0.1, 0.1, 0.1], { shadows: 80 })[0]).toBeGreaterThan(0.1);
    expect(px([0.95, 0.95, 0.95], { shadows: 80 })[0]).toBeCloseTo(0.95, 3);
    expect(px([0.9, 0.9, 0.9], { highlights: -80 })[0]).toBeLessThan(0.9);
    expect(px([0.05, 0.05, 0.05], { highlights: -80 })[0]).toBeCloseTo(0.05, 3);
  });

  it('desaturates to grey and warms up with temperature', () => {
    const grey = px([0.9, 0.2, 0.1], { saturation: -100 });
    expect(grey[0]).toBeCloseTo(grey[1], 6);
    expect(grey[1]).toBeCloseTo(grey[2], 6);
    const warm = px([0.5, 0.5, 0.5], { temperature: 60 });
    expect(warm[0]).toBeGreaterThan(0.5);
    expect(warm[2]).toBeLessThan(0.5);
  });

  it('fades blacks up and darkens edges with the vignette, not the centre', () => {
    expect(px([0, 0, 0], { fade: 100 })[0]).toBeCloseTo(0.16, 6);
    expect(px([0.6, 0.6, 0.6], { vignette: 100 }, 0.5, 0.5)[0]).toBeCloseTo(0.6, 6);
    expect(px([0.6, 0.6, 0.6], { vignette: 100 }, 0.02, 0.02)[0]).toBeLessThan(0.3);
  });

  it('adds deterministic grain', () => {
    const a = px([0.5, 0.5, 0.5], { grain: 100 });
    const b = px([0.5, 0.5, 0.5], { grain: 100 });
    expect(a).toEqual(b);
    expect(a[0]).not.toBe(0.5);
  });
});

describe('adjustment bookkeeping', () => {
  const base: ImageElement = {
    id: 'i',
    type: 'image',
    x: 0,
    y: 0,
    width: 10,
    height: 10,
    rotation: 0,
    opacity: 1,
    assetId: 'as_1',
    fit: 'cover',
  };

  it('drops zero values', () => {
    expect(cleanAdjustments({ exposure: 0, contrast: 12.4, fade: 0 })).toEqual({ contrast: 12 });
    expect(cleanAdjustments({ exposure: 0 })).toBeUndefined();
    expect(hasAdjustments({ grain: 0 })).toBe(false);
  });

  it('leaves the vignette to the renderer (no re-develop while dragging it)', () => {
    expect(needsDevelop({ ...base, adjust: { vignette: 40 } })).toBe(false);
    expect(needsDevelop({ ...base, adjust: { contrast: 10 } })).toBe(true);
    expect(developSignature({ ...base, adjust: { contrast: 10, vignette: 40 } })).toBe(
      developSignature({ ...base, adjust: { contrast: 10, vignette: -20 } }),
    );
    expect(needsDevelop({ ...base, perspective: { vertical: 10, horizontal: 0 } })).toBe(true);
  });
});
