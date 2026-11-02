'use client';

import { motion } from 'motion/react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  BookmarkPlus,
  Copy,
  Download,
  ExternalLink,
  FileDown,
  Folder as FolderIcon,
  FolderInput,
  MoreHorizontal,
  PenLine,
  RotateCcw,
  Star,
  Trash2,
  XCircle,
} from 'lucide-react';
import type { ProjectMeta } from '@/types/project';
import { FORMATS } from '@/projects/formats';
import { useProjects } from '@/projects/store';
import { useUi } from '@/settings/ui-store';
import { formatRelativeTime } from '@/utils/time';
import { useNow } from '@/hooks/useClientValue';
import { cn } from '@/utils/cn';
import { Menu, MenuContent, MenuItem, MenuSeparator, MenuTrigger } from '@/components/ui/Menu';
import { FormatIcon } from '@/components/home/FormatIcon';
import { editorHref } from './useCreateProject';
import { useProjectActions } from './useProjectActions';
import { downloadProjectFile } from './project-files';

function Thumb({ project }: { project: ProjectMeta }) {
  const url = useProjects((s) => s.thumbnails[project.id]);
  const multi = project.slideCount > 1;
  return (
    <div className="relative flex aspect-[4/5] items-center justify-center overflow-hidden rounded-lg bg-bg-sunken">
      <div className="relative flex h-[84%] w-[84%] items-center justify-center">
        {multi && url && (
          <span aria-hidden className="absolute inset-y-[5%] right-[-4%] left-[10%] rounded-[3px] bg-surface-active" />
        )}
        {url ? (
          <motion.img
            src={url}
            alt=""
            draggable={false}
            initial={{ opacity: 0, scale: 0.985 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.28, ease: [0.2, 0, 0, 1] }}
            className="relative max-h-full max-w-full rounded-[3px] object-contain shadow-[var(--shadow-lift)] transition-transform duration-300 ease-[var(--ease-emphasized)] group-hover:-translate-y-0.5"
          />
        ) : (
          <span className="flex size-12 items-center justify-center rounded-md border border-line-strong text-fg-subtle">
            <FormatIcon format={project.format} className="size-5" />
          </span>
        )}
      </div>
    </div>
  );
}

/** Drag-and-drop payload type for moving a card onto a folder. */
export const PROJECT_DRAG_TYPE = 'application/x-stardeck-project';

export function ProjectCard({
  project,
  trashed = false,
  showFolder = false,
  className,
}: {
  project: ProjectMeta;
  trashed?: boolean;
  className?: string;
  /** Show which folder the project is in (when the list isn't already filtered to one). */
  showFolder?: boolean;
}) {
  const actions = useProjectActions();
  const router = useRouter();
  const now = useNow();
  const format = FORMATS[project.format];
  const folder = useProjects((s) =>
    showFolder && project.folderId ? s.folders.find((f) => f.id === project.folderId) : undefined,
  );

  return (
    <motion.article
      layout
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, scale: 0.97, transition: { duration: 0.16 } }}
      transition={{ duration: 0.2, ease: [0.2, 0, 0, 1] }}
      className={cn('group relative', className)}
      data-testid="project-card"
    >
      <div
        onDragStart={(e) => {
          if (trashed) return;
          e.dataTransfer.setData(PROJECT_DRAG_TYPE, project.id);
          e.dataTransfer.effectAllowed = 'copyMove';
        }}
      >
        <Thumb project={project} />
        <div className="flex items-start gap-1 pt-2.5 pl-0.5">
          <div className="min-w-0 flex-1">
            <h3 className="truncate text-[14px] leading-snug font-semibold tracking-[-0.01em]">
              {trashed ? (
                project.name
              ) : (
                <Link
                  href={editorHref(project.id)}
                  className="outline-none after:absolute after:inset-0 after:rounded-lg focus-visible:after:outline-2 focus-visible:after:outline-ring"
                >
                  {project.name}
                </Link>
              )}
            </h3>
            <p className="mt-0.5 flex items-center gap-1.5 truncate text-meta">
              <span className="truncate">
                {format.label}
                {project.slideCount > 1 && ` · ${project.slideCount} slides`}
              </span>
              <span aria-hidden>·</span>
              <time className="shrink-0" dateTime={new Date(project.updatedAt).toISOString()} suppressHydrationWarning>
                {now === null
                  ? ''
                  : trashed && project.deletedAt
                    ? `Deleted ${formatRelativeTime(project.deletedAt, now)}`
                    : formatRelativeTime(project.updatedAt, now)}
              </time>
            </p>
            {folder && (
              <p className="mt-1 flex items-center gap-1 truncate text-[11.5px] font-medium text-fg-muted">
                <FolderIcon className="size-3 shrink-0" style={{ color: folder.color }} fill={folder.color} fillOpacity={0.3} />
                <span className="truncate">{folder.name}</span>
              </p>
            )}
          </div>
          <Menu>
            <MenuTrigger asChild>
              <button
                type="button"
                aria-label={`Actions for ${project.name}`}
                className="relative z-10 -mt-1 -mr-1.5 flex size-9 shrink-0 items-center justify-center rounded-md text-fg-subtle transition-colors hover:bg-surface-hover hover:text-fg data-[state=open]:bg-surface-active data-[state=open]:text-fg"
              >
                <MoreHorizontal className="size-[18px]" />
              </button>
            </MenuTrigger>
            <MenuContent>
              {trashed ? (
                <>
                  <MenuItem icon={<RotateCcw />} onSelect={() => void actions.restore(project.id)}>
                    Restore
                  </MenuItem>
                  <MenuSeparator />
                  <MenuItem icon={<XCircle />} destructive onSelect={() => actions.deleteForever(project.id)}>
                    Delete forever
                  </MenuItem>
                </>
              ) : (
                <>
                  <MenuItem icon={<ExternalLink />} onSelect={() => router.push(editorHref(project.id))}>
                    Open
                  </MenuItem>
                  <MenuItem icon={<PenLine />} onSelect={() => actions.rename(project.id)}>
                    Rename
                  </MenuItem>
                  <MenuItem icon={<Copy />} onSelect={() => void actions.duplicate(project.id)}>
                    Duplicate
                  </MenuItem>
                  <MenuItem icon={<FolderInput />} onSelect={() => useUi.getState().openMove([project.id])}>
                    Move to folder…
                  </MenuItem>
                  <MenuItem
                    icon={<Download />}
                    onSelect={() => useUi.getState().openExport({ source: 'project', projectId: project.id })}
                  >
                    Export…
                  </MenuItem>
                  <MenuItem icon={<FileDown />} onSelect={() => void downloadProjectFile(project.id)}>
                    Download project file
                  </MenuItem>
                  <MenuItem
                    icon={<BookmarkPlus />}
                    onSelect={() => useUi.getState().openSaveTemplate({ source: 'project', projectId: project.id })}
                  >
                    Save as template
                  </MenuItem>
                  <MenuItem icon={<Star />} onSelect={() => void actions.toggleFavorite(project.id)}>
                    {project.favorite ? 'Remove from favourites' : 'Add to favourites'}
                  </MenuItem>
                  <MenuSeparator />
                  <MenuItem icon={<Trash2 />} destructive onSelect={() => void actions.trash(project.id)}>
                    Move to trash
                  </MenuItem>
                </>
              )}
            </MenuContent>
          </Menu>
        </div>
      </div>
      {!trashed && (
        <button
          type="button"
          aria-label={project.favorite ? `Unfavourite ${project.name}` : `Favourite ${project.name}`}
          aria-pressed={project.favorite}
          onClick={() => void actions.toggleFavorite(project.id)}
          className={cn(
            'absolute top-2 left-2 z-10 flex size-8 items-center justify-center rounded-full transition-[opacity,background-color,color] duration-150',
            project.favorite
              ? 'bg-accent-2 text-ink'
              : 'bg-bg-elevated/90 text-fg-muted opacity-0 group-hover:opacity-100 hover:text-fg focus-visible:opacity-100',
          )}
        >
          <Star className={cn('size-4', project.favorite && 'fill-current')} />
        </button>
      )}
    </motion.article>
  );
}

export function ProjectCardSkeleton() {
  return (
    <div aria-hidden>
      <div className="aspect-[4/5] skeleton rounded-lg" />
      <div className="space-y-2 pt-3 pl-0.5">
        <div className="h-3.5 w-3/4 skeleton rounded-xs" />
        <div className="h-3 w-1/2 skeleton rounded-xs" />
      </div>
    </div>
  );
}
