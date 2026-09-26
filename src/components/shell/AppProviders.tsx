'use client';

import { MotionConfig } from 'motion/react';
import { useEffect, type ReactNode } from 'react';
import { useSettings } from '@/settings/store';
import { useProjects } from '@/projects/store';
import { useTrends } from '@/trends/store';
import { useResolvedMotion } from '@/hooks/usePreferences';
import { Toaster } from '@/components/ui/Toaster';
import { TooltipProvider } from '@/components/ui/Tooltip';
import { NewProjectDialog } from '@/components/projects/NewProjectDialog';
import { ProjectDialogs } from '@/components/projects/ProjectDialogs';
import { Onboarding } from '@/components/onboarding/Onboarding';
import { PhotoFlowDialog } from '@/components/magic/PhotoFlowDialog';
import { SaveTemplateDialog } from '@/components/templates/SaveTemplateDialog';
import { TemplatePreviewDialog } from '@/components/templates/TemplatePreviewDialog';
import { Backdrop } from './Backdrop';
import { CommandPalette } from './CommandPalette';
import { ServiceWorker } from './ServiceWorker';
import { ThemeController } from './ThemeController';

export function AppProviders({ children }: { children: ReactNode }) {
  const motion = useResolvedMotion();
  const loadProjects = useProjects((s) => s.load);
  const refreshTrends = useTrends((s) => s.refresh);

  useEffect(() => {
    void useSettings.persist.rehydrate();
    // Signals that client handlers (shortcuts etc.) are live — used by e2e tests.
    document.documentElement.dataset.ready = 'true';
    void loadProjects();
    void refreshTrends();
  }, [loadProjects, refreshTrends]);

  return (
    <MotionConfig reducedMotion={motion === 'full' ? 'never' : 'always'} skipAnimations={motion === 'off'}>
      <TooltipProvider>
        <ThemeController />
        <Backdrop />
        {children}
        <NewProjectDialog />
        <ProjectDialogs />
        <PhotoFlowDialog />
        <TemplatePreviewDialog />
        <SaveTemplateDialog />
        <CommandPalette />
        <Onboarding />
        <Toaster />
        <ServiceWorker />
      </TooltipProvider>
    </MotionConfig>
  );
}
