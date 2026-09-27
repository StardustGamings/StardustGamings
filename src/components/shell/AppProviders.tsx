'use client';

import { MotionConfig } from 'motion/react';
import { useEffect, type ReactNode } from 'react';
import { useSettings } from '@/settings/store';
import { useProjects } from '@/projects/store';
import { useTrends } from '@/trends/store';
import { useStorageSync } from '@/storage/useStorageSync';
import { useResolvedMotion } from '@/hooks/usePreferences';
import { Toaster } from '@/components/ui/Toaster';
import { TooltipProvider } from '@/components/ui/Tooltip';
import { ProjectDialogs } from '@/components/projects/ProjectDialogs';
import { TransferStatus } from '@/components/projects/TransferStatus';
import { Backdrop } from './Backdrop';
import { LazyDialogs } from './LazyDialogs';
import { ServiceWorker } from './ServiceWorker';
import { ThemeController } from './ThemeController';

export function AppProviders({ children }: { children: ReactNode }) {
  const motion = useResolvedMotion();
  const loadProjects = useProjects((s) => s.load);
  const refreshTrends = useTrends((s) => s.refresh);
  useStorageSync();

  useEffect(() => {
    // Trends wait for settings: the user may have turned trend downloads off.
    void Promise.resolve(useSettings.persist.rehydrate()).then(() => refreshTrends());
    // Signals that client handlers (shortcuts etc.) are live — used by e2e tests.
    document.documentElement.dataset.ready = 'true';
    void loadProjects();
  }, [loadProjects, refreshTrends]);

  return (
    <MotionConfig reducedMotion={motion === 'full' ? 'never' : 'always'} skipAnimations={motion === 'off'}>
      <TooltipProvider>
        <ThemeController />
        <Backdrop />
        {children}
        <ProjectDialogs />
        <LazyDialogs />
        <TransferStatus />
        <Toaster />
        <ServiceWorker />
      </TooltipProvider>
    </MotionConfig>
  );
}
