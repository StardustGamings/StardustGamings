import { describe, expect, it } from 'vitest';
import { createDocument } from '@/projects/document';
import type { DesignDocument, ShapeElement, TextElement } from '@/types/document';
import {
  addGuide,
  alignElements,
  distributeElements,
  duplicateElements,
  elementLabel,
  expandToGroups,
  groupElements,
  placeRelative,
  removeElements,
  reorderElements,
  scaleElementContent,
  setHidden,
  setLocked,
  translateElements,
  ungroupElements,
} from './ops';

const shape = (id: string, x: number, y = 0, w = 100): ShapeElement => ({
  id,
  type: 'shape',
  shape: 'rect',
  x,
  y,
  width: w,
  height: 100,
  rotation: 0,
  opacity: 1,
  fill: { type: 'solid', color: '#000' },
});

function doc(...els: ShapeElement[]): DesignDocument {
  return { ...createDocument({ width: 1000, height: 1000 }), elements: els };
}

const ids = (d: DesignDocument) => d.elements.map((e) => e.id);

describe('element operations', () => {
  it('reorders forward/backward/front/back', () => {
    const d = doc(shape('a', 0), shape('b', 0), shape('c', 0), shape('d', 0));
    expect(ids(reorderElements(d, ['b'], 'forward'))).toEqual(['a', 'c', 'b', 'd']);
    expect(ids(reorderElements(d, ['c'], 'backward'))).toEqual(['a', 'c', 'b', 'd']);
    expect(ids(reorderElements(d, ['a', 'b'], 'front'))).toEqual(['c', 'd', 'a', 'b']);
    expect(ids(reorderElements(d, ['d'], 'back'))).toEqual(['d', 'a', 'b', 'c']);
    expect(reorderElements(d, ['d'], 'forward')).toBe(d);
    expect(ids(placeRelative(d, 'a', 'c', 'above'))).toEqual(['b', 'c', 'a', 'd']);
    expect(ids(placeRelative(d, 'd', 'b', 'below'))).toEqual(['a', 'd', 'b', 'c']);
    expect(placeRelative(d, 'b', 'a', 'above')).toBe(d);
  });

  it('groups contiguously, expands selections and ungroups', () => {
    const d = doc(shape('a', 0), shape('b', 0), shape('c', 0));
    const { doc: g, groupId } = groupElements(d, ['a', 'c']);
    expect(groupId).toBeTruthy();
    expect(ids(g)).toEqual(['b', 'a', 'c']);
    expect(expandToGroups(g, ['a']).sort()).toEqual(['a', 'c']);
    const u = ungroupElements(g, ['a']);
    expect(u.elements.every((e) => !e.groupId)).toBe(true);
    expect(groupElements(d, ['a']).groupId).toBeNull();
  });

  it('duplicates with fresh ids and remapped groups above the source', () => {
    const { doc: g } = groupElements(doc(shape('a', 0), shape('b', 50)), ['a', 'b']);
    const { doc: dup, ids: copies } = duplicateElements(g, ['a', 'b'], { x: 10, y: 10 });
    expect(copies).toHaveLength(2);
    const copyEls = dup.elements.filter((e) => copies.includes(e.id));
    expect(copyEls[0]!.groupId).toBeTruthy();
    expect(copyEls[0]!.groupId).not.toBe(g.elements[0]!.groupId);
    expect(copyEls[0]!.groupId).toBe(copyEls[1]!.groupId);
    expect(copyEls[0]!.x).toBe(10);
  });

  it('aligns units to a reference and distributes them', () => {
    const d = doc(shape('a', 0, 0), shape('b', 300, 50), shape('c', 900, 100));
    const left = alignElements(d, ['b', 'c'], 'left', { x: 0, y: 0, width: 1000, height: 1000 });
    expect(left.elements.map((e) => e.x)).toEqual([0, 0, 0]);
    const mid = alignElements(d, ['a'], 'middle', { x: 0, y: 0, width: 1000, height: 1000 });
    expect(mid.elements[0]!.y).toBe(450);
    const spread = distributeElements(d, ['a', 'b', 'c'], 'x');
    expect(spread.elements.map((e) => e.x)).toEqual([0, 450, 900]);
    expect(distributeElements(d, ['a', 'b'], 'x')).toBe(d);
  });

  it('translates, removes, locks and hides', () => {
    const d = doc(shape('a', 0), shape('b', 0));
    expect(translateElements(d, ['a'], 5, 6).elements[0]).toMatchObject({ x: 5, y: 6 });
    expect(ids(removeElements(d, ['a']))).toEqual(['b']);
    expect(removeElements(d, ['zzz'])).toBe(d);
    expect(setLocked(d, ['a'], true).elements[0]!.locked).toBe(true);
    expect(setHidden(d, ['b'], true).elements[1]!.hidden).toBe(true);
  });

  it('scales content and labels layers', () => {
    const text: TextElement = {
      id: 't',
      type: 'text',
      x: 0,
      y: 0,
      width: 100,
      height: 20,
      rotation: 0,
      opacity: 1,
      text: '  Hello\nworld ',
      fontFamily: 'Manrope',
      fontSize: 20,
      fontWeight: 400,
      fontStyle: 'normal',
      fill: { type: 'solid', color: '#000' },
      align: 'left',
      verticalAlign: 'top',
      lineHeight: 1,
      letterSpacing: 0,
      stroke: { color: '#fff', width: 2 },
    };
    const scaled = scaleElementContent(text, 2);
    expect(scaled.fontSize).toBe(40);
    expect(scaled.stroke?.width).toBe(4);
    expect(elementLabel(text)).toBe('Hello world');
    expect(elementLabel(shape('s', 0))).toBe('Rectangle');
  });

  it('adds guides', () => {
    const { doc: d, id } = addGuide(doc(), 'x', 540);
    expect(d.guides).toEqual([{ id, axis: 'x', position: 540 }]);
  });
});
