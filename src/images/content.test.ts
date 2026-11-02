import { describe, expect, it } from 'vitest';
import type { ImageElement } from '@/types/document';
import { seededRandom } from '@/utils/math';
import {
  baseScale,
  contentLayout,
  frameForAspect,
  frameToWorld,
  orientedSize,
  panContent,
  photoCornersInFrame,
  photoQuad,
  pointInQuad,
  resizeFrameKeepingPhoto,
  worldToFrame,
  zoomContent,
} from './content';

const img = (over: Partial<ImageElement> = {}): ImageElement => ({
  id: 'i',
  type: 'image',
  x: 100,
  y: 50,
  width: 400,
  height: 300,
  rotation: 0,
  opacity: 1,
  assetId: 'as_1',
  fit: 'cover',
  ...over,
});

const close = (a: number, b: number, eps = 1e-6) => expect(Math.abs(a - b)).toBeLessThan(eps);

describe('photo layout inside a frame', () => {
  it('covers the frame by default and centres the photo', () => {
    // 2000×1000 photo into a 400×300 frame: height is the limiting side.
    const l = contentLayout(img(), 2000, 1000);
    close(l.scale, 0.3);
    close(l.width, 600);
    close(l.height, 300);
    close(l.offsetX, 0);
    close(l.offsetY, 0);
  });

  it('fits the whole photo with contain', () => {
    const l = contentLayout(img({ fit: 'contain' }), 2000, 1000);
    close(l.width, 400);
    close(l.height, 200);
  });

  it('uses the focal point like object-position', () => {
    // focusX 0 shows the photo's left edge: its left side lines up with the frame's.
    const left = contentLayout(img({ focusX: 0 }), 2000, 1000);
    close(200 + left.offsetX - left.width / 2, 0);
    const right = contentLayout(img({ focusX: 1 }), 2000, 1000);
    close(200 + right.offsetX + right.width / 2, 400);
  });

  it('applies zoom on top of the fit and swaps sides for quarter turns', () => {
    expect(contentLayout(img({ zoom: 2 }), 2000, 1000).width).toBeCloseTo(1200);
    expect(orientedSize(2000, 1000, 1)).toEqual({ width: 1000, height: 2000 });
    const turned = contentLayout(img({ turns: 1 }), 2000, 1000);
    close(turned.width, 400);
    close(turned.height, 800);
  });

  it('keeps the frame covered for any straighten angle, zoom and focus', () => {
    const random = seededRandom(7);
    for (let i = 0; i < 300; i++) {
      const el = img({
        width: 50 + random() * 500,
        height: 50 + random() * 500,
        straighten: -45 + random() * 90,
        zoom: 1 + random() * 2,
        focusX: random(),
        focusY: random(),
        turns: (Math.floor(random() * 4) as 0 | 1 | 2 | 3) || undefined,
      });
      const quad = photoCornersInFrame(el, 400 + random() * 3000, 400 + random() * 3000);
      // Shrink the frame a hair to avoid floating-point edge cases.
      for (const corner of [
        { x: 0.01, y: 0.01 },
        { x: el.width - 0.01, y: 0.01 },
        { x: el.width - 0.01, y: el.height - 0.01 },
        { x: 0.01, y: el.height - 0.01 },
      ]) {
        expect(pointInQuad(corner, quad)).toBe(true);
      }
    }
  });

  it('pans by dragging and clamps at the photo edge', () => {
    const el = img({ zoom: 2 });
    const panned = panContent(el, 2000, 1000, 100, 0);
    // Dragging right reveals more of the left side: focus moves towards 0.
    expect(panned.focusX!).toBeLessThan(0.5);
    const clamped = panContent(el, 2000, 1000, 10_000, 10_000);
    expect(clamped.focusX).toBe(0);
    expect(clamped.focusY).toBe(0);
  });

  it('zooms around an anchor, keeping the photo point under it in place', () => {
    const el = img({ zoom: 2, focusX: 0.3, focusY: 0.6 });
    const anchor = { x: 120, y: 90 };
    const before = contentLayout(el, 2000, 1000);
    const zoomed = zoomContent(el, 2000, 1000, 3, anchor);
    const after = contentLayout(zoomed, 2000, 1000);
    // Photo-space coordinate (relative to the photo's centre, normalised) under the anchor.
    const u0 = (anchor.x - 200 - before.offsetX) / before.width;
    const u1 = (anchor.x - 200 - after.offsetX) / after.width;
    close(u0, u1, 1e-6);
    expect(zoomed.zoom).toBe(3);
  });

  it('resizing the crop window keeps the photo fixed on the canvas', () => {
    const el = img({ zoom: 2, focusX: 0.4, focusY: 0.5, rotation: 20 });
    const before = photoQuad(el, 2000, 1000);
    // Shrink from the right edge in the element's own axes.
    const next = resizeFrameKeepingPhoto(el, { ...el, width: 300 }, 2000, 1000);
    const after = photoQuad(next, 2000, 1000);
    before.forEach((p, i) => {
      close(p.x, after[i]!.x, 1e-6);
      close(p.y, after[i]!.y, 1e-6);
    });
  });

  it('grows the photo when the crop window would outgrow it', () => {
    const el = img();
    const next = resizeFrameKeepingPhoto(el, { ...el, height: 900 }, 2000, 1000);
    expect(next.zoom).toBe(1);
    expect(baseScale(next, 2000, 1000)).toBeGreaterThan(baseScale(el, 2000, 1000));
  });

  it('builds aspect-ratio frames with the same area and centre', () => {
    const f = frameForAspect(img(), 1);
    close(f.width * f.height, 400 * 300, 1e-6);
    close(f.x + f.width / 2, 300);
    close(f.y + f.height / 2, 200);
  });

  it('converts between frame and world space through rotation', () => {
    const el = img({ rotation: 33 });
    const p = { x: 37, y: 250 };
    const back = worldToFrame(el, frameToWorld(el, p));
    close(back.x, p.x, 1e-9);
    close(back.y, p.y, 1e-9);
  });
});
