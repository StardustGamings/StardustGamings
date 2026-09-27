import { describe, expect, it } from 'vitest';
import { createDocument } from '@/projects/document';
import type { DesignDocument, ShapeElement } from '@/types/document';
import { collectSnapTargets, gridSizeFor, snapRect, snapValue } from './snapping';

const shape = (id: string, x: number, y: number): ShapeElement => ({
  id,
  type: 'shape',
  shape: 'rect',
  x,
  y,
  width: 100,
  height: 100,
  rotation: 0,
  opacity: 1,
  fill: { type: 'solid', color: '#000' },
});

function doc(): DesignDocument {
  return {
    ...createDocument({ width: 1000, height: 1000, slideCount: 2 }),
    elements: [shape('a', 100, 100), shape('b', 600, 400)],
  };
}

describe('snapping', () => {
  it('snaps to slide centres and edges', () => {
    const targets = collectSnapTargets(doc(), new Set(['a', 'b']));
    const r = snapRect({ x: 446, y: 10, width: 100, height: 100 }, targets, 8);
    expect(r.dx).toBe(4); // centre 496 → 500
    expect(r.lines.some((l) => l.axis === 'x' && l.position === 500)).toBe(true);
  });

  it('snaps to other elements but not to the moving ones', () => {
    const targets = collectSnapTargets(doc(), new Set(['a']));
    const r = snapRect({ x: 603, y: 250, width: 50, height: 50 }, targets, 8);
    expect(r.dx).toBe(-3); // left edge to b's left edge (600)
    const self = collectSnapTargets(doc(), new Set(['a', 'b']));
    expect(snapRect({ x: 603, y: 250, width: 50, height: 50 }, self, 2).dx).toBe(0);
  });

  it('includes guides and the grid', () => {
    const d = { ...doc(), guides: [{ id: 'g', axis: 'y' as const, position: 333 }] };
    expect(snapValue(330, collectSnapTargets(d, new Set()).y, 5)).toBe(333);
    const grid = collectSnapTargets(d, new Set(['a', 'b']), { elements: false, gridSize: gridSizeFor(d) });
    expect(snapValue(170, grid.x, 5)).toBeCloseTo(1000 / 6);
  });

  it('leaves values alone outside the threshold', () => {
    const targets = collectSnapTargets(doc(), new Set(['a', 'b']));
    expect(snapRect({ x: 230, y: 230, width: 10, height: 10 }, targets, 5)).toMatchObject({ dx: 0, dy: 0 });
  });
});
