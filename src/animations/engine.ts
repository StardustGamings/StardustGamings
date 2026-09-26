import type { DesignElement } from '@/types/document';
import type {
  Direction,
  EnterAnimation,
  EnterPreset,
  ExitAnimation,
  ExitPreset,
  LoopAnimation,
  LoopPreset,
} from '@/types/animation';

/**
 * Pure animation maths: where an element is, and how it looks, at a moment of
 * its slide. The renderer applies the returned pose on top of the element's
 * own transform, so a resting pose (no animation, or after it finishes) draws
 * the design exactly as edited.
 */

export interface Pose {
  /** Multiplies the element's opacity. */
  opacity: number;
  /** Offset in design units. */
  dx: number;
  dy: number;
  /** Uniform scale around the element's centre. */
  scale: number;
  /** Extra horizontal stretch (elastic). */
  scaleX: number;
  /** Extra rotation, degrees. */
  rotate: number;
  /** Blur radius in design units. */
  blur: number;
  /** 0..1: typewriter (text) or left-to-right wipe (everything else). 1 = fully shown. */
  reveal: number;
  /** 0..1 glitch strength, and a seed that changes every few frames. */
  glitch: number;
  seed: number;
}

export const REST: Readonly<Pose> = Object.freeze({
  opacity: 1,
  dx: 0,
  dy: 0,
  scale: 1,
  scaleX: 1,
  rotate: 0,
  blur: 0,
  reveal: 1,
  glitch: 0,
  seed: 0,
});

export interface Stage {
  /** Slide size in design units (for travel distances). */
  width: number;
  height: number;
  /** How long this slide plays, ms. */
  duration: number;
}

/* ───────────── Presets ───────────── */

interface PresetInfo {
  label: string;
  hint: string;
  duration: number;
  directional: boolean;
}

export const ENTER_PRESETS: Record<EnterPreset, PresetInfo> = {
  fade: { label: 'Fade', hint: 'Softly appears', duration: 600, directional: false },
  slide: { label: 'Slide', hint: 'Glides in from a side', duration: 650, directional: true },
  zoom: { label: 'Zoom', hint: 'Grows into place', duration: 650, directional: false },
  bounce: { label: 'Bounce', hint: 'Drops in and bounces', duration: 900, directional: true },
  pop: { label: 'Pop', hint: 'Pops with a little overshoot', duration: 500, directional: false },
  rotate: { label: 'Rotate', hint: 'Spins into place', duration: 700, directional: false },
  blur: { label: 'Blur reveal', hint: 'Comes into focus', duration: 800, directional: false },
  typewriter: { label: 'Typewriter', hint: 'Types itself out (wipes in for non-text)', duration: 1200, directional: false },
  glitch: { label: 'Glitch', hint: 'Flickers in with digital noise', duration: 700, directional: false },
  elastic: { label: 'Elastic', hint: 'Stretches and snaps into place', duration: 1000, directional: false },
};

export const EXIT_PRESETS: Record<ExitPreset, PresetInfo> = {
  fade: { label: 'Fade', hint: 'Fades away', duration: 500, directional: false },
  slide: { label: 'Slide', hint: 'Glides out', duration: 500, directional: true },
  zoom: { label: 'Zoom', hint: 'Shrinks away', duration: 500, directional: false },
  pop: { label: 'Pop', hint: 'Pops out', duration: 400, directional: false },
  rotate: { label: 'Rotate', hint: 'Spins out', duration: 500, directional: false },
  blur: { label: 'Blur', hint: 'Goes out of focus', duration: 600, directional: false },
};

export const LOOP_PRESETS: Record<LoopPreset, PresetInfo> = {
  parallax: {
    label: 'Parallax',
    hint: 'Drifts slowly across the slide — layers at different depths',
    duration: 0,
    directional: true,
  },
  float: { label: 'Float', hint: 'Gently bobs up and down', duration: 0, directional: false },
  pulse: { label: 'Pulse', hint: 'Breathes in and out', duration: 0, directional: false },
};

/* ───────────── Easing ───────────── */

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);
export const easeOutCubic = (p: number) => 1 - (1 - p) ** 3;
export const easeInOutCubic = (p: number) => (p < 0.5 ? 4 * p ** 3 : 1 - (-2 * p + 2) ** 3 / 2);
export const easeOutBack = (p: number) => {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * (p - 1) ** 3 + c1 * (p - 1) ** 2;
};
export function easeOutBounce(p: number): number {
  const n1 = 7.5625;
  const d1 = 2.75;
  if (p < 1 / d1) return n1 * p * p;
  if (p < 2 / d1) return n1 * (p -= 1.5 / d1) * p + 0.75;
  if (p < 2.5 / d1) return n1 * (p -= 2.25 / d1) * p + 0.9375;
  return n1 * (p -= 2.625 / d1) * p + 0.984375;
}
export const easeOutElastic = (p: number) =>
  p <= 0 ? 0 : p >= 1 ? 1 : 2 ** (-10 * p) * Math.sin((p * 10 - 0.75) * ((2 * Math.PI) / 3)) + 1;

/** Deterministic noise in 0..1 for glitches (same frame → same look, so exports are repeatable). */
export function noise(seed: number): number {
  const x = Math.sin(seed * 12.9898 + 78.233) * 43758.5453;
  return x - Math.floor(x);
}

/** Unit vector pointing where the element comes *from*. */
function from(direction: Direction | undefined, fallback: Direction): [number, number] {
  switch (direction ?? fallback) {
    case 'up':
      return [0, 1]; // moves up into place: starts below
    case 'down':
      return [0, -1];
    case 'left':
      return [1, 0]; // moves left into place: starts on the right
    case 'right':
      return [-1, 0];
  }
}

const travel = (stage: Stage, [x]: [number, number]) => (x !== 0 ? stage.width : stage.height) * 0.18;

/* ───────────── Evaluation ───────────── */

/** Applies an entrance at progress `p` (0 = not started, 1 = in place) to `pose`. */
function applyEnter(pose: Pose, a: EnterAnimation, p: number, t: number, stage: Stage): void {
  const e = easeOutCubic(p);
  const fadeIn = clamp01(p * 2.2);
  switch (a.preset) {
    case 'fade':
      pose.opacity *= easeInOutCubic(p);
      break;
    case 'slide': {
      const dir = from(a.direction, 'up');
      const d = travel(stage, dir) * (1 - e);
      pose.dx += dir[0] * d;
      pose.dy += dir[1] * d;
      pose.opacity *= fadeIn;
      break;
    }
    case 'zoom':
      pose.scale *= 0.55 + 0.45 * e;
      pose.opacity *= fadeIn;
      break;
    case 'bounce': {
      const dir = from(a.direction, 'down');
      const d = (dir[0] !== 0 ? stage.width : stage.height) * 0.35 * (1 - easeOutBounce(p));
      pose.dx += dir[0] * d;
      pose.dy += dir[1] * d;
      pose.opacity *= clamp01(p * 5);
      break;
    }
    case 'pop':
      pose.scale *= Math.max(0, easeOutBack(p));
      pose.opacity *= clamp01(p * 4);
      break;
    case 'rotate':
      pose.rotate += -120 * (1 - e);
      pose.scale *= 0.7 + 0.3 * e;
      pose.opacity *= fadeIn;
      break;
    case 'blur':
      pose.blur = Math.max(pose.blur, 28 * (1 - e));
      pose.opacity *= clamp01(p * 1.6);
      break;
    case 'typewriter':
      pose.reveal = Math.min(pose.reveal, p);
      break;
    case 'glitch': {
      const seed = Math.floor(t / 60);
      const strength = 1 - p;
      // Flickers: early on it's mostly off, then settles.
      const on = p > 0.85 || noise(seed + 0.5) > 0.55 * strength;
      pose.opacity *= on ? 1 : 0.08;
      pose.glitch = Math.max(pose.glitch, strength);
      pose.seed = seed;
      pose.dx += (noise(seed) - 0.5) * stage.width * 0.05 * strength;
      break;
    }
    case 'elastic': {
      const k = easeOutElastic(p);
      pose.scale *= 0.4 + 0.6 * k;
      pose.scaleX *= 1 + (1 - k) * 0.25;
      pose.opacity *= clamp01(p * 3);
      break;
    }
  }
}

/** Applies an exit at progress `p` (0 = still in place, 1 = gone). */
function applyExit(pose: Pose, a: ExitAnimation, p: number, stage: Stage): void {
  const e = p ** 3; // ease-in
  const fadeOut = 1 - clamp01((p - 0.2) / 0.8);
  switch (a.preset) {
    case 'fade':
      pose.opacity *= 1 - easeInOutCubic(p);
      break;
    case 'slide': {
      const [x, y] = from(a.direction, 'up');
      // "Up" exits upwards: the opposite of where an "up" entrance starts.
      const d = travel(stage, [x, y]) * e;
      pose.dx -= x * d;
      pose.dy -= y * d;
      pose.opacity *= fadeOut;
      break;
    }
    case 'zoom':
      pose.scale *= 1 - 0.45 * e;
      pose.opacity *= fadeOut;
      break;
    case 'pop':
      pose.scale *= p < 0.3 ? 1 + (p / 0.3) * 0.12 : Math.max(0, 1.12 * (1 - (p - 0.3) / 0.7));
      pose.opacity *= fadeOut;
      break;
    case 'rotate':
      pose.rotate += 120 * e;
      pose.scale *= 1 - 0.3 * e;
      pose.opacity *= fadeOut;
      break;
    case 'blur':
      pose.blur = Math.max(pose.blur, 28 * e);
      pose.opacity *= 1 - clamp01((p - 0.4) / 0.6);
      break;
  }
}

function applyLoop(pose: Pose, a: LoopAnimation, t: number, stage: Stage): void {
  const k = a.intensity / 100;
  switch (a.preset) {
    case 'parallax': {
      // A slow drift across the whole slide; stronger intensity reads as a nearer layer.
      const [x, y] = from(a.direction, 'left');
      const p = stage.duration > 0 ? clamp01(t / stage.duration) : 0;
      const d = (p - 0.5) * 2 * (x !== 0 ? stage.width : stage.height) * 0.06 * k;
      pose.dx -= x * d;
      pose.dy -= y * d;
      break;
    }
    case 'float':
      pose.dy += Math.sin((2 * Math.PI * t) / 3200) * stage.height * 0.018 * k;
      break;
    case 'pulse':
      pose.scale *= 1 + Math.sin((2 * Math.PI * t) / 1600) * 0.05 * k;
      break;
  }
}

/**
 * The element's pose `t` ms into its slide. `-Infinity` = before the slide
 * starts, `Infinity` = after it ended. Returns `null` when the element is
 * invisible at that moment (before its entrance, or after its exit).
 */
export function poseAt(el: DesignElement, t: number, stage: Stage): Pose | null {
  const anim = el.animation;
  if (!anim || (!anim.enter && !anim.exit && !anim.loop)) return REST;
  const pose: Pose = { ...REST };
  if (anim.enter) {
    const p = anim.enter.duration > 0 ? (t - anim.enter.delay) / anim.enter.duration : t >= anim.enter.delay ? 1 : 0;
    if (p <= 0) return null;
    if (p < 1) applyEnter(pose, anim.enter, p, t, stage);
  }
  if (anim.exit) {
    const start = stage.duration - anim.exit.duration;
    if (t >= stage.duration) return null;
    if (t > start) applyExit(pose, anim.exit, (t - start) / anim.exit.duration, stage);
  }
  if (anim.loop && Number.isFinite(t)) applyLoop(pose, anim.loop, t, stage);
  return pose.opacity <= 0.001 ? null : pose;
}

export const hasAnimation = (el: DesignElement) =>
  Boolean(el.animation && (el.animation.enter || el.animation.exit || el.animation.loop));

/** When the element's entrance has finished (ms into the slide). */
export const settledAt = (el: DesignElement) =>
  el.animation?.enter ? el.animation.enter.delay + el.animation.enter.duration : 0;
