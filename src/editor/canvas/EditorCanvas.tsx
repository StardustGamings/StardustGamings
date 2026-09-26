'use client';

import {
  ArrowDownToLine,
  ArrowUpToLine,
  ClipboardPaste,
  Copy,
  Crop,
  Dices,
  EyeOff,
  ImageUp,
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
import { FRAME_PRESETS } from '../core/factory';
import { addFrame, enterCrop, fillFrame, importAndPlace, placePhotos } from '../photo-actions';
import { openPhotoPicker } from '../file-picker';
import { shuffleLayout, toggleLayoutLock } from '../layout-actions';
import { useAssets } from '@/assets/store';
import { useInteraction } from './interaction-store';
import type { Point } from '../core/geometry';
import { pointInBox } from '../core/geometry';

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

  const docPointOf = (e: React.DragEvent): Point => {
    const rect = viewportRef.current!.getBoundingClientRect();
    return screenToDoc({ x: e.clientX - rect.left, y: e.clientY - rect.top });
  };

  /** Topmost unlocked image element under a point — photos dropped there fill it. */
  const frameAt = (p: Point) => {
    const d = selectDoc(useEditor.getState());
    if (!d) return null;
    for (let i = d.elements.length - 1; i >= 0; i--) {
      const el = d.elements[i]!;
      if (el.hidden) continue;
      if (pointInBox(p, el)) return el.type === 'image' && !el.locked ? el : null;
    }
    return null;
  };

  const carriesPhoto = (e: React.DragEvent) => e.dataTransfer.types.includes('Files') || e.dataTransfer.types.includes(DND_TYPE);

  const onDragOver = (e: React.DragEvent) => {
    if (!carriesPhoto(e)) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
    // Only files and library photos can fill a frame (the payload isn't readable during dragover,
    // so a panel drag is treated as a photo candidate; non-photo drops simply ignore the target).
    const target = frameAt(docPointOf(e));
    const id = target?.id ?? null;
    if (useInteraction.getState().dropTargetId !== id) useInteraction.getState().set({ dropTargetId: id });
  };

  const clearDropTarget = () => useInteraction.getState().set({ dropTargetId: null });

  const onDrop = (e: React.DragEvent) => {
    if (!viewportRef.current) return;
    const at = docPointOf(e);
    const target = frameAt(at);
    clearDropTarget();
    const files = [...e.dataTransfer.files];
    if (files.length) {
      e.preventDefault();
      void importAndPlace(files, { at, targetId: target?.id ?? null });
      return;
    }
    const raw = e.dataTransfer.getData(DND_TYPE);
    if (!raw) return;
    e.preventDefault();
    try {
      const item = JSON.parse(raw) as DragItem;
      if (item.kind === 'photo') {
        const meta = useAssets.getState().assets.find((a) => a.id === item.assetId);
        if (!meta) return;
        if (target && meta.kind === 'photo') fillFrame(target.id, meta);
        else placePhotos([meta], at);
      }
      if (item.kind === 'frame') {
        const preset = FRAME_PRESETS.find((p) => p.id === item.presetId);
        if (preset) addFrame(preset, at);
      }
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
  const image = selectedEls.length === 1 && selectedEls[0]!.type === 'image' && !selectedEls[0]!.locked ? selectedEls[0]! : null;

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
          onDragOver={onDragOver}
          onDragLeave={(e) => {
            if (!e.currentTarget.contains(e.relatedTarget as Node | null)) clearDropTarget();
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
            {selectedEls.some((e) => e.layout) && (
              <>
                <ContextMenuSeparator />
                <ContextMenuItem icon={<Dices />} onSelect={shuffleLayout}>
                  Shuffle layout
                </ContextMenuItem>
                {selectedEls.length === 1 && selectedEls[0]!.layout?.role === 'photo' && (
                  <ContextMenuItem icon={<Lock />} onSelect={() => toggleLayoutLock(selectedEls[0]!.id)}>
                    {selectedEls[0]!.layout.locked ? 'Let it move when shuffling' : 'Keep in place when shuffling'}
                  </ContextMenuItem>
                )}
              </>
            )}
            {image && (
              <>
                <ContextMenuSeparator />
                {image.type === 'image' && image.assetId && (
                  <ContextMenuItem icon={<Crop />} shortcut="↵" onSelect={() => enterCrop(image.id)}>
                    Crop photo
                  </ContextMenuItem>
                )}
                <ContextMenuItem icon={<ImageUp />} onSelect={() => openPhotoPicker({ targetId: image.id, single: true })}>
                  {image.type === 'image' && image.assetId ? 'Replace photo' : 'Add photo'}
                </ContextMenuItem>
              </>
            )}
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
