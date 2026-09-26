import { describe, expect, it } from 'vitest';
import type { DesignElement, TextElement } from '@/types/document';
import { createDocument } from '@/projects/document';
import { renderDocument } from '@/canvas/render/renderer';
import type { Ctx2D } from '@/canvas/render/types';
import { easeOutBack, easeOutBounce, easeOutElastic, ENTER_PRESETS, poseAt, REST } from './engine';
import { clipTime, frameAt, homeSlide, isAnimated, planSequence, suggestedSlideDuration } from './sequence';

const stage = { width: 1080, height: 1350, duration: 3000 };

const box = (animation: DesignElement['animation'], over: Partial<DesignElement> = {}): DesignElement =>
  ({
    id: 'e',
    type: 'shape',
    shape: 'rect',
    fill: { type: 'solid', color: '#FF0000' },
    x: 100,
    y: 100,
    width: 200,
    height: 200,
    rotation: 0,
    opacity: 1,
    animation,
    ...over,
  }) as DesignElement;

describe('easing', () => {
  it('starts at 0 and lands on 1', () => {
    for (const f of [easeOutBack, easeOutBounce, easeOutElastic]) {
      expect(f(0)).toBeCloseTo(0, 5);
      expect(f(1)).toBeCloseTo(1, 5);
    }
    // Pop overshoots, which is the point.
    expect(Math.max(...Array.from({ length: 50 }, (_, i) => easeOutBack(i / 49)))).toBeGreaterThan(1.05);
  });
});

describe('poses', () => {
  it('leaves unanimated elements at rest', () => {
    expect(poseAt(box(undefined), 0, stage)).toBe(REST);
  });

  it('hides an element until its entrance starts, animates it, then rests', () => {
    const el = box({ enter: { preset: 'slide', delay: 200, duration: 600, direction: 'up' } });
    expect(poseAt(el, 100, stage)).toBeNull();
    expect(poseAt(el, -Infinity, stage)).toBeNull();
    const mid = poseAt(el, 350, stage)!;
    expect(mid.dy).toBeGreaterThan(0); // comes up from below
    expect(mid.dx).toBe(0);
    const done = poseAt(el, 900, stage)!;
    expect(done).toMatchObject({ dx: 0, dy: 0, opacity: 1, scale: 1 });
    expect(poseAt(el, Infinity, stage)).toMatchObject({ dy: 0, opacity: 1 });
  });

  it('every preset starts hidden-or-moved and ends exactly at rest', () => {
    for (const preset of Object.keys(ENTER_PRESETS) as (keyof typeof ENTER_PRESETS)[]) {
      const el = box({ enter: { preset, delay: 0, duration: 800, direction: 'left' } });
      const early = poseAt(el, 40, stage);
      const moved =
        early === null ||
        early.opacity < 1 ||
        early.dx !== 0 ||
        early.dy !== 0 ||
        early.scale !== 1 ||
        early.rotate !== 0 ||
        early.blur > 0 ||
        early.reveal < 1 ||
        early.glitch > 0;
      expect(moved, preset).toBe(true);
      expect(poseAt(el, 800, stage), preset).toMatchObject({ opacity: 1, dx: 0, dy: 0, scale: 1, rotate: 0, blur: 0, reveal: 1 });
    }
  });

  it('typewriter reveals progressively; blur reveal sharpens', () => {
    const tw = box({ enter: { preset: 'typewriter', delay: 0, duration: 1000 } });
    expect(poseAt(tw, 250, stage)!.reveal).toBeCloseTo(0.25, 5);
    const blur = box({ enter: { preset: 'blur', delay: 0, duration: 1000 } });
    expect(poseAt(blur, 100, stage)!.blur).toBeGreaterThan(poseAt(blur, 600, stage)!.blur);
  });

  it('glitch is deterministic (repeatable exports)', () => {
    const el = box({ enter: { preset: 'glitch', delay: 0, duration: 700 } });
    expect(poseAt(el, 180, stage)).toEqual(poseAt(el, 180, stage));
    expect(poseAt(el, 180, stage)?.glitch ?? 1).toBeGreaterThan(0);
  });

  it('exits end the element with the slide', () => {
    const el = box({ exit: { preset: 'fade', duration: 500 } });
    expect(poseAt(el, 2000, stage)!.opacity).toBe(1);
    expect(poseAt(el, 2750, stage)!.opacity).toBeLessThan(1);
    expect(poseAt(el, 3000, stage)).toBeNull();
    expect(poseAt(el, Infinity, stage)).toBeNull();
  });

  it('loops move continuously: parallax drifts across the slide', () => {
    const el = box({ loop: { preset: 'parallax', intensity: 100, direction: 'left' } });
    const start = poseAt(el, 0, stage)!.dx;
    const end = poseAt(el, 3000, stage)!.dx;
    expect(start).toBeGreaterThan(0);
    expect(end).toBeLessThan(0);
    expect(poseAt(box({ loop: { preset: 'pulse', intensity: 100 } }), 400, stage)!.scale).toBeGreaterThan(1);
  });
});

describe('sequence', () => {
  const doc = createDocument({ width: 1080, height: 1350, slideCount: 3 });
  doc.slides[1]!.duration = 4000;

  it('plans slides back to back with overlapping transitions', () => {
    const seq = planSequence(doc);
    expect(seq.starts).toEqual([0, 2500, 6000]);
    expect(seq.total).toBe(9000);
    expect(frameAt(seq, 1000)).toEqual([{ slide: 0, t: 1000, role: 'only', progress: 0 }]);
    const handover = frameAt(seq, 2750);
    expect(handover.map((f) => [f.slide, f.role])).toEqual([
      [0, 'out'],
      [1, 'in'],
    ]);
    expect(handover[1]).toMatchObject({ t: 250, progress: 0.5 });
    expect(frameAt(seq, 99999).at(-1)!.slide).toBe(2);
  });

  it('cuts have no overlap, and a subset of slides plays alone', () => {
    const cut = planSequence({ ...doc, motion: { transition: 'cut', transitionDuration: 500 } });
    expect(cut.total).toBe(10000);
    const one = planSequence(doc, [1]);
    expect(one).toMatchObject({ slides: [1], total: 4000, overlap: 0 });
  });

  it('finds each element’s slide and whether a design moves at all', () => {
    expect(homeSlide(doc, box(undefined, { x: 1200, width: 100 }))).toBe(1);
    expect(homeSlide(doc, box(undefined, { x: -500, width: 100 }))).toBe(0);
    expect(isAnimated(createDocument({ width: 100, height: 100 }))).toBe(false);
    expect(isAnimated(doc)).toBe(true);
    const still = createDocument({ width: 1080, height: 1080 });
    still.elements.push(box({ enter: { preset: 'pop', delay: 3000, duration: 800 } }));
    expect(isAnimated(still)).toBe(true);
    expect(suggestedSlideDuration(still, 0)).toBe(5500);
  });

  it('maps slide time onto a trimmed, sped-up or looping clip', () => {
    const clip = { trimStart: 2, trimEnd: 5, speed: 2, loop: true };
    expect(clipTime(clip, 0)).toBe(2);
    expect(clipTime(clip, 1000)).toBe(4);
    expect(clipTime(clip, 2000)).toBeCloseTo(3, 5); // looped: 4 s into a 3 s clip
    expect(clipTime({ ...clip, loop: false }, 5000)).toBeCloseTo(5 - 1 / 60, 5);
  });
});

describe('renderer with time', () => {
  function recorder() {
    const calls: string[] = [];
    const state: Record<string, unknown> = { font: '10px sans-serif', globalAlpha: 1, filter: 'none' };
    const ctx = new Proxy(state, {
      get(target, prop: string) {
        if (prop in target) return target[prop];
        if (prop === 'measureText')
          return (s: string) => ({ width: s.length * 5, fontBoundingBoxAscent: 8, fontBoundingBoxDescent: 2 });
        if (prop === 'getTransform') return () => ({ a: 1, b: 0 });
        return (...args: unknown[]) =>
          calls.push(
            `${prop}(${args.map((a) => (typeof a === 'number' ? Math.round(a) : typeof a === 'string' ? a : '')).join(',')})`,
          );
      },
      set(target, prop: string, value) {
        target[prop] = value;
        if (prop === 'filter') calls.push(`filter=${value}`);
        return true;
      },
    });
    return { ctx: ctx as unknown as Ctx2D, calls };
  }

  const text: TextElement = {
    id: 't',
    type: 'text',
    x: 0,
    y: 0,
    width: 400,
    height: 100,
    rotation: 0,
    opacity: 1,
    text: 'abcdefghij',
    fontFamily: 'Manrope',
    fontSize: 10,
    fontWeight: 400,
    fontStyle: 'normal',
    fill: { type: 'solid', color: '#000000' },
    align: 'left',
    verticalAlign: 'top',
    lineHeight: 1.2,
    letterSpacing: 0,
    animation: { enter: { preset: 'typewriter', delay: 0, duration: 1000 } },
  };

  it('types text out and skips elements that haven’t entered yet', () => {
    const doc = createDocument({ width: 500, height: 500 });
    doc.elements.push(text, box({ enter: { preset: 'fade', delay: 800, duration: 200 } }));
    const half = recorder();
    renderDocument(half.ctx, doc, { scale: 1, time: () => 500 });
    expect(half.calls.filter((c) => c.startsWith('fillText'))).toEqual(['fillText(abcde,0,9)']);
    expect(half.calls.some((c) => c.startsWith('fillRect(0,0,200'))).toBe(false); // the box isn't drawn yet

    const rest = recorder();
    renderDocument(rest.ctx, doc, { scale: 1 });
    expect(rest.calls.filter((c) => c.startsWith('fillText'))).toEqual(['fillText(abcdefghij,0,9)']);
  });

  it('blurs during a blur reveal', () => {
    const doc = createDocument({ width: 500, height: 500 });
    doc.elements.push(box({ enter: { preset: 'blur', delay: 0, duration: 1000 } }));
    const r = recorder();
    renderDocument(r.ctx, doc, { scale: 1, time: () => 100 });
    expect(r.calls.some((c) => /^filter=blur\(\d/.test(c))).toBe(true);
  });
});

describe('auto-animate', async () => {
  const { autoAnimate, clearAnimations } = await import('./auto');
  const doc = createDocument({ width: 1080, height: 1350, slideCount: 2 });
  doc.elements.push(
    box(undefined, {
      id: 'bg',
      type: 'image',
      x: 0,
      y: 0,
      width: 1080,
      height: 1350,
      assetId: 'a',
      fit: 'cover',
    } as Partial<DesignElement>),
    {
      ...(box(undefined) as unknown as TextElement),
      id: 'small',
      type: 'text',
      y: 900,
      fontSize: 30,
      text: 'body',
    } as DesignElement,
    {
      ...(box(undefined) as unknown as TextElement),
      id: 'big',
      type: 'text',
      y: 200,
      fontSize: 90,
      text: 'Title',
    } as DesignElement,
    box(undefined, { id: 'other-slide', x: 1300 }),
  );

  it('stages a slide: backdrop drifts, headline first, then the rest top to bottom', () => {
    const out = autoAnimate(doc, [0], 'smooth');
    const by = (id: string) => out.elements.find((e) => e.id === id)!.animation;
    expect(by('bg')).toEqual({ loop: { preset: 'parallax', intensity: 45, direction: 'left' } });
    expect(by('big')!.enter).toMatchObject({ preset: 'slide', direction: 'up', delay: 150 });
    expect(by('small')!.enter).toMatchObject({ preset: 'fade', delay: 330 });
    expect(by('other-slide')).toBeUndefined();
    expect(out.motion).toEqual({ transition: 'swipe', transitionDuration: 500 });
    expect(out.slides[0]!.duration).toBeGreaterThanOrEqual(3000);
    expect(out.slides[1]!.duration).toBeUndefined();
    // The original is untouched (pure).
    expect(doc.elements.every((e) => !e.animation)).toBe(true);
  });

  it('vibes pick different presets, and clearing removes them', () => {
    const playful = autoAnimate(doc, [0, 1], 'playful');
    expect(playful.elements.find((e) => e.id === 'big')!.animation!.enter!.preset).toBe('pop');
    expect(playful.elements.find((e) => e.id === 'other-slide')!.animation!.enter!.preset).toBe('pop');
    const glitchy = autoAnimate(doc, [0], 'glitchy');
    expect(glitchy.elements.find((e) => e.id === 'small')!.animation!.enter!.preset).toBe('typewriter');
    expect(glitchy.motion!.transition).toBe('cut');
    const cleared = clearAnimations(playful, [0]);
    expect(cleared.elements.filter((e) => e.animation).map((e) => e.id)).toEqual(['other-slide']);
  });
});
