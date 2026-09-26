'use client';

import {
  ArrowDownToLine,
  Download,
  History,
  Bookmark,
  FileDown,
  Wand2,
  BookmarkPlus,
  LayoutTemplate,
  ArrowUpToLine,
  Copy,
  Crop,
  Dices,
  Eye,
  FlipHorizontal2,
  GalleryHorizontal,
  LayoutGrid,
  Sparkles,
  Grid3x3,
  ImagePlus,
  Group,
  Hand,
  Layers,
  Lock,
  Magnet,
  Maximize,
  MousePointer2,
  Plus,
  Redo2,
  Ruler,
  ScanLine,
  Shapes,
  Smile,
  Trash2,
  Type,
  Undo2,
  Ungroup,
  WandSparkles,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import { useEffect } from 'react';
import { useHotkeys } from '@/hooks/useHotkeys';
import { useCommandRegistry } from '@/components/shell/commands';
import { toast } from '@/components/ui/toast-store';
import * as actions from './actions';
import { imageFilesFrom, parseElements, serializeElements } from './core/clipboard';
import { openPhotoPicker } from './file-picker';
import { makeCollage, shuffleLayout } from './layout-actions';
import { useUi } from '@/settings/ui-store';
import { autoEnhance, cancelCrop, commitCrop, enterCrop, flipPhoto, importAndPlace, selectedImage } from './photo-actions';
import { getElements } from './core/ops';
import { TEXT_PRESETS } from './core/factory';
import { selectDoc, useEditor } from './store';
import { saveVersion } from './versioning';
import { downloadProjectFile } from '@/components/projects/project-files';

const ed = () => useEditor.getState();
const hasSelection = () => ed().selection.length > 0;

function isEditable(target: EventTarget | null) {
  return target instanceof HTMLElement && (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName));
}

/** Keyboard shortcuts, clipboard events and command-palette entries for the editor. */
export function useEditorShortcuts() {
  const register = useCommandRegistry((s) => s.register);
  const unregister = useCommandRegistry((s) => s.unregister);

  useHotkeys({
    'mod+z': () => ed().undo(),
    'mod+shift+z': () => ed().redo(),
    'mod+y': () => ed().redo(),
    'mod+d': actions.duplicateSelection,
    delete: actions.deleteSelection,
    'mod+a': actions.selectAll,
    'mod+g': actions.groupSelection,
    'mod+shift+g': actions.ungroupSelection,
    'mod+]': () => actions.reorder('forward'),
    'mod+[': () => actions.reorder('backward'),
    'mod+shift+]': () => actions.reorder('front'),
    'mod+shift+}': () => actions.reorder('front'),
    'mod+shift+[': () => actions.reorder('back'),
    'mod+shift+{': () => actions.reorder('back'),
    'mod+shift+l': actions.toggleLock,
    'mod+shift+h': actions.toggleHidden,
    arrowleft: () => (hasSelection() ? actions.nudge(-1, 0) : actions.goToSlide(ed().activeSlide - 1)),
    arrowright: () => (hasSelection() ? actions.nudge(1, 0) : actions.goToSlide(ed().activeSlide + 1)),
    arrowup: () => hasSelection() && actions.nudge(0, -1),
    arrowdown: () => hasSelection() && actions.nudge(0, 1),
    'shift+arrowleft': () => actions.nudge(-10, 0),
    'shift+arrowright': () => actions.nudge(10, 0),
    'shift+arrowup': () => actions.nudge(0, -10),
    'shift+arrowdown': () => actions.nudge(0, 10),
    enter: () => {
      if (ed().croppingId) return commitCrop();
      const d = selectDoc(ed());
      const [el] = d ? getElements(d, ed().selection) : [];
      if (ed().selection.length !== 1 || !el || el.locked) return;
      if (el.type === 'text') ed().setEditingText(el.id);
      if (el.type === 'image') enterCrop(el.id);
    },
    escape: () => {
      if (ed().croppingId) cancelCrop();
      else if (hasSelection()) ed().clearSelection();
      else ed().setTool('select');
    },
    v: () => ed().setTool('select'),
    t: () => ed().setTool('text'),
    p: () => ed().setPanel(ed().panel === 'photos' ? null : 'photos'),
    l: () => ed().setPanel(ed().panel === 'layouts' ? null : 'layouts'),
    f: () => ed().setPanel(ed().panel === 'filters' ? null : 'filters'),
    h: () => ed().setTool('hand'),
    'mod+=': () => actions.zoomStep(1),
    'mod++': () => actions.zoomStep(1),
    'mod+-': () => actions.zoomStep(-1),
    'mod+0': () => actions.zoomTo(1),
    'shift+!': () => actions.fitSlide(),
    'shift+1': () => actions.fitSlide(),
    'shift+@': () => actions.fitAll(),
    'shift+2': () => actions.fitAll(),
    "'": () => ed().toggleGrid(),
    'shift+r': () => ed().toggleRulers(),
  });

  // Save and export work even while typing (e.g. in the project name field).
  useHotkeys(
    {
      'mod+shift+e': () => useUi.getState().openExport({ source: 'editor' }),
      'mod+s': async () => {
        await ed().save();
        if (ed().saveState !== 'saved') return;
        // Ctrl/⌘ S also keeps a version (when something changed since the last one).
        const version = await saveVersion().catch(() => null);
        toast({
          title: 'Saved on this device',
          description: version ? 'This version is kept in History.' : undefined,
          tone: 'success',
          duration: 2200,
        });
      },
    },
    { allowInInputs: true },
  );

  // Native clipboard events work in every browser without permission prompts.
  useEffect(() => {
    const onCopy = (e: ClipboardEvent) => {
      if (isEditable(e.target) || !hasSelection()) return;
      const d = selectDoc(ed());
      if (!d) return;
      e.preventDefault();
      const els = getElements(d, ed().selection);
      e.clipboardData?.setData('text/plain', serializeElements(els));
      void actions.copySelection();
      if (e.type === 'cut') actions.deleteSelection();
    };
    const onPaste = (e: ClipboardEvent) => {
      if (isEditable(e.target)) return;
      const d = selectDoc(ed());
      if (!d) return;
      const images = imageFilesFrom(e.clipboardData);
      if (images.length) {
        e.preventDefault();
        const frame = selectedImage();
        void importAndPlace(images, { targetId: frame && !frame.assetId ? frame.id : null });
        return;
      }
      const text = e.clipboardData?.getData('text/plain') ?? '';
      const elements = parseElements(text);
      e.preventDefault();
      if (elements) {
        actions.pasteElements(elements);
      } else if (text.trim()) {
        actions.addText(
          TEXT_PRESETS.find((p) => p.id === 'body'),
          undefined,
          { text: text.slice(0, 2000) },
        );
      } else {
        void actions.paste();
      }
    };
    window.addEventListener('copy', onCopy);
    window.addEventListener('cut', onCopy);
    window.addEventListener('paste', onPaste);
    return () => {
      window.removeEventListener('copy', onCopy);
      window.removeEventListener('cut', onCopy);
      window.removeEventListener('paste', onPaste);
    };
  }, []);

  useEffect(() => {
    register('editor', [
      {
        id: 'ed-add-text',
        label: 'Add text',
        group: 'Editor',
        icon: <Type />,
        shortcut: 'T',
        keywords: ['heading', 'caption', 'type'],
        run: () => actions.addText(TEXT_PRESETS[0], undefined, { edit: true }),
      },
      {
        id: 'ed-add-image',
        label: 'Add image',
        group: 'Editor',
        icon: <ImagePlus />,
        shortcut: 'P',
        keywords: ['photo', 'picture', 'upload', 'import'],
        run: () => {
          ed().setPanel('photos');
          openPhotoPicker();
        },
      },
      {
        id: 'ed-crop',
        label: 'Crop photo',
        group: 'Editor',
        icon: <Crop />,
        keywords: ['image', 'position', 'zoom', 'straighten'],
        run: () => {
          if (!enterCrop()) toast({ title: 'Select a photo to crop' });
        },
      },
      {
        id: 'ed-flip',
        label: 'Flip photo horizontally',
        group: 'Editor',
        icon: <FlipHorizontal2 />,
        keywords: ['mirror', 'image'],
        run: () => (selectedImage()?.assetId ? flipPhoto('x') : toast({ title: 'Select a photo to flip' })),
      },
      {
        id: 'ed-auto',
        label: 'Auto-enhance photo',
        group: 'Editor',
        icon: <WandSparkles />,
        keywords: ['fix', 'improve', 'magic', 'adjust'],
        run: () => (selectedImage()?.assetId ? void autoEnhance() : toast({ title: 'Select a photo to enhance' })),
      },
      {
        id: 'ed-shuffle',
        label: 'Shuffle collage',
        group: 'Editor',
        icon: <Dices />,
        keywords: ['layout', 'remix', 'random', 'panorama'],
        run: shuffleLayout,
      },
      {
        id: 'ed-collage',
        label: 'Make a collage',
        group: 'Editor',
        icon: <LayoutGrid />,
        keywords: ['grid', 'bento', 'scrapbook', 'polaroid', 'arrange photos'],
        run: () => {
          const d = selectDoc(ed());
          const photos = d ? getElements(d, ed().selection).filter((e) => e.type === 'image' && e.assetId) : [];
          if (photos.length >= 2) makeCollage('bento');
          else useUi.getState().openPhotoFlow('collage', 'current');
        },
      },
      {
        id: 'ed-seamless',
        label: 'Seamless swipe (panorama)…',
        group: 'Editor',
        icon: <GalleryHorizontal />,
        keywords: ['carousel', 'panorama', 'continuous', 'split photo'],
        run: () => useUi.getState().openPhotoFlow('seamless', 'current'),
      },
      {
        id: 'ed-dump',
        label: 'Smart photo dump…',
        group: 'Editor',
        icon: <Sparkles />,
        keywords: ['carousel', 'auto', 'generate', 'photos'],
        run: () => useUi.getState().openPhotoFlow('dump', 'current'),
      },
      {
        id: 'ed-export',
        label: 'Export…',
        group: 'Editor',
        icon: <Download />,
        shortcut: '⌘ ⇧ E',
        keywords: ['export', 'download', 'save as', 'png', 'jpg', 'jpeg', 'webp', 'pdf', 'zip', 'share'],
        run: () => useUi.getState().openExport({ source: 'editor' }),
      },
      {
        id: 'ed-history',
        label: 'Version history',
        group: 'Editor',
        icon: <History />,
        keywords: ['versions', 'restore', 'undo', 'earlier', 'backup', 'revert', 'recover'],
        run: () => useUi.getState().setHistoryOpen(true),
      },
      {
        id: 'ed-save-version',
        label: 'Save a version',
        group: 'Editor',
        icon: <Bookmark />,
        shortcut: '⌘ S',
        keywords: ['checkpoint', 'snapshot', 'save', 'history'],
        run: async () => {
          await ed().save();
          const version = await saveVersion().catch(() => null);
          toast({
            title: version ? 'Version saved' : 'Already saved',
            description: version ? 'Find it in Version history.' : 'Nothing changed since the last version.',
            tone: version ? 'success' : 'default',
            duration: 2200,
          });
        },
      },
      {
        id: 'ed-project-file',
        label: 'Download project file',
        group: 'Editor',
        icon: <FileDown />,
        keywords: ['stardeck', 'backup', 'move', 'another device', 'share project', 'save file'],
        run: () => {
          const s = ed();
          if (s.meta) void downloadProjectFile(s.meta.id, selectDoc(s) ?? undefined);
        },
      },
      {
        id: 'ed-filters',
        label: 'Filters',
        group: 'Editor',
        icon: <Wand2 />,
        keywords: ['filter', 'look', 'preset', 'effects', 'cinematic', 'vintage', 'vhs', 'film', 'y2k'],
        run: () => ed().setPanel('filters'),
      },
      {
        id: 'ed-templates',
        label: 'Templates panel',
        group: 'Editor',
        icon: <LayoutTemplate />,
        keywords: ['template', 'add slides', 'replace design', 'library'],
        run: () => ed().setPanel('templates'),
      },
      {
        id: 'ed-save-template',
        label: 'Save as template…',
        group: 'Editor',
        icon: <BookmarkPlus />,
        keywords: ['template', 'reuse', 'save design'],
        run: () => useUi.getState().openSaveTemplate({ source: 'editor' }),
      },
      {
        id: 'ed-preview',
        label: 'Swipe preview',
        group: 'View',
        icon: <Eye />,
        keywords: ['preview', 'carousel', 'play'],
        run: () => useUi.getState().setCarouselPreview(true),
      },
      {
        id: 'ed-add-shape',
        label: 'Add shape',
        group: 'Editor',
        icon: <Shapes />,
        keywords: ['rectangle', 'circle', 'star'],
        run: () => ed().setPanel('shapes'),
      },
      {
        id: 'ed-add-sticker',
        label: 'Add sticker',
        group: 'Editor',
        icon: <Smile />,
        keywords: ['emoji', 'sparkle', 'heart'],
        run: () => ed().setPanel('stickers'),
      },
      { id: 'ed-layers', label: 'Show layers', group: 'Editor', icon: <Layers />, run: () => ed().setPanel('layers') },
      {
        id: 'ed-duplicate',
        label: 'Duplicate',
        group: 'Editor',
        icon: <Copy />,
        shortcut: '⌘ D',
        keywords: ['copy'],
        run: actions.duplicateSelection,
      },
      {
        id: 'ed-group',
        label: 'Group selection',
        group: 'Editor',
        icon: <Group />,
        shortcut: '⌘ G',
        run: actions.groupSelection,
      },
      {
        id: 'ed-ungroup',
        label: 'Ungroup',
        group: 'Editor',
        icon: <Ungroup />,
        shortcut: '⌘ ⇧ G',
        run: actions.ungroupSelection,
      },
      { id: 'ed-front', label: 'Bring to front', group: 'Editor', icon: <ArrowUpToLine />, run: () => actions.reorder('front') },
      { id: 'ed-back', label: 'Send to back', group: 'Editor', icon: <ArrowDownToLine />, run: () => actions.reorder('back') },
      { id: 'ed-lock', label: 'Lock / unlock selection', group: 'Editor', icon: <Lock />, run: actions.toggleLock },
      { id: 'ed-delete', label: 'Delete selection', group: 'Editor', icon: <Trash2 />, run: actions.deleteSelection },
      { id: 'ed-undo', label: 'Undo', group: 'Editor', icon: <Undo2 />, shortcut: '⌘ Z', run: () => ed().undo() },
      { id: 'ed-redo', label: 'Redo', group: 'Editor', icon: <Redo2 />, shortcut: '⌘ ⇧ Z', run: () => ed().redo() },
      {
        id: 'ed-add-slide',
        label: 'Add slide',
        group: 'Editor',
        icon: <Plus />,
        keywords: ['new slide', 'carousel'],
        run: actions.addSlide,
      },
      { id: 'ed-dup-slide', label: 'Duplicate slide', group: 'Editor', icon: <Copy />, run: actions.duplicateActiveSlide },
      { id: 'ed-del-slide', label: 'Delete slide', group: 'Editor', icon: <Trash2 />, run: actions.deleteActiveSlide },
      { id: 'ed-zoom-in', label: 'Zoom in', group: 'View', icon: <ZoomIn />, shortcut: '⌘ +', run: () => actions.zoomStep(1) },
      {
        id: 'ed-zoom-out',
        label: 'Zoom out',
        group: 'View',
        icon: <ZoomOut />,
        shortcut: '⌘ −',
        run: () => actions.zoomStep(-1),
      },
      {
        id: 'ed-fit',
        label: 'Fit canvas',
        group: 'View',
        icon: <Maximize />,
        shortcut: '⇧ 1',
        keywords: ['zoom to fit'],
        run: () => actions.fitSlide(),
      },
      {
        id: 'ed-fit-all',
        label: 'Fit all slides',
        group: 'View',
        icon: <Maximize />,
        shortcut: '⇧ 2',
        keywords: ['zoom out', 'overview'],
        run: actions.fitAll,
      },
      { id: 'ed-grid', label: 'Toggle grid', group: 'View', icon: <Grid3x3 />, shortcut: "'", run: () => ed().toggleGrid() },
      {
        id: 'ed-rulers',
        label: 'Toggle rulers & guides',
        group: 'View',
        icon: <Ruler />,
        shortcut: '⇧ R',
        run: () => ed().toggleRulers(),
      },
      {
        id: 'ed-snap',
        label: 'Toggle snapping',
        group: 'View',
        icon: <Magnet />,
        keywords: ['smart guides', 'magnet'],
        run: () => ed().toggleSnapping(),
      },
      {
        id: 'ed-safe',
        label: 'Toggle safe areas',
        group: 'View',
        icon: <ScanLine />,
        keywords: ['guides'],
        run: () => ed().toggleSafeArea(),
      },
      {
        id: 'ed-tool-select',
        label: 'Select tool',
        group: 'View',
        icon: <MousePointer2 />,
        shortcut: 'V',
        run: () => ed().setTool('select'),
      },
      {
        id: 'ed-tool-hand',
        label: 'Hand tool (pan)',
        group: 'View',
        icon: <Hand />,
        shortcut: 'H',
        run: () => ed().setTool('hand'),
      },
    ]);
    return () => unregister('editor');
  }, [register, unregister]);
}
