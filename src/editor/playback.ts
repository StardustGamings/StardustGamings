'use client';

import { create } from 'zustand';
import { slideDuration } from '@/animations/sequence';
import { pauseAllPlayers } from '@/assets/video';
import { setLivePlayback } from '@/images/resolver';
import { selectDoc, useEditor } from './store';

/**
 * Previewing motion in the editor: one slide plays (or sits at a scrubbed
 * moment) while everything else shows the resting design. `slide === null`
 * means no preview — the canvas shows the design exactly as edited.
 */
interface PlaybackState {
  slide: number | null;
  /** ms into `slide`. */
  time: number;
  playing: boolean;
  loop: boolean;
  /** Plays a slide (the active one by default) from where it is — or from the start when finished, another slide, or asked. */
  play: (slide?: number, fromStart?: boolean) => void;
  pause: () => void;
  /** Back to the resting design. */
  stop: () => void;
  seek: (slide: number, time: number) => void;
  setLoop: (loop: boolean) => void;
}

let raf = 0;
let last = 0;

const durationOf = (slide: number) => {
  const doc = selectDoc(useEditor.getState());
  return doc ? slideDuration(doc, slide) : 0;
};

function tick(now: number) {
  const s = usePlayback.getState();
  if (!s.playing || s.slide === null) {
    raf = 0;
    return;
  }
  const d = durationOf(s.slide);
  let time = s.time + (now - last);
  last = now;
  if (time >= d) {
    if (s.loop) time = d > 0 ? time % d : 0;
    else {
      raf = 0;
      usePlayback.setState({ time: d, playing: false });
      return;
    }
  }
  usePlayback.setState({ time });
  raf = requestAnimationFrame(tick);
}

export const usePlayback = create<PlaybackState>()((set, get) => ({
  slide: null,
  time: 0,
  playing: false,
  loop: false,
  play: (slide, fromStart = false) => {
    const target = slide ?? get().slide ?? useEditor.getState().activeSlide;
    const d = durationOf(target);
    const restart = fromStart || get().slide !== target || get().time >= d - 1;
    set({ slide: target, time: restart ? 0 : get().time, playing: true });
    last = performance.now();
    if (!raf) raf = requestAnimationFrame(tick);
  },
  pause: () => set({ playing: false }),
  stop: () => {
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
    set({ slide: null, time: 0, playing: false });
  },
  seek: (slide, time) => set({ slide, time: Math.max(0, Math.min(time, durationOf(slide))), playing: false }),
  setLoop: (loop) => set({ loop }),
}));

// Videos play in real time while previewing, and hold still when paused or scrubbed.
usePlayback.subscribe((s, prev) => {
  if (s.playing === prev.playing) return;
  setLivePlayback(s.playing);
  if (!s.playing) pauseAllPlayers();
});

/** Stops previewing when the design closes or another project opens. */
useEditor.subscribe((s, prev) => {
  if (s.meta?.id !== prev.meta?.id) usePlayback.getState().stop();
});

export const formatSeconds = (ms: number) => `${(ms / 1000).toFixed(1)}s`;
