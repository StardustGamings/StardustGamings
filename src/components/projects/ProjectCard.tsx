'use client';

import { motion } from 'motion/react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Copy, ExternalLink, MoreHorizontal, PenLine, RotateCcw, Star, Trash2, XCircle } from 'lucide-react';
import type { ProjectMeta } from '@/types/project';
import { FORMATS } from '@/projects/formats';
import { useProjects } from '@/projects/store';
import { formatRelativeTime } from '@/utils/time';
import { useNow } from '@/hooks/useClientValue';
import { cn } from '@/utils/cn';
import { Menu, MenuContent, MenuItem, MenuSeparator, MenuTrigger } from '@/components/ui/Menu';
import { FormatIcon } from '@/components/home/FormatIcon';
import { editorHref } from './useCreateProject';
import { useProjectActions } from './useProjectActions';

function Thumb({ project }: { project: ProjectMeta }) {
  const url = useProjects((s) => s.thumbnails[project.id]);
  const [a, b] = FORMATS[project.format].accent;
  const multi = project.slideCount > 1;
  return (
    <div className="relative flex aspect-[4/5] items-center justify-center overflow-hidden rounded-[20px] bg-bg-sunken">
      <div
        aria-hidden
        className="absolute inset-0 opacity-25"
        style={{
          background: `radial-gradient(circle at 30% 20%, ${a}, transparent 60%), radial-gradient(circle at 80% 90%, ${b}, transparent 55%)`,
        }}
      />
      <div className="relative flex h-[78%] w-[80%] items-center justify-center">
        {multi && url && (
          <>
            <span aria-hidden className="absolute inset-y-[6%] right-[-2%] left-[12%] rounded-[10px] bg-fg/10" />
            <span aria-hidden className="absolute inset-y-[3%] right-[-1%] left-[6%] rounded-[10px] bg-fg/15" />
          </>
        )}
        {url ? (
          // eslint-disable-next-line @next/next/no-img-element -- local object URL
          <img
            src={url}
            alt=""
            draggable={false}
            className="relative max-h-full max-w-full rounded-[10px] object-contain shadow-[var(--shadow-lift)] transition-transform duration-500 ease-[var(--ease-out-expo)] group-hover:scale-[1.03]"
          />
        ) : (
          <span
            className="flex size-14 items-center justify-center rounded-2xl text-ink"
            style={{ background: `linear-gradient(135deg, ${a}, ${b})` }}
          >
            <FormatIcon format={project.format} className="size-6" />
          </span>
        )}
      </div>
    </div>
  );
}

export function ProjectCard({ project, trashed = false }: { project: ProjectMeta; trashed?: boolean }) {
  const actions = useProjectActions();
  const router = useRouter();
  const now = useNow();
  const format = FORMATS[project.format];

  return (
    <motion.article
      layout
      initial={{ opacity: 0, y: 16, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9, filter: 'blur(4px)', transition: { duration: 0.2 } }}
      transition={{ type: 'spring', stiffness: 380, damping: 32 }}
      className="group relative"
      data-testid="project-card"
    >
      <div className="rounded-[24px] border border-line bg-surface p-2 transition-[transform,box-shadow,border-color] duration-300 ease-[var(--ease-out-expo)] group-hover:-translate-y-1 group-hover:border-line-strong group-hover:shadow-[var(--shadow-lift)]">
        <Thumb project={project} />
        <div className="flex items-start gap-2 px-2 pt-3 pb-1.5">
          <div className="min-w-0 flex-1">
            <h3 className="truncate font-sans text-sm font-bold tracking-normal">
              {trashed ? (
                project.name
              ) : (
                <Link
                  href={editorHref(project.id)}
                  className="outline-none after:absolute after:inset-0 after:rounded-[24px] focus-visible:after:outline-2 focus-visible:after:outline-ring"
                >
                  {project.name}
                </Link>
              )}
            </h3>
            <p className="mt-0.5 flex items-center gap-1.5 truncate text-xs text-fg-subtle">
              <FormatIcon format={project.format} className="size-3.5 shrink-0" />
              <span>{format.label}</span>
              {project.slideCount > 1 && <span>· {project.slideCount} slides</span>}
              <span aria-hidden>·</span>
              <time dateTime={new Date(project.updatedAt).toISOString()} suppressHydrationWarning>
                {now === null
                  ? ''
                  : trashed && project.deletedAt
                    ? `Deleted ${formatRelativeTime(project.deletedAt, now)}`
                    : formatRelativeTime(project.updatedAt, now)}
              </time>
            </p>
          </div>
          <Menu>
            <MenuTrigger asChild>
              <button
                type="button"
                aria-label={`Actions for ${project.name}`}
                className="relative z-10 -mr-1 flex size-8 shrink-0 items-center justify-center rounded-[10px] text-fg-subtle transition-colors hover:bg-surface-hover hover:text-fg data-[state=open]:bg-surface-active data-[state=open]:text-fg"
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
            'absolute top-4 left-4 z-10 flex size-8 items-center justify-center rounded-full transition-all',
            project.favorite
              ? 'bg-warning text-ink'
              : 'text-fg-muted opacity-0 glass-strong group-hover:opacity-100 hover:text-fg focus-visible:opacity-100 [@media(hover:none)]:opacity-100',
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
    <div className="rounded-[24px] border border-line bg-surface p-2" aria-hidden>
      <div className="aspect-[4/5] skeleton rounded-[20px]" />
      <div className="space-y-2 px-2 pt-3 pb-2">
        <div className="h-3.5 w-3/4 skeleton rounded-full" />
        <div className="h-3 w-1/2 skeleton rounded-full" />
      </div>
    </div>
  );
}
