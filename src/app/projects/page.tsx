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
          Saved on this device as you work. Deleted designs wait in the trash for 30 days.
        </p>
      </header>
      <Suspense>
        <ProjectsBrowser />
      </Suspense>
    </>
  );
}
