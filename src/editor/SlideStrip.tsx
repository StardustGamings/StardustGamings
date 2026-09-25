'use client';

import { Reorder } from 'motion/react';
import { ChevronLeft, ChevronRight, Copy, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { ScenePreview } from '@/canvas/ScenePreview';
import { moveSlide } from '@/projects/document';
import { addSlide, deleteActiveSlide, duplicateActiveSlide, goToSlide } from './actions';
import { MAX_SLIDES } from '@/projects/formats';
import { IconButton } from '@/components/ui/IconButton';
import { cn } from '@/utils/cn';
import { selectDoc, useEditor } from './store';

export function SlideStrip() {
  const doc = useEditor(selectDoc);
  const active = useEditor((s) => s.activeSlide);
  const apply = useEditor((s) => s.apply);
  const ids = doc?.slides.map((s) => s.id) ?? [];
  const [order, setOrder] = useState(ids);
  const idsKey = ids.join('|');
  // Local drag order resyncs with the document whenever slides change.
  const [syncedKey, setSyncedKey] = useState(idsKey);
  if (idsKey !== syncedKey) {
    setSyncedKey(idsKey);
    setOrder(ids);
  }

  if (!doc) return null;
  const count = doc.slides.length;
  const thumbH = 64;
  const thumbW = (doc.slideWidth / doc.slideHeight) * thumbH;

  const move = (dir: -1 | 1) => {
    apply((d) => moveSlide(d, active, active + dir));
    goToSlide(active + dir);
  };

  return (
    <div
      className="z-10 flex shrink-0 items-center gap-2 border-x-0 border-b-0 px-2 py-2 glass-strong sm:px-3"
      data-testid="slide-strip"
    >
      <div className="flex shrink-0 items-center">
        <IconButton label="Move slide left" icon={<ChevronLeft />} size="sm" disabled={active === 0} onClick={() => move(-1)} />
        <IconButton
          label="Move slide right"
          icon={<ChevronRight />}
          size="sm"
          disabled={active >= count - 1}
          onClick={() => move(1)}
        />
        <IconButton
          label="Duplicate slide"
          icon={<Copy />}
          size="sm"
          disabled={count >= MAX_SLIDES}
          onClick={duplicateActiveSlide}
        />
        <IconButton label="Delete slide" icon={<Trash2 />} size="sm" disabled={count <= 1} onClick={deleteActiveSlide} />
      </div>
      <div className="h-8 w-px shrink-0 bg-line" />
      <Reorder.Group
        axis="x"
        values={order}
        onReorder={setOrder}
        className="hide-scrollbar flex min-w-0 flex-1 items-center gap-2 overflow-x-auto py-1"
        aria-label="Slides — drag to reorder"
      >
        {order.map((id) => {
          const index = doc.slides.findIndex((s) => s.id === id);
          if (index < 0) return null;
          return (
            <Reorder.Item
              key={id}
              value={id}
              onDragEnd={() => {
                const to = order.indexOf(id);
                if (to !== index && to >= 0) {
                  apply((d) => moveSlide(d, index, to));
                  goToSlide(to);
                }
              }}
              className="relative shrink-0 cursor-grab touch-pan-x active:cursor-grabbing"
              whileDrag={{ scale: 1.08, zIndex: 10 }}
            >
              <button
                type="button"
                onClick={() => goToSlide(index)}
                aria-label={`Slide ${index + 1}`}
                aria-current={index === active ? 'true' : undefined}
                className={cn(
                  'block overflow-hidden rounded-[8px] ring-offset-2 ring-offset-bg-elevated transition-shadow',
                  index === active ? 'ring-2 ring-accent' : 'ring-1 ring-line hover:ring-line-strong',
                )}
                style={{ width: thumbW, height: thumbH }}
              >
                <ScenePreview
                  doc={doc}
                  slide={index}
                  eager
                  maxDpr={1.5}
                  fit="contain"
                  className="size-full"
                  style={{ width: thumbW, height: thumbH }}
                />
              </button>
              <span className="pointer-events-none absolute bottom-1 left-1 rounded-[5px] bg-ink/75 px-1 font-mono text-[9px] font-bold text-white">
                {index + 1}
              </span>
            </Reorder.Item>
          );
        })}
        <li className="shrink-0 list-none">
          <button
            type="button"
            onClick={addSlide}
            disabled={count >= MAX_SLIDES}
            aria-label="Add slide"
            className="flex items-center justify-center rounded-[8px] border-2 border-dashed border-line-strong text-fg-muted transition-colors hover:border-accent hover:text-accent-text disabled:opacity-40"
            style={{ width: thumbW, height: thumbH }}
          >
            <Plus className="size-5" />
          </button>
        </li>
      </Reorder.Group>
      <span className="hidden shrink-0 font-mono text-xs text-fg-subtle sm:block">
        {active + 1}/{count}
      </span>
    </div>
  );
}
