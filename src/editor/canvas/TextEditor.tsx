'use client';

import { useEffect, useLayoutEffect, useRef } from 'react';
import type { TextElement } from '@/types/document';
import { fillPrimaryColor } from '@/canvas/render/fill';
import { fontStack } from '@/typography/fonts';
import { fitTextHeight, getElements, removeElements, updateElements } from '../core/ops';
import { useCamera } from '../camera';
import { selectDoc, useEditor } from '../store';

/**
 * Edits text in place: a transparent textarea styled like the element sits
 * exactly over it (the canvas skips drawing that element while editing).
 */
export function TextEditor() {
  const editingId = useEditor((s) => s.editingTextId);
  const el = useEditor((s) => {
    const d = selectDoc(s);
    const found = d && s.editingTextId ? getElements(d, [s.editingTextId])[0] : undefined;
    return found?.type === 'text' ? found : undefined;
  });
  if (!editingId || !el) return null;
  return <Editor key={editingId} el={el} />;
}

function Editor({ el }: { el: TextElement }) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const zoom = useCamera((s) => s.zoom);
  const camX = useCamera((s) => s.x);
  const camY = useCamera((s) => s.y);
  const originalText = useRef(el.text);

  useLayoutEffect(() => {
    const ta = ref.current;
    if (!ta) return;
    ta.focus({ preventScroll: true });
    ta.select();
  }, []);

  // Commit when editing ends (click away, Escape, or switching selection).
  useEffect(() => {
    const id = el.id;
    return () => {
      const editor = useEditor.getState();
      const d = selectDoc(editor);
      const current = d ? getElements(d, [id])[0] : undefined;
      if (current?.type === 'text' && current.text.trim() === '') {
        editor.preview((base) => removeElements(base, [id]));
      }
      editor.commit();
    };
    // Mounted once per editing session (keyed by id).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onInput = (text: string) => {
    useEditor
      .getState()
      .preview((base) => updateElements(base, [el.id], (e) => (e.type === 'text' ? fitTextHeight({ ...e, text }) : e)));
  };

  const finish = (revert: boolean) => {
    if (revert) onInput(originalText.current);
    useEditor.getState().setEditingText(null);
  };

  const left = (el.x - camX) * zoom;
  const top = (el.y - camY) * zoom;

  return (
    <textarea
      ref={ref}
      data-canvas-ignore
      aria-label="Edit text"
      defaultValue={el.text}
      spellCheck
      onChange={(e) => onInput(e.target.value)}
      onKeyDown={(e) => {
        e.stopPropagation();
        if (e.key === 'Escape') {
          e.preventDefault();
          finish(false);
        }
        if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
          e.preventDefault();
          finish(false);
        }
      }}
      onBlur={() => finish(false)}
      onPointerDown={(e) => e.stopPropagation()}
      className="absolute z-10 m-0 resize-none overflow-hidden border-0 bg-transparent p-0 [caret-color:var(--selection)] outline-none selection:bg-selection/35"
      style={{
        left,
        top,
        width: el.width * zoom,
        height: el.height * zoom,
        transform: el.rotation ? `rotate(${el.rotation}deg)` : undefined,
        transformOrigin: 'center center',
        fontFamily: fontStack(el.fontFamily),
        fontSize: el.fontSize * zoom,
        fontWeight: el.fontWeight,
        fontStyle: el.fontStyle,
        lineHeight: el.lineHeight,
        letterSpacing: `${el.letterSpacing}em`,
        textAlign: el.align,
        textTransform: el.textTransform ?? 'none',
        color: fillPrimaryColor(el.fill),
        whiteSpace: 'pre-wrap',
        overflowWrap: 'anywhere',
        opacity: el.opacity,
        outline: '1.5px dashed var(--selection)',
        outlineOffset: 4,
      }}
    />
  );
}
