'use client';

import type { DesignDocument, DesignElement } from '@/types/document';
import type { DesignMotion, ElementAnimation, EnterAnimation, ExitAnimation, LoopAnimation } from '@/types/animation';
import { autoAnimate, clearAnimations, type AutoVibe } from '@/animations/auto';
import { ENTER_PRESETS } from '@/animations/engine';
import { DEFAULT_MOTION, homeSlide, MAX_SLIDE_DURATION, MIN_SLIDE_DURATION, suggestedSlideDuration } from '@/animations/sequence';
import { toast } from '@/components/ui/toast-store';
import { usePlayback } from './playback';
import { selectDoc, useEditor } from './store';

/** Editor actions for motion. Each is one undo step (drags coalesce into one). */

const ed = () => useEditor.getState();

function patchAnimation(ids: string[], recipe: (a: ElementAnimation) => ElementAnimation, coalesce?: string) {
  const set = new Set(ids);
  ed().apply(
    (d) => ({
      ...d,
      elements: d.elements.map((el) => {
        if (!set.has(el.id) || el.locked) return el;
        const next = recipe(el.animation ?? {});
        const { animation: _old, ...rest } = el;
        return (next.enter || next.exit || next.loop ? { ...rest, animation: next } : rest) as DesignElement;
      }),
    }),
    coalesce ? { coalesce } : undefined,
  );
}

const without = <K extends keyof ElementAnimation>(a: ElementAnimation, key: K): ElementAnimation => {
  const { [key]: _gone, ...rest } = a;
  return rest;
};

/** Picks an entrance (null removes it), keeping the element's timing when it had one. */
export function setEnter(ids: string[], preset: EnterAnimation['preset'] | null) {
  patchAnimation(ids, (a) => {
    if (!preset) return without(a, 'enter');
    const previous = a.enter;
    return {
      ...a,
      enter: {
        preset,
        delay: previous?.delay ?? 0,
        duration:
          previous && previous.preset !== preset
            ? ENTER_PRESETS[preset].duration
            : (previous?.duration ?? ENTER_PRESETS[preset].duration),
        ...(ENTER_PRESETS[preset].directional ? { direction: previous?.direction ?? (preset === 'bounce' ? 'down' : 'up') } : {}),
      },
    };
  });
  previewSoon();
}

export function patchEnter(ids: string[], patch: Partial<Omit<EnterAnimation, 'preset'>>, coalesce = 'enter-timing') {
  patchAnimation(ids, (a) => (a.enter ? { ...a, enter: { ...a.enter, ...patch } } : a), coalesce);
}

export function setExit(ids: string[], exit: ExitAnimation | null) {
  patchAnimation(ids, (a) => (exit ? { ...a, exit } : without(a, 'exit')));
}

export function patchExit(ids: string[], patch: Partial<ExitAnimation>, coalesce = 'exit-timing') {
  patchAnimation(ids, (a) => (a.exit ? { ...a, exit: { ...a.exit, ...patch } } : a), coalesce);
}

export function setLoop(ids: string[], loop: LoopAnimation | null, coalesce?: string) {
  patchAnimation(ids, (a) => (loop ? { ...a, loop } : without(a, 'loop')), coalesce);
}

export const clampDuration = (ms: number) => Math.round(Math.max(MIN_SLIDE_DURATION, Math.min(MAX_SLIDE_DURATION, ms)) / 50) * 50;

export function setSlideDuration(index: number, ms: number, coalesce = 'slide-duration') {
  ed().apply((d) => ({ ...d, slides: d.slides.map((s, i) => (i === index ? { ...s, duration: clampDuration(ms) } : s)) }), {
    coalesce: `${coalesce}-${index}`,
  });
}

export function fitSlideToAnimations(index: number) {
  const d = selectDoc(ed());
  if (d) setSlideDuration(index, suggestedSlideDuration(d, index), 'fit');
}

export function setMotion(patch: Partial<DesignMotion>, coalesce?: string) {
  ed().apply((d) => ({ ...d, motion: { ...(d.motion ?? DEFAULT_MOTION), ...patch } }), coalesce ? { coalesce } : undefined);
}

export function autoAnimateSlides(scope: 'slide' | 'all', vibe: AutoVibe) {
  const d = selectDoc(ed());
  if (!d) return;
  const slides = scope === 'all' ? d.slides.map((_, i) => i) : [ed().activeSlide];
  const count = d.elements.filter((el) => !el.hidden && slides.includes(homeSlide(d, el))).length;
  if (count === 0) {
    toast({ title: 'Nothing to animate yet', description: 'Add text, photos or stickers first.' });
    return;
  }
  ed().apply((doc) => autoAnimate(doc, slides, vibe));
  toast({
    title: `Animated ${count} element${count === 1 ? '' : 's'}`,
    description: 'Every choice stays editable. Undo to go back.',
    tone: 'success',
  });
  usePlayback.getState().play(ed().activeSlide, true);
}

export function clearSlideAnimations(scope: 'slide' | 'all') {
  const d = selectDoc(ed());
  if (!d) return;
  const slides = scope === 'all' ? d.slides.map((_, i) => i) : [ed().activeSlide];
  ed().apply((doc: DesignDocument) => clearAnimations(doc, slides));
  usePlayback.getState().stop();
}

/** A short replay of the active slide after picking a preset, so the choice is visible straight away. */
function previewSoon() {
  requestAnimationFrame(() => usePlayback.getState().play(ed().activeSlide, true));
}
