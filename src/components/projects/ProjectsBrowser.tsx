'use client';

import { AnimatePresence } from 'motion/react';
import { useRouter, useSearchParams } from 'next/navigation';
import { FileUp, Folder as FolderIcon, FolderPlus, PenLine, Search, Trash2, X } from 'lucide-react';
import { useMemo, useRef, useState } from 'react';
import type { Folder, FormatId, ProjectMeta } from '@/types/project';
import { FORMAT_ORDER, FORMATS } from '@/projects/formats';
import { TRASH_RETENTION_DAYS } from '@/projects/repository';
import { useProjects } from '@/projects/store';
import { useSettings } from '@/settings/store';
import { useUi } from '@/settings/ui-store';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { EmptyState } from '@/components/ui/EmptyState';
import { IconButton } from '@/components/ui/IconButton';
import { Segmented } from '@/components/ui/Segmented';
import { TextField } from '@/components/ui/TextField';
import { toast } from '@/components/ui/toast-store';
import { cn } from '@/utils/cn';
import { moveWithToast } from './FolderDialogs';
import { importFiles, isProjectFile, PROJECT_FILE_ACCEPT } from './project-files';
import { PROJECT_DRAG_TYPE, ProjectCard, ProjectCardSkeleton } from './ProjectCard';
import { StorageNotice } from './StorageNotice';

type View = 'all' | 'favorites' | 'trash';
/** `all` = every folder. */
type FolderFilter = 'all' | string;

/** A folder chip; also a drop target for dragged project cards. */
function FolderChip({
  label,
  count,
  color,
  active,
  onClick,
  onDropProject,
}: {
  label: string;
  count: number;
  color?: string;
  active: boolean;
  onClick: () => void;
  onDropProject: (id: string) => void;
}) {
  const [over, setOver] = useState(false);
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      onDragOver={(e) => {
        if (!e.dataTransfer.types.includes(PROJECT_DRAG_TYPE)) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        setOver(false);
        const id = e.dataTransfer.getData(PROJECT_DRAG_TYPE);
        if (!id) return;
        e.preventDefault();
        onDropProject(id);
      }}
      className={cn(
        'flex h-8 shrink-0 items-center gap-2 rounded-md border px-2.5 text-[13px] font-medium transition-colors',
        active
          ? 'border-line-strong bg-surface-active text-fg'
          : 'border-line text-fg-muted hover:border-line-strong hover:text-fg',
        over && 'border-accent bg-accent/12 text-fg',
      )}
    >
      {color && <FolderIcon className="size-4 shrink-0" style={{ color }} fill={color} fillOpacity={0.3} aria-hidden />}
      <span className="max-w-[160px] truncate">{label}</span>
      <span className={cn('text-[11px] font-medium', active ? 'text-fg-muted' : 'text-fg-subtle')}>{count}</span>
    </button>
  );
}
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
  const [folderFilter, setFolderFilter] = useState<FolderFilter>(params.get('folder') ?? 'all');
  const [confirmFolderDelete, setConfirmFolderDelete] = useState<Folder | null>(null);
  const [droppingFiles, setDroppingFiles] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<Sort>('updated');
  const [format, setFormat] = useState<FormatId | 'any'>('any');
  const [confirmEmpty, setConfirmEmpty] = useState(false);

  const status = useProjects((s) => s.status);
  const projects = useProjects((s) => s.projects);
  const folders = useProjects((s) => s.folders);
  const emptyTrash = useProjects((s) => s.emptyTrash);
  const deleteFolder = useProjects((s) => s.deleteFolder);
  const openFolderDialog = useUi((s) => s.openFolderDialog);
  // A folder deleted elsewhere (e.g. another tab) falls back to everything.
  const activeFolder = folders.find((f) => f.id === folderFilter) ?? null;
  const folderId = activeFolder?.id ?? 'all';
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

  const folderCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const p of projects) {
      if (p.deletedAt !== null || (view === 'favorites' && !p.favorite) || !p.folderId) continue;
      counts.set(p.folderId, (counts.get(p.folderId) ?? 0) + 1);
    }
    return counts;
  }, [projects, view]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return projects
      .filter((p) => (view === 'trash' ? p.deletedAt !== null : p.deletedAt === null))
      .filter((p) => view !== 'favorites' || p.favorite)
      .filter((p) => view === 'trash' || folderId === 'all' || p.folderId === folderId)
      .filter((p) => format === 'any' || p.format === format)
      .filter((p) => !q || p.name.toLowerCase().includes(q) || FORMATS[p.format].label.toLowerCase().includes(q))
      .sort(SORTERS[sort]);
  }, [projects, view, query, sort, format, folderId]);

  const syncUrl = (v: View, f: FolderFilter) => {
    const q = new URLSearchParams();
    if (v !== 'all') q.set('view', v);
    if (f !== 'all' && v !== 'trash') q.set('folder', f);
    const search = q.toString();
    router.replace(search ? `/projects/?${search}` : '/projects/', { scroll: false });
  };
  const changeView = (v: View) => {
    setView(v);
    syncUrl(v, folderId);
  };
  const changeFolder = (f: FolderFilter) => {
    setFolderFilter(f);
    syncUrl(view, f);
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
    if (activeFolder && view !== 'trash')
      return (
        <EmptyState
          title={`${activeFolder.name} is empty 📂`}
          description="Drag designs onto the folder, or use “Move to folder…” in a project’s menu."
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
          <Button variant="primary" onClick={() => openNewProject(defaultFormat)}>
            Create Something
          </Button>
        }
      />
    );
  };

  const importPicked = async (list: FileList | File[] | null) => {
    const files = [...(list ?? [])].filter(isProjectFile);
    if (files.length === 0) {
      if (list?.length)
        toast({ title: 'That isn’t a Stardeck file', description: 'Pick a .stardeck project file or backup.', tone: 'error' });
      return;
    }
    await importFiles(files);
  };

  return (
    <div
      className="relative"
      onDragOver={(e) => {
        if (!e.dataTransfer.types.includes('Files')) return;
        e.preventDefault();
        setDroppingFiles(true);
      }}
      onDragLeave={(e) => {
        if (e.currentTarget === e.target || !e.currentTarget.contains(e.relatedTarget as Node)) setDroppingFiles(false);
      }}
      onDrop={(e) => {
        if (!e.dataTransfer.types.includes('Files')) return;
        e.preventDefault();
        setDroppingFiles(false);
        void importPicked([...e.dataTransfer.files]);
      }}
    >
      {droppingFiles && (
        <div className="pointer-events-none absolute -inset-3 z-30 flex items-center justify-center rounded-xl border-2 border-dashed border-accent bg-bg/85">
          <p className="flex items-center gap-2 rounded-md border border-line bg-bg-elevated px-4 py-2 font-semibold">
            <FileUp className="size-5 text-accent-text" /> Drop a .stardeck file to import it
          </p>
        </div>
      )}
      <input
        ref={fileInput}
        type="file"
        accept={PROJECT_FILE_ACCEPT}
        multiple
        hidden
        data-testid="project-file-input"
        onChange={(e) => {
          void importPicked(e.target.files);
          e.target.value = '';
        }}
      />
      <StorageNotice />
      <div className="mb-5 flex flex-col gap-3 lg:flex-row lg:items-center">
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
            className="h-9 rounded-md border border-line bg-bg-sunken px-2.5 text-sm text-fg outline-none focus:border-ring"
          >
            <option value="updated">Last edited</option>
            <option value="created">Newest</option>
            <option value="name">Name A–Z</option>
          </select>
          <Button
            icon={<FileUp className="size-4" />}
            onClick={() => fileInput.current?.click()}
            title="Open a .stardeck project file or backup"
          >
            Import
          </Button>
          {view === 'trash' && counts.trash > 0 && (
            <Button variant="danger" icon={<Trash2 className="size-4" />} onClick={() => setConfirmEmpty(true)}>
              Empty trash
            </Button>
          )}
        </div>
      </div>

      {view !== 'trash' && (
        <div className="mb-4">
          <div
            className="-mx-4 hide-scrollbar flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0"
            role="group"
            aria-label="Folders"
          >
            <FolderChip
              label="All projects"
              count={view === 'favorites' ? counts.favorites : counts.all}
              active={folderId === 'all'}
              onClick={() => changeFolder('all')}
              onDropProject={(id) => void moveWithToast([id], null)}
            />
            {folders.map((f) => (
              <FolderChip
                key={f.id}
                label={f.name}
                color={f.color}
                count={folderCounts.get(f.id) ?? 0}
                active={folderId === f.id}
                onClick={() => changeFolder(f.id)}
                onDropProject={(id) => void moveWithToast([id], f.id)}
              />
            ))}
            <button
              type="button"
              onClick={() => openFolderDialog({ mode: 'create' })}
              className="flex h-8 shrink-0 items-center gap-1.5 rounded-md border border-dashed border-line-strong px-2.5 text-[13px] font-medium text-fg-muted transition-colors hover:border-fg-muted hover:text-fg"
            >
              <FolderPlus className="size-4" /> New folder
            </button>
          </div>
          {activeFolder && (
            <div className="mt-3 flex items-center gap-2" data-testid="folder-header">
              <FolderIcon
                className="size-5"
                style={{ color: activeFolder.color }}
                fill={activeFolder.color}
                fillOpacity={0.3}
                aria-hidden
              />
              <h2 className="truncate text-heading">{activeFolder.name}</h2>
              <IconButton
                label="Edit folder"
                icon={<PenLine />}
                size="sm"
                onClick={() => openFolderDialog({ mode: 'edit', id: activeFolder.id })}
              />
              <IconButton
                label="Delete folder"
                icon={<Trash2 />}
                size="sm"
                onClick={() => setConfirmFolderDelete(activeFolder)}
              />
            </div>
          )}
        </div>
      )}

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
              'h-7 shrink-0 rounded-sm border px-2.5 text-xs font-medium transition-colors',
              format === f ? 'border-line-strong bg-surface-active text-fg' : 'border-line text-fg-muted hover:text-fg',
            )}
          >
            {f === 'any' ? 'All formats' : FORMATS[f].label}
          </button>
        ))}
      </div>

      {/* Cards are h3s; in a folder the folder's name is the h2, otherwise this one is. */}
      {!activeFolder && <h2 className="sr-only">{view === 'trash' ? 'Trash' : 'Designs'}</h2>}
      {loading ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {Array.from({ length: 5 }, (_, i) => (
            <ProjectCardSkeleton key={i} />
          ))}
        </div>
      ) : visible.length === 0 ? (
        empty()
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          <AnimatePresence mode="popLayout">
            {visible.map((p) => (
              <ProjectCard
                key={p.id}
                project={p}
                trashed={view === 'trash'}
                showFolder={folderId === 'all' && view !== 'trash'}
              />
            ))}
          </AnimatePresence>
        </div>
      )}

      <ConfirmDialog
        open={confirmFolderDelete !== null}
        onOpenChange={(open) => !open && setConfirmFolderDelete(null)}
        title={`Delete the folder “${confirmFolderDelete?.name ?? ''}”?`}
        description="Only the folder goes — every design in it stays in All projects."
        confirmLabel="Delete folder"
        destructive
        onConfirm={async () => {
          if (!confirmFolderDelete) return;
          const moved = await deleteFolder(confirmFolderDelete.id);
          changeFolder('all');
          toast({
            title: 'Folder deleted',
            description: moved ? `${moved} design${moved === 1 ? '' : 's'} moved to All projects.` : undefined,
          });
        }}
      />

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
    </div>
  );
}
