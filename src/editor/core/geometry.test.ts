import { describe, expect, it } from 'vitest';
import {
  angleFrom,
  boxCorners,
  handlePoint,
  normalizeAngle,
  pointInBox,
  rectFromPoints,
  resizeBox,
  rotatePoint,
  snapAngle,
  unionRects,
} from './geometry';

const box = { x: 0, y: 0, width: 100, height: 50, rotation: 0 };
const round = (b: { x: number; y: number; width: number; height: number }) => ({
  x: Math.round(b.x),
  y: Math.round(b.y),
  width: Math.round(b.width),
  height: Math.round(b.height),
});

describe('geometry', () => {
  it('rotates points and boxes', () => {
    const p = rotatePoint({ x: 10, y: 0 }, { x: 0, y: 0 }, 90);
    expect(Math.round(p.x)).toBe(0);
    expect(Math.round(p.y)).toBe(10);
    const [tl] = boxCorners({ ...box, rotation: 180 });
    expect(Math.round(tl.x)).toBe(100);
    expect(Math.round(tl.y)).toBe(50);
  });

  it('hit-tests rotated boxes', () => {
    const rotated = { x: 0, y: 0, width: 100, height: 10, rotation: 90 };
    expect(pointInBox({ x: 50, y: 5 }, rotated)).toBe(true); // centre
    expect(pointInBox({ x: 50, y: -40 }, rotated)).toBe(true); // now vertical
    expect(pointInBox({ x: 5, y: 5 }, rotated)).toBe(false);
    expect(pointInBox({ x: 101, y: 5 }, box, 2)).toBe(true);
  });

  it('resizes from a corner keeping the opposite corner fixed', () => {
    expect(round(resizeBox(box, 'se', { x: 200, y: 100 }))).toEqual({ x: 0, y: 0, width: 200, height: 100 });
    expect(round(resizeBox(box, 'nw', { x: -50, y: -50 }))).toEqual({ x: -50, y: -50, width: 150, height: 100 });
  });

  it('resizes sides, keeps ratio and resizes from centre', () => {
    expect(round(resizeBox(box, 'e', { x: 150, y: 999 }))).toEqual({ x: 0, y: 0, width: 150, height: 50 });
    expect(round(resizeBox(box, 'se', { x: 200, y: 60 }, { keepRatio: true }))).toEqual({ x: 0, y: 0, width: 200, height: 100 });
    expect(round(resizeBox(box, 'e', { x: 150, y: 25 }, { fromCenter: true }))).toEqual({ x: -50, y: 0, width: 200, height: 50 });
  });

  it('respects the minimum size instead of flipping', () => {
    expect(round(resizeBox(box, 'se', { x: -500, y: -500 }, { minSize: 10 }))).toEqual({ x: 0, y: 0, width: 10, height: 10 });
  });

  it('resizes rotated boxes along their own axes', () => {
    const rotated = { x: 0, y: 0, width: 100, height: 50, rotation: 90 };
    // Right edge now points down: dragging "e" handle further down grows width.
    const east = handlePoint(rotated, 'e');
    const r = resizeBox(rotated, 'e', { x: east.x, y: east.y + 50 });
    expect(Math.round(r.width)).toBe(150);
    expect(Math.round(r.height)).toBe(50);
    // The west edge stays put.
    const westBefore = handlePoint(rotated, 'w');
    const westAfter = handlePoint(r, 'w');
    expect(Math.round(westAfter.x)).toBe(Math.round(westBefore.x));
    expect(Math.round(westAfter.y)).toBe(Math.round(westBefore.y));
  });

  it('measures and snaps angles', () => {
    expect(Math.round(angleFrom({ x: 0, y: 0 }, { x: 0, y: -10 }))).toBe(0);
    expect(Math.round(angleFrom({ x: 0, y: 0 }, { x: 10, y: 0 }))).toBe(90);
    expect(normalizeAngle(270)).toBe(-90);
    expect(snapAngle(44, true)).toBe(45);
    expect(snapAngle(88, false)).toBe(90);
    expect(snapAngle(80, false)).toBe(80);
  });

  it('unions rects and builds marquees', () => {
    expect(unionRects([])).toBeNull();
    expect(
      unionRects([
        { x: 0, y: 0, width: 10, height: 10 },
        { x: 20, y: -5, width: 5, height: 5 },
      ]),
    ).toEqual({ x: 0, y: -5, width: 25, height: 15 });
    expect(rectFromPoints({ x: 10, y: 10 }, { x: 0, y: 20 })).toEqual({ x: 0, y: 10, width: 10, height: 10 });
  });
});
