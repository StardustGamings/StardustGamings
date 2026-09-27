'use client';

import { Info, Play, Timer } from 'lucide-react';
import type { ImageElement } from '@/types/document';
import type { VideoClip } from '@/types/animation';
import { homeSlide } from '@/animations/sequence';
import { useAssets } from '@/assets/store';
import { canDevelopVideo } from '@/images/develop';
import { hasAdjustments } from '@/images/adjustments';
import { Segmented } from '@/components/ui/Segmented';
import { Slider } from '@/components/ui/Slider';
import { Switch } from '@/components/ui/Switch';
import { setSlideDuration } from '../animation-actions';
import { usePlayback } from '../playback';
import { selectDoc, useEditor } from '../store';
import { Row, Section } from './fields';
import { updateSelection } from './useSelection';

const SPEEDS = [0.5, 1, 1.5, 2] as const;
const secs = (s: number) => `${s.toFixed(1)}s`;

function patchClip(key: string, patch: Partial<VideoClip>) {
  updateSelection(`video-${key}`, (e) => (e.type === 'image' && e.video ? { ...e, video: { ...e.video, ...patch } } : e));
}

/** Trim, speed, sound and loop for a video in a frame. */
export function VideoSection({ el }: { el: ImageElement }) {
  const meta = useAssets((st) => st.assets.find((a) => a.id === el.assetId));
  const clip = el.video!;
  const total = meta?.duration ?? Math.max(clip.trimEnd, 1);
  const length = Math.max(0, clip.trimEnd - clip.trimStart);
  const plays = length / clip.speed;
  const filtered = Boolean(el.filter || el.effects || hasAdjustments(el.adjust));
  return (
    <Section
      title="Playback"
      action={
        <span className="font-mono text-[11px] text-fg-subtle tabular-nums" data-testid="clip-length">
          {secs(plays)} of {secs(total)}
        </span>
      }
    >
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between text-[13px]">
          <span className="text-fg-muted">Start</span>
          <span className="font-mono text-[12px] font-semibold tabular-nums">{secs(clip.trimStart)}</span>
        </div>
        <Slider
          aria-label="Trim start"
          value={clip.trimStart}
          min={0}
          max={Math.max(0, total - 0.2)}
          step={0.1}
          valueText={secs(clip.trimStart)}
          onChange={(v) => patchClip('start', { trimStart: Math.min(v, clip.trimEnd - 0.2) })}
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between text-[13px]">
          <span className="text-fg-muted">End</span>
          <span className="font-mono text-[12px] font-semibold tabular-nums">{secs(clip.trimEnd)}</span>
        </div>
        <Slider
          aria-label="Trim end"
          value={clip.trimEnd}
          min={0.2}
          max={total}
          step={0.1}
          valueText={secs(clip.trimEnd)}
          onChange={(v) => patchClip('end', { trimEnd: Math.max(v, clip.trimStart + 0.2) })}
        />
      </div>
      <Row label="Speed">
        <Segmented
          aria-label="Playback speed"
          size="sm"
          value={String(clip.speed)}
          onChange={(v) => patchClip('speed', { speed: Number(v) })}
          options={SPEEDS.map((s) => ({ value: String(s), label: `${s}×` }))}
        />
      </Row>
      <Row label="Sound">
        <Switch checked={!clip.muted} onCheckedChange={(on) => patchClip('muted', { muted: !on })} aria-label="Sound" />
      </Row>
      <Row label="Loop">
        <Switch checked={clip.loop} onCheckedChange={(loop) => patchClip('loop', { loop })} aria-label="Loop clip" />
      </Row>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => {
            const d = selectDoc(useEditor.getState());
            if (d) usePlayback.getState().play(homeSlide(d, el), true);
          }}
          className="flex h-9 flex-1 items-center justify-center gap-1.5 rounded-md border border-line-strong bg-surface-active text-[13px] font-semibold text-fg transition-colors hover:bg-surface-hover"
        >
          <Play className="size-4" /> Play
        </button>
        <button
          type="button"
          title="Make the slide exactly as long as the clip"
          onClick={() => {
            const d = selectDoc(useEditor.getState());
            if (d) setSlideDuration(homeSlide(d, el), plays * 1000, 'fit-clip');
          }}
          className="flex h-9 flex-1 items-center justify-center gap-1.5 rounded-md border border-line text-[12.5px] font-semibold text-fg-muted hover:border-line-strong hover:text-fg"
        >
          <Timer className="size-4" /> Fit slide
        </button>
      </div>
      {filtered && !canDevelopVideo() && (
        <p className="flex items-start gap-1.5 text-[11.5px] leading-snug text-warning">
          <Info className="mt-px size-3.5 shrink-0" />
          Looks and adjustments show on the still frame here, but this browser can’t apply them to moving video (it needs WebGL).
        </p>
      )}
    </Section>
  );
}
