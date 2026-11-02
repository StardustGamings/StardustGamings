/**
 * Motion for designs: per-element entrance / exit animations and loop effects,
 * per-slide durations and the transition between slides. Everything is plain
 * data evaluated by `src/animations/engine.ts`; a design without any of it
 * renders exactly as before (and still exports as a still image).
 */

/** Entrance presets (the brief's animation list). */
export type EnterPreset = 'fade' | 'slide' | 'zoom' | 'bounce' | 'pop' | 'rotate' | 'blur' | 'typewriter' | 'glitch' | 'elastic';

/** Exits are the entrance presets that read well in reverse. */
export type ExitPreset = 'fade' | 'slide' | 'zoom' | 'pop' | 'rotate' | 'blur';

/** Continuous effects over the whole slide. */
export type LoopPreset = 'parallax' | 'float' | 'pulse';

export type Direction = 'up' | 'down' | 'left' | 'right';

export interface EnterAnimation {
  preset: EnterPreset;
  /** ms after the slide starts. */
  delay: number;
  /** ms. */
  duration: number;
  /** Where it comes from (slide, bounce, parallax). */
  direction?: Direction;
}

export interface ExitAnimation {
  preset: ExitPreset;
  /** ms; the exit ends when the slide ends. */
  duration: number;
  direction?: Direction;
}

export interface LoopAnimation {
  preset: LoopPreset;
  /** 0..100. */
  intensity: number;
  direction?: Direction;
}

export interface ElementAnimation {
  enter?: EnterAnimation;
  exit?: ExitAnimation;
  loop?: LoopAnimation;
}

/** How one slide hands over to the next in a video. */
export type SlideTransition = 'swipe' | 'fade' | 'zoom' | 'cut';

export interface DesignMotion {
  transition: SlideTransition;
  /** ms (ignored for `cut`). */
  transitionDuration: number;
}

/** A video clip placed in an image frame (the frame's asset is a video). */
export interface VideoClip {
  /** Seconds into the source where the clip starts. */
  trimStart: number;
  /** Seconds into the source where it ends (> trimStart). */
  trimEnd: number;
  /** 0.25..4. */
  speed: number;
  muted: boolean;
  /** Repeat when the slide lasts longer than the clip (otherwise the last frame holds). */
  loop: boolean;
}
