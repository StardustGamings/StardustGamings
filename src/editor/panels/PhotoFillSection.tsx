'use client';

import { ImagePlus } from 'lucide-react';
import { useMemo } from 'react';
import type { TextElement, TextPhotoFill } from '@/types/document';
import { useAssets } from '@/assets/store';
import { useAssetUrl } from '@/assets/useAssetUrl';
import { Slider } from '@/components/ui/Slider';
import { Switch } from '@/components/ui/Switch';
import { cn } from '@/utils/cn';
import { useEditor } from '../store';
import { Section } from './fields';

function PhotoChoice({ id, selected, onPick }: { id: string; selected: boolean; onPick: () => void }) {
  const url = useAssetUrl(id, 'thumb');
  return (
    <button
      type="button"
      onClick={onPick}
      aria-pressed={selected}
      aria-label="Fill the text with this photo"
      className={cn(
        'aspect-square overflow-hidden rounded-[10px] border-2 transition-colors',
        selected ? 'border-accent' : 'border-transparent hover:border-line-strong',
      )}
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- local blob URL */}
      {url && <img src={url} alt="" className="size-full object-cover" />}
    </button>
  );
}

/**
 * Photo fill (a text mask): a photo from the library shows through the letters. It works with every font,
 * outline, shadow and warp; the text colour stands in while the photo loads.
 */
export function PhotoFillSection({ el, set }: { el: TextElement; set: (key: string, patch: Partial<TextElement>) => void }) {
  const assets = useAssets((s) => s.assets);
  const photos = useMemo(() => assets.filter((a) => a.kind === 'photo').slice(0, 12), [assets]);
  const setPanel = useEditor((s) => s.setPanel);
  const fill = el.photoFill;
  const update = (key: string, patch: Partial<TextPhotoFill>) => fill && set(key, { photoFill: { ...fill, ...patch } });
  const percent = (v: number | undefined) => Math.round((v ?? 0.5) * 100);

  return (
    <Section
      title="Photo fill"
      action={
        <Switch
          checked={Boolean(fill)}
          aria-label="Photo fill"
          disabled={!fill && photos.length === 0}
          onCheckedChange={(on) => set('photo-fill-on', { photoFill: on && photos[0] ? { assetId: photos[0].id } : undefined })}
        />
      }
    >
      {fill ? (
        <>
          <div className="grid grid-cols-4 gap-1.5">
            {photos.map((a) => (
              <PhotoChoice
                key={a.id}
                id={a.id}
                selected={a.id === fill.assetId}
                onPick={() => set('photo-fill-photo', { photoFill: { assetId: a.id } })}
              />
            ))}
          </div>
          <div>
            <p className="mb-1 text-[12.5px] text-fg-muted">Zoom · {Math.round((fill.zoom ?? 1) * 100)}%</p>
            <Slider
              aria-label="Photo zoom"
              min={100}
              max={400}
              value={Math.round((fill.zoom ?? 1) * 100)}
              onChange={(v) => update('photo-fill-zoom', { zoom: v / 100 })}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="mb-1 text-[12.5px] text-fg-muted">Across · {percent(fill.focusX)}%</p>
              <Slider
                aria-label="Photo position across"
                min={0}
                max={100}
                value={percent(fill.focusX)}
                onChange={(v) => update('photo-fill-x', { focusX: v / 100 })}
              />
            </div>
            <div>
              <p className="mb-1 text-[12.5px] text-fg-muted">Down · {percent(fill.focusY)}%</p>
              <Slider
                aria-label="Photo position down"
                min={0}
                max={100}
                value={percent(fill.focusY)}
                onChange={(v) => update('photo-fill-y', { focusY: v / 100 })}
              />
            </div>
          </div>
          <p className="text-[11.5px] leading-snug text-fg-subtle">
            Bold, heavy fonts show the most photo. The text colour stands in while it loads.
          </p>
        </>
      ) : photos.length === 0 ? (
        <div className="flex items-center justify-between gap-2">
          <p className="text-[11.5px] leading-snug text-fg-subtle">Add a photo to show it through the letters.</p>
          <button
            type="button"
            onClick={() => setPanel('photos')}
            className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full border border-line px-3 text-[12px] font-semibold transition-colors hover:border-accent"
          >
            <ImagePlus className="size-3.5" /> Photos
          </button>
        </div>
      ) : null}
    </Section>
  );
}
