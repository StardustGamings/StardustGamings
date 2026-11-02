'use client';

import { Reorder } from 'motion/react';
import { ArrowLeftRight, Check, ChevronLeft, ChevronRight, Copy, MoreHorizontal, Plus, Trash2 } from 'lucide-react';
import { useRef, useState } from 'react';
import { ScenePreview } from '@/canvas/ScenePreview';
import { moveSlide } from '@/projects/document';
import { addSlide, deleteActiveSlide, duplicateActiveSlide, goToSlide } from './actions';
import { MAX_SLIDES } from '@/projects/formats';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { IconButton } from '@/components/ui/IconButton';
import { Menu, MenuContent, MenuItem, MenuSeparator, MenuTrigger } from '@/components/ui/Menu';
import { cn } from '@/utils/cn';
import { selectDoc, useEditor } from './store';

/** How long a finger rests on a thumbnail before the strip switches to reordering. */
const LONG_PRESS_MS = 450;

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
  // Touch: thumbnails scroll sideways, so dragging to reorder is its own mode (long-press or the menu).
  const [reordering, setReordering] = useState(false);
  const press = useRef<{ timer: number; x: number; y: number } | null>(null);
  const phone = !useMediaQuery('(min-width: 1024px)', true);

  if (!doc) return null;
  const count = doc.slides.length;
  const thumbH = 60;
  const thumbW = (doc.slideWidth / doc.slideHeight) * thumbH;

  const move = (dir: -1 | 1) => {
    apply((d) => moveSlide(d, active, active + dir));
    goToSlide(active + dir);
  };
  const cancelPress = () => {
    if (press.current) window.clearTimeout(press.current.timer);
    press.current = null;
  };

  return (
    <div
      className="z-10 flex shrink-0 items-center gap-2 border-t border-line bg-bg-elevated px-2 py-1.5 sm:px-3"
      data-testid="slide-strip"
      data-reordering={reordering || undefined}
    >
      <div className="hidden shrink-0 items-center lg:flex">
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
        <div className="ml-1 h-8 w-px shrink-0 bg-line" />
      </div>
      <Reorder.Group
        axis="x"
        values={order}
        onReorder={setOrder}
        className="hide-scrollbar flex min-w-0 flex-1 items-center gap-2 overflow-x-auto px-0.5 py-1.5"
        aria-label={reordering ? 'Slides — drag to reorder' : 'Slides'}
      >
        {order.map((id) => {
          const index = doc.slides.findIndex((s) => s.id === id);
          if (index < 0) return null;
          return (
            <Reorder.Item
              key={id}
              value={id}
              dragListener={!phone || reordering}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ type: 'spring', stiffness: 520, damping: 38 }}
              onDragEnd={() => {
                const to = order.indexOf(id);
                if (to !== index && to >= 0) {
                  apply((d) => moveSlide(d, index, to));
                  goToSlide(to);
                }
              }}
              className={cn(
                'relative shrink-0 cursor-grab active:cursor-grabbing',
                reordering ? 'touch-none' : 'max-lg:touch-pan-x',
              )}
              whileDrag={{ scale: 1.08, zIndex: 10 }}
            >
              <button
                type="button"
                onClick={() => goToSlide(index)}
                onPointerDown={(e) => {
                  if (e.pointerType !== 'touch' || reordering) return;
                  const timer = window.setTimeout(() => {
                    setReordering(true);
                    navigator.vibrate?.(10);
                  }, LONG_PRESS_MS);
                  press.current = { timer, x: e.clientX, y: e.clientY };
                }}
                onPointerMove={(e) => {
                  if (press.current && Math.hypot(e.clientX - press.current.x, e.clientY - press.current.y) > 8) cancelPress();
                }}
                onPointerUp={cancelPress}
                onPointerCancel={cancelPress}
                onContextMenu={(e) => e.preventDefault()}
                aria-label={`Slide ${index + 1}`}
                aria-current={index === active ? 'true' : undefined}
                className={cn(
                  'block overflow-hidden rounded-[4px] ring-offset-2 ring-offset-bg-elevated transition-shadow duration-150',
                  index === active ? 'ring-2 ring-accent' : 'ring-1 ring-line hover:ring-line-strong',
                  reordering && 'animate-[wiggle_0.5s_ease-in-out_infinite_alternate]',
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
              <span className="pointer-events-none absolute bottom-1 left-1 rounded-[3px] bg-ink/70 px-1 font-mono text-[9.5px] font-medium text-white">
                {index + 1}
              </span>
            </Reorder.Item>
          );
        })}
        {!reordering && (
          <li className="shrink-0 list-none">
            <button
              type="button"
              onClick={addSlide}
              disabled={count >= MAX_SLIDES}
              aria-label="Add slide"
              className="pressable flex items-center justify-center rounded-[4px] border border-dashed border-line-strong text-fg-muted hover:border-fg-subtle hover:text-fg disabled:opacity-40"
              style={{ width: thumbW, height: thumbH }}
            >
              <Plus className="size-5" />
            </button>
          </li>
        )}
      </Reorder.Group>
      <span className="hidden shrink-0 font-mono text-xs text-fg-subtle lg:block">
        {active + 1}/{count}
      </span>
      <div className="shrink-0 lg:hidden">
        {reordering ? (
          <button
            type="button"
            onClick={() => setReordering(false)}
            className="pressable flex h-10 items-center gap-1.5 rounded-md bg-accent-soft px-3 text-[13px] font-semibold text-accent-text"
          >
            <Check className="size-[18px]" /> Done
          </button>
        ) : (
          <Menu>
            <MenuTrigger asChild>
              <IconButton label="Slide options" icon={<MoreHorizontal />} tooltip={false} />
            </MenuTrigger>
            <MenuContent align="end" side="top">
              <MenuItem icon={<Copy />} disabled={count >= MAX_SLIDES} onSelect={duplicateActiveSlide}>
                Duplicate slide
              </MenuItem>
              <MenuItem icon={<ArrowLeftRight />} disabled={count < 2} onSelect={() => setReordering(true)}>
                Reorder slides
              </MenuItem>
              <MenuItem icon={<ChevronLeft />} disabled={active === 0} onSelect={() => move(-1)}>
                Move left
              </MenuItem>
              <MenuItem icon={<ChevronRight />} disabled={active >= count - 1} onSelect={() => move(1)}>
                Move right
              </MenuItem>
              <MenuSeparator />
              <MenuItem icon={<Trash2 />} destructive disabled={count <= 1} onSelect={deleteActiveSlide}>
                Delete slide
              </MenuItem>
            </MenuContent>
          </Menu>
        )}
      </div>
    </div>
  );
}
