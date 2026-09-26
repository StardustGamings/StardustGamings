'use client';

import {
  ChevronDown,
  Crop,
  Eye,
  FlipHorizontal2,
  FlipVertical2,
  ImagePlus,
  RotateCcw,
  RotateCw,
  WandSparkles,
} from 'lucide-react';
import { useState, type ReactNode } from 'react';
import type { ImageClip, ImageElement } from '@/types/document';
import { useAssetUrl } from '@/assets/useAssetUrl';
import { ADJUSTMENT_GROUPS, hasAdjustments, hasCurves, type AdjustmentDef } from '@/images/adjustments';
import { setCompare } from '@/images/resolver';
import { Segmented } from '@/components/ui/Segmented';
import { Slider } from '@/components/ui/Slider';
import { Switch } from '@/components/ui/Switch';
import { cn } from '@/utils/cn';
import { openPhotoPicker } from '../file-picker';
import {
  autoEnhance,
  enterCrop,
  flipPhoto,
  resetCurves,
  rotatePhoto90,
  setAdjustment,
  setAdjustments,
  setCurve,
  setFit,
  setPerspective,
} from '../photo-actions';
import { CurveEditor } from './CurveEditor';
import { EffectsSection, FiltersSection } from './FilterSections';
import { VideoSection } from './VideoSection';
import { ActionButton, FillField, IconToggle, NumberField, Row, Section } from './fields';
import { ClipGlyph } from './PhotosPanel';
import { updateSelection } from './useSelection';

const CLIPS: { id: ImageClip; label: string }[] = [
  { id: 'rect', label: 'Rectangle' },
  { id: 'ellipse', label: 'Circle' },
  { id: 'arch', label: 'Arch' },
  { id: 'heart', label: 'Heart' },
  { id: 'star', label: 'Star' },
  { id: 'hexagon', label: 'Hexagon' },
];

const setImage = (key: string, patch: Partial<ImageElement>) =>
  updateSelection(key, (e) => (e.type === 'image' ? { ...e, ...patch } : e));

/** Collapsible panel section (keeps the long list of photo tools scannable). */
function Disclosure({
  title,
  badge,
  defaultOpen = false,
  action,
  children,
}: {
  title: string;
  badge?: ReactNode;
  defaultOpen?: boolean;
  action?: ReactNode;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section className="border-b border-line last:border-b-0">
      <div className="flex items-center gap-2 px-4">
        <button
          type="button"
          aria-expanded={open}
          onClick={() => setOpen(!open)}
          className="flex h-12 min-w-0 flex-1 items-center gap-2 text-left"
        >
          <h3 className="font-sans text-[11px] font-bold tracking-[0.12em] text-fg-subtle uppercase">{title}</h3>
          {badge}
          <ChevronDown className={cn('ml-auto size-4 text-fg-subtle transition-transform', open && 'rotate-180')} />
        </button>
        {action}
      </div>
      {open && <div className="flex flex-col gap-3 px-4 pb-4">{children}</div>}
    </section>
  );
}

function AdjustSlider({ def, value, onChange }: { def: AdjustmentDef; value: number; onChange: (v: number) => void }) {
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-[12.5px]">
        <button
          type="button"
          className="text-fg-muted hover:text-fg"
          title="Double-click to reset"
          onDoubleClick={() => onChange(0)}
        >
          {def.label}
        </button>
        <span className={cn('font-mono text-[11.5px] tabular-nums', value ? 'text-fg' : 'text-fg-subtle')}>
          {value > 0 && def.min < 0 ? '+' : ''}
          {Math.round(value)}
        </span>
      </div>
      <Slider
        aria-label={def.label}
        min={def.min}
        max={def.max}
        value={value}
        onChange={onChange}
        origin={def.min < 0 ? 0 : undefined}
      />
    </div>
  );
}

function PhotoSection({ el }: { el: ImageElement }) {
  const url = useAssetUrl(el.assetId, 'thumb');
  if (!el.assetId) {
    return (
      <Section title="Photo">
        <button
          type="button"
          onClick={() => openPhotoPicker({ targetId: el.id, single: true })}
          className="flex h-24 flex-col items-center justify-center gap-1.5 rounded-[14px] border border-dashed border-line-strong text-[13px] font-semibold text-fg-muted transition-colors hover:border-accent hover:text-fg"
        >
          <ImagePlus className="size-5" />
          Add a photo to this frame
        </button>
        <p className="text-[12px] text-fg-subtle">Or drag one in from the Photos panel.</p>
      </Section>
    );
  }
  const kind = el.video ? 'video' : 'photo';
  return (
    <Section title={el.video ? 'Video' : 'Photo'}>
      <div className="flex items-center gap-3">
        <div className={cn('size-14 shrink-0 overflow-hidden rounded-[10px] border border-line', 'checkerboard')}>
          {/* eslint-disable-next-line @next/next/no-img-element -- local blob URL */}
          {url && <img src={url} alt="" className="size-full object-cover" />}
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          <button
            type="button"
            onClick={() => enterCrop()}
            className="flex h-9 items-center justify-center gap-2 rounded-[10px] bg-fg text-[13px] font-semibold text-bg transition-opacity hover:opacity-90"
          >
            <Crop className="size-4" /> Crop & position
          </button>
          <button
            type="button"
            onClick={() => openPhotoPicker({ targetId: el.id, single: true })}
            className="h-8 rounded-[10px] border border-line text-[12.5px] font-semibold text-fg-muted transition-colors hover:border-line-strong hover:text-fg"
          >
            Replace {kind}
          </button>
        </div>
      </div>
      <div className="flex gap-1.5">
        <ActionButton label="Rotate 90°" onClick={rotatePhoto90}>
          <RotateCw />
        </ActionButton>
        <ActionButton label="Flip horizontally" onClick={() => flipPhoto('x')}>
          <FlipHorizontal2 />
        </ActionButton>
        <ActionButton label="Flip vertically" onClick={() => flipPhoto('y')}>
          <FlipVertical2 />
        </ActionButton>
      </div>
      <Row label="Fit">
        <Segmented
          aria-label="Photo fit"
          size="sm"
          value={el.fit}
          onChange={(v) => setFit(v)}
          options={[
            { value: 'cover', label: 'Fill frame' },
            { value: 'contain', label: 'Show all' },
          ]}
        />
      </Row>
    </Section>
  );
}

function FrameSection({ el }: { el: ImageElement }) {
  const clip = el.clip ?? 'rect';
  return (
    <Section title="Frame">
      <div className="flex gap-1.5" role="radiogroup" aria-label="Frame shape">
        {CLIPS.map((c) => (
          <button
            key={c.id}
            type="button"
            role="radio"
            aria-checked={clip === c.id}
            aria-label={c.label}
            title={c.label}
            onClick={() => setImage('clip', { clip: c.id === 'rect' ? undefined : c.id })}
            className={cn(
              'flex h-9 flex-1 items-center justify-center rounded-[10px] border p-1 transition-colors',
              clip === c.id ? 'border-transparent bg-fg text-bg' : 'border-line text-fg-muted hover:border-line-strong',
            )}
          >
            <ClipGlyph clip={c.id} className="size-5 fill-current/30 stroke-current stroke-[3]" />
          </button>
        ))}
      </div>
      {clip === 'rect' && (
        <Row label="Corner radius">
          <NumberField
            label="Corner radius"
            glyph="R"
            className="w-28"
            value={Math.min(el.cornerRadius ?? 0, Math.min(el.width, el.height) / 2)}
            min={0}
            max={Math.min(el.width, el.height) / 2}
            onChange={(v) => setImage('radius', { cornerRadius: v || undefined })}
          />
        </Row>
      )}
      <Row label="Border">
        <Switch
          checked={Boolean(el.stroke)}
          aria-label="Photo border"
          onCheckedChange={(on) =>
            setImage('stroke-on', {
              stroke: on ? { color: '#FFFFFF', width: Math.max(4, Math.round(el.width * 0.02)) } : undefined,
            })
          }
        />
      </Row>
      {el.stroke && (
        <div className="flex gap-2">
          <FillField
            label="Border colour"
            solidOnly
            value={{ type: 'solid', color: el.stroke.color }}
            onChange={(f) => f?.type === 'solid' && setImage('stroke-c', { stroke: { ...el.stroke!, color: f.color } })}
          />
          <NumberField
            label="Border width"
            glyph="W"
            className="w-24"
            value={el.stroke.width}
            min={0}
            max={200}
            onChange={(v) => setImage('stroke-w', { stroke: { ...el.stroke!, width: v } })}
          />
        </div>
      )}
    </Section>
  );
}

function AdjustSection({ el }: { el: ImageElement }) {
  const edited = hasAdjustments(el.adjust);
  return (
    <Disclosure
      title="Adjust"
      defaultOpen
      badge={edited ? <span className="size-1.5 rounded-full bg-accent" aria-label="edited" /> : undefined}
    >
      <div className="flex gap-1.5">
        <button
          type="button"
          onClick={() => void autoEnhance()}
          className="flex h-9 flex-1 items-center justify-center gap-1.5 rounded-[10px] border border-line text-[12.5px] font-semibold transition-colors hover:border-accent"
        >
          <WandSparkles className="size-4 text-accent-text" /> Auto
        </button>
        <button
          type="button"
          disabled={!edited && !hasCurves(el.curves) && !el.filter && !el.effects}
          onPointerDown={() => setCompare(el.id)}
          onPointerUp={() => setCompare(null)}
          onPointerLeave={() => setCompare(null)}
          onPointerCancel={() => setCompare(null)}
          onKeyDown={(e) => (e.key === ' ' || e.key === 'Enter') && setCompare(el.id)}
          onKeyUp={() => setCompare(null)}
          onBlur={() => setCompare(null)}
          className="flex h-9 flex-1 items-center justify-center gap-1.5 rounded-[10px] border border-line text-[12.5px] font-semibold transition-colors select-none hover:border-line-strong disabled:opacity-40"
          title="Hold to see the original"
        >
          <Eye className="size-4" /> Hold to compare
        </button>
        <IconToggle label="Reset adjustments" pressed={false} onClick={() => setAdjustments(undefined)}>
          <RotateCcw />
        </IconToggle>
      </div>
      {ADJUSTMENT_GROUPS.map((g) => (
        <div key={g.title} className="flex flex-col gap-2.5">
          <p className="text-[11px] font-semibold text-fg-subtle">{g.title}</p>
          {g.items.map((def) => (
            <AdjustSlider key={def.key} def={def} value={el.adjust?.[def.key] ?? 0} onChange={(v) => setAdjustment(def.key, v)} />
          ))}
        </div>
      ))}
    </Disclosure>
  );
}

function CurvesSection({ el }: { el: ImageElement }) {
  const edited = hasCurves(el.curves);
  return (
    <Disclosure
      title="Curves"
      badge={edited ? <span className="size-1.5 rounded-full bg-accent" aria-label="edited" /> : undefined}
      action={
        edited ? (
          <button type="button" onClick={resetCurves} className="text-[12px] font-semibold text-fg-muted hover:text-fg">
            Reset
          </button>
        ) : undefined
      }
    >
      <CurveEditor curves={el.curves} onChange={setCurve} />
    </Disclosure>
  );
}

function PerspectiveSection({ el }: { el: ImageElement }) {
  const p = el.perspective;
  return (
    <Disclosure
      title="Perspective"
      badge={p ? <span className="size-1.5 rounded-full bg-accent" aria-label="edited" /> : undefined}
    >
      <p className="text-[12px] text-fg-subtle">Straighten leaning buildings and tilted screens.</p>
      <AdjustSlider
        def={{ key: 'exposure', label: 'Vertical', min: -100, max: 100 }}
        value={p?.vertical ?? 0}
        onChange={(v) => setPerspective('vertical', v)}
      />
      <AdjustSlider
        def={{ key: 'exposure', label: 'Horizontal', min: -100, max: 100 }}
        value={p?.horizontal ?? 0}
        onChange={(v) => setPerspective('horizontal', v)}
      />
    </Disclosure>
  );
}

/** Everything for a single selected image element. */
export function ImageSections({ el, cutout }: { el: ImageElement; cutout?: ReactNode }) {
  return (
    <>
      <PhotoSection el={el} />
      {el.video && el.assetId && <VideoSection el={el} />}
      <FrameSection el={el} />
      {el.assetId && (
        <>
          <FiltersSection el={el} />
          <AdjustSection el={el} />
          <EffectsSection el={el} />
          <CurvesSection el={el} />
          <PerspectiveSection el={el} />
          {/* Background removal works on stills only. */}
          {!el.video && cutout}
        </>
      )}
    </>
  );
}
