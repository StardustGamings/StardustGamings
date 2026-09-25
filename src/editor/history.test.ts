import { describe, expect, it } from 'vitest';
import { createHistory, pushHistory, redoHistory, undoHistory } from './history';
import { fitZoom, nextZoom, ZOOM_MAX, ZOOM_MIN } from './zoom';

describe('history', () => {
  it('undoes and redoes in order', () => {
    let h = createHistory(1);
    h = pushHistory(h, 2);
    h = pushHistory(h, 3);
    h = undoHistory(h);
    expect(h.present).toBe(2);
    h = undoHistory(h);
    expect(h.present).toBe(1);
    expect(undoHistory(h)).toBe(h);
    h = redoHistory(h);
    expect(h.present).toBe(2);
  });

  it('drops the redo stack on a new edit', () => {
    let h = pushHistory(pushHistory(createHistory('a'), 'b'), 'c');
    h = undoHistory(h);
    h = pushHistory(h, 'd');
    expect(h.future).toEqual([]);
    expect(redoHistory(h)).toBe(h);
  });

  it('ignores no-op pushes and caps its length', () => {
    const h0 = createHistory({ v: 0 });
    expect(pushHistory(h0, h0.present)).toBe(h0);
    let h = createHistory(0);
    for (let i = 1; i <= 150; i++) h = pushHistory(h, i, 100);
    expect(h.past).toHaveLength(100);
    expect(h.past[0]).toBe(50);
  });
});

describe('zoom', () => {
  it('steps through zoom levels within bounds', () => {
    expect(nextZoom(1, 1)).toBe(1.5);
    expect(nextZoom(1, -1)).toBe(0.75);
    expect(nextZoom(ZOOM_MAX, 1)).toBe(ZOOM_MAX);
    expect(nextZoom(ZOOM_MIN, -1)).toBe(ZOOM_MIN);
    expect(nextZoom(0.44, 1)).toBe(0.5);
  });

  it('fits slides into the viewport without upscaling', () => {
    expect(fitZoom({ width: 1000, height: 800 }, { width: 1080, height: 1350 }, 1, 0)).toBeCloseTo(800 / 1350);
    expect(fitZoom({ width: 5000, height: 5000 }, { width: 100, height: 100 }, 1, 0)).toBe(1);
    expect(fitZoom({ width: 1200, height: 2000 }, { width: 1080, height: 1350 }, 3, 0)).toBeCloseTo(1200 / 3240);
  });
});
