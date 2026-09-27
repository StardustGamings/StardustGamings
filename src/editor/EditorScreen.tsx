'use client';

import { AnimatePresence, motion } from 'motion/react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import {
  ArrowDown,
  ArrowUp,
  Check,
  Copy,
  Crop,
  Dices,
  Grid3x3,
  ImageUp,
  Lock,
  Maximize,
  PenLine,
  SlidersHorizontal,
  Sparkles,
  Trash2,
  Type,
  Unlock,
  Wand2,
  X,
} from 'lucide-react';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { FORMATS } from '@/projects/formats';
import { useSettings } from '@/settings/store';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { buttonClasses } from '@/components/ui/button-styles';
import { EmptyState } from '@/components/ui/EmptyState';
import { IconButton } from '@/components/ui/IconButton';
import { Spinner } from '@/components/ui/Spinner';
import { cn } from '@/utils/cn';
import * as actions from './actions';
import { useCamera } from './camera';
import { EditorCanvas } from './canvas/EditorCanvas';
import { EditorTopBar } from './EditorTopBar';
import { TextPanel, ShapesPanel, StickersPanel } from './panels/AddPanels';
import {
  AnimatePanel,
  EditorDialogs,
  FiltersPanel,
  LayoutsPanel,
  MagicPanel,
  PhotosPanel,
  TemplatesPanel,
  Timeline,
  TrendsPanel,
} from './lazy';
import { useUi } from '@/settings/ui-store';
import { EditorAlerts } from './EditorAlerts';
import { useVersions } from './versioning';
import { subscribe } from '@/storage/sync';
import { shuffleLayout } from './layout-actions';
import { CropBar } from './CropBar';
import { PhotoPicker } from './PhotoPicker';
import { openPhotoPicker } from './file-picker';
import { enterCrop, importAndPlace } from './photo-actions';
import { useAssets } from '@/assets/store';
import { BackgroundPanel, DocumentPanel } from './panels/DocumentPanels';
import { LayersPanel } from './panels/LayersPanel';
import { PropertiesPanel } from './panels/PropertiesPanel';
import { useSelectedElements } from './panels/useSelection';
import { SlideStrip } from './SlideStrip';
import { usePlayback } from './playback';
import { selectDoc, useEditor, type PanelId } from './store';
import { PANEL_TOOLS, ToolButton, ToolRail } from './ToolRail';
import { useEditorShortcuts } from './useEditorShortcuts';

const PANEL_TITLES: Record<PanelId, string> = {
  templates: 'Templates',
  text: 'Text',
  shapes: 'Shapes',
  stickers: 'Stickers',
  photos: 'Photos',
  filters: 'Filters',
  layouts: 'Layouts',
  animate: 'Animate',
  trends: 'Trends',
  magic: 'Magic',
  design: 'Background',
  layers: 'Layers',
  properties: 'Edit',
};

function PanelContent({ panel }: { panel: PanelId }) {
  switch (panel) {
    case 'templates':
      return <TemplatesPanel />;
    case 'text':
      return <TextPanel />;
    case 'shapes':
      return <ShapesPanel />;
    case 'stickers':
      return <StickersPanel />;
    case 'photos':
      return <PhotosPanel />;
    case 'filters':
      return <FiltersPanel />;
    case 'layouts':
      return <LayoutsPanel />;
    case 'animate':
      return <AnimatePanel />;
    case 'trends':
      return <TrendsPanel />;
    case 'magic':
      return <MagicPanel />;
    case 'design':
      return <BackgroundPanel />;
    case 'layers':
      return <LayersPanel />;
    case 'properties':
      return <PropertiesPanel />;
  }
}

/** Desktop: the add-content flyout next to the tool rail. */
function Flyout() {
  const panel = useEditor((s) => s.panel);
  const setPanel = useEditor((s) => s.setPanel);
  const show =
    panel === 'templates' ||
    panel === 'text' ||
    panel === 'shapes' ||
    panel === 'stickers' ||
    panel === 'photos' ||
    panel === 'filters' ||
    panel === 'layouts' ||
    panel === 'animate' ||
    panel === 'trends' ||
    panel === 'magic' ||
    panel === 'design';
  return (
    <AnimatePresence initial={false}>
      {show && (
        <motion.aside
          key="flyout"
          aria-label={PANEL_TITLES[panel]}
          initial={{ width: 0, opacity: 0 }}
          animate={{ width: 300, opacity: 1 }}
          exit={{ width: 0, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 420, damping: 40 }}
          className="z-10 hidden shrink-0 overflow-hidden border-y-0 border-l-0 glass-strong lg:block"
        >
          <div className="flex h-full w-[300px] flex-col">
            <div className="flex h-12 shrink-0 items-center justify-between border-b border-line pr-2 pl-4">
              <h2 className="font-sans text-sm font-bold tracking-normal">{PANEL_TITLES[panel]}</h2>
              <IconButton label="Close panel" icon={<X />} size="sm" tooltip={false} onClick={() => setPanel(null)} />
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto">
              <PanelContent panel={panel} />
            </div>
          </div>
        </motion.aside>
      )}
    </AnimatePresence>
  );
}

/** Desktop: inspector with Design / Layers tabs. */
function Inspector() {
  const panel = useEditor((s) => s.panel);
  const setPanel = useEditor((s) => s.setPanel);
  const selection = useEditor((s) => s.selection);
  const [tab, setTab] = useState<'design' | 'layers'>('design');
  const [lastPanel, setLastPanel] = useState(panel);
  if (panel !== lastPanel) {
    setLastPanel(panel);
    if (panel === 'layers') setTab('layers');
  }
  const tabs = [
    { id: 'design' as const, label: 'Design' },
    { id: 'layers' as const, label: 'Layers' },
  ];
  return (
    <aside aria-label="Inspector" className="z-10 hidden w-[300px] shrink-0 flex-col border-y-0 border-r-0 glass-strong lg:flex">
      <div role="tablist" aria-label="Inspector" className="flex h-12 shrink-0 items-center gap-1 border-b border-line px-2">
        {tabs.map((t) => (
          <button
            key={t.id}
            role="tab"
            type="button"
            aria-selected={tab === t.id}
            onClick={() => {
              setTab(t.id);
              if (t.id === 'design' && panel === 'layers') setPanel(null);
            }}
            className={cn(
              'h-8 rounded-[10px] px-3 text-[13px] font-semibold transition-colors',
              tab === t.id ? 'bg-surface-active text-fg' : 'text-fg-muted hover:text-fg',
            )}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto" role="tabpanel">
        {tab === 'layers' ? <LayersPanel /> : selection.length ? <PropertiesPanel /> : <DocumentPanel />}
      </div>
    </aside>
  );
}

function MobileAction({
  label,
  icon,
  onClick,
  active,
}: {
  label: string;
  icon: ReactNode;
  onClick: () => void;
  active?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      aria-pressed={active}
      className={cn(
        'flex h-14 w-16 shrink-0 flex-col items-center justify-center gap-1 rounded-[14px] text-[10px] font-semibold transition-colors [&_svg]:size-5',
        active ? 'bg-accent text-accent-fg' : 'text-fg-muted active:bg-surface-active',
      )}
    >
      {icon}
      {label}
    </button>
  );
}

/** Phone: tools, or contextual actions while something is selected. */
function MobileToolbar() {
  const panel = useEditor((s) => s.panel);
  const setPanel = useEditor((s) => s.setPanel);
  const showGrid = useEditor((s) => s.showGrid);
  const toggleGrid = useEditor((s) => s.toggleGrid);
  const selected = useSelectedElements();
  const toggle = (p: PanelId) => setPanel(panel === p ? null : p);

  if (selected.length > 0) {
    const single = selected.length === 1 ? selected[0]! : null;
    const locked = selected.every((e) => e.locked);
    return (
      <nav aria-label="Selection actions" className="z-10 shrink-0 border-x-0 border-b-0 safe-bottom glass-strong lg:hidden">
        <div className="hide-scrollbar flex gap-1 overflow-x-auto px-2 py-1.5">
          <MobileAction
            label="Edit"
            icon={<SlidersHorizontal />}
            active={panel === 'properties'}
            onClick={() => toggle('properties')}
          />
          {single?.type === 'text' && !single.locked && (
            <MobileAction label="Text" icon={<PenLine />} onClick={() => useEditor.getState().setEditingText(single.id)} />
          )}
          {selected.some((e) => e.type === 'image' && e.assetId && !e.locked) && (
            <MobileAction label="Filters" icon={<Wand2 />} active={panel === 'filters'} onClick={() => toggle('filters')} />
          )}
          {single?.type === 'image' && !single.locked && single.assetId && (
            <MobileAction label="Crop" icon={<Crop />} onClick={() => enterCrop(single.id)} />
          )}
          {single?.type === 'image' && !single.locked && (
            <MobileAction
              label={single.assetId ? 'Replace' : 'Add photo'}
              icon={<ImageUp />}
              onClick={() => openPhotoPicker({ targetId: single.id, single: true })}
            />
          )}
          <MobileAction label="Animate" icon={<Sparkles />} active={panel === 'animate'} onClick={() => toggle('animate')} />
          {selected.some((e) => e.layout) && <MobileAction label="Shuffle" icon={<Dices />} onClick={shuffleLayout} />}
          <MobileAction label="Duplicate" icon={<Copy />} onClick={actions.duplicateSelection} />
          <MobileAction label="Forward" icon={<ArrowUp />} onClick={() => actions.reorder('forward')} />
          <MobileAction label="Back" icon={<ArrowDown />} onClick={() => actions.reorder('backward')} />
          <MobileAction label={locked ? 'Unlock' : 'Lock'} icon={locked ? <Unlock /> : <Lock />} onClick={actions.toggleLock} />
          <MobileAction label="Delete" icon={<Trash2 />} onClick={actions.deleteSelection} />
          <MobileAction label="Done" icon={<Check />} onClick={() => useEditor.getState().clearSelection()} />
        </div>
      </nav>
    );
  }

  return (
    <nav aria-label="Tools" className="z-10 shrink-0 border-x-0 border-b-0 safe-bottom glass-strong lg:hidden">
      <div className="hide-scrollbar flex gap-1 overflow-x-auto px-2 py-1.5">
        {PANEL_TOOLS.map((t) => (
          <ToolButton
            key={t.id}
            tool={t}
            orientation="horizontal"
            active={panel === t.panel}
            onClick={() => t.panel && toggle(t.panel)}
          />
        ))}
        <span className="mx-1 w-px shrink-0 self-stretch bg-line" />
        <MobileAction label="Fit" icon={<Maximize />} onClick={() => actions.fitSlide()} />
        <MobileAction label="Grid" icon={<Grid3x3 />} active={showGrid} onClick={toggleGrid} />
      </div>
    </nav>
  );
}

/** Phone: a non-modal sheet so the canvas stays visible while editing. */
function MobileSheet() {
  const panel = useEditor((s) => s.panel);
  const setPanel = useEditor((s) => s.setPanel);
  const hasSelection = useEditor((s) => s.selection.length > 0);
  const phone = !useMediaQuery('(min-width: 1024px)', true);
  const open = phone && panel !== null && !(panel === 'properties' && !hasSelection);
  return (
    <AnimatePresence initial={false}>
      {open && (
        <motion.section
          key={panel}
          aria-label={PANEL_TITLES[panel!]}
          initial={{ height: 0 }}
          animate={{ height: 'auto' }}
          exit={{ height: 0 }}
          transition={{ type: 'spring', stiffness: 420, damping: 42 }}
          className="z-10 shrink-0 overflow-hidden border-x-0 border-b-0 glass-strong lg:hidden"
          data-testid="mobile-sheet"
        >
          <div className="flex max-h-[44dvh] flex-col">
            <div className="flex h-11 shrink-0 items-center justify-between border-b border-line pr-1.5 pl-4">
              <h2 className="font-sans text-sm font-bold tracking-normal">{PANEL_TITLES[panel!]}</h2>
              <IconButton label="Close panel" icon={<X />} size="sm" tooltip={false} onClick={() => setPanel(null)} />
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
              <PanelContent panel={panel!} />
            </div>
          </div>
        </motion.section>
      )}
    </AnimatePresence>
  );
}

function Editor() {
  const doc = useEditor(selectDoc);
  const meta = useEditor((s) => s.meta);
  const saveState = useEditor((s) => s.saveState);
  const tool = useEditor((s) => s.tool);
  const cropping = useEditor((s) => s.croppingId !== null);
  const panel = useEditor((s) => s.panel);
  const loadAssets = useAssets((s) => s.load);
  useEditorShortcuts();

  useEffect(() => {
    void loadAssets();
  }, [loadAssets]);

  // The timeline takes room from the canvas: re-fit when it opens or closes, and leave
  // any motion preview when the Animate panel closes.
  const timelineOpen = panel === 'animate';
  const timelineMounted = useRef(false);
  useEffect(() => {
    if (!timelineOpen) usePlayback.getState().stop();
    if (!timelineMounted.current) {
      timelineMounted.current = true;
      return;
    }
    const id = requestAnimationFrame(() => actions.fitSlide());
    return () => cancelAnimationFrame(id);
  }, [timelineOpen]);

  // Files dropped anywhere in the editor (outside the canvas) go onto the active slide
  // instead of making the browser navigate away to the file.
  useEffect(() => {
    const hasFiles = (e: DragEvent) => e.dataTransfer?.types.includes('Files');
    const onOver = (e: DragEvent) => {
      if (hasFiles(e)) e.preventDefault();
    };
    const onDrop = (e: DragEvent) => {
      if (!hasFiles(e) || e.defaultPrevented) return;
      e.preventDefault();
      void importAndPlace([...(e.dataTransfer?.files ?? [])]);
    };
    window.addEventListener('dragover', onOver);
    window.addEventListener('drop', onDrop);
    return () => {
      window.removeEventListener('dragover', onOver);
      window.removeEventListener('drop', onDrop);
    };
  }, []);

  // Changes made in other tabs: pick them up (or flag a conflict), and keep History current.
  useEffect(
    () =>
      subscribe((message) => {
        const open = useEditor.getState().meta?.id;
        if (!open) return;
        if ((message.type === 'project' && message.id === open) || message.type === 'library') {
          void useEditor.getState().externalChange(open);
        } else if (message.type === 'versions' && message.projectId === open && useVersions.getState().projectId === open) {
          void useVersions.getState().load(open);
        }
      }),
    [],
  );

  // Flush pending edits when the tab is hidden, and warn before closing mid-save.
  useEffect(() => {
    const onHide = () => {
      if (document.visibilityState === 'hidden' && useEditor.getState().saveState === 'dirty') void useEditor.getState().save();
    };
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      const state = useEditor.getState().saveState;
      if (state === 'dirty' || state === 'saving') {
        void useEditor.getState().save();
        e.preventDefault();
      }
    };
    document.addEventListener('visibilitychange', onHide);
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => {
      document.removeEventListener('visibilitychange', onHide);
      window.removeEventListener('beforeunload', onBeforeUnload);
    };
  }, []);

  if (!doc || !meta) return null;
  const multi = FORMATS[meta.format].multiSlide || doc.slides.length > 1;

  return (
    <div className="fixed inset-0 flex flex-col bg-bg" data-save-state={saveState}>
      <EditorTopBar />
      <div className="flex min-h-0 flex-1">
        <ToolRail />
        <Flyout />
        <div className="flex min-w-0 flex-1 flex-col">
          <div className="relative min-h-0 flex-1">
            <EditorCanvas />
            <EditorAlerts />
            <CropBar layout="floating" />
            {tool === 'text' && (
              <div className="pointer-events-none absolute top-3 left-1/2 z-20 -translate-x-1/2 rounded-full bg-ink/80 px-3 py-1.5 text-xs font-semibold text-white">
                <Type className="mr-1 inline size-3.5" /> Click anywhere to add text · Esc to cancel
              </div>
            )}
          </div>
          {panel === 'animate' && !cropping && <Timeline />}
          {multi && !cropping && <SlideStrip />}
          {cropping ? (
            <CropBar layout="docked" />
          ) : (
            <>
              <MobileSheet />
              <MobileToolbar />
            </>
          )}
        </div>
        <Inspector />
      </div>
      <PhotoPicker />
      <EditorDialogs />
    </div>
  );
}

export function EditorScreen() {
  const params = useSearchParams();
  const id = params.get('id');
  const status = useEditor((s) => s.status);
  const load = useEditor((s) => s.load);
  const reset = useEditor((s) => s.reset);
  const hydrated = useSettings((s) => s.hasHydrated);
  const showGrid = useSettings((s) => s.editor.showGrid);
  const showSafeArea = useSettings((s) => s.editor.showSafeArea);

  useEffect(() => {
    if (!id || !hydrated) return;
    useCamera.getState().reset();
    void load(id, { showGrid, showSafeArea });
    return () => {
      reset();
      useUi.getState().setHistoryOpen(false);
    };
    // Grid/safe-area defaults are read once per project open.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, hydrated, load, reset]);

  if (!id || status === 'missing') {
    return (
      <div className="flex min-h-dvh items-center justify-center p-6">
        <EmptyState
          title="We can’t find that design 🫥"
          description="It may have been deleted, or it was made on another device. Projects live in the browser where you created them."
          action={
            <Link href="/projects/" className={buttonClasses({ variant: 'primary' })}>
              See your projects
            </Link>
          }
        />
      </div>
    );
  }

  if (status !== 'ready') {
    return (
      <div className="flex min-h-dvh items-center justify-center" role="status">
        <Spinner className="size-6 text-accent-text" label="Opening your design" />
      </div>
    );
  }

  return <Editor />;
}
