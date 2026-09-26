import type { DesignDocument, DesignElement, Guide, TextElement } from '@/types/document';
import type { Rect } from '@/canvas/render/types';
import { elementBounds } from '@/canvas/render/renderer';
import { measureTextHeight } from '@/canvas/render/text';
import { resolveSticker } from '@/stickers/library';
import { createId } from '@/utils/id';
import { unionRects } from './geometry';

/**
 * Pure document operations used by the editor. Every function returns a new
 * document (or the same one when nothing changed) so edits compose with undo.
 */

export function getElements(doc: DesignDocument, ids: Iterable<string>): DesignElement[] {
  const set = new Set(ids);
  return doc.elements.filter((e) => set.has(e.id));
}

/** Adds every other member of the groups touched by `ids`. */
export function expandToGroups(doc: DesignDocument, ids: string[]): string[] {
  const groups = new Set(
    getElements(doc, ids)
      .map((e) => e.groupId)
      .filter(Boolean),
  );
  if (groups.size === 0) return ids;
  const out = new Set(ids);
  for (const e of doc.elements) if (e.groupId && groups.has(e.groupId)) out.add(e.id);
  return doc.elements.filter((e) => out.has(e.id)).map((e) => e.id);
}

export function addElements(doc: DesignDocument, elements: DesignElement[], index = doc.elements.length): DesignDocument {
  if (elements.length === 0) return doc;
  const list = [...doc.elements];
  list.splice(index, 0, ...elements);
  return { ...doc, elements: list };
}

export function removeElements(doc: DesignDocument, ids: string[]): DesignDocument {
  const set = new Set(ids);
  if (!doc.elements.some((e) => set.has(e.id))) return doc;
  return { ...doc, elements: doc.elements.filter((e) => !set.has(e.id)) };
}

export function updateElements(
  doc: DesignDocument,
  ids: Iterable<string>,
  fn: (el: DesignElement) => DesignElement,
): DesignDocument {
  const set = new Set(ids);
  let changed = false;
  const elements = doc.elements.map((e) => {
    if (!set.has(e.id)) return e;
    const next = fn(e);
    if (next !== e) changed = true;
    return next;
  });
  return changed ? { ...doc, elements } : doc;
}

export function translateElements(doc: DesignDocument, ids: string[], dx: number, dy: number): DesignDocument {
  if (dx === 0 && dy === 0) return doc;
  return updateElements(doc, ids, (e) => ({ ...e, x: e.x + dx, y: e.y + dy }));
}

/** Duplicates elements (keeping their groups together under new group ids). */
export function duplicateElements(
  doc: DesignDocument,
  ids: string[],
  offset: { x: number; y: number },
): { doc: DesignDocument; ids: string[] } {
  const source = getElements(doc, ids);
  if (source.length === 0) return { doc, ids: [] };
  const groupMap = new Map<string, string>();
  const newGroupId = (old: string) => {
    if (!groupMap.has(old)) groupMap.set(old, createId('grp'));
    return groupMap.get(old)!;
  };
  // Copies don't join the original's generated layout (shuffling it would move them).
  const copies = source.map(({ layout: _layout, ...e }) => ({
    ...structuredClone(e),
    id: createId('el'),
    x: e.x + offset.x,
    y: e.y + offset.y,
    groupId: e.groupId ? newGroupId(e.groupId) : undefined,
    locked: false,
  }));
  const topIndex = Math.max(...source.map((e) => doc.elements.indexOf(e)));
  return { doc: addElements(doc, copies, topIndex + 1), ids: copies.map((c) => c.id) };
}

export type ReorderMode = 'forward' | 'backward' | 'front' | 'back';

export function reorderElements(doc: DesignDocument, ids: string[], mode: ReorderMode): DesignDocument {
  const set = new Set(ids);
  const list = [...doc.elements];
  if (mode === 'front' || mode === 'back') {
    const moving = list.filter((e) => set.has(e.id));
    const rest = list.filter((e) => !set.has(e.id));
    const elements = mode === 'front' ? [...rest, ...moving] : [...moving, ...rest];
    return elements.every((e, i) => e === doc.elements[i]) ? doc : { ...doc, elements };
  }
  // Step past one non-selected neighbour at a time, preserving relative order.
  if (mode === 'forward') {
    for (let i = list.length - 2; i >= 0; i--) {
      if (set.has(list[i]!.id) && !set.has(list[i + 1]!.id)) [list[i], list[i + 1]] = [list[i + 1]!, list[i]!];
    }
  } else {
    for (let i = 1; i < list.length; i++) {
      if (set.has(list[i]!.id) && !set.has(list[i - 1]!.id)) [list[i], list[i - 1]] = [list[i - 1]!, list[i]!];
    }
  }
  return list.every((e, i) => e === doc.elements[i]) ? doc : { ...doc, elements: list };
}

/** Re-stacks `id` directly above (or below) another element. */
export function placeRelative(doc: DesignDocument, id: string, targetId: string, where: 'above' | 'below'): DesignDocument {
  const el = doc.elements.find((e) => e.id === id);
  if (!el || id === targetId) return doc;
  const rest = doc.elements.filter((e) => e.id !== id);
  const t = rest.findIndex((e) => e.id === targetId);
  if (t < 0) return doc;
  const index = where === 'above' ? t + 1 : t;
  const elements = [...rest.slice(0, index), el, ...rest.slice(index)];
  return elements.every((e, i) => e === doc.elements[i]) ? doc : { ...doc, elements };
}

/** Groups elements; members become contiguous at the top-most member's depth. */
export function groupElements(doc: DesignDocument, ids: string[]): { doc: DesignDocument; groupId: string | null } {
  const members = getElements(doc, ids);
  if (members.length < 2) return { doc, groupId: null };
  const groupId = createId('grp');
  const set = new Set(ids);
  const top = Math.max(...members.map((m) => doc.elements.indexOf(m)));
  const grouped = members.map((m) => ({ ...m, groupId }));
  const before = doc.elements.slice(0, top + 1).filter((e) => !set.has(e.id));
  const after = doc.elements.slice(top + 1);
  return { doc: { ...doc, elements: [...before, ...grouped, ...after] }, groupId };
}

export function ungroupElements(doc: DesignDocument, ids: string[]): DesignDocument {
  return updateElements(doc, expandToGroups(doc, ids), (e) => {
    if (!e.groupId) return e;
    const { groupId: _g, ...rest } = e;
    return rest as DesignElement;
  });
}

export const setLocked = (doc: DesignDocument, ids: string[], locked: boolean) =>
  updateElements(doc, ids, (e) => (Boolean(e.locked) === locked ? e : { ...e, locked }));

export const setHidden = (doc: DesignDocument, ids: string[], hidden: boolean) =>
  updateElements(doc, ids, (e) => (Boolean(e.hidden) === hidden ? e : { ...e, hidden }));

/** Selection "units": each group moves as one block, loose elements individually. */
export function selectionUnits(doc: DesignDocument, ids: string[]): { ids: string[]; bounds: Rect }[] {
  const units = new Map<string, DesignElement[]>();
  for (const e of getElements(doc, ids)) {
    const key = e.groupId ?? e.id;
    units.set(key, [...(units.get(key) ?? []), e]);
  }
  return [...units.values()].map((els) => ({ ids: els.map((e) => e.id), bounds: unionRects(els.map(elementBounds))! }));
}

export type Alignment = 'left' | 'center' | 'right' | 'top' | 'middle' | 'bottom';

/** Aligns each unit to `reference` (a slide, or the selection bounds). */
export function alignElements(doc: DesignDocument, ids: string[], alignment: Alignment, reference: Rect): DesignDocument {
  let next = doc;
  for (const unit of selectionUnits(doc, ids)) {
    const b = unit.bounds;
    let dx = 0;
    let dy = 0;
    if (alignment === 'left') dx = reference.x - b.x;
    if (alignment === 'center') dx = reference.x + reference.width / 2 - (b.x + b.width / 2);
    if (alignment === 'right') dx = reference.x + reference.width - (b.x + b.width);
    if (alignment === 'top') dy = reference.y - b.y;
    if (alignment === 'middle') dy = reference.y + reference.height / 2 - (b.y + b.height / 2);
    if (alignment === 'bottom') dy = reference.y + reference.height - (b.y + b.height);
    next = translateElements(next, unit.ids, dx, dy);
  }
  return next;
}

/** Evenly spaces three or more units between the outermost ones. */
export function distributeElements(doc: DesignDocument, ids: string[], axis: 'x' | 'y'): DesignDocument {
  const units = selectionUnits(doc, ids);
  if (units.length < 3) return doc;
  const pos = (r: Rect) => (axis === 'x' ? r.x : r.y);
  const size = (r: Rect) => (axis === 'x' ? r.width : r.height);
  units.sort((a, b) => pos(a.bounds) - pos(b.bounds));
  const first = units[0]!.bounds;
  const last = units[units.length - 1]!.bounds;
  const total = units.reduce((sum, u) => sum + size(u.bounds), 0);
  const gap = (pos(last) + size(last) - pos(first) - total) / (units.length - 1);
  let cursor = pos(first);
  let next = doc;
  for (const u of units) {
    const delta = cursor - pos(u.bounds);
    next = axis === 'x' ? translateElements(next, u.ids, delta, 0) : translateElements(next, u.ids, 0, delta);
    cursor += size(u.bounds) + gap;
  }
  return next;
}

/** Uniformly scales an element's content (fonts, strokes, radii) along with its box. */
export function scaleElementContent<T extends DesignElement>(el: T, s: number): T {
  if (s === 1) return el;
  const shadow = el.shadow && { ...el.shadow, blur: el.shadow.blur * s, x: el.shadow.x * s, y: el.shadow.y * s };
  switch (el.type) {
    case 'text':
      return {
        ...el,
        shadow,
        fontSize: Math.max(1, el.fontSize * s),
        stroke: el.stroke && { ...el.stroke, width: el.stroke.width * s },
        highlight: el.highlight && { ...el.highlight, padding: el.highlight.padding * s, radius: el.highlight.radius * s },
      };
    case 'shape':
      return {
        ...el,
        shadow,
        stroke: el.stroke && { ...el.stroke, width: el.stroke.width * s },
        cornerRadius: el.cornerRadius !== undefined ? el.cornerRadius * s : undefined,
        dash: el.dash?.map((d) => d * s),
      };
    case 'image':
      return {
        ...el,
        shadow,
        stroke: el.stroke && { ...el.stroke, width: el.stroke.width * s },
        cornerRadius: el.cornerRadius !== undefined ? el.cornerRadius * s : undefined,
      };
    default:
      return { ...el, shadow };
  }
}

/** Grows/shrinks a text box's height to fit its content. */
export function fitTextHeight(el: TextElement): TextElement {
  const height = Math.max(el.fontSize * el.lineHeight, measureTextHeight(el));
  return Math.abs(height - el.height) < 0.5 ? el : { ...el, height };
}

/** Human-readable layer name. */
export function elementLabel(el: DesignElement): string {
  if (el.name) return el.name;
  switch (el.type) {
    case 'text':
      return el.text.replace(/\s+/g, ' ').trim().slice(0, 40) || 'Text';
    case 'shape':
      return {
        rect: 'Rectangle',
        ellipse: 'Ellipse',
        triangle: 'Triangle',
        star: 'Star',
        polygon: 'Polygon',
        line: 'Line',
        arrow: 'Arrow',
      }[el.shape];
    case 'image':
      return el.assetId ? 'Photo' : 'Photo frame';
    case 'sticker':
      return resolveSticker(el.stickerId)?.sticker.name ?? 'Sticker';
  }
}

export function addGuide(doc: DesignDocument, axis: Guide['axis'], position: number): { doc: DesignDocument; id: string } {
  const id = createId('gd');
  return { doc: { ...doc, guides: [...(doc.guides ?? []), { id, axis, position }] }, id };
}

export function moveGuide(doc: DesignDocument, id: string, position: number): DesignDocument {
  return { ...doc, guides: (doc.guides ?? []).map((g) => (g.id === id ? { ...g, position } : g)) };
}

export function removeGuide(doc: DesignDocument, id: string): DesignDocument {
  return { ...doc, guides: (doc.guides ?? []).filter((g) => g.id !== id) };
}
