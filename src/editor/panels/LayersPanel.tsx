'use client';

import { Reorder } from 'motion/react';
import { Eye, EyeOff, GripVertical, Layers, Lock, Unlock } from 'lucide-react';
import { useMemo, useState } from 'react';
import type { DesignElement } from '@/types/document';
import { slideIndexOf } from '@/projects/document';
import { EmptyState } from '@/components/ui/EmptyState';
import { cn } from '@/utils/cn';
import { elementLabel, expandToGroups, placeRelative, setHidden, setLocked, updateElements } from '../core/ops';
import { selectDoc, useEditor } from '../store';
import { ElementIcon } from './ElementIcon';

function LayerRow({
  el,
  slide,
  selected,
  groupEdge,
}: {
  el: DesignElement;
  slide: number;
  selected: boolean;
  groupEdge: 'none' | 'start' | 'mid' | 'end';
}) {
  const [renaming, setRenaming] = useState(false);
  const apply = useEditor((s) => s.apply);

  const onClick = (e: React.MouseEvent) => {
    const editor = useEditor.getState();
    const d = selectDoc(editor)!;
    const ids = e.metaKey || e.ctrlKey ? [el.id] : expandToGroups(d, [el.id]);
    if (e.shiftKey) editor.select([...new Set([...editor.selection, ...ids])]);
    else editor.select(ids);
    editor.setActiveSlide(slide);
  };

  return (
    <div
      className={cn(
        'group flex h-10 items-center gap-2 rounded-[10px] pr-1.5 pl-1 text-[13px] transition-colors',
        selected ? 'bg-accent/15 text-fg' : 'text-fg-muted hover:bg-surface-hover hover:text-fg',
        el.hidden && 'opacity-50',
      )}
    >
      <GripVertical className="size-3.5 shrink-0 cursor-grab text-fg-subtle opacity-0 group-hover:opacity-100" aria-hidden />
      {groupEdge !== 'none' && (
        <span
          aria-hidden
          className={cn(
            '-ml-1 w-1 self-stretch rounded-full bg-violet/60',
            groupEdge === 'start' && 'mt-2',
            groupEdge === 'end' && 'mb-2',
          )}
        />
      )}
      <ElementIcon el={el} className="size-4 shrink-0" />
      {renaming ? (
        <input
          autoFocus
          aria-label="Layer name"
          defaultValue={elementLabel(el)}
          maxLength={60}
          onBlur={(e) => {
            const name = e.target.value.trim();
            apply((d) => updateElements(d, [el.id], (x) => ({ ...x, name: name || undefined })));
            setRenaming(false);
          }}
          onKeyDown={(e) => {
            e.stopPropagation();
            if (e.key === 'Enter') e.currentTarget.blur();
            if (e.key === 'Escape') setRenaming(false);
          }}
          className="h-7 min-w-0 flex-1 rounded-[6px] border border-ring bg-bg-sunken px-1.5 text-[13px] outline-none"
        />
      ) : (
        <button
          type="button"
          onClick={onClick}
          onDoubleClick={() => setRenaming(true)}
          className="min-w-0 flex-1 truncate text-left"
          title="Click to select · double-click to rename"
        >
          {elementLabel(el)}
        </button>
      )}
      <span className="shrink-0 font-mono text-[10px] text-fg-muted">{String(slide + 1).padStart(2, '0')}</span>
      <button
        type="button"
        aria-label={el.locked ? `Unlock ${elementLabel(el)}` : `Lock ${elementLabel(el)}`}
        aria-pressed={Boolean(el.locked)}
        onClick={() => apply((d) => setLocked(d, [el.id], !el.locked))}
        className={cn(
          'flex size-7 shrink-0 items-center justify-center rounded-[7px] hover:bg-surface-active',
          !el.locked && 'opacity-0 group-hover:opacity-100 focus-visible:opacity-100',
        )}
      >
        {el.locked ? <Lock className="size-3.5" /> : <Unlock className="size-3.5" />}
      </button>
      <button
        type="button"
        aria-label={el.hidden ? `Show ${elementLabel(el)}` : `Hide ${elementLabel(el)}`}
        aria-pressed={Boolean(el.hidden)}
        onClick={() => apply((d) => setHidden(d, [el.id], !el.hidden))}
        className={cn(
          'flex size-7 shrink-0 items-center justify-center rounded-[7px] hover:bg-surface-active',
          !el.hidden && 'opacity-0 group-hover:opacity-100 focus-visible:opacity-100',
        )}
      >
        {el.hidden ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
      </button>
    </div>
  );
}

/** All layers, top-most first. Drag to reorder; groups share a violet bracket. */
export function LayersPanel() {
  const doc = useEditor(selectDoc);
  const selection = useEditor((s) => s.selection);
  const apply = useEditor((s) => s.apply);
  const activeSlide = useEditor((s) => s.activeSlide);
  const [onlySlide, setOnlySlide] = useState(false);
  const topFirst = useMemo(
    () => (doc ? [...doc.elements].reverse().filter((e) => !onlySlide || slideIndexOf(e, doc) === activeSlide) : []),
    [doc, onlySlide, activeSlide],
  );
  const [order, setOrder] = useState<string[]>([]);
  const key = topFirst.map((e) => e.id).join('|');
  const [synced, setSynced] = useState('');
  if (key !== synced) {
    setSynced(key);
    setOrder(topFirst.map((e) => e.id));
  }

  if (!doc) return null;
  const filter = doc.slides.length > 1 && (
    <div className="flex items-center justify-between gap-2 px-2 pb-1">
      <span className="text-[11px] font-bold tracking-[0.12em] text-fg-subtle uppercase">
        {onlySlide ? `Slide ${activeSlide + 1}` : 'All slides'}
      </span>
      <button
        type="button"
        aria-pressed={onlySlide}
        onClick={() => setOnlySlide((v) => !v)}
        className="h-7 rounded-full border border-line px-2.5 text-[11.5px] font-semibold text-fg-muted transition-colors hover:text-fg aria-pressed:border-transparent aria-pressed:bg-fg aria-pressed:text-bg"
      >
        Only this slide
      </button>
    </div>
  );
  if (topFirst.length === 0) {
    return (
      <div className="p-4">
        {filter}
        <EmptyState
          compact
          illustration={<Layers className="size-8 text-fg-subtle" />}
          title="No layers yet"
          description="Add text, shapes or stickers and they’ll stack up here."
        />
      </div>
    );
  }

  const byId = new Map(doc.elements.map((e) => [e.id, e]));
  const edge = (i: number): 'none' | 'start' | 'mid' | 'end' => {
    const el = byId.get(order[i]!);
    if (!el?.groupId) return 'none';
    const prev = byId.get(order[i - 1] ?? '')?.groupId === el.groupId;
    const next = byId.get(order[i + 1] ?? '')?.groupId === el.groupId;
    return prev && next ? 'mid' : prev ? 'end' : next ? 'start' : 'none';
  };

  return (
    <div className="p-2" data-testid="layers-panel">
      {filter}
      <Reorder.Group
        axis="y"
        values={order}
        onReorder={setOrder}
        className="flex flex-col gap-0.5"
        aria-label="Layers — drag to reorder"
      >
        {order.map((id, i) => {
          const el = byId.get(id);
          if (!el) return null;
          return (
            <Reorder.Item
              key={id}
              value={id}
              onDragEnd={() => {
                // `order` is top-first (and may be filtered to one slide), so
                // re-stack relative to the new neighbour rather than by index.
                const i = order.indexOf(id);
                const beneath = order[i + 1];
                const over = order[i - 1];
                if (beneath) apply((d) => placeRelative(d, id, beneath, 'above'));
                else if (over) apply((d) => placeRelative(d, id, over, 'below'));
              }}
              className="list-none"
            >
              <LayerRow el={el} slide={slideIndexOf(el, doc)} selected={selection.includes(id)} groupEdge={edge(i)} />
            </Reorder.Item>
          );
        })}
      </Reorder.Group>
    </div>
  );
}
