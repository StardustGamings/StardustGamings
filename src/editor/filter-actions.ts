'use client';

import type { DesignDocument, ImageEffects, ImageElement, LeakStyle } from '@/types/document';
import type { EffectKey } from '@/effects/effects';
import { updateElements } from './core/ops';
import { useEditor } from './store';

const ed = () => useEditor.getState();
const doc = (): DesignDocument | null => ed().history?.present ?? null;

/** Photos a look can go on: image elements that hold a photo and aren't locked. */
const isPhoto = (el: { type: string }): el is ImageElement =>
  el.type === 'image' && !!(el as ImageElement).assetId && !(el as ImageElement).locked;

export type LookScope = 'selection' | 'all';

/** The photos a filter change applies to: the selected ones, or every photo in the design. */
export function lookTargets(scope: LookScope, d: DesignDocument | null = doc()): ImageElement[] {
  if (!d) return [];
  if (scope === 'all') return d.elements.filter(isPhoto);
  const selected = new Set(ed().selection);
  return d.elements.filter((e): e is ImageElement => selected.has(e.id) && isPhoto(e));
}

function updatePhotos(scope: LookScope, fn: (el: ImageElement) => ImageElement, coalesce?: string) {
  const targets = lookTargets(scope);
  if (targets.length === 0) return;
  const ids = targets.map((t) => t.id);
  ed().apply((d) => updateElements(d, ids, (e) => (e.type === 'image' ? fn(e) : e)), {
    coalesce: coalesce ? `${coalesce}:${ids.join(',')}` : undefined,
  });
}

export const DEFAULT_INTENSITY = 100;

/** Puts a look on the target photos (`null` removes it). Keeps each photo's intensity when switching looks. */
export function applyLook(id: string | null, scope: LookScope = 'selection', intensity?: number) {
  updatePhotos(scope, (el) => {
    if (!id) {
      const { filter: _filter, ...rest } = el;
      return rest;
    }
    return { ...el, filter: { id, intensity: Math.round(intensity ?? el.filter?.intensity ?? DEFAULT_INTENSITY) } };
  });
}

export function setLookIntensity(intensity: number, scope: LookScope = 'selection') {
  updatePhotos(
    scope,
    (el) => (el.filter ? { ...el, filter: { ...el.filter, intensity: Math.round(Math.max(0, Math.min(100, intensity))) } } : el),
    'look-intensity',
  );
}

function withEffects(el: ImageElement, patch: Partial<ImageEffects>): ImageElement {
  const next: ImageEffects = { ...el.effects, ...patch };
  for (const [k, v] of Object.entries(next)) if (v === 0 || v === undefined) delete next[k as keyof ImageEffects];
  if (!next.leak) delete next.leakStyle;
  const { effects: _effects, ...rest } = el;
  return Object.keys(next).length ? { ...rest, effects: next } : rest;
}

export function setEffect(key: EffectKey, value: number) {
  updatePhotos('selection', (el) => withEffects(el, { [key]: Math.round(value) }), `effect-${key}`);
}

export function setLeakStyle(style: LeakStyle) {
  updatePhotos('selection', (el) => withEffects(el, { leak: el.effects?.leak || 40, leakStyle: style }));
}

export function resetEffects() {
  updatePhotos('selection', (el) => {
    const { effects: _effects, ...rest } = el;
    return rest;
  });
}
