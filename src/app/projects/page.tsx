import type { Metadata } from 'next';
import { Suspense } from 'react';
import { ProjectsBrowser } from '@/components/projects/ProjectsBrowser';

export const metadata: Metadata = { title: 'Projects' };

export default function ProjectsPage() {
  return (
    <>
      <header className="pt-4 pb-8">
        <p className="mb-1.5 text-[11px] font-bold tracking-[0.14em] text-accent-text uppercase">Saved on this device</p>
        <h1 className="text-4xl font-extrabold sm:text-5xl">Projects</h1>
        <p className="mt-2 max-w-lg text-sm text-fg-muted">
          Everything autosaves locally in your browser — nothing is uploaded. Favourite the keepers, and anything you delete waits
          in the trash for 30 days.
        </p>
      </header>
      <Suspense>
        <ProjectsBrowser />
      </Suspense>
    </>
  );
}
