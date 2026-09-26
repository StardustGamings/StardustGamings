import type { DesignDocument, DesignElement } from '@/types/document';
import type { DesignMotion, ElementAnimation, EnterPreset } from '@/types/animation';
import { ENTER_PRESETS } from './engine';
import { homeSlide, suggestedSlideDuration } from './sequence';

/**
 * One-tap motion: gives every element on the chosen slides an entrance that
 * suits what it is (headline, body text, photo, sticker, shape), staggered top
 * to bottom, and sizes each slide so everything has time to land. Pure.
 */

export type AutoVibe = 'smooth' | 'playful' | 'glitchy';

export const AUTO_VIBES: Record<AutoVibe, { label: string; hint: string }> = {
  smooth: { label: 'Smooth', hint: 'Fades, slides and slow parallax — clean and editorial' },
  playful: { label: 'Playful', hint: 'Pops, bounces and elastic snaps' },
  glitchy: { label: 'Glitchy', hint: 'Glitches, typewriter text and hard cuts' },
};

type Role = 'backdrop' | 'headline' | 'text' | 'photo' | 'sticker' | 'shape';

const PRESETS: Record<AutoVibe, Record<Exclude<Role, 'backdrop'>, EnterPreset>> = {
  smooth: { headline: 'slide', text: 'fade', photo: 'zoom', sticker: 'pop', shape: 'fade' },
  playful: { headline: 'pop', text: 'bounce', photo: 'elastic', sticker: 'bounce', shape: 'pop' },
  glitchy: { headline: 'glitch', text: 'typewriter', photo: 'glitch', sticker: 'rotate', shape: 'blur' },
};

const STAGGER: Record<AutoVibe, { first: number; step: number }> = {
  smooth: { first: 150, step: 180 },
  playful: { first: 120, step: 150 },
  glitchy: { first: 80, step: 130 },
};

const MOTION: Record<AutoVibe, DesignMotion> = {
  smooth: { transition: 'swipe', transitionDuration: 500 },
  playful: { transition: 'zoom', transitionDuration: 450 },
  glitchy: { transition: 'cut', transitionDuration: 0 },
};

function role(doc: DesignDocument, el: DesignElement, headlineId: string | null): Role {
  const covers = el.width * el.height >= doc.slideWidth * doc.slideHeight * 0.8;
  if ((el.type === 'image' || el.type === 'shape') && covers) return 'backdrop';
  if (el.type === 'text') return el.id === headlineId ? 'headline' : 'text';
  if (el.type === 'image') return 'photo';
  if (el.type === 'sticker') return 'sticker';
  return 'shape';
}

function animationFor(vibe: AutoVibe, r: Role, delay: number, el: DesignElement): ElementAnimation | undefined {
  if (r === 'backdrop') {
    // Backgrounds don't enter; photos drift for a sense of depth.
    return el.type === 'image' && vibe !== 'glitchy'
      ? { loop: { preset: 'parallax', intensity: 45, direction: 'left' } }
      : undefined;
  }
  const preset = PRESETS[vibe][r];
  return {
    enter: {
      preset,
      delay,
      duration: ENTER_PRESETS[preset].duration,
      ...(preset === 'slide' || preset === 'bounce'
        ? { direction: preset === 'slide' ? ('up' as const) : ('down' as const) }
        : {}),
    },
  };
}

export function autoAnimate(doc: DesignDocument, slides: number[], vibe: AutoVibe): DesignDocument {
  const chosen = new Set(slides);
  const bySlide = new Map<number, DesignElement[]>();
  for (const el of doc.elements) {
    if (el.hidden) continue;
    const s = homeSlide(doc, el);
    if (!chosen.has(s)) continue;
    bySlide.set(s, [...(bySlide.get(s) ?? []), el]);
  }
  const next = new Map<string, ElementAnimation | undefined>();
  for (const els of bySlide.values()) {
    const texts = els.filter((e): e is Extract<DesignElement, { type: 'text' }> => e.type === 'text');
    const headline = texts.length ? texts.reduce((a, b) => (b.fontSize > a.fontSize ? b : a)).id : null;
    const ordered = [...els].sort((a, b) => a.y - b.y || a.x - b.x);
    let i = 0;
    for (const el of ordered) {
      const r = role(doc, el, headline);
      const delay = r === 'backdrop' ? 0 : STAGGER[vibe].first + STAGGER[vibe].step * i++;
      next.set(el.id, animationFor(vibe, r, delay, el));
    }
  }
  const animated: DesignDocument = {
    ...doc,
    motion: MOTION[vibe],
    elements: doc.elements.map((el) => {
      if (!next.has(el.id)) return el;
      const animation = next.get(el.id);
      const { animation: _old, ...rest } = el;
      return (animation ? { ...rest, animation } : rest) as DesignElement;
    }),
  };
  return {
    ...animated,
    slides: animated.slides.map((s, i) => (chosen.has(i) ? { ...s, duration: suggestedSlideDuration(animated, i) } : s)),
  };
}

/** Removes all motion from the chosen slides' elements (slide timing stays). */
export function clearAnimations(doc: DesignDocument, slides: number[]): DesignDocument {
  const chosen = new Set(slides);
  return {
    ...doc,
    elements: doc.elements.map((el) => {
      if (!el.animation || !chosen.has(homeSlide(doc, el))) return el;
      const { animation: _gone, ...rest } = el;
      return rest as DesignElement;
    }),
  };
}
