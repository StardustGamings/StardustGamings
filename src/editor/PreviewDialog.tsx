'use client';

import { useState } from 'react';
import { CarouselPreview } from '@/components/carousel/CarouselPreview';
import { MotionPreview } from '@/components/carousel/MotionPreview';
import { Dialog } from '@/components/ui/Dialog';
import { Segmented } from '@/components/ui/Segmented';
import { useUi } from '@/settings/ui-store';
import { useSettings } from '@/settings/store';
import { usePlayback } from './playback';
import { selectDoc, useEditor } from './store';

/** Full-screen preview of the design being edited: swipe through it, or play it as a video. */
export function PreviewDialog() {
  const open = useUi((s) => s.carouselPreview);
  const setOpen = useUi((s) => s.setCarouselPreview);
  const doc = useEditor(selectDoc);
  const name = useSettings((s) => s.displayName);
  const [mode, setMode] = useState<'swipe' | 'play'>('swipe');
  if (!doc) return null;
  const aspect = doc.slideWidth / doc.slideHeight;
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (next) usePlayback.getState().stop();
        setOpen(next);
      }}
      size="md"
      title="Swipe preview"
      description={
        mode === 'swipe'
          ? 'Swipe, drag or use the arrow keys — this is how the carousel flows in a feed.'
          : 'Every slide with its animations and transitions — exactly what an MP4 or GIF export plays.'
      }
    >
      <div className="mx-auto flex flex-col gap-4" style={{ width: `min(100%, calc((68dvh - 150px) * ${aspect}))` }}>
        <Segmented
          aria-label="Preview mode"
          block
          size="sm"
          value={mode}
          onChange={setMode}
          options={[
            { value: 'swipe', label: 'Swipe' },
            { value: 'play', label: 'Play as video' },
          ]}
        />
        {open &&
          (mode === 'swipe' ? (
            <CarouselPreview doc={doc} handle={name?.trim() ? name.trim().toLowerCase().replace(/\s+/g, '.') : 'you'} />
          ) : (
            <MotionPreview doc={doc} />
          ))}
      </div>
    </Dialog>
  );
}
