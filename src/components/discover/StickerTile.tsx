'use client';

import { Download } from 'lucide-react';
import { useMemo } from 'react';
import type { DesignDocument } from '@/types/document';
import { renderDocument } from '@/canvas/render';
import { ScenePreview } from '@/canvas/ScenePreview';
import { stickerName } from '@/stickers/library';
import { toast } from '@/components/ui/toast-store';

function stickerDoc(stickerId: string, size: number): DesignDocument {
  return {
    version: 1,
    slideWidth: size,
    slideHeight: size,
    background: { type: 'solid', color: 'rgba(0,0,0,0)' },
    slides: [{ id: 's', fill: null }],
    elements: [{ id: 'st', type: 'sticker', stickerId, x: 0, y: 0, width: size, height: size, rotation: 0, opacity: 1 }],
  };
}

async function downloadSticker(stickerId: string) {
  const size = 512;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  renderDocument(ctx, stickerDoc(stickerId, size), { scale: 1 });
  canvas.toBlob((blob) => {
    if (!blob) {
      toast({ title: 'Couldn’t render that sticker', tone: 'error' });
      return;
    }
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `stardeck-${stickerName(stickerId)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')}.png`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    toast({ title: 'Sticker saved', description: 'Transparent 512px PNG', tone: 'success' });
  }, 'image/png');
}

export function StickerTile({ stickerId }: { stickerId: string }) {
  const doc = useMemo(() => stickerDoc(stickerId, 200), [stickerId]);
  const name = stickerName(stickerId);
  return (
    <button
      type="button"
      onClick={() => void downloadSticker(stickerId)}
      className="group relative flex aspect-square w-full items-center justify-center rounded-lg border border-line bg-surface p-4 transition-[border-color,background-color] duration-150 hover:border-line-strong hover:bg-surface-hover"
      aria-label={`Download ${name} sticker as PNG`}
      title={`${name} — download PNG`}
    >
      <ScenePreview doc={doc} className="w-full transition-transform duration-200 group-hover:scale-105" />
      <span className="absolute right-2 bottom-2 flex size-6 items-center justify-center rounded-sm border border-line bg-bg-elevated text-fg-muted opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100 [@media(hover:none)]:opacity-100">
        <Download className="size-3.5" />
      </span>
    </button>
  );
}
