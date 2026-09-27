import type { Metadata } from 'next';
import { Suspense } from 'react';
import { ProjectsBrowser } from '@/components/projects/ProjectsBrowser';

export const metadata: Metadata = { title: 'Projects' };

export default function ProjectsPage() {
  return (
    <>
      <header className="pb-6">
        <h1 className="text-display">Projects</h1>
        <p className="mt-2 max-w-xl text-caption">
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
