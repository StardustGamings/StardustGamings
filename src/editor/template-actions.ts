'use client';

import type { DesignDocument } from '@/types/document';
import { MAX_SLIDES } from '@/projects/formats';
import type { Template } from '@/templates/registry';
import { insertTemplate, instantiateTemplate, replaceWithTemplate, type InstantiateOptions } from '@/templates/instantiate';
import { toast } from '@/components/ui/toast-store';
import { goToSlide } from './actions';
import { useEditor } from './store';

const ed = () => useEditor.getState();
const doc = (): DesignDocument | null => ed().history?.present ?? null;

/** A design with nothing on it yet — templates replace it instead of adding slides. */
export const isBlank = (d: DesignDocument) => d.elements.length === 0;

/**
 * Adds a template's slides after the current slide (scaled to this design's
 * size). A blank design is replaced instead. One undo step either way.
 */
export function addTemplateToDesign(template: Template, options: InstantiateOptions = {}): boolean {
  const d = doc();
  if (!d) return false;
  const source = instantiateTemplate(template, options);
  if (isBlank(d)) return replaceDesign(template, options);
  const at = ed().activeSlide + 1;
  const next = insertTemplate(d, source, at);
  if (!next) {
    toast({
      title: `A design can have up to ${MAX_SLIDES} slides`,
      description: 'Remove a few slides first, or start a new design from this template.',
      tone: 'error',
    });
    return false;
  }
  ed().apply(() => next);
  ed().clearSelection();
  goToSlide(at);
  return true;
}

/** Swaps the design's content for the template (keeps the canvas size). Undo brings it back. */
export function replaceDesign(template: Template, options: InstantiateOptions = {}): boolean {
  const d = doc();
  if (!d) return false;
  const next = replaceWithTemplate(d, instantiateTemplate(template, options));
  ed().apply(() => next);
  ed().clearSelection();
  goToSlide(0);
  return true;
}

export const editorDocument = doc;
