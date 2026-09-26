'use client';

import { ImagePlus, ShieldCheck } from 'lucide-react';
import { useEffect, useMemo, useRef } from 'react';
import type { AssetMeta } from '@/assets/types';
import { useAssets } from '@/assets/store';
import { useAssetUrl } from '@/assets/useAssetUrl';
import { Button } from '@/components/ui/Button';
import { Spinner } from '@/components/ui/Spinner';
import { cn } from '@/utils/cn';

function Tile({ asset, order, onToggle }: { asset: AssetMeta; order: number; onToggle: () => void }) {
  const url = useAssetUrl(asset.id, 'thumb');
  const selected = order > 0;
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={selected}
      aria-label={`${asset.name}${selected ? `, selected ${order}` : ''}`}
      onClick={onToggle}
      className={cn(
        'relative aspect-square overflow-hidden rounded-[12px] border-2 bg-surface transition-[transform,border-color]',
        selected ? 'scale-[0.94] border-accent' : 'border-transparent hover:border-line-strong',
      )}
    >
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element -- local blob URL
        <img src={url} alt="" draggable={false} className="size-full object-cover" />
      ) : (
        <span className="block size-full animate-pulse bg-surface-active" />
      )}
      <span
        aria-hidden
        className={cn(
          'absolute top-1.5 right-1.5 flex size-6 items-center justify-center rounded-full border-2 text-[11px] font-bold',
          selected ? 'border-accent bg-accent text-accent-fg' : 'border-white/80 bg-ink/30',
        )}
      >
        {selected ? order : null}
      </span>
    </button>
  );
}

/**
 * Multi-select from the local photo library (selection order is kept — it's
 * the order photos appear in), with import from the device.
 */
export function PhotoChooser({
  selected,
  onChange,
  max,
}: {
  selected: string[];
  onChange: (ids: string[]) => void;
  max: number;
}) {
  const load = useAssets((s) => s.load);
  const all = useAssets((s) => s.assets);
  const importing = useAssets((s) => s.importing);
  const importFiles = useAssets((s) => s.importFiles);
  const inputRef = useRef<HTMLInputElement>(null);
  const photos = useMemo(() => all.filter((a) => a.kind === 'photo'), [all]);
  useEffect(() => {
    void load();
  }, [load]);

  const toggle = (id: string) => {
    if (selected.includes(id)) onChange(selected.filter((x) => x !== id));
    else if (selected.length < max) onChange([...selected, id]);
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="primary" size="sm" icon={<ImagePlus className="size-4" />} onClick={() => inputRef.current?.click()}>
          Add from device
        </Button>
        {photos.length > 0 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onChange(selected.length ? [] : photos.slice(0, max).map((p) => p.id))}
          >
            {selected.length ? 'Clear' : `Select ${Math.min(max, photos.length)}`}
          </Button>
        )}
        {importing > 0 && (
          <span className="flex items-center gap-1.5 text-[12.5px] text-fg-muted">
            <Spinner className="size-3.5" label="Adding photos" /> Adding {importing}…
          </span>
        )}
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          multiple
          hidden
          data-testid="flow-photo-input"
          onChange={async (e) => {
            const files = [...(e.currentTarget.files ?? [])];
            e.currentTarget.value = '';
            const added = await importFiles(files, 'photo');
            const ids = added.map((a) => a.id).filter((id) => !selected.includes(id));
            onChange([...selected, ...ids].slice(0, max));
          }}
        />
      </div>
      <p className="flex items-center gap-1.5 text-[11.5px] text-fg-subtle">
        <ShieldCheck className="size-3.5 text-success" /> Everything happens on this device — nothing is uploaded.
      </p>
      {photos.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-[18px] border border-dashed border-line-strong px-6 py-10 text-center">
          <span className="text-3xl" aria-hidden>
            📸
          </span>
          <p className="text-sm font-semibold">No photos yet</p>
          <p className="max-w-xs text-[12.5px] text-fg-muted">Add a few from your device to get started.</p>
        </div>
      ) : (
        <div className="grid grid-cols-4 gap-2 sm:grid-cols-6" role="group" aria-label="Your photos" data-testid="photo-chooser">
          {photos.map((a) => (
            <Tile key={a.id} asset={a} order={selected.indexOf(a.id) + 1} onToggle={() => toggle(a.id)} />
          ))}
        </div>
      )}
      {selected.length >= max && <p className="text-[12px] text-fg-muted">That’s the maximum ({max}) for this one.</p>}
      {selected.length > 0 && (
        <p className="sr-only" aria-live="polite">
          {selected.length} selected
        </p>
      )}
    </div>
  );
}
