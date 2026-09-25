'use client';

import { AnimatePresence, motion } from 'motion/react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Grid3x3, Maximize, ScanLine } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { FORMATS } from '@/projects/formats';
import { useSettings } from '@/settings/store';
import { buttonClasses } from '@/components/ui/button-styles';
import { Dialog } from '@/components/ui/Dialog';
import { EmptyState } from '@/components/ui/EmptyState';
import { Spinner } from '@/components/ui/Spinner';
import { cn } from '@/utils/cn';
import { CanvasViewport } from './CanvasViewport';
import { EditorTopBar } from './EditorTopBar';
import { BackgroundPanel, DocumentPanel } from './Panels';
import { SlideStrip } from './SlideStrip';
import { selectDoc, useEditor } from './store';
import { ToolButton, ToolRail, TOOLS, type PanelId } from './ToolRail';
import { useEditorShortcuts } from './useEditorShortcuts';

function MobileToolbar({ onPanel }: { onPanel: (p: PanelId | null) => void }) {
  const showGrid = useEditor((s) => s.showGrid);
  const showSafeArea = useEditor((s) => s.showSafeArea);
  const toggleGrid = useEditor((s) => s.toggleGrid);
  const toggleSafeArea = useEditor((s) => s.toggleSafeArea);
  const setZoom = useEditor((s) => s.setZoom);
  const extra = [
    { id: 'fit', label: 'Fit', icon: <Maximize />, on: false, run: () => setZoom(null) },
    { id: 'grid', label: 'Grid', icon: <Grid3x3 />, on: showGrid, run: toggleGrid },
    { id: 'safe', label: 'Safe', icon: <ScanLine />, on: showSafeArea, run: toggleSafeArea },
  ];
  return (
    <nav aria-label="Tools" className="z-10 shrink-0 border-x-0 border-b-0 safe-bottom glass-strong lg:hidden">
      <div className="hide-scrollbar flex gap-1 overflow-x-auto px-2 py-1.5">
        {TOOLS.filter((t) => t.id !== 'select').map((tool) => (
          <ToolButton
            key={tool.id}
            tool={tool}
            orientation="horizontal"
            active={false}
            onClick={() => onPanel(tool.panel ?? null)}
          />
        ))}
        <span className="mx-1 w-px shrink-0 self-stretch bg-line" />
        {extra.map((x) => (
          <button
            key={x.id}
            type="button"
            onClick={x.run}
            aria-pressed={x.id === 'fit' ? undefined : x.on}
            className={cn(
              'flex h-14 w-16 shrink-0 flex-col items-center justify-center gap-1 rounded-[14px] text-[10px] font-semibold transition-colors [&_svg]:size-5',
              x.on ? 'bg-surface-active text-fg' : 'text-fg-muted',
            )}
          >
            {x.icon}
            {x.label}
          </button>
        ))}
      </div>
    </nav>
  );
}

function Editor() {
  const doc = useEditor(selectDoc);
  const meta = useEditor((s) => s.meta);
  const saveState = useEditor((s) => s.saveState);
  const [panel, setPanel] = useState<PanelId | null>(null);
  const [mobileSheet, setMobileSheet] = useState(false);
  const [zoom, setZoomValue] = useState(0.25);
  const onZoomComputed = useCallback((z: number) => setZoomValue(z), []);
  useEditorShortcuts(zoom);

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

  const openPanel = (p: PanelId | null) => {
    setPanel(p);
    if (p && typeof window !== 'undefined' && window.innerWidth < 1024) setMobileSheet(true);
  };

  return (
    <div className="fixed inset-0 flex flex-col bg-bg" data-save-state={saveState}>
      <EditorTopBar zoom={zoom} />
      <div className="flex min-h-0 flex-1">
        <ToolRail panel={panel} onPanel={setPanel} />
        <div className="flex min-w-0 flex-1 flex-col">
          <div className="relative min-h-0 flex-1">
            <CanvasViewport onZoomComputed={onZoomComputed} />
          </div>
          {multi && <SlideStrip />}
        </div>
        <aside
          aria-label={panel === 'design' ? 'Background' : 'Document'}
          className="hidden w-[300px] shrink-0 overflow-y-auto border-y-0 border-r-0 glass-strong lg:block"
        >
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={panel ?? 'doc'}
              initial={{ opacity: 0, x: 12 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -12 }}
              transition={{ duration: 0.18 }}
            >
              {panel === 'design' ? <BackgroundPanel /> : <DocumentPanel />}
            </motion.div>
          </AnimatePresence>
        </aside>
      </div>
      <MobileToolbar onPanel={openPanel} />
      <Dialog open={mobileSheet} onOpenChange={setMobileSheet} title="Background" size="md" bodyClassName="px-0 pb-4 pt-0">
        <BackgroundPanel />
      </Dialog>
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
    void load(id, { showGrid, showSafeArea });
    return () => reset();
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
