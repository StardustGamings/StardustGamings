'use client';

import { ImagePlus, ShieldCheck, Trash2 } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import type { ImageClip } from '@/types/document';
import type { AssetKind, AssetMeta } from '@/assets/types';
import { useAssets } from '@/assets/store';
import { assetUsage, documentAssetIds } from '@/assets/repository';
import { useAssetUrl } from '@/assets/useAssetUrl';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Spinner } from '@/components/ui/Spinner';
import { toast } from '@/components/ui/toast-store';
import { cn } from '@/utils/cn';
import { FRAME_PRESETS } from '../core/factory';
import { DND_TYPE, type DragItem } from '../dnd';
import { openPhotoPicker } from '../file-picker';
import { addFrame, fillFrame, placePhotos, selectedImage } from '../photo-actions';
import { selectDoc, useEditor } from '../store';

const dragProps = (item: DragItem) => ({
  draggable: true,
  onDragStart: (e: React.DragEvent) => {
    e.dataTransfer.setData(DND_TYPE, JSON.stringify(item));
    e.dataTransfer.effectAllowed = 'copy';
  },
});

/** Frame outline preview drawn with the same geometry idea as the renderer's clip paths. */
export function ClipGlyph({
  clip,
  ratio = 1,
  radius = 0,
  className,
}: {
  clip: ImageClip;
  ratio?: number;
  radius?: number;
  className?: string;
}) {
  const w = ratio >= 1 ? 40 : 40 * ratio;
  const h = ratio >= 1 ? 40 / ratio : 40;
  const x = (48 - w) / 2;
  const y = (48 - h) / 2;
  const star = (points: number, inner: number) => {
    const count = inner >= 1 ? points : points * 2;
    return Array.from({ length: count }, (_, i) => {
      const r = inner >= 1 || i % 2 === 0 ? 1 : inner;
      const a = -Math.PI / 2 + (i * 2 * Math.PI) / count;
      return `${x + w / 2 + (Math.cos(a) * r * w) / 2},${y + h / 2 + (Math.sin(a) * r * h) / 2}`;
    }).join(' ');
  };
  return (
    <svg viewBox="0 0 48 48" className={className} aria-hidden>
      {clip === 'rect' && <rect x={x} y={y} width={w} height={h} rx={radius * Math.min(w, h)} />}
      {clip === 'ellipse' && <ellipse cx={24} cy={24} rx={w / 2} ry={h / 2} />}
      {clip === 'arch' && <path d={`M${x} ${y + h} V${y + w / 2} A${w / 2} ${w / 2} 0 0 1 ${x + w} ${y + w / 2} V${y + h} Z`} />}
      {clip === 'heart' && (
        <path
          d={`M${x + w * 0.5} ${y + h * 0.96} C${x + w * 0.1} ${y + h * 0.7} ${x - w * 0.02} ${y + h * 0.42} ${x + w * 0.06} ${y + h * 0.22} C${x + w * 0.15} ${y + h * 0.02} ${x + w * 0.42} ${y - h * 0.02} ${x + w * 0.5} ${y + h * 0.2} C${x + w * 0.58} ${y - h * 0.02} ${x + w * 0.85} ${y + h * 0.02} ${x + w * 0.94} ${y + h * 0.22} C${x + w * 1.02} ${y + h * 0.42} ${x + w * 0.9} ${y + h * 0.7} ${x + w * 0.5} ${y + h * 0.96} Z`}
        />
      )}
      {clip === 'star' && <polygon points={star(5, 0.5)} />}
      {clip === 'hexagon' && <polygon points={star(6, 1)} />}
    </svg>
  );
}

function AssetTile({
  asset,
  used,
  onAdd,
  onDelete,
}: {
  asset: AssetMeta;
  used: boolean;
  onAdd: () => void;
  onDelete: () => void;
}) {
  const url = useAssetUrl(asset.id, 'thumb');
  return (
    <div className="group relative">
      <button
        type="button"
        aria-label={`Add ${asset.name}`}
        title={asset.name}
        {...dragProps({ kind: 'photo', assetId: asset.id })}
        onClick={onAdd}
        className={cn(
          'block aspect-square w-full overflow-hidden rounded-[12px] border border-line transition-transform hover:scale-[1.03] hover:border-line-strong',
          asset.hasAlpha ? 'checkerboard' : 'bg-surface',
        )}
      >
        {url ? (
          // eslint-disable-next-line @next/next/no-img-element -- local blob URL, not optimisable
          <img
            src={url}
            alt=""
            draggable={false}
            className={cn('size-full', asset.kind === 'sticker' ? 'object-contain p-1.5' : 'object-cover')}
          />
        ) : (
          <span className="block size-full animate-pulse bg-surface-active" />
        )}
      </button>
      {used && (
        <span
          className="pointer-events-none absolute bottom-1.5 left-1.5 size-2 rounded-full bg-accent ring-2 ring-bg"
          title="Used in this design"
          aria-hidden
        />
      )}
      <button
        type="button"
        aria-label={`Delete ${asset.name} from this device`}
        onClick={onDelete}
        className="absolute top-1 right-1 flex size-7 items-center justify-center rounded-full bg-ink/70 text-white opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100 focus-visible:opacity-100 [@media(pointer:coarse)]:opacity-100"
      >
        <Trash2 className="size-3.5" />
      </button>
    </div>
  );
}

/** Library grid shared by the Photos and Stickers panels. */
export function AssetLibrary({ kind, emptyText }: { kind: Exclude<AssetKind, 'mask'>; emptyText: string }) {
  const load = useAssets((s) => s.load);
  const all = useAssets((s) => s.assets);
  const remove = useAssets((s) => s.remove);
  const doc = useEditor(selectDoc);
  const [pending, setPending] = useState<{ asset: AssetMeta; projects: number } | null>(null);
  useEffect(() => {
    void load();
  }, [load]);
  const assets = useMemo(() => all.filter((a) => a.kind === kind), [all, kind]);
  const inDoc = useMemo(() => (doc ? documentAssetIds(doc) : new Set<string>()), [doc]);

  const add = (asset: AssetMeta) => {
    const target = selectedImage();
    // Tapping a photo while an empty frame is selected fills that frame.
    if (target && !target.assetId && !target.locked && asset.kind === 'photo') fillFrame(target.id, asset);
    else placePhotos([asset]);
  };

  const askDelete = async (asset: AssetMeta) => {
    const usage = await assetUsage();
    setPending({ asset, projects: usage.get(asset.id)?.length ?? 0 });
  };

  if (assets.length === 0) {
    return <p className="px-4 py-6 text-center text-[13px] leading-relaxed text-fg-muted">{emptyText}</p>;
  }
  return (
    <>
      <div className="grid grid-cols-3 gap-2 px-4 pb-4" data-testid={`${kind}-library`}>
        {assets.map((a) => (
          <AssetTile key={a.id} asset={a} used={inDoc.has(a.id)} onAdd={() => add(a)} onDelete={() => void askDelete(a)} />
        ))}
      </div>
      <ConfirmDialog
        open={pending !== null}
        onOpenChange={(open) => !open && setPending(null)}
        title={`Delete this ${kind === 'sticker' ? 'sticker' : 'photo'} from your device?`}
        description={
          pending && pending.projects > 0
            ? `It’s used in ${pending.projects} design${pending.projects === 1 ? '' : 's'} — those frames will become empty.`
            : 'It isn’t used in any design. This can’t be undone.'
        }
        confirmLabel="Delete"
        destructive
        onConfirm={async () => {
          if (!pending) return;
          await remove([pending.asset.id]);
          toast({ title: 'Deleted from this device', tone: 'success', duration: 2200 });
        }}
      />
    </>
  );
}

export function PhotosPanel() {
  const importing = useAssets((s) => s.importing);
  return (
    <div data-testid="photos-panel">
      <div className="flex flex-col gap-2 p-4">
        <Button variant="primary" block icon={<ImagePlus className="size-4" />} onClick={() => openPhotoPicker()}>
          Add photos
        </Button>
        <p className="flex items-start gap-1.5 text-[11.5px] leading-snug text-fg-subtle">
          <ShieldCheck className="mt-px size-3.5 shrink-0 text-success" />
          Photos stay on this device. Drop files anywhere on the canvas, or paste with {'⌘/Ctrl'} V.
        </p>
        {importing > 0 && (
          <p role="status" className="flex items-center gap-2 text-[12.5px] font-semibold text-fg-muted">
            <Spinner className="size-4 text-accent-text" label="" /> Adding {importing} photo{importing === 1 ? '' : 's'}…
          </p>
        )}
      </div>

      <h3 className="px-4 pt-1 text-[11px] font-bold tracking-[0.12em] text-fg-subtle uppercase">Frames</h3>
      <p className="px-4 pt-1 text-[12px] text-fg-subtle">Add a frame, then drop a photo into it.</p>
      <div className="grid grid-cols-5 gap-2 p-4">
        {FRAME_PRESETS.map((f) => (
          <button
            key={f.id}
            type="button"
            aria-label={`Add ${f.name.toLowerCase()} frame`}
            title={`${f.name} frame`}
            {...dragProps({ kind: 'frame', presetId: f.id })}
            onClick={() => addFrame(f)}
            className="flex aspect-square items-center justify-center rounded-[12px] border border-line bg-surface p-1.5 text-fg-muted transition-colors hover:border-line-strong hover:text-fg"
          >
            <ClipGlyph clip={f.clip} ratio={f.ratio} radius={f.radius} className="size-full fill-current/25 stroke-current" />
          </button>
        ))}
      </div>

      <h3 className="px-4 pt-1 pb-3 text-[11px] font-bold tracking-[0.12em] text-fg-subtle uppercase">Your photos</h3>
      <AssetLibrary kind="photo" emptyText="No photos yet. Add some from your device — they never leave it." />
    </div>
  );
}
