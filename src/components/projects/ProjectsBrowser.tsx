'use client';

import { AnimatePresence } from 'motion/react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Search, Trash2, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import type { FormatId, ProjectMeta } from '@/types/project';
import { FORMAT_ORDER, FORMATS } from '@/projects/formats';
import { TRASH_RETENTION_DAYS } from '@/projects/repository';
import { useProjects } from '@/projects/store';
import { useSettings } from '@/settings/store';
import { useUi } from '@/settings/ui-store';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { EmptyState } from '@/components/ui/EmptyState';
import { Segmented } from '@/components/ui/Segmented';
import { TextField } from '@/components/ui/TextField';
import { toast } from '@/components/ui/toast-store';
import { cn } from '@/utils/cn';
import { ProjectCard, ProjectCardSkeleton } from './ProjectCard';
import { StorageNotice } from './StorageNotice';

type View = 'all' | 'favorites' | 'trash';
type Sort = 'updated' | 'created' | 'name';

const SORTERS: Record<Sort, (a: ProjectMeta, b: ProjectMeta) => number> = {
  updated: (a, b) => b.updatedAt - a.updatedAt,
  created: (a, b) => b.createdAt - a.createdAt,
  name: (a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }),
};

export function ProjectsBrowser() {
  const params = useSearchParams();
  const router = useRouter();
  const initialView = params.get('view');
  const [view, setView] = useState<View>(initialView === 'trash' || initialView === 'favorites' ? initialView : 'all');
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<Sort>('updated');
  const [format, setFormat] = useState<FormatId | 'any'>('any');
  const [confirmEmpty, setConfirmEmpty] = useState(false);

  const status = useProjects((s) => s.status);
  const projects = useProjects((s) => s.projects);
  const emptyTrash = useProjects((s) => s.emptyTrash);
  const openNewProject = useUi((s) => s.openNewProject);
  const defaultFormat = useSettings((s) => s.editor.defaultFormat);

  const counts = useMemo(
    () => ({
      all: projects.filter((p) => p.deletedAt === null).length,
      favorites: projects.filter((p) => p.deletedAt === null && p.favorite).length,
      trash: projects.filter((p) => p.deletedAt !== null).length,
    }),
    [projects],
  );

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return projects
      .filter((p) => (view === 'trash' ? p.deletedAt !== null : p.deletedAt === null))
      .filter((p) => view !== 'favorites' || p.favorite)
      .filter((p) => format === 'any' || p.format === format)
      .filter((p) => !q || p.name.toLowerCase().includes(q) || FORMATS[p.format].label.toLowerCase().includes(q))
      .sort(SORTERS[sort]);
  }, [projects, view, query, sort, format]);

  const changeView = (v: View) => {
    setView(v);
    router.replace(v === 'all' ? '/projects/' : `/projects/?view=${v}`, { scroll: false });
  };

  const loading = status === 'idle' || status === 'loading';
  const filtered = query.trim() !== '' || format !== 'any';

  const empty = () => {
    if (filtered)
      return (
        <EmptyState
          title="Nothing matches that 🔍"
          description="Try a different name, or clear the filters."
          action={
            <Button
              variant="secondary"
              onClick={() => {
                setQuery('');
                setFormat('any');
              }}
            >
              Clear filters
            </Button>
          }
        />
      );
    if (view === 'favorites')
      return <EmptyState title="No favourites yet ⭐" description="Tap the star on any project to pin it here." />;
    if (view === 'trash')
      return (
        <EmptyState
          title="Trash is empty ✨"
          description={`Deleted projects wait here for ${TRASH_RETENTION_DAYS} days before they’re cleared.`}
        />
      );
    return (
      <EmptyState
        title="No designs yet 👀"
        description="Your first masterpiece is literally one tap away."
        action={
          <Button variant="primary" magnetic onClick={() => openNewProject(defaultFormat)}>
            Create Something
          </Button>
        }
      />
    );
  };

  return (
    <>
      <StorageNotice />
      <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-center">
        <Segmented
          value={view}
          onChange={changeView}
          aria-label="Project view"
          options={[
            { value: 'all', label: `All · ${counts.all}` },
            { value: 'favorites', label: `Favourites · ${counts.favorites}` },
            { value: 'trash', label: `Trash · ${counts.trash}` },
          ]}
        />
        <TextField
          aria-label="Search projects"
          placeholder="Search projects"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          leading={<Search />}
          trailing={
            query && (
              <button
                type="button"
                aria-label="Clear search"
                onClick={() => setQuery('')}
                className="text-fg-subtle hover:text-fg"
              >
                <X className="size-4" />
              </button>
            )
          }
          className="flex-1 lg:max-w-sm"
        />
        <div className="flex items-center gap-2 lg:ml-auto">
          <label className="sr-only" htmlFor="sort">
            Sort by
          </label>
          <select
            id="sort"
            value={sort}
            onChange={(e) => setSort(e.target.value as Sort)}
            className="h-11 rounded-[13px] border border-line bg-bg-sunken/70 px-3 text-sm text-fg outline-none focus:border-ring"
          >
            <option value="updated">Last edited</option>
            <option value="created">Newest</option>
            <option value="name">Name A–Z</option>
          </select>
          {view === 'trash' && counts.trash > 0 && (
            <Button variant="danger" icon={<Trash2 className="size-4" />} onClick={() => setConfirmEmpty(true)}>
              Empty trash
            </Button>
          )}
        </div>
      </div>

      <div
        className="-mx-4 mb-6 hide-scrollbar flex gap-2 overflow-x-auto px-4 sm:mx-0 sm:px-0"
        role="group"
        aria-label="Filter by format"
      >
        {(['any', ...FORMAT_ORDER] as const).map((f) => (
          <button
            key={f}
            type="button"
            aria-pressed={format === f}
            onClick={() => setFormat(f)}
            className={cn(
              'h-8 shrink-0 rounded-full border px-3 text-xs font-semibold transition-colors',
              format === f ? 'border-transparent bg-fg text-bg' : 'border-line text-fg-muted hover:text-fg',
            )}
          >
            {f === 'any' ? 'All formats' : FORMATS[f].label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {Array.from({ length: 5 }, (_, i) => (
            <ProjectCardSkeleton key={i} />
          ))}
        </div>
      ) : visible.length === 0 ? (
        empty()
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          <AnimatePresence mode="popLayout">
            {visible.map((p) => (
              <ProjectCard key={p.id} project={p} trashed={view === 'trash'} />
            ))}
          </AnimatePresence>
        </div>
      )}

      <ConfirmDialog
        open={confirmEmpty}
        onOpenChange={setConfirmEmpty}
        title="Empty the trash?"
        description={`${counts.trash} project${counts.trash === 1 ? '' : 's'} will be permanently deleted from this device.`}
        confirmLabel="Empty trash"
        destructive
        onConfirm={async () => {
          const n = await emptyTrash();
          toast({ title: `Deleted ${n} project${n === 1 ? '' : 's'} permanently` });
        }}
      />
    </>
  );
}
