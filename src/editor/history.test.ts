import { describe, expect, it } from 'vitest';
import { createHistory, pushHistory, redoHistory, undoHistory } from './history';
import { nextZoom } from './zoom';
import { docToScreen, screenToDoc, useCamera, ZOOM_MAX, ZOOM_MIN } from './camera';

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

describe('zoom & camera', () => {
  it('steps through zoom levels within bounds', () => {
    expect(nextZoom(1, 1)).toBe(1.5);
    expect(nextZoom(1, -1)).toBe(0.75);
    expect(nextZoom(ZOOM_MAX, 1)).toBe(ZOOM_MAX);
    expect(nextZoom(ZOOM_MIN, -1)).toBe(ZOOM_MIN);
    expect(nextZoom(0.44, 1)).toBe(0.5);
  });

  it('keeps the point under the cursor fixed while zooming', () => {
    const cam = useCamera.getState();
    cam.reset();
    cam.setViewport(1000, 800);
    cam.fitTo({ x: 0, y: 0, width: 1080, height: 1350 }, 0);
    const pointer = { x: 300, y: 200 };
    const before = screenToDoc(pointer);
    useCamera.getState().zoomAt(pointer, useCamera.getState().zoom * 2);
    const after = screenToDoc(pointer);
    expect(after.x).toBeCloseTo(before.x);
    expect(after.y).toBeCloseTo(before.y);
  });

  it('fits content (never above 100%) and centres it', () => {
    const cam = useCamera.getState();
    cam.setViewport(1000, 800);
    cam.fitTo({ x: 0, y: 0, width: 1080, height: 1350 }, 0);
    expect(useCamera.getState().zoom).toBeCloseTo(800 / 1350);
    const centre = docToScreen({ x: 540, y: 675 });
    expect(centre.x).toBeCloseTo(500);
    expect(centre.y).toBeCloseTo(400);
    cam.fitTo({ x: 0, y: 0, width: 100, height: 100 }, 0);
    expect(useCamera.getState().zoom).toBe(1);
  });

  it('never pans the content completely out of view', () => {
    const cam = useCamera.getState();
    cam.setViewport(1000, 800);
    cam.setContent({ x: 0, y: 0, width: 1080, height: 1350 });
    cam.fitTo({ x: 0, y: 0, width: 1080, height: 1350 }, 0);
    useCamera.getState().panBy(-100000, -100000);
    const { x, y, zoom } = useCamera.getState();
    expect(x).toBeLessThanOrEqual(1080);
    expect(y).toBeLessThanOrEqual(1350);
    expect(x + 1000 / zoom).toBeGreaterThan(1080);
  });
});
