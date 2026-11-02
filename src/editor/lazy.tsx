'use client';

import dynamic from 'next/dynamic';
import { useEffect, useState } from 'react';
import { useUi } from '@/settings/ui-store';
import { Spinner } from '@/components/ui/Spinner';

/**
 * Editor tools that aren't on screen when a design opens: their code loads the
 * first time they're used (and in the background once the editor is idle), so
 * opening a design only waits for the canvas, layers and properties.
 */

const loaders = {
  templates: () => import('./panels/TemplatesPanel'),
  photos: () => import('./panels/PhotosPanel'),
  layouts: () => import('./panels/LayoutsPanel'),
  filters: () => import('./panels/FiltersPanel'),
  animate: () => import('./panels/AnimatePanel'),
  trends: () => import('./panels/TrendsPanel'),
  magic: () => import('./panels/MagicPanel'),
  timeline: () => import('./Timeline'),
  preview: () => import('./PreviewDialog'),
  history: () => import('./VersionHistoryDialog'),
  resize: () => import('./ResizeDialog'),
};

function PanelLoading() {
  return (
    <div className="flex justify-center py-10" role="status" aria-label="Loading">
      <Spinner />
    </div>
  );
}

export const TemplatesPanel = dynamic(() => loaders.templates().then((m) => m.TemplatesPanel), {
  ssr: false,
  loading: PanelLoading,
});
export const PhotosPanel = dynamic(() => loaders.photos().then((m) => m.PhotosPanel), { ssr: false, loading: PanelLoading });
export const LayoutsPanel = dynamic(() => loaders.layouts().then((m) => m.LayoutsPanel), { ssr: false, loading: PanelLoading });
export const FiltersPanel = dynamic(() => loaders.filters().then((m) => m.FiltersPanel), { ssr: false, loading: PanelLoading });
export const AnimatePanel = dynamic(() => loaders.animate().then((m) => m.AnimatePanel), { ssr: false, loading: PanelLoading });
export const TrendsPanel = dynamic(() => loaders.trends().then((m) => m.TrendsPanel), { ssr: false, loading: PanelLoading });
export const MagicPanel = dynamic(() => loaders.magic().then((m) => m.MagicPanel), { ssr: false, loading: PanelLoading });
export const Timeline = dynamic(() => loaders.timeline().then((m) => m.Timeline), { ssr: false });

const PreviewDialog = dynamic(() => loaders.preview().then((m) => m.PreviewDialog), { ssr: false });
const VersionHistoryDialog = dynamic(() => loaders.history().then((m) => m.VersionHistoryDialog), { ssr: false });
const ResizeDialog = dynamic(() => loaders.resize().then((m) => m.ResizeDialog), { ssr: false });

/** True from the first time `active` is true. */
function useOnce(active: boolean): boolean {
  const [on, setOn] = useState(active);
  if (active && !on) setOn(true);
  return on;
}

/** The editor's dialogs, mounted once first opened; every lazy tool is fetched when the editor is idle. */
export function EditorDialogs() {
  useEffect(() => {
    const run = () => Object.values(loaders).forEach((load) => void load().catch(() => undefined));
    if (typeof requestIdleCallback === 'function') {
      const id = requestIdleCallback(run, { timeout: 4000 });
      return () => cancelIdleCallback(id);
    }
    const id = setTimeout(run, 2000);
    return () => clearTimeout(id);
  }, []);
  const preview = useOnce(useUi((s) => s.carouselPreview));
  const history = useOnce(useUi((s) => s.historyOpen));
  const resize = useOnce(useUi((s) => s.resize !== null));
  return (
    <>
      {preview && <PreviewDialog />}
      {history && <VersionHistoryDialog />}
      {resize && <ResizeDialog />}
    </>
  );
}
