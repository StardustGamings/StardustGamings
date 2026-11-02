'use client';

import { AnimatePresence } from 'motion/react';
import Link from 'next/link';
import { useMemo } from 'react';
import { useProjects } from '@/projects/store';
import { useSettings } from '@/settings/store';
import { useUi } from '@/settings/ui-store';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { ProjectCard, ProjectCardSkeleton } from '@/components/projects/ProjectCard';
import { SectionHeader } from './SectionHeader';

const LIMIT = 10;

/* Phones: a swipeable row that bleeds to the screen edge; wider screens: a grid. */
const ROW =
  '-mx-4 flex snap-x snap-mandatory scroll-px-4 gap-3 overflow-x-auto px-4 pb-1 hide-scrollbar sm:mx-0 sm:grid sm:snap-none sm:grid-cols-3 sm:gap-4 sm:overflow-visible sm:px-0 lg:grid-cols-5';
const ITEM = 'w-[44%] min-w-[148px] max-w-[190px] shrink-0 snap-start sm:w-auto sm:max-w-none sm:min-w-0';

export function RecentProjects() {
  const status = useProjects((s) => s.status);
  const projects = useProjects((s) => s.projects);
  const openNewProject = useUi((s) => s.openNewProject);
  const defaultFormat = useSettings((s) => s.editor.defaultFormat);
  const active = useMemo(() => projects.filter((p) => p.deletedAt === null), [projects]);
  const loading = status === 'idle' || status === 'loading';

  return (
    <section aria-labelledby="recent-projects">
      <SectionHeader
        id="recent-projects"
        title="Recent"
        action={
          active.length > 0 && (
            <Link href="/projects/" className="text-[13.5px] font-medium text-accent-text hover:underline">
              See all
            </Link>
          )
        }
      />
      {loading ? (
        <div className={ROW}>
          {[0, 1, 2, 3, 4].map((i) => (
            <div key={i} className={ITEM}>
              <ProjectCardSkeleton />
            </div>
          ))}
        </div>
      ) : active.length === 0 ? (
        <EmptyState
          compact
          className="rounded-lg bg-surface"
          title="No designs yet."
          description="Start with a blank canvas or pick a template."
          action={
            <Button variant="primary" onClick={() => openNewProject(defaultFormat)}>
              Create
            </Button>
          }
        />
      ) : (
        <div className={ROW}>
          <AnimatePresence mode="popLayout">
            {active.slice(0, LIMIT).map((p) => (
              <ProjectCard key={p.id} project={p} className={ITEM} />
            ))}
          </AnimatePresence>
        </div>
      )}
    </section>
  );
}
