'use client';

import { useMemo } from 'react';
import type { DesignElement, Fill } from '@/types/document';
import { normalizeHex } from '@/utils/color';
import { getElements, updateElements } from '../core/ops';
import { selectDoc, useEditor } from '../store';

/** The selected elements (memoised against the document + selection). */
export function useSelectedElements(): DesignElement[] {
  const doc = useEditor(selectDoc);
  const selection = useEditor((s) => s.selection);
  return useMemo(() => (doc ? getElements(doc, selection) : []), [doc, selection]);
}

/** Every solid colour used in the design (fills, strokes, tints) — most used first. */
export function useDocColors(): string[] {
  const doc = useEditor(selectDoc);
  return useMemo(() => {
    if (!doc) return [];
    const counts = new Map<string, number>();
    const add = (c?: string) => {
      const hex = c ? normalizeHex(c) : null;
      if (hex && hex.length === 7) counts.set(hex, (counts.get(hex) ?? 0) + 1);
    };
    const addFill = (f?: Fill | null) => {
      if (!f) return;
      if (f.type === 'solid') add(f.color);
      else f.stops.forEach((s) => add(s.color));
    };
    addFill(doc.background);
    doc.slides.forEach((s) => addFill(s.fill));
    for (const el of doc.elements) {
      if (el.type === 'text') {
        addFill(el.fill);
        add(el.stroke?.color);
        addFill(el.highlight?.fill);
      } else if (el.type === 'shape') {
        addFill(el.fill);
        add(el.stroke?.color);
      } else if (el.type === 'sticker') add(el.tint);
    }
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([c]) => c);
  }, [doc]);
}

/**
 * Updates the selected elements as one undo step; rapid repeats of the same
 * property (slider drags, colour picking) merge into that step.
 */
export function updateSelection(key: string, fn: (el: DesignElement) => DesignElement) {
  const { selection, apply } = useEditor.getState();
  if (selection.length === 0) return;
  apply((d) => updateElements(d, selection, fn), { coalesce: `${key}:${selection.join(',')}` });
}
