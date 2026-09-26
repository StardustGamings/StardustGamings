'use client';

import { Ban } from 'lucide-react';
import { useEffect, useRef, useSyncExternalStore } from 'react';
import { assetsVersion, peekAsset, subscribeAssets } from '@/assets/cache';
import { LOOKS, type LookDefinition } from '@/filters/looks';
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
    const preview = renderLookPreview(asset.image, look ? { filter: { id: look.id, intensity: 100 } } : {}, 160);
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

/**
 * Grid of one-tap looks previewed on the photo (None + the 14 built-ins).
 * `value` is the active look id, `null` for none, or `'mixed'` across several photos.
 */
export function LookPicker({
  assetId,
  value,
  onPick,
}: {
  assetId: string | null;
  value: string | null | 'mixed';
  onPick: (id: string | null) => void;
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
        <button
          key={look.id}
          type="button"
          role="radio"
          aria-checked={value === look.id}
          aria-label={look.name}
          title={look.description}
          onClick={() => onPick(look.id)}
          className="group flex min-w-0 flex-col gap-1 text-left"
        >
          <span
            className={cn(
              'block aspect-square overflow-hidden rounded-[12px] border-2 transition-colors',
              value === look.id ? 'border-accent' : 'border-transparent group-hover:border-line-strong',
            )}
          >
            <LookPreview assetId={assetId} look={look} />
          </span>
          <span className="truncate text-[11.5px] font-semibold">{look.name}</span>
        </button>
      ))}
    </div>
  );
}
