'use client';

import { Check, FlipHorizontal2, FlipVertical2, RotateCcw, RotateCw, X } from 'lucide-react';
import type { ReactNode } from 'react';
import type { ImageElement } from '@/types/document';
import { Slider } from '@/components/ui/Slider';
import { cn } from '@/utils/cn';
import { getElements } from './core/ops';
import {
  assetMetaSync,
  cancelCrop,
  commitCrop,
  CROP_ASPECTS,
  flipPhoto,
  resetCrop,
  rotatePhoto90,
  setCropAspect,
  setPhotoZoom,
  setStraighten,
} from './photo-actions';
import { selectDoc, useEditor } from './store';

function Tool({ label, onClick, children }: { label: string; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className="flex size-9 shrink-0 items-center justify-center rounded-md text-fg-muted transition-colors hover:bg-surface-hover hover:text-fg [&_svg]:size-4"
    >
      {children}
    </button>
  );
}

/** Controls for crop mode: aspect ratios, zoom, straighten, rotate/flip, done/cancel. */
export function CropBar({ layout }: { layout: 'floating' | 'docked' }) {
  const croppingId = useEditor((s) => s.croppingId);
  const doc = useEditor(selectDoc);
  const el = croppingId && doc ? (getElements(doc, [croppingId])[0] as ImageElement | undefined) : undefined;
  if (!el || el.type !== 'image') return null;
  const meta = assetMetaSync(el.assetId);
  const ratio = el.width / el.height;
  const original = meta ? (el.turns && el.turns % 2 ? meta.height / meta.width : meta.width / meta.height) : null;
  const activeAspect =
    CROP_ASPECTS.find((a) => {
      const r = a.ratio === 'original' ? original : a.ratio;
      return r !== null && Math.abs(r - ratio) < 0.01;
    })?.id ?? 'free';

  return (
    <div
      role="toolbar"
      aria-label="Crop"
      data-testid="crop-bar"
      data-canvas-ignore
      className={cn(
        'z-30 flex flex-col gap-2 glass-strong',
        layout === 'floating'
          ? 'absolute top-3 left-1/2 hidden w-[min(640px,calc(100%-24px))] -translate-x-1/2 rounded-lg p-2.5 shadow-[var(--shadow-float)] lg:flex'
          : 'shrink-0 border-x-0 border-b-0 px-3 pt-2.5 pb-2 safe-bottom lg:hidden',
      )}
    >
      <div className="hide-scrollbar flex items-center gap-1 overflow-x-auto" role="radiogroup" aria-label="Aspect ratio">
        {CROP_ASPECTS.map((a) => (
          <button
            key={a.id}
            type="button"
            role="radio"
            aria-checked={activeAspect === a.id}
            onClick={() => a.ratio !== null && setCropAspect(a.ratio)}
            className={cn(
              'h-8 shrink-0 rounded-md px-3 text-[12px] font-semibold transition-colors',
              activeAspect === a.id ? 'bg-surface-active text-fg' : 'text-fg-muted hover:bg-surface-hover hover:text-fg',
            )}
          >
            {a.label}
          </button>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <label className="flex min-w-[150px] flex-1 items-center gap-2 text-[12px] text-fg-muted">
          Zoom
          <Slider
            aria-label="Photo zoom"
            min={100}
            max={500}
            value={Math.round((el.zoom ?? 1) * 100)}
            valueText={`${Math.round((el.zoom ?? 1) * 100)}%`}
            onChange={(v) => setPhotoZoom(v / 100)}
          />
        </label>
        <label className="flex min-w-[150px] flex-1 items-center gap-2 text-[12px] text-fg-muted">
          Straighten
          <Slider
            aria-label="Straighten"
            min={-45}
            max={45}
            step={0.5}
            origin={0}
            value={el.straighten ?? 0}
            valueText={`${el.straighten ?? 0}°`}
            onChange={setStraighten}
          />
          <span className="w-9 text-right font-mono text-[11px] tabular-nums">{(el.straighten ?? 0).toFixed(1)}°</span>
        </label>
      </div>
      <div className="flex items-center gap-1">
        <Tool label="Rotate 90°" onClick={rotatePhoto90}>
          <RotateCw />
        </Tool>
        <Tool label="Flip horizontally" onClick={() => flipPhoto('x')}>
          <FlipHorizontal2 />
        </Tool>
        <Tool label="Flip vertically" onClick={() => flipPhoto('y')}>
          <FlipVertical2 />
        </Tool>
        <Tool label="Reset crop" onClick={resetCrop}>
          <RotateCcw />
        </Tool>
        <span className="flex-1" />
        <button
          type="button"
          onClick={cancelCrop}
          className="flex h-9 items-center gap-1.5 rounded-md px-3 text-[13px] font-semibold text-fg-muted transition-colors hover:bg-surface-hover hover:text-fg"
        >
          <X className="size-4" /> Cancel
        </button>
        <button
          type="button"
          onClick={commitCrop}
          className="flex h-9 items-center gap-1.5 rounded-md bg-accent px-4 text-[13px] font-bold text-accent-fg transition-transform active:scale-95"
        >
          <Check className="size-4" /> Done
        </button>
      </div>
    </div>
  );
}
