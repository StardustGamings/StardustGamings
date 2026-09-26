'use client';

import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, Ban, Pause, Play, Repeat, Sparkles, Timer, Wand2 } from 'lucide-react';
import type { CSSProperties, ReactNode } from 'react';
import { useState } from 'react';
import type { Direction, EnterPreset, ExitPreset, LoopPreset } from '@/types/animation';
import { AUTO_VIBES, type AutoVibe } from '@/animations/auto';
import { ENTER_PRESETS, EXIT_PRESETS, LOOP_PRESETS } from '@/animations/engine';
import { DEFAULT_MOTION, slideDuration } from '@/animations/sequence';
import { Button } from '@/components/ui/Button';
import { Segmented } from '@/components/ui/Segmented';
import { Slider } from '@/components/ui/Slider';
import { cn } from '@/utils/cn';
import * as anim from '../animation-actions';
import { formatSeconds, usePlayback } from '../playback';
import { selectDoc, useEditor } from '../store';
import { Section } from './fields';
import { useSelectedElements } from './useSelection';

const DIRECTIONS: { value: Direction; label: string; icon: ReactNode }[] = [
  { value: 'up', label: 'Up', icon: <ArrowUp className="size-4" /> },
  { value: 'down', label: 'Down', icon: <ArrowDown className="size-4" /> },
  { value: 'left', label: 'Left', icon: <ArrowLeft className="size-4" /> },
  { value: 'right', label: 'Right', icon: <ArrowRight className="size-4" /> },
];

function PresetTile({
  label,
  hint,
  keyframes,
  checked,
  loop,
  onPick,
}: {
  label: string;
  hint: string;
  keyframes: string | null;
  checked: boolean;
  loop?: boolean;
  onPick: () => void;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={checked}
      aria-label={label}
      title={hint}
      onClick={onPick}
      data-loop={loop || undefined}
      className={cn(
        'anim-tile flex flex-col items-center gap-1.5 rounded-[12px] border p-2 text-[11px] font-semibold transition-colors',
        checked
          ? 'border-transparent bg-accent/15 text-fg ring-1 ring-accent'
          : 'border-line text-fg-muted hover:border-line-strong hover:text-fg',
      )}
      style={keyframes ? ({ '--anim': keyframes } as CSSProperties) : undefined}
    >
      <span className="flex size-9 items-center justify-center overflow-hidden rounded-[9px] bg-bg-sunken">
        {keyframes ? (
          <span className="anim-dot to-nova flex size-6 items-center justify-center rounded-[7px] bg-gradient-to-br from-accent font-display text-[10px] font-extrabold text-ink">
            Aa
          </span>
        ) : (
          <Ban className="size-4 text-fg-subtle" />
        )}
      </span>
      <span className="truncate">{label}</span>
    </button>
  );
}

function TimeSlider({
  label,
  value,
  onChange,
  min,
  max,
  step = 50,
}: {
  label: string;
  value: number;
  onChange: (ms: number) => void;
  min: number;
  max: number;
  step?: number;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between text-[13px]">
        <span className="text-fg-muted">{label}</span>
        <span className="font-mono text-[12px] font-semibold tabular-nums">{formatSeconds(value)}</span>
      </div>
      <Slider
        aria-label={label}
        value={value}
        onChange={onChange}
        min={min}
        max={max}
        step={step}
        valueText={formatSeconds(value)}
      />
    </div>
  );
}

function DirectionPicker({
  value,
  onChange,
  label = 'Direction',
}: {
  value: Direction;
  onChange: (d: Direction) => void;
  label?: string;
}) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-[13px] text-fg-muted">{label}</span>
      <div role="radiogroup" aria-label={label} className="flex gap-1">
        {DIRECTIONS.map((d) => (
          <button
            key={d.value}
            type="button"
            role="radio"
            aria-checked={value === d.value}
            aria-label={d.label}
            onClick={() => onChange(d.value)}
            className={cn(
              'flex size-8 items-center justify-center rounded-[9px] border transition-colors',
              value === d.value ? 'border-transparent bg-fg text-bg' : 'border-line text-fg-muted hover:text-fg',
            )}
          >
            {d.icon}
          </button>
        ))}
      </div>
    </div>
  );
}

/** Play / pause the active slide, loop, and (on phones) scrub. */
function Transport() {
  const doc = useEditor(selectDoc);
  const active = useEditor((s) => s.activeSlide);
  const { slide, time, playing, loop } = usePlayback();
  if (!doc) return null;
  const duration = slideDuration(doc, active);
  const here = slide === active;
  return (
    <div className="flex flex-col gap-2 border-b border-line px-4 py-3">
      <div className="flex items-center gap-2">
        <Button
          size="sm"
          variant="primary"
          icon={playing && here ? <Pause className="size-4" /> : <Play className="size-4" />}
          onClick={() => (playing && here ? usePlayback.getState().pause() : usePlayback.getState().play(active))}
          data-testid="play-slide"
        >
          {playing && here ? 'Pause' : `Play slide ${active + 1}`}
        </Button>
        <button
          type="button"
          aria-pressed={loop}
          aria-label="Loop preview"
          title="Loop preview"
          onClick={() => usePlayback.getState().setLoop(!loop)}
          className={cn(
            'flex size-8 items-center justify-center rounded-[10px] transition-colors [&_svg]:size-4',
            loop ? 'bg-surface-active text-fg' : 'text-fg-muted hover:bg-surface-hover hover:text-fg',
          )}
        >
          <Repeat />
        </button>
        <span className="ml-auto font-mono text-[12px] text-fg-muted tabular-nums" data-testid="playhead-time">
          {formatSeconds(here ? time : 0)} / {formatSeconds(duration)}
        </span>
      </div>
      {/* The desktop timeline scrubs too; this slider keeps it reachable on phones. */}
      <Slider
        aria-label="Preview time"
        value={here ? time : 0}
        min={0}
        max={duration}
        step={10}
        onChange={(t) => usePlayback.getState().seek(active, t)}
        className="lg:hidden"
      />
    </div>
  );
}

function AutoAnimate() {
  const [scope, setScope] = useState<'slide' | 'all'>('all');
  const multi = useEditor((s) => (s.history?.present.slides.length ?? 1) > 1);
  return (
    <Section title="Auto-animate">
      <p className="text-[12.5px] leading-snug text-fg-muted">
        One tap gives everything an entrance that suits it — then tweak anything.
      </p>
      {multi && (
        <Segmented
          aria-label="Animate"
          block
          size="sm"
          value={scope}
          onChange={setScope}
          options={[
            { value: 'all', label: 'All slides' },
            { value: 'slide', label: 'This slide' },
          ]}
        />
      )}
      <div className="grid grid-cols-3 gap-2">
        {(Object.keys(AUTO_VIBES) as AutoVibe[]).map((vibe) => (
          <button
            key={vibe}
            type="button"
            title={AUTO_VIBES[vibe].hint}
            onClick={() => anim.autoAnimateSlides(multi ? scope : 'all', vibe)}
            className="flex flex-col items-center gap-1 rounded-[12px] border border-line px-2 py-2.5 text-[12px] font-bold transition-colors hover:border-accent hover:bg-accent/10"
          >
            <Wand2 className="size-4 text-accent-text" />
            {AUTO_VIBES[vibe].label}
          </button>
        ))}
      </div>
      <button
        type="button"
        onClick={() => anim.clearSlideAnimations(multi ? scope : 'all')}
        className="self-start text-[12px] font-semibold text-fg-muted underline-offset-2 hover:text-fg hover:underline"
      >
        Remove animations
      </button>
    </Section>
  );
}

function ElementMotion() {
  const selected = useSelectedElements().filter((e) => !e.locked);
  if (selected.length === 0) {
    return (
      <Section title="Selected">
        <p className="text-[12.5px] leading-snug text-fg-muted">
          Select something on the canvas to give it its own entrance, exit or loop.
        </p>
      </Section>
    );
  }
  const ids = selected.map((e) => e.id);
  const first = selected[0]!;
  const enter = first.animation?.enter;
  const exit = first.animation?.exit;
  const loop = first.animation?.loop;
  const title = selected.length === 1 ? 'Entrance' : `Entrance · ${selected.length} selected`;

  return (
    <>
      <Section title={title}>
        <div role="radiogroup" aria-label="Entrance" className="grid grid-cols-4 gap-1.5" data-testid="enter-presets">
          <PresetTile label="None" hint="No entrance" keyframes={null} checked={!enter} onPick={() => anim.setEnter(ids, null)} />
          {(Object.keys(ENTER_PRESETS) as EnterPreset[]).map((p) => (
            <PresetTile
              key={p}
              label={ENTER_PRESETS[p].label}
              hint={ENTER_PRESETS[p].hint}
              keyframes={`sd-${p}`}
              checked={enter?.preset === p}
              onPick={() => anim.setEnter(ids, p)}
            />
          ))}
        </div>
        {enter && (
          <>
            {ENTER_PRESETS[enter.preset].directional && (
              <DirectionPicker
                value={enter.direction ?? 'up'}
                onChange={(direction) => anim.patchEnter(ids, { direction }, 'enter-dir')}
              />
            )}
            <TimeSlider
              label="Delay"
              value={enter.delay}
              min={0}
              max={10_000}
              onChange={(delay) => anim.patchEnter(ids, { delay })}
            />
            <TimeSlider
              label="Duration"
              value={enter.duration}
              min={100}
              max={5000}
              onChange={(duration) => anim.patchEnter(ids, { duration })}
            />
          </>
        )}
      </Section>

      <Section title="Exit">
        <div role="radiogroup" aria-label="Exit" className="grid grid-cols-4 gap-1.5">
          <PresetTile
            label="None"
            hint="Stays until the slide ends"
            keyframes={null}
            checked={!exit}
            onPick={() => anim.setExit(ids, null)}
          />
          {(Object.keys(EXIT_PRESETS) as ExitPreset[]).map((p) => (
            <PresetTile
              key={p}
              label={EXIT_PRESETS[p].label}
              hint={EXIT_PRESETS[p].hint}
              keyframes={`sd-${p}`}
              checked={exit?.preset === p}
              onPick={() =>
                anim.setExit(ids, {
                  preset: p,
                  duration: exit?.duration ?? EXIT_PRESETS[p].duration,
                  ...(EXIT_PRESETS[p].directional ? { direction: exit?.direction ?? 'up' } : {}),
                })
              }
            />
          ))}
        </div>
        {exit && (
          <>
            {EXIT_PRESETS[exit.preset].directional && (
              <DirectionPicker
                value={exit.direction ?? 'up'}
                onChange={(direction) => anim.patchExit(ids, { direction }, 'exit-dir')}
              />
            )}
            <TimeSlider
              label="Exit duration"
              value={exit.duration}
              min={100}
              max={3000}
              onChange={(duration) => anim.patchExit(ids, { duration })}
            />
          </>
        )}
      </Section>

      <Section title="Loop">
        <div role="radiogroup" aria-label="Loop" className="grid grid-cols-4 gap-1.5">
          <PresetTile
            label="None"
            hint="No continuous motion"
            keyframes={null}
            checked={!loop}
            onPick={() => anim.setLoop(ids, null)}
          />
          {(Object.keys(LOOP_PRESETS) as LoopPreset[]).map((p) => (
            <PresetTile
              key={p}
              label={LOOP_PRESETS[p].label}
              hint={LOOP_PRESETS[p].hint}
              keyframes={`sd-${p}`}
              loop
              checked={loop?.preset === p}
              onPick={() =>
                anim.setLoop(ids, {
                  preset: p,
                  intensity: loop?.intensity ?? 60,
                  ...(LOOP_PRESETS[p].directional ? { direction: loop?.direction ?? 'left' } : {}),
                })
              }
            />
          ))}
        </div>
        {loop && (
          <>
            {LOOP_PRESETS[loop.preset].directional && (
              <DirectionPicker
                label="Drift"
                value={loop.direction ?? 'left'}
                onChange={(direction) => anim.setLoop(ids, { ...loop, direction }, 'loop-dir')}
              />
            )}
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between text-[13px]">
                <span className="text-fg-muted">Intensity</span>
                <span className="font-mono text-[12px] font-semibold tabular-nums">{Math.round(loop.intensity)}</span>
              </div>
              <Slider
                aria-label="Loop intensity"
                value={loop.intensity}
                min={0}
                max={100}
                onChange={(intensity) => anim.setLoop(ids, { ...loop, intensity }, 'loop-intensity')}
              />
            </div>
          </>
        )}
      </Section>
    </>
  );
}

function SlideTiming() {
  const doc = useEditor(selectDoc);
  const active = useEditor((s) => s.activeSlide);
  if (!doc) return null;
  const motion = doc.motion ?? DEFAULT_MOTION;
  const multi = doc.slides.length > 1;
  return (
    <Section
      title={multi ? `Slide ${active + 1} timing` : 'Timing'}
      action={
        <button
          type="button"
          onClick={() => anim.fitSlideToAnimations(active)}
          className="flex items-center gap-1 text-[12px] font-semibold text-accent-text hover:underline"
          title="Long enough for every entrance, plus a beat to read it"
        >
          <Timer className="size-3.5" /> Fit
        </button>
      }
    >
      <TimeSlider
        label={multi ? 'Slide length' : 'Length'}
        value={slideDuration(doc, active)}
        min={500}
        max={15_000}
        step={100}
        onChange={(ms) => anim.setSlideDuration(active, ms)}
      />
      {multi && (
        <>
          <div className="flex flex-col gap-1.5">
            <span className="text-[13px] text-fg-muted">Between slides</span>
            <Segmented
              aria-label="Transition"
              block
              size="sm"
              value={motion.transition}
              onChange={(transition) => anim.setMotion({ transition })}
              options={[
                { value: 'swipe', label: 'Swipe' },
                { value: 'fade', label: 'Fade' },
                { value: 'zoom', label: 'Zoom' },
                { value: 'cut', label: 'Cut' },
              ]}
            />
          </div>
          {motion.transition !== 'cut' && (
            <TimeSlider
              label="Transition"
              value={motion.transitionDuration}
              min={100}
              max={1500}
              onChange={(transitionDuration) => anim.setMotion({ transitionDuration }, 'transition-duration')}
            />
          )}
        </>
      )}
      <p className="flex items-start gap-1.5 text-[11.5px] leading-snug text-fg-subtle">
        <Sparkles className="mt-px size-3.5 shrink-0 text-accent-text" />
        Motion plays in MP4 and GIF exports. Still images show everything in place.
      </p>
    </Section>
  );
}

export function AnimatePanel() {
  return (
    <div data-testid="animate-panel">
      <Transport />
      <ElementMotion />
      <AutoAnimate />
      <SlideTiming />
    </div>
  );
}
