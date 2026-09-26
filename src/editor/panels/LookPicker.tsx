'use client';

import { Ban, Flame } from 'lucide-react';
import { useEffect, useMemo, useRef, useSyncExternalStore } from 'react';
import { assetsVersion, peekAsset, subscribeAssets } from '@/assets/cache';
import { isBuiltInLook, lookFilter, LOOKS, type LookDefinition } from '@/filters/looks';
import { useTrendLooks, useTrends } from '@/trends/store';
import { renderLookPreview } from '@/filters/preview';
import { cn } from '@/utils/cn';

const serverVersion = () => 0;

/** The photo with a look applied, drawn into a small canvas (or the look's swatch without a photo). */
function LookPreview({ assetId, look }: { assetId: string | null; look: LookDefinition | null }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const version = useSyncExternalStore(subscribeAssets, assetsVersion, serverVersion);
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas || !assetId) return;
    const asset = peekAsset(assetId, 'thumb');
    if (!asset) return;
    const preview = renderLookPreview(asset.image, look ? { filter: lookFilter(look, 100) } : {}, 160);
    if (!preview) return;
    canvas.width = preview.width;
    canvas.height = preview.height;
    canvas.getContext('2d')?.drawImage(preview, 0, 0);
  }, [assetId, look, version]);

  if (!assetId) {
    return (
      <span
        className="block size-full"
        style={{ background: look ? `linear-gradient(135deg, ${look.swatch[0]}, ${look.swatch[1]})` : undefined }}
      />
    );
  }
  return <canvas ref={ref} className="block size-full object-cover" aria-hidden />;
}

function LookTile({
  look,
  assetId,
  checked,
  onPick,
}: {
  look: LookDefinition;
  assetId: string | null;
  checked: boolean;
  onPick: (look: LookDefinition) => void;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={checked}
      aria-label={look.name}
      title={look.description || look.name}
      onClick={() => onPick(look)}
      className="group flex min-w-0 flex-col gap-1 text-left"
    >
      <span
        className={cn(
          'block aspect-square overflow-hidden rounded-[12px] border-2 transition-colors',
          checked ? 'border-accent' : 'border-transparent group-hover:border-line-strong',
        )}
      >
        <LookPreview assetId={assetId} look={look} />
      </span>
      <span className="truncate text-[11.5px] font-semibold">{look.name}</span>
    </button>
  );
}

/**
 * Grid of one-tap looks previewed on the photo: None, the 14 built-ins, and
 * `extra` looks (the current trend drop's, or a pack look already on the photo).
 * `value` is the active look id, `null` for none, or `'mixed'` across several photos.
 */
export function LookPicker({
  assetId,
  value,
  onPick,
  extra = [],
  extraLabel = 'Trending',
}: {
  assetId: string | null;
  value: string | null | 'mixed';
  onPick: (look: LookDefinition | null) => void;
  extra?: LookDefinition[];
  extraLabel?: string;
}) {
  return (
    <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Filters" data-testid="look-picker">
      <button
        type="button"
        role="radio"
        aria-checked={value === null}
        onClick={() => onPick(null)}
        className="group flex min-w-0 flex-col gap-1 text-left"
      >
        <span
          className={cn(
            'flex aspect-square items-center justify-center overflow-hidden rounded-[12px] border-2 bg-surface transition-colors',
            value === null ? 'border-accent' : 'border-line group-hover:border-line-strong',
          )}
        >
          {assetId ? <LookPreview assetId={assetId} look={null} /> : <Ban className="size-5 text-fg-subtle" />}
        </span>
        <span className="truncate text-[11.5px] font-semibold">None</span>
      </button>
      {LOOKS.map((look) => (
        <LookTile key={look.id} look={look} assetId={assetId} checked={value === look.id} onPick={onPick} />
      ))}
      {extra.length > 0 && (
        <>
          <p
            className="col-span-3 mt-1 flex items-center gap-1.5 text-[11px] font-bold tracking-[0.1em] text-fg-subtle uppercase"
            data-testid="trend-looks-label"
          >
            <Flame className="size-3.5 text-lime" aria-hidden /> {extraLabel}
          </p>
          {extra.map((look) => (
            <LookTile key={`x-${look.id}`} look={look} assetId={assetId} checked={value === look.id} onPick={onPick} />
          ))}
        </>
      )}
    </div>
  );
}

/**
 * Looks to offer besides the built-ins: the trend drop's, plus a pack look a
 * photo already wears from an older drop (it travels with the photo).
 */
export function usePickerExtras(current: LookDefinition | undefined): { looks: LookDefinition[]; label: string } {
  const trend = useTrendLooks();
  const title = useTrends((s) => s.pack.title);
  const looks = useMemo(
    () => (current && !isBuiltInLook(current.id) && !trend.some((l) => l.id === current.id) ? [...trend, current] : trend),
    [trend, current],
  );
  return { looks, label: `Trending · ${title}` };
}
