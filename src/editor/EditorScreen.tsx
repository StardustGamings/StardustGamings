'use client';

import { AnimatePresence, motion } from 'motion/react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Type, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { FORMATS } from '@/projects/formats';
import { useSettings } from '@/settings/store';
import { buttonClasses } from '@/components/ui/button-styles';
import { EmptyState } from '@/components/ui/EmptyState';
import { IconButton } from '@/components/ui/IconButton';
import { LoadingState } from '@/components/ui/LoadingState';
import { cn } from '@/utils/cn';
import * as actions from './actions';
import { useCamera } from './camera';
import { EditorCanvas } from './canvas/EditorCanvas';
import { EditorTopBar } from './EditorTopBar';
import { EditorDialogs, Timeline } from './lazy';
import { useUi } from '@/settings/ui-store';
import { EditorAlerts } from './EditorAlerts';
import { useVersions } from './versioning';
import { subscribe } from '@/storage/sync';
import { CropBar } from './CropBar';
import { PhotoPicker } from './PhotoPicker';
import { importAndPlace } from './photo-actions';
import { useAssets } from '@/assets/store';
import { DocumentPanel } from './panels/DocumentPanels';
import { LayersPanel } from './panels/LayersPanel';
import { PropertiesPanel } from './panels/PropertiesPanel';
import { SlideStrip } from './SlideStrip';
import { MobileEditorChrome } from './MobileEditor';
import { PANEL_TITLES, PanelContent } from './panel-content';
import { usePlayback } from './playback';
import { selectDoc, useEditor } from './store';
import { ToolRail } from './ToolRail';
import { useEditorShortcuts } from './useEditorShortcuts';

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
          className="z-10 hidden shrink-0 overflow-hidden border-r border-line bg-bg-elevated lg:block"
        >
          <div className="flex h-full w-[288px] flex-col">
            <div className="flex h-11 shrink-0 items-center justify-between border-b border-line pr-1.5 pl-4">
              <h2 className="font-sans text-[13px] font-semibold tracking-normal">{PANEL_TITLES[panel]}</h2>
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
    <aside aria-label="Inspector" className="z-10 hidden w-[280px] shrink-0 flex-col border-l border-line bg-bg-elevated lg:flex">
      <div role="tablist" aria-label="Inspector" className="flex h-11 shrink-0 items-stretch gap-4 border-b border-line px-4">
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
              'relative -mb-px border-b-2 text-[13px] font-medium transition-colors',
              tab === t.id ? 'border-fg text-fg' : 'border-transparent text-fg-muted hover:text-fg',
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

/** Phone: which slide is on screen, quietly, at the top of the canvas. */
function SlideCounter() {
  const active = useEditor((s) => s.activeSlide);
  const count = useEditor((s) => selectDoc(s)?.slides.length ?? 0);
  return (
    <div className="pointer-events-none absolute top-2.5 left-1/2 z-10 -translate-x-1/2 lg:hidden" aria-hidden>
      <span className="flex h-6 items-center gap-1 rounded-full bg-bg-elevated/85 px-2.5 font-mono text-[11px] text-fg-muted tabular-nums shadow-[var(--shadow-soft)]">
        <motion.span key={active} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.18 }}>
          {active + 1}
        </motion.span>
        <span className="opacity-50">/ {count}</span>
      </span>
    </div>
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
            {multi && <SlideCounter />}
            <CropBar layout="floating" />
            {tool === 'text' && (
              <div className="pointer-events-none absolute top-3 left-1/2 z-20 -translate-x-1/2 rounded-md border border-line bg-bg-elevated px-3 py-1.5 text-xs font-medium text-fg-muted shadow-[var(--shadow-soft)]">
                <Type className="mr-1 inline size-3.5" />
                <span className="lg:hidden">Tap where the text should go</span>
                <span className="hidden lg:inline">Click anywhere to add text · Esc to cancel</span>
              </div>
            )}
          </div>
          {panel === 'animate' && !cropping && <Timeline />}
          {multi && !cropping && <SlideStrip />}
          {cropping ? (
            <CropBar layout="docked" />
          ) : (
            <MobileEditorChrome />
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

  // The dialog that opened this design has closed; later dialogs animate out as usual.
  useEffect(() => useUi.getState().setOpeningEditor(false), []);

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
          title="We can’t find that design."
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
      <div className="flex min-h-dvh items-center justify-center">
        <LoadingState label="Preparing your canvas…" />
      </div>
    );
  }

  return <Editor />;
}
