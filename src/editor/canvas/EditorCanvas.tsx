'use client';

import {
  ArrowDownToLine,
  ArrowUpToLine,
  ClipboardPaste,
  Copy,
  EyeOff,
  Group,
  Lock,
  MousePointerSquareDashed,
  Scissors,
  Trash2,
  Type,
  Ungroup,
  Unlock,
} from 'lucide-react';
import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { stripRegion } from '@/canvas/render';
import { useClientValue } from '@/hooks/useClientValue';
import { modKey } from '@/hooks/useHotkeys';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from '@/components/ui/ContextMenu';
import * as actions from '../actions';
import { SHAPE_PRESETS, TEXT_PRESETS } from '../core/factory';
import { getElements } from '../core/ops';
import { screenToDoc, useCamera } from '../camera';
import { selectDoc, useEditor } from '../store';
import { Overlay, Readout } from './Overlay';
import { Rulers } from './Rulers';
import { TextEditor } from './TextEditor';
import { useCanvasInteractions } from './useCanvasInteractions';
import { useSceneRenderer } from './useSceneRenderer';
import { DND_TYPE, type DragItem } from '../dnd';

export function EditorCanvas() {
  const viewportRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const handlers = useCanvasInteractions(viewportRef);
  const showRulers = useEditor((s) => s.showRulers);
  const tool = useEditor((s) => s.tool);
  const slideCount = useEditor((s) => selectDoc(s)?.slides.length ?? 0);
  const slideWidth = useEditor((s) => selectDoc(s)?.slideWidth ?? 0);
  const selection = useEditor((s) => s.selection);
  const doc = useEditor(selectDoc);
  const selectedEls = useMemo(() => (doc ? getElements(doc, selection) : []), [doc, selection]);
  const mod = useClientValue(modKey, 'Ctrl');
  useSceneRenderer(canvasRef);

  // Track the viewport size; frame the first slide once we know it.
  useLayoutEffect(() => {
    const el = viewportRef.current;
    if (!el) return;
    const measure = () => {
      useCamera.getState().setViewport(el.clientWidth, el.clientHeight);
      if (!useCamera.getState().ready && el.clientWidth > 0) actions.fitSlide(useEditor.getState().activeSlide);
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Keep the camera's pan bounds in sync with the strip size.
  useEffect(() => {
    const d = selectDoc(useEditor.getState());
    if (d) useCamera.getState().setContent(stripRegion(d));
  }, [slideCount, slideWidth]);

  const onDrop = (e: React.DragEvent) => {
    const raw = e.dataTransfer.getData(DND_TYPE);
    if (!raw || !viewportRef.current) return;
    e.preventDefault();
    const rect = viewportRef.current.getBoundingClientRect();
    const at = screenToDoc({ x: e.clientX - rect.left, y: e.clientY - rect.top });
    try {
      const item = JSON.parse(raw) as DragItem;
      if (item.kind === 'text')
        actions.addText(
          TEXT_PRESETS.find((p) => p.id === item.presetId),
          at,
        );
      if (item.kind === 'shape')
        actions.addShape(
          SHAPE_PRESETS.find((p) => p.id === item.presetId),
          at,
        );
      if (item.kind === 'sticker') actions.addSticker(item.stickerId, at);
    } catch {
      /* Ignore foreign drops. */
    }
  };

  const hasSelection = selection.length > 0;
  const allLocked = hasSelection && selectedEls.every((el) => el.locked);
  const grouped = selectedEls.some((el) => el.groupId);

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <div
          ref={viewportRef}
          role="application"
          aria-label="Design canvas"
          aria-roledescription="canvas"
          tabIndex={-1}
          data-testid="canvas-viewport"
          data-tool={tool}
          className="relative size-full touch-none overflow-hidden bg-canvas [background-image:radial-gradient(var(--border)_1px,transparent_1px)] [background-size:22px_22px] outline-none select-none"
          onPointerDown={handlers.onPointerDown}
          onPointerMove={handlers.onPointerMove}
          onPointerUp={handlers.onPointerUp}
          onPointerCancel={handlers.onPointerCancel}
          onContextMenu={handlers.onContextMenu}
          onDragOver={(e) => {
            if (e.dataTransfer.types.includes(DND_TYPE)) {
              e.preventDefault();
              e.dataTransfer.dropEffect = 'copy';
            }
          }}
          onDrop={onDrop}
        >
          <canvas ref={canvasRef} className="absolute inset-0 size-full" data-testid="scene-canvas" />
          <Overlay />
          <TextEditor />
          <Readout />
          {showRulers && <Rulers />}
        </div>
      </ContextMenuTrigger>
      <ContextMenuContent>
        {hasSelection ? (
          <>
            <ContextMenuItem icon={<Scissors />} shortcut={`${mod} X`} onSelect={() => void actions.cutSelection()}>
              Cut
            </ContextMenuItem>
            <ContextMenuItem icon={<Copy />} shortcut={`${mod} C`} onSelect={() => void actions.copySelection()}>
              Copy
            </ContextMenuItem>
            <ContextMenuItem icon={<ClipboardPaste />} shortcut={`${mod} V`} onSelect={() => void actions.paste()}>
              Paste
            </ContextMenuItem>
            <ContextMenuItem icon={<Copy />} shortcut={`${mod} D`} onSelect={actions.duplicateSelection}>
              Duplicate
            </ContextMenuItem>
            <ContextMenuSeparator />
            <ContextMenuItem icon={<ArrowUpToLine />} shortcut={`${mod} ]`} onSelect={() => actions.reorder('forward')}>
              Bring forward
            </ContextMenuItem>
            <ContextMenuItem icon={<ArrowUpToLine />} shortcut={`${mod} ⇧ ]`} onSelect={() => actions.reorder('front')}>
              Bring to front
            </ContextMenuItem>
            <ContextMenuItem icon={<ArrowDownToLine />} shortcut={`${mod} [`} onSelect={() => actions.reorder('backward')}>
              Send backward
            </ContextMenuItem>
            <ContextMenuItem icon={<ArrowDownToLine />} shortcut={`${mod} ⇧ [`} onSelect={() => actions.reorder('back')}>
              Send to back
            </ContextMenuItem>
            <ContextMenuSeparator />
            {selection.length > 1 && (
              <ContextMenuItem icon={<Group />} shortcut={`${mod} G`} onSelect={actions.groupSelection}>
                Group
              </ContextMenuItem>
            )}
            {grouped && (
              <ContextMenuItem icon={<Ungroup />} shortcut={`${mod} ⇧ G`} onSelect={actions.ungroupSelection}>
                Ungroup
              </ContextMenuItem>
            )}
            <ContextMenuItem icon={allLocked ? <Unlock /> : <Lock />} shortcut={`${mod} ⇧ L`} onSelect={actions.toggleLock}>
              {allLocked ? 'Unlock' : 'Lock'}
            </ContextMenuItem>
            <ContextMenuItem icon={<EyeOff />} shortcut={`${mod} ⇧ H`} onSelect={actions.toggleHidden}>
              Hide
            </ContextMenuItem>
            <ContextMenuSeparator />
            <ContextMenuItem icon={<Trash2 />} shortcut="Del" destructive onSelect={actions.deleteSelection}>
              Delete
            </ContextMenuItem>
          </>
        ) : (
          <>
            <ContextMenuItem
              icon={<ClipboardPaste />}
              shortcut={`${mod} V`}
              onSelect={() => void actions.paste(handlers.contextPoint.current ?? undefined)}
            >
              Paste here
            </ContextMenuItem>
            <ContextMenuItem
              icon={<Type />}
              onSelect={() =>
                actions.addText(TEXT_PRESETS[0], handlers.contextPoint.current ?? undefined, { edit: true, text: 'Your text' })
              }
            >
              Add text here
            </ContextMenuItem>
            <ContextMenuItem icon={<MousePointerSquareDashed />} shortcut={`${mod} A`} onSelect={actions.selectAll}>
              Select all
            </ContextMenuItem>
          </>
        )}
      </ContextMenuContent>
    </ContextMenu>
  );
}
