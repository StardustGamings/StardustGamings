'use client';

import { Dices, Eye, Lock, MousePointerSquareDashed, Unlink, Unlock } from 'lucide-react';
import type { CollageFamily, DesignElement, LayoutSpec } from '@/types/document';
import { FAMILY_LABELS, type CollageMood } from '@/layouts/collage';
import { Segmented } from '@/components/ui/Segmented';
import { Slider } from '@/components/ui/Slider';
import { Switch } from '@/components/ui/Switch';
import { cn } from '@/utils/cn';
import { useUi } from '@/settings/ui-store';
import {
  detachLayout,
  restyleCollage,
  selectLayoutMembers,
  setCollageChaos,
  setCollageDecor,
  setCollageFamily,
  setCollageGutter,
  shuffleLayout,
  toggleLayoutLock,
  updatePanorama,
} from '../layout-actions';
import { NumberField, Row, Section } from './fields';

const MOODS: { id: CollageMood; label: string }[] = [
  { id: 'chaotic', label: 'More chaotic' },
  { id: 'minimal', label: 'More minimal' },
  { id: 'aesthetic', label: 'More aesthetic' },
  { id: 'editorial', label: 'More editorial' },
  { id: 'genz', label: 'More Gen-Z' },
];

const FAMILIES = Object.keys(FAMILY_LABELS) as CollageFamily[];

function Chip({ onClick, children, active }: { onClick: () => void; children: React.ReactNode; active?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        'h-8 rounded-md border px-3 text-[12px] font-semibold transition-colors',
        active ? 'border-line-strong bg-surface-active text-fg' : 'border-line text-fg-muted hover:border-accent hover:text-fg',
      )}
    >
      {children}
    </button>
  );
}

/** Layout controls for a selection that belongs to a collage or seamless panorama. */
export function LayoutSection({ spec, els }: { spec: LayoutSpec; els: DesignElement[] }) {
  const openPreview = useUi((s) => s.setCarouselPreview);
  const single = els.length === 1 ? els[0]! : null;
  const lockable = single?.layout?.role === 'photo';
  const locked = Boolean(single?.layout?.locked);

  const common = (
    <div className="flex gap-1.5">
      <button
        type="button"
        onClick={() => selectLayoutMembers(spec.id)}
        className="flex h-8 flex-1 items-center justify-center gap-1.5 rounded-md border border-line text-[12px] font-semibold text-fg-muted transition-colors hover:border-line-strong hover:text-fg"
      >
        <MousePointerSquareDashed className="size-3.5" /> Select all
      </button>
      <button
        type="button"
        onClick={() => detachLayout(spec.id)}
        className="flex h-8 flex-1 items-center justify-center gap-1.5 rounded-md border border-line text-[12px] font-semibold text-fg-muted transition-colors hover:border-line-strong hover:text-fg"
        title="Keep the photos but stop treating them as one layout"
      >
        <Unlink className="size-3.5" /> Detach
      </button>
    </div>
  );

  if (spec.kind === 'panorama') {
    return (
      <Section title="Seamless swipe">
        <p className="-mt-1 text-[12px] text-fg-subtle">
          Photos flow across {spec.slides} slides — every swipe continues the last.
        </p>
        <div className="flex gap-1.5">
          <button
            type="button"
            onClick={shuffleLayout}
            className="flex h-9 flex-1 items-center justify-center gap-1.5 rounded-md border border-line-strong bg-surface-active text-[13px] font-semibold text-fg transition-colors hover:bg-surface-hover"
          >
            <Dices className="size-4" /> Shuffle order
          </button>
          <button
            type="button"
            onClick={() => openPreview(true)}
            className="flex h-9 flex-1 items-center justify-center gap-1.5 rounded-md border border-line text-[13px] font-semibold transition-colors hover:border-accent"
          >
            <Eye className="size-4" /> Preview swipe
          </button>
        </div>
        <Row label="Slides">
          <NumberField
            label="Panorama slides"
            glyph="#"
            className="w-24"
            value={spec.slides}
            min={1}
            max={10}
            onChange={(v) => updatePanorama({ slides: Math.round(v) })}
          />
        </Row>
        <div>
          <p className="mb-1 text-[12.5px] text-fg-muted">Spacing</p>
          <Slider
            aria-label="Panorama spacing"
            min={0}
            max={30}
            value={Math.round(spec.spacing * 100)}
            onChange={(v) => updatePanorama({ spacing: v / 100 }, 'pano-spacing')}
          />
        </div>
        <div>
          <p className="mb-1 text-[12.5px] text-fg-muted">Margin</p>
          <Slider
            aria-label="Panorama margin"
            min={0}
            max={35}
            value={Math.round(spec.margin * 100)}
            onChange={(v) => updatePanorama({ margin: v / 100 }, 'pano-margin')}
          />
        </div>
        <Segmented
          aria-label="Panorama alignment"
          size="sm"
          block
          value={spec.align}
          onChange={(align) => updatePanorama({ align })}
          options={[
            { value: 'center', label: 'Centre' },
            { value: 'top', label: 'Top' },
            { value: 'bottom', label: 'Bottom' },
            { value: 'stagger', label: 'Stagger' },
          ]}
        />
        <p className="text-[11.5px] text-fg-subtle">Double-click a photo to reposition it inside its frame.</p>
        {common}
      </Section>
    );
  }

  return (
    <Section title={`Collage · ${FAMILY_LABELS[spec.family]}`}>
      <button
        type="button"
        onClick={shuffleLayout}
        className="flex h-9 items-center justify-center gap-2 rounded-md border border-line-strong bg-surface-active text-[13px] font-semibold text-fg transition-colors hover:bg-surface-hover"
      >
        <Dices className="size-4" /> Shuffle
      </button>
      {lockable && (
        <button
          type="button"
          aria-pressed={locked}
          onClick={() => toggleLayoutLock(single!.id)}
          className={cn(
            'flex h-9 items-center justify-center gap-1.5 rounded-md border text-[12.5px] font-semibold transition-colors',
            locked ? 'border-accent bg-accent/10 text-fg' : 'border-line text-fg-muted hover:border-line-strong hover:text-fg',
          )}
        >
          {locked ? <Lock className="size-3.5" /> : <Unlock className="size-3.5" />}
          {locked ? 'Kept in place when shuffling' : 'Keep this photo in place'}
        </button>
      )}
      <div className="flex flex-wrap gap-1.5">
        {MOODS.map((m) => (
          <Chip key={m.id} onClick={() => restyleCollage(m.id)}>
            {m.label}
          </Chip>
        ))}
      </div>
      <div className="flex flex-wrap gap-1.5" role="group" aria-label="Collage style">
        {FAMILIES.map((f) => (
          <Chip key={f} active={spec.family === f} onClick={() => setCollageFamily(f)}>
            {FAMILY_LABELS[f]}
          </Chip>
        ))}
      </div>
      <div>
        <p className="mb-1 text-[12.5px] text-fg-muted">Spacing</p>
        <Slider
          aria-label="Collage spacing"
          min={0}
          max={80}
          value={Math.round(spec.gutter * 1000)}
          onChange={(v) => setCollageGutter(v / 1000)}
        />
      </div>
      {(spec.family === 'scrapbook' || spec.family === 'polaroid' || spec.family === 'filmstrip' || spec.family === 'grid') && (
        <div>
          <p className="mb-1 text-[12.5px] text-fg-muted">{spec.family === 'grid' ? 'Mix up the order' : 'Messiness'}</p>
          <Slider
            aria-label="Collage chaos"
            min={0}
            max={100}
            value={Math.round(spec.chaos * 100)}
            onChange={(v) => setCollageChaos(v / 100)}
          />
        </div>
      )}
      {(spec.family === 'scrapbook' || spec.family === 'polaroid') && (
        <Row label="Tape & stickers">
          <Switch checked={Boolean(spec.decor)} aria-label="Tape and stickers" onCheckedChange={setCollageDecor} />
        </Row>
      )}
      {common}
    </Section>
  );
}
