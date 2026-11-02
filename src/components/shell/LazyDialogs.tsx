'use client';

import dynamic from 'next/dynamic';
import { useEffect, useState } from 'react';
import { useHotkeys } from '@/hooks/useHotkeys';
import { useSettings } from '@/settings/store';
import { useUi } from '@/settings/ui-store';

/**
 * The app-wide dialogs, loaded the first time they're needed instead of with
 * every page. Each stays mounted once opened (so it can animate closed), and
 * all of them are fetched in the background once the page is idle, so the
 * first open is instant too. The service worker precaches their files, so
 * this works offline as well.
 */

const loaders = {
  newProject: () => import('@/components/projects/NewProjectDialog'),
  photoFlow: () => import('@/components/magic/PhotoFlowDialog'),
  templatePreview: () => import('@/components/templates/TemplatePreviewDialog'),
  saveTemplate: () => import('@/components/templates/SaveTemplateDialog'),
  export: () => import('@/components/export/ExportDialog'),
  palette: () => import('./CommandPalette'),
  onboarding: () => import('@/components/onboarding/Onboarding'),
};

const NewProjectDialog = dynamic(() => loaders.newProject().then((m) => m.NewProjectDialog), { ssr: false });
const PhotoFlowDialog = dynamic(() => loaders.photoFlow().then((m) => m.PhotoFlowDialog), { ssr: false });
const TemplatePreviewDialog = dynamic(() => loaders.templatePreview().then((m) => m.TemplatePreviewDialog), { ssr: false });
const SaveTemplateDialog = dynamic(() => loaders.saveTemplate().then((m) => m.SaveTemplateDialog), { ssr: false });
const ExportDialog = dynamic(() => loaders.export().then((m) => m.ExportDialog), { ssr: false });
const CommandPalette = dynamic(() => loaders.palette().then((m) => m.CommandPalette), { ssr: false });
const Onboarding = dynamic(() => loaders.onboarding().then((m) => m.Onboarding), { ssr: false });

/** True from the first time `active` is true. */
function useOnce(active: boolean): boolean {
  const [on, setOn] = useState(active);
  if (active && !on) setOn(true);
  return on;
}

/** Fetches every dialog's code once the page has settled. */
function usePrefetch() {
  useEffect(() => {
    const run = () => Object.values(loaders).forEach((load) => void load().catch(() => undefined));
    if (typeof requestIdleCallback === 'function') {
      const id = requestIdleCallback(run, { timeout: 5000 });
      return () => cancelIdleCallback(id);
    }
    const id = setTimeout(run, 2500);
    return () => clearTimeout(id);
  }, []);
}

export function LazyDialogs() {
  usePrefetch();
  // Ctrl/⌘ K works before the palette's code has loaded.
  useHotkeys({ 'mod+k': () => useUi.getState().setPaletteOpen(!useUi.getState().paletteOpen) }, { allowInInputs: true });

  const newProject = useOnce(useUi((s) => s.newProject !== null));
  const photoFlow = useOnce(useUi((s) => s.photoFlow !== null));
  const templatePreview = useOnce(useUi((s) => s.templatePreview !== null));
  const saveTemplate = useOnce(useUi((s) => s.saveTemplate !== null));
  const exportDialog = useOnce(useUi((s) => s.exportRequest !== null));
  const palette = useOnce(useUi((s) => s.paletteOpen));
  const firstRun = useSettings((s) => s.hasHydrated && !s.onboarded);
  const replay = useUi((s) => Boolean(s.onboardingReplay));
  const onboarding = useOnce(firstRun || replay);

  return (
    <>
      {newProject && <NewProjectDialog />}
      {photoFlow && <PhotoFlowDialog />}
      {templatePreview && <TemplatePreviewDialog />}
      {saveTemplate && <SaveTemplateDialog />}
      {exportDialog && <ExportDialog />}
      {palette && <CommandPalette />}
      {onboarding && <Onboarding />}
    </>
  );
}
