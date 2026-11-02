'use client';

import { AnimatePresence, motion, useDragControls } from 'motion/react';
import {
  Aperture,
  ArrowDown,
  ArrowUp,
  Check,
  Copy,
  Crop,
  Dices,
  Flame,
  Grid3x3,
  Image as ImageIcon,
  ImageUp,
  LayoutGrid,
  LayoutTemplate,
  Layers,
  Lock,
  Magnet,
  Maximize,
  Maximize2,
  MoreHorizontal,
  PaintBucket,
  PenLine,
  Play,
  ScanLine,
  Shapes,
  SlidersHorizontal,
  Sparkles,
  Trash2,
  Type,
  Unlock,
  WandSparkles,
  X,
} from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { create } from 'zustand';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { useUi } from '@/settings/ui-store';
import { IconButton } from '@/components/ui/IconButton';
import { Segmented } from '@/components/ui/Segmented';
import { cn } from '@/utils/cn';
import * as actions from './actions';
import { openPhotoPicker } from './file-picker';
import { shuffleLayout } from './layout-actions';
import { PANEL_TITLES, PanelContent } from './panel-content';
import { useSelectedElements } from './panels/useSelection';
import { enterCrop } from './photo-actions';
import { useEditor, type PanelId } from './store';

/*
 * The phone editor's chrome: a bottom toolbar (tools, or actions for what's selected) and one
 * bottom sheet for whichever tool is open. The canvas stays visible above the sheet: a framed
 * slide re-fits as the sheet opens, resizes or closes.
 */

const SPRING = { type: 'spring', stiffness: 520, damping: 42 } as const;

/** Whether the More tools sheet is open (the slide strip steps aside while any sheet is up). */
export const useMoreTools = create<{ open: boolean; setOpen: (open: boolean) => void }>()((set) => ({
  open: false,
  setOpen: (open) => set({ open }),
}));

/** Shapes and stickers share the Elements tool; it reopens on the one used last. */
let lastElements: 'shapes' | 'stickers' = 'shapes';

const PRIMARY: { label: string; icon: ReactNode; panels: PanelId[]; open: () => PanelId }[] = [
  { label: 'Templates', icon: <LayoutTemplate />, panels: ['templates'], open: () => 'templates' },
  { label: 'Text', icon: <Type />, panels: ['text'], open: () => 'text' },
  { label: 'Photos', icon: <ImageIcon />, panels: ['photos'], open: () => 'photos' },
  { label: 'Elements', icon: <Shapes />, panels: ['shapes', 'stickers'], open: () => lastElements },
  { label: 'Background', icon: <PaintBucket />, panels: ['design'], open: () => 'design' },
];

/** The rest of the tools, in the More sheet. */
const MORE_PANELS: { panel: PanelId; label: string; icon: ReactNode }[] = [
  { panel: 'layouts', label: 'Layouts', icon: <LayoutGrid /> },
  { panel: 'filters', label: 'Filters', icon: <Aperture /> },
  { panel: 'animate', label: 'Animate', icon: <Sparkles /> },
  { panel: 'trends', label: 'Trends', icon: <Flame /> },
  { panel: 'magic', label: 'Magic', icon: <WandSparkles /> },
  { panel: 'layers', label: 'Layers', icon: <Layers /> },
];

/** One slot in the bottom toolbar: icon over label, with a soft highlight that slides to the active tool. */
function ToolSlot({
  label,
  icon,
  active,
  onClick,
  highlightId,
}: {
  label: string;
  icon: ReactNode;
  active?: boolean;
  onClick: () => void;
  highlightId: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      aria-pressed={active}
      className={cn(
        'relative flex h-[58px] min-w-[54px] flex-1 pressable flex-col items-center justify-center gap-1 text-[10.5px] font-medium tracking-[-0.01em]',
        active ? 'text-fg' : 'text-fg-muted',
      )}
    >
      {active && (
        <motion.span
          layoutId={highlightId}
          className="absolute inset-x-1 inset-y-1 rounded-md bg-surface-active"
          transition={SPRING}
        />
      )}
      <span className={cn('relative transition-colors duration-150 [&_svg]:size-[22px]', active && 'text-accent-text')}>
        {icon}
      </span>
      <span className="relative max-w-full truncate px-0.5">{label}</span>
    </button>
  );
}

/** Phone: tools, or contextual actions while something is selected. */
function MobileToolbar({ moreOpen, onMore }: { moreOpen: boolean; onMore: (open: boolean) => void }) {
  const panel = useEditor((s) => s.panel);
  const setPanel = useEditor((s) => s.setPanel);
  const selected = useSelectedElements();
  const toggle = (p: PanelId) => {
    onMore(false);
    setPanel(panel === p ? null : p);
  };

  if (selected.length > 0) {
    const single = selected.length === 1 ? selected[0]! : null;
    const locked = selected.every((e) => e.locked);
    return (
      <nav
        aria-label="Selection actions"
        className="relative z-20 shrink-0 border-t border-line bg-bg-elevated safe-bottom lg:hidden"
      >
        <motion.div
          key="selection"
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.18, ease: [0.2, 0, 0, 1] }}
          className="flex items-stretch"
        >
          <div className="hide-scrollbar flex min-w-0 flex-1 overflow-x-auto px-1">
            <ToolSlot
              highlightId="selection-active"
              label="Edit"
              icon={<SlidersHorizontal />}
              active={panel === 'properties'}
              onClick={() => toggle('properties')}
            />
            {single?.type === 'text' && !single.locked && (
              <ToolSlot
                highlightId="selection-active"
                label="Text"
                icon={<PenLine />}
                onClick={() => useEditor.getState().setEditingText(single.id)}
              />
            )}
            {selected.some((e) => e.type === 'image' && e.assetId && !e.locked) && (
              <ToolSlot
                highlightId="selection-active"
                label="Filters"
                icon={<Aperture />}
                active={panel === 'filters'}
                onClick={() => toggle('filters')}
              />
            )}
            {single?.type === 'image' && !single.locked && single.assetId && (
              <ToolSlot highlightId="selection-active" label="Crop" icon={<Crop />} onClick={() => enterCrop(single.id)} />
            )}
            {single?.type === 'image' && !single.locked && (
              <ToolSlot
                highlightId="selection-active"
                label={single.assetId ? 'Replace' : 'Add photo'}
                icon={<ImageUp />}
                onClick={() => openPhotoPicker({ targetId: single.id, single: true })}
              />
            )}
            <ToolSlot
              highlightId="selection-active"
              label="Animate"
              icon={<Sparkles />}
              active={panel === 'animate'}
              onClick={() => toggle('animate')}
            />
            {selected.some((e) => e.layout) && (
              <ToolSlot highlightId="selection-active" label="Shuffle" icon={<Dices />} onClick={shuffleLayout} />
            )}
            <ToolSlot highlightId="selection-active" label="Duplicate" icon={<Copy />} onClick={actions.duplicateSelection} />
            <ToolSlot
              highlightId="selection-active"
              label="Forward"
              icon={<ArrowUp />}
              onClick={() => actions.reorder('forward')}
            />
            <ToolSlot
              highlightId="selection-active"
              label="Back"
              icon={<ArrowDown />}
              onClick={() => actions.reorder('backward')}
            />
            <ToolSlot
              highlightId="selection-active"
              label={locked ? 'Unlock' : 'Lock'}
              icon={locked ? <Unlock /> : <Lock />}
              onClick={actions.toggleLock}
            />
            <ToolSlot highlightId="selection-active" label="Delete" icon={<Trash2 />} onClick={actions.deleteSelection} />
          </div>
          <div className="flex shrink-0 items-center border-l border-line px-2">
            <button
              type="button"
              aria-label="Done"
              onClick={() => useEditor.getState().clearSelection()}
              className="flex h-11 pressable items-center gap-1.5 rounded-md bg-accent-soft px-3 text-[13px] font-semibold text-accent-text"
            >
              <Check className="size-[18px]" />
              Done
            </button>
          </div>
        </motion.div>
      </nav>
    );
  }

  return (
    <nav aria-label="Tools" className="relative z-20 shrink-0 border-t border-line bg-bg-elevated safe-bottom lg:hidden">
      <div className="flex px-1">
        {PRIMARY.map((t) => (
          <ToolSlot
            key={t.label}
            highlightId="tool-active"
            label={t.label}
            icon={t.icon}
            active={!moreOpen && panel !== null && t.panels.includes(panel)}
            onClick={() => {
              onMore(false);
              const target = t.open();
              setPanel(panel !== null && t.panels.includes(panel) ? null : target);
            }}
          />
        ))}
        <ToolSlot
          highlightId="tool-active"
          label="More"
          icon={<MoreHorizontal />}
          active={moreOpen || (panel !== null && MORE_PANELS.some((m) => m.panel === panel))}
          onClick={() => {
            if (moreOpen) onMore(false);
            else {
              setPanel(null);
              onMore(true);
            }
          }}
        />
      </div>
    </nav>
  );
}

/** A square tile in the More sheet. */
function MoreTile({ label, icon, onClick, pressed }: { label: string; icon: ReactNode; onClick: () => void; pressed?: boolean }) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={pressed}
      onClick={onClick}
      className={cn(
        'flex h-[76px] pressable flex-col items-center justify-center gap-1.5 rounded-lg text-[12px] font-medium',
        pressed ? 'bg-accent-soft text-accent-text' : 'bg-surface-active text-fg-muted hover:text-fg',
      )}
    >
      <span className="[&_svg]:size-[22px]">{icon}</span>
      {label}
    </button>
  );
}

function MoreTools({ onPick }: { onPick: () => void }) {
  const setPanel = useEditor((s) => s.setPanel);
  const showGrid = useEditor((s) => s.showGrid);
  const showSafeArea = useEditor((s) => s.showSafeArea);
  const snapping = useEditor((s) => s.snapping);
  const ed = useEditor.getState();
  return (
    <div className="px-4 pb-5" data-testid="more-tools">
      <p className="mb-2 text-label">Tools</p>
      <div className="grid grid-cols-3 gap-2">
        {MORE_PANELS.map((m) => (
          <MoreTile
            key={m.panel}
            label={m.label}
            icon={m.icon}
            onClick={() => {
              onPick();
              setPanel(m.panel);
            }}
          />
        ))}
      </div>
      <p className="mt-5 mb-2 text-label">View</p>
      <div className="grid grid-cols-3 gap-2">
        <MoreTile label="Fit" icon={<Maximize />} onClick={() => actions.fitSlide()} />
        <MoreTile label="Grid" icon={<Grid3x3 />} pressed={showGrid} onClick={ed.toggleGrid} />
        <MoreTile label="Safe areas" icon={<ScanLine />} pressed={showSafeArea} onClick={ed.toggleSafeArea} />
        <MoreTile label="Snapping" icon={<Magnet />} pressed={snapping} onClick={ed.toggleSnapping} />
        <MoreTile
          label="Swipe preview"
          icon={<Play />}
          onClick={() => {
            onPick();
            useUi.getState().setCarouselPreview(true);
          }}
        />
        <MoreTile
          label="Resize"
          icon={<Maximize2 />}
          onClick={() => {
            onPick();
            useUi.getState().openResize();
          }}
        />
      </div>
    </div>
  );
}

/** Phone: one sheet for the open tool. Drag its handle down to close, up to make it taller. */
function MobileSheet({ more, onMore }: { more: boolean; onMore: (open: boolean) => void }) {
  const panel = useEditor((s) => s.panel);
  const setPanel = useEditor((s) => s.setPanel);
  const hasSelection = useEditor((s) => s.selection.length > 0);
  const phone = !useMediaQuery('(min-width: 1024px)', true);
  const drag = useDragControls();
  const [expanded, setExpanded] = useState(false);

  const panelOpen = panel !== null && !(panel === 'properties' && !hasSelection);
  const open = phone && (more || panelOpen);
  const contentKey = more ? 'more' : panel;
  const title = more ? 'More tools' : panel ? PANEL_TITLES[panel] : '';
  const elements = !more && (panel === 'shapes' || panel === 'stickers');

  const close = () => {
    onMore(false);
    setPanel(null);
    setExpanded(false);
  };

  return (
    <AnimatePresence initial={false} onExitComplete={() => setExpanded(false)}>
      {open && (
        <motion.section
          key="sheet"
          aria-label={title}
          initial={{ height: 0 }}
          animate={{ height: 'auto' }}
          exit={{ height: 0 }}
          transition={{ type: 'spring', stiffness: 420, damping: 44 }}
          className="relative z-10 shrink-0 overflow-hidden lg:hidden"
          data-testid="mobile-sheet"
        >
          <motion.div
            drag="y"
            dragControls={drag}
            dragListener={false}
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0.06, bottom: 0.85 }}
            dragSnapToOrigin
            onDragEnd={(_, info) => {
              if (info.offset.y > 80 || info.velocity.y > 500) close();
              else if (info.offset.y < -36 || info.velocity.y < -400) setExpanded(true);
              else if (expanded && info.offset.y > 28) setExpanded(false);
            }}
            animate={{ maxHeight: expanded ? '82dvh' : '46dvh' }}
            transition={SPRING}
            className="flex flex-col rounded-t-xl border-t border-line bg-bg-elevated shadow-[var(--shadow-sheet)]"
          >
            <div
              className="shrink-0 cursor-grab touch-none active:cursor-grabbing"
              onPointerDown={(e) => {
                if (!(e.target as HTMLElement).closest('button')) drag.start(e);
              }}
            >
              <div aria-hidden className="mx-auto mt-2 h-[5px] w-9 rounded-full bg-line-strong" />
              <div className="flex h-11 items-center justify-between gap-2 pr-1.5 pl-4">
                {elements ? (
                  <Segmented
                    size="sm"
                    aria-label="Elements"
                    value={panel as 'shapes' | 'stickers'}
                    onChange={(p) => {
                      lastElements = p;
                      setPanel(p);
                    }}
                    options={[
                      { value: 'shapes', label: 'Shapes' },
                      { value: 'stickers', label: 'Stickers' },
                    ]}
                  />
                ) : (
                  <h2 className="text-[15px] font-semibold tracking-[-0.01em]">{title}</h2>
                )}
                <IconButton label="Close panel" icon={<X />} size="sm" tooltip={false} onClick={close} />
              </div>
            </div>
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={contentKey}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.16, ease: [0.2, 0, 0, 1] }}
                className="min-h-0 flex-1 overflow-y-auto overscroll-contain"
              >
                {more ? <MoreTools onPick={() => onMore(false)} /> : panel && <PanelContent panel={panel} />}
              </motion.div>
            </AnimatePresence>
          </motion.div>
        </motion.section>
      )}
    </AnimatePresence>
  );
}

/** Everything below the canvas on a phone. Desktop uses the rail, flyout and inspector instead. */
export function MobileEditorChrome() {
  const more = useMoreTools((s) => s.open);
  const setMore = useMoreTools((s) => s.setOpen);
  return (
    <>
      <MobileSheet more={more} onMore={setMore} />
      <MobileToolbar moreOpen={more} onMore={setMore} />
    </>
  );
}
