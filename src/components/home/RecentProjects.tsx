'use client';

import { AnimatePresence } from 'motion/react';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { useMemo } from 'react';
import { useProjects } from '@/projects/store';
import { useSettings } from '@/settings/store';
import { useUi } from '@/settings/ui-store';
import { Button } from '@/components/ui/Button';
import { buttonClasses } from '@/components/ui/button-styles';
import { EmptyState } from '@/components/ui/EmptyState';
import { ProjectCard, ProjectCardSkeleton } from '@/components/projects/ProjectCard';
import { SectionHeader } from './SectionHeader';

const LIMIT = 10;

export function RecentProjects() {
  const status = useProjects((s) => s.status);
  const projects = useProjects((s) => s.projects);
  const openNewProject = useUi((s) => s.openNewProject);
  const defaultFormat = useSettings((s) => s.editor.defaultFormat);
  const active = useMemo(() => projects.filter((p) => p.deletedAt === null), [projects]);
  const loading = status === 'idle' || status === 'loading';

  return (
    <section aria-labelledby="recent-projects" className="mt-14">
      <SectionHeader
        id="recent-projects"
        eyebrow="Your studio"
        title="Recent projects"
        action={
          active.length > 0 && (
            <Link href="/projects/" className={buttonClasses({ variant: 'ghost', size: 'sm' })}>
              View all <ArrowRight className="size-4" />
            </Link>
          )
        }
      />
      {loading ? (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
          {[0, 1, 2, 3, 4].map((i) => (
            <ProjectCardSkeleton key={i} />
          ))}
        </div>
      ) : active.length === 0 ? (
        <EmptyState
          title="No designs yet 👀"
          description="Your first masterpiece is literally one tap away."
          action={
            <Button variant="primary" magnetic onClick={() => openNewProject(defaultFormat)}>
              Create Something
            </Button>
          }
        />
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
          <AnimatePresence mode="popLayout">
            {active.slice(0, LIMIT).map((p) => (
              <ProjectCard key={p.id} project={p} />
            ))}
          </AnimatePresence>
        </div>
      )}
    </section>
  );
}
