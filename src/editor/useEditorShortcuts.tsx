'use client';

import { Copy, Grid3x3, Maximize, Plus, Redo2, ScanLine, Trash2, Undo2, ZoomIn, ZoomOut } from 'lucide-react';
import { useEffect } from 'react';
import { duplicateSlide, insertSlide, removeSlide } from '@/projects/document';
import { useHotkeys } from '@/hooks/useHotkeys';
import { useCommandRegistry } from '@/components/shell/commands';
import { toast } from '@/components/ui/toast-store';
import { useEditor } from './store';
import { nextZoom } from './zoom';

/** Keyboard shortcuts + command-palette entries for the editor. */
export function useEditorShortcuts(currentZoom: number) {
  const register = useCommandRegistry((s) => s.register);
  const unregister = useCommandRegistry((s) => s.unregister);

  useHotkeys({
    'mod+z': () => useEditor.getState().undo(),
    'mod+shift+z': () => useEditor.getState().redo(),
    'mod+y': () => useEditor.getState().redo(),
    'mod+d': () => {
      const { apply, activeSlide, setActiveSlide } = useEditor.getState();
      apply((d) => duplicateSlide(d, activeSlide));
      setActiveSlide(activeSlide + 1);
    },
    arrowleft: () => {
      const s = useEditor.getState();
      s.setActiveSlide(s.activeSlide - 1);
    },
    arrowright: () => {
      const s = useEditor.getState();
      s.setActiveSlide(s.activeSlide + 1);
    },
    'mod+=': () => useEditor.getState().setZoom(nextZoom(currentZoom, 1)),
    'mod++': () => useEditor.getState().setZoom(nextZoom(currentZoom, 1)),
    'mod+-': () => useEditor.getState().setZoom(nextZoom(currentZoom, -1)),
    'shift+!': () => useEditor.getState().setZoom(null),
    'shift+1': () => useEditor.getState().setZoom(null),
    "'": () => useEditor.getState().toggleGrid(),
  });

  // Save works even while typing (e.g. in the project name field).
  useHotkeys(
    {
      'mod+s': async () => {
        await useEditor.getState().save();
        if (useEditor.getState().saveState === 'saved') toast({ title: 'Saved on this device', tone: 'success', duration: 1800 });
      },
    },
    { allowInInputs: true },
  );

  useEffect(() => {
    const ed = () => useEditor.getState();
    register('editor', [
      {
        id: 'ed-add-slide',
        label: 'Add slide',
        group: 'Editor',
        icon: <Plus />,
        keywords: ['new slide', 'carousel'],
        run: () => {
          ed().apply((d) => insertSlide(d, ed().activeSlide + 1));
          ed().setActiveSlide(ed().activeSlide + 1);
        },
      },
      {
        id: 'ed-dup-slide',
        label: 'Duplicate slide',
        group: 'Editor',
        icon: <Copy />,
        shortcut: '⌘ D',
        keywords: ['duplicate', 'copy'],
        run: () => {
          ed().apply((d) => duplicateSlide(d, ed().activeSlide));
          ed().setActiveSlide(ed().activeSlide + 1);
        },
      },
      {
        id: 'ed-del-slide',
        label: 'Delete slide',
        group: 'Editor',
        icon: <Trash2 />,
        keywords: ['remove'],
        run: () => ed().apply((d) => removeSlide(d, ed().activeSlide)),
      },
      { id: 'ed-undo', label: 'Undo', group: 'Editor', icon: <Undo2 />, shortcut: '⌘ Z', run: () => ed().undo() },
      { id: 'ed-redo', label: 'Redo', group: 'Editor', icon: <Redo2 />, shortcut: '⌘ ⇧ Z', run: () => ed().redo() },
      {
        id: 'ed-zoom-in',
        label: 'Zoom in',
        group: 'Editor',
        icon: <ZoomIn />,
        run: () => ed().setZoom(nextZoom(currentZoom, 1)),
      },
      {
        id: 'ed-zoom-out',
        label: 'Zoom out',
        group: 'Editor',
        icon: <ZoomOut />,
        run: () => ed().setZoom(nextZoom(currentZoom, -1)),
      },
      {
        id: 'ed-fit',
        label: 'Fit canvas',
        group: 'Editor',
        icon: <Maximize />,
        shortcut: '⇧ 1',
        keywords: ['zoom to fit'],
        run: () => ed().setZoom(null),
      },
      { id: 'ed-grid', label: 'Toggle grid', group: 'Editor', icon: <Grid3x3 />, shortcut: "'", run: () => ed().toggleGrid() },
      {
        id: 'ed-safe',
        label: 'Toggle safe areas',
        group: 'Editor',
        icon: <ScanLine />,
        keywords: ['guides'],
        run: () => ed().toggleSafeArea(),
      },
    ]);
    return () => unregister('editor');
  }, [register, unregister, currentZoom]);
}
