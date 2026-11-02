import type { DesignDocument, DesignElement } from '@/types/document';
import type { DesignMotion } from '@/types/animation';
import { hasAnimation, settledAt } from './engine';

/**
 * How a design plays as a video: each slide for its duration, one after the
 * other, handing over with a transition. The next slide's clock starts when
 * its transition starts, so its entrances play as it arrives.
 */

export const DEFAULT_SLIDE_DURATION = 3000;
export const MIN_SLIDE_DURATION = 500;
export const MAX_SLIDE_DURATION = 60_000;
export const DEFAULT_MOTION: DesignMotion = { transition: 'swipe', transitionDuration: 500 };

export const slideDuration = (doc: DesignDocument, index: number) => doc.slides[index]?.duration ?? DEFAULT_SLIDE_DURATION;
export const motionOf = (doc: DesignDocument): DesignMotion => doc.motion ?? DEFAULT_MOTION;

/** The slide an element belongs to: the one holding its centre. */
export function homeSlide(doc: DesignDocument, el: DesignElement): number {
  const i = Math.floor((el.x + el.width / 2) / doc.slideWidth);
  return Math.max(0, Math.min(doc.slides.length - 1, i));
}

export interface Sequence {
  /** Slide indices in play order. */
  slides: number[];
  /** Start time of each entry (ms from the start of the video). */
  starts: number[];
  durations: number[];
  /** Transition overlap, ms (0 for cuts). */
  overlap: number;
  motion: DesignMotion;
  total: number;
}

export function planSequence(doc: DesignDocument, slides: number[] = doc.slides.map((_, i) => i)): Sequence {
  const motion = motionOf(doc);
  const durations = slides.map((i) => slideDuration(doc, i));
  const shortest = Math.min(...durations);
  const overlap = motion.transition === 'cut' || slides.length < 2 ? 0 : Math.min(motion.transitionDuration, shortest / 2);
  const starts: number[] = [];
  let at = 0;
  for (const d of durations) {
    starts.push(at);
    at += d - overlap;
  }
  const total = slides.length ? starts[starts.length - 1]! + durations[durations.length - 1]! : 0;
  return { slides, starts, durations, overlap, motion, total };
}

export interface FrameSlide {
  /** Index into `doc.slides`. */
  slide: number;
  /** ms into that slide. */
  t: number;
  /** 'out' = leaving, 'in' = arriving, 'only' = alone on screen. */
  role: 'only' | 'out' | 'in';
  /** 0..1 through the transition (0 when alone). */
  progress: number;
}

/** Which slides are on screen at time `g` of the sequence, and how far along each is. */
export function frameAt(seq: Sequence, g: number): FrameSlide[] {
  const n = seq.slides.length;
  if (n === 0) return [];
  const time = Math.max(0, Math.min(g, seq.total - 1e-6));
  let i = 0;
  while (i < n - 1 && time >= seq.starts[i + 1]!) i++;
  const t = time - seq.starts[i]!;
  // Still overlapping with the previous slide's hand-over?
  if (i > 0 && seq.overlap > 0 && t < seq.overlap) {
    const progress = t / seq.overlap;
    return [
      { slide: seq.slides[i - 1]!, t: time - seq.starts[i - 1]!, role: 'out', progress },
      { slide: seq.slides[i]!, t, role: 'in', progress },
    ];
  }
  return [{ slide: seq.slides[i]!, t, role: 'only', progress: 0 }];
}

/** Anything that moves: animated elements, videos, or several slides (transitions). */
export function isAnimated(doc: DesignDocument): boolean {
  return doc.slides.length > 1 || doc.elements.some((el) => hasAnimation(el) || (el.type === 'image' && el.video));
}

/** How long a slide needs for all its entrances to finish (+ a beat to read it). */
export function suggestedSlideDuration(doc: DesignDocument, index: number): number {
  let end = 0;
  for (const el of doc.elements) {
    if (homeSlide(doc, el) !== index) continue;
    end = Math.max(
      end,
      settledAt(el),
      el.type === 'image' && el.video ? ((el.video.trimEnd - el.video.trimStart) / el.video.speed) * 1000 : 0,
    );
  }
  return Math.max(DEFAULT_SLIDE_DURATION, Math.min(MAX_SLIDE_DURATION, Math.ceil((end + 1500) / 250) * 250));
}

/** Seconds into the source video to show `t` ms into the slide (trimmed, sped up or slowed, looped or held). */
export function clipTime(clip: { trimStart: number; trimEnd: number; speed: number; loop: boolean }, t: number): number {
  const length = Math.max(0, clip.trimEnd - clip.trimStart);
  let s = (Math.max(0, t) / 1000) * clip.speed;
  if (length <= 0) return clip.trimStart;
  s = clip.loop ? s % length : Math.min(s, Math.max(0, length - 1 / 60));
  return clip.trimStart + s;
}
