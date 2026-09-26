'use client';

import { useRouter } from 'next/navigation';
import { Bookmark, Check, Copy, History, PenLine, RotateCcw, ShieldCheck, Trash2, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import type { VersionRecord } from '@/types/project';
import { ScenePreview } from '@/canvas/ScenePreview';
import { renderThumbnail } from '@/canvas/thumbnail';
import { copyVersionToProject, MAX_VERSION_NAME, VERSION_RETENTION_DAYS, versionTitle } from '@/projects/versions';
import { useProjects } from '@/projects/store';
import { useUi } from '@/settings/ui-store';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Dialog } from '@/components/ui/Dialog';
import { IconButton } from '@/components/ui/IconButton';
import { Spinner } from '@/components/ui/Spinner';
import { TextField } from '@/components/ui/TextField';
import { toast } from '@/components/ui/toast-store';
import { editorHref } from '@/components/projects/useCreateProject';
import { cn } from '@/utils/cn';
import { formatRelativeTime } from '@/utils/time';
import { selectDoc, useEditor } from './store';
import { restoreVersion, saveVersion, useVersions } from './versioning';

const time = (t: number) => new Date(t).toLocaleTimeString('en', { hour: 'numeric', minute: '2-digit' });

function dayLabel(t: number, now: number): string {
  const day = (x: number) => new Date(x).toDateString();
  if (day(t) === day(now)) return 'Today';
  if (day(t) === day(now - 24 * 3600e3)) return 'Yesterday';
  return new Date(t).toLocaleDateString('en', { weekday: 'short', month: 'short', day: 'numeric' });
}

function Row({
  selected,
  onSelect,
  title,
  subtitle,
  preview,
  badge,
  testId,
}: {
  selected: boolean;
  onSelect: () => void;
  title: string;
  subtitle: string;
  preview: React.ReactNode;
  badge?: React.ReactNode;
  testId?: string;
}) {
  return (
    <button
      type="button"
      role="option"
      aria-selected={selected}
      onClick={onSelect}
      data-testid={testId}
      className={cn(
        'flex w-full items-center gap-3 rounded-[14px] p-2 text-left transition-colors',
        selected ? 'bg-surface-active ring-1 ring-ring' : 'hover:bg-surface-hover',
      )}
    >
      <span className="w-11 shrink-0 overflow-hidden rounded-[8px] border border-line bg-bg-sunken">{preview}</span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1.5 truncate text-[13.5px] font-semibold">
          <span className="truncate">{title}</span>
          {badge}
        </span>
        <span className="block truncate text-[12px] text-fg-muted">{subtitle}</span>
      </span>
    </button>
  );
}

function Body({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const meta = useEditor((s) => s.meta);
  const current = useEditor(selectDoc);
  const saveState = useEditor((s) => s.saveState);
  const lastSavedAt = useEditor((s) => s.lastSavedAt);
  const { list, status, load, rename, remove } = useVersions();
  const [selectedId, setSelectedId] = useState<string>('current');
  const [draft, setDraft] = useState('');
  const [saving, setSaving] = useState(false);
  const [renaming, setRenaming] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<VersionRecord | null>(null);
  const [busy, setBusy] = useState(false);
  const [now] = useState(() => Date.now());

  useEffect(() => {
    if (meta) void load(meta.id);
  }, [meta, load]);

  const version = list.find((v) => v.id === selectedId) ?? null;
  const previewDoc = version?.doc ?? current;
  const groups = useMemo(() => {
    const out: { label: string; items: VersionRecord[] }[] = [];
    for (const v of list) {
      const label = dayLabel(v.createdAt, now);
      const last = out[out.length - 1];
      if (last?.label === label) last.items.push(v);
      else out.push({ label, items: [v] });
    }
    return out;
  }, [list, now]);

  if (!meta || !current || !previewDoc) return null;

  const saveNamed = async () => {
    setSaving(true);
    try {
      await useEditor.getState().save();
      const saved = await saveVersion({ name: draft.trim() || null });
      setDraft('');
      toast(
        saved
          ? { title: saved.name ? `Saved “${saved.name}”` : 'Version saved', tone: 'success', duration: 2200 }
          : { title: 'Nothing new to save', description: 'The latest version already matches your design.' },
      );
      if (saved) setSelectedId(saved.id);
    } catch {
      toast({ title: 'Couldn’t save the version', description: 'Your device may be out of space.', tone: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const restore = async (v: VersionRecord) => {
    setBusy(true);
    try {
      await restoreVersion(v);
      onClose();
      toast({
        title: `Restored the ${time(v.createdAt)} version`,
        description: 'Your previous design is kept in History.',
        tone: 'success',
        action: { label: 'Undo', onClick: () => useEditor.getState().undo() },
      });
    } finally {
      setBusy(false);
    }
  };

  const openCopy = async (v: VersionRecord) => {
    setBusy(true);
    try {
      const project = await copyVersionToProject(v.id);
      useProjects.getState().upsert(project.meta);
      void renderThumbnail(project.doc).then((blob) => blob && useProjects.getState().setThumbnail(project.meta.id, blob));
      toast({
        title: 'Saved as a new design',
        description: project.meta.name,
        tone: 'success',
        action: {
          label: 'Open',
          onClick: () => {
            onClose();
            router.push(editorHref(project.meta.id));
          },
        },
      });
    } catch {
      toast({ title: 'Couldn’t copy that version', tone: 'error' });
    } finally {
      setBusy(false);
    }
  };

  const currentSubtitle =
    saveState === 'saved' && lastSavedAt ? `Saved ${formatRelativeTime(lastSavedAt, Math.max(now, lastSavedAt))}` : 'Saving…';

  return (
    <Dialog
      open
      onOpenChange={(open) => !open && onClose()}
      size="xl"
      title="Version history"
      description="Earlier versions of this design, kept on this device."
      bodyClassName="px-4 sm:px-6"
    >
      <div className="grid gap-5 sm:grid-cols-[minmax(0,300px)_minmax(0,1fr)]">
        <div className="order-2 flex min-w-0 flex-col gap-3 sm:order-1">
          <form
            className="flex items-end gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              void saveNamed();
            }}
          >
            <TextField
              aria-label="Version name"
              placeholder="Name this version"
              value={draft}
              maxLength={MAX_VERSION_NAME}
              onChange={(e) => setDraft(e.target.value)}
              className="flex-1"
            />
            <Button
              type="submit"
              variant="primary"
              icon={<Bookmark className="size-4" />}
              loading={saving}
              data-testid="save-version"
            >
              Save
            </Button>
          </form>

          <div role="listbox" aria-label="Versions" className="flex flex-col gap-1 sm:max-h-[52dvh] sm:overflow-y-auto sm:pr-1">
            <Row
              selected={selectedId === 'current'}
              onSelect={() => setSelectedId('current')}
              title="Current design"
              subtitle={currentSubtitle}
              preview={<ScenePreview doc={current} eager maxDpr={1} />}
              badge={<Badge tone="accent">Now</Badge>}
              testId="version-current"
            />
            {status === 'loading' && list.length === 0 && (
              <div className="flex justify-center py-6">
                <Spinner label="Loading versions" />
              </div>
            )}
            {groups.map((group) => (
              <div key={group.label} className="flex flex-col gap-1">
                <p className="px-2 pt-3 pb-1 text-[11px] font-semibold tracking-[0.08em] text-fg-subtle uppercase">
                  {group.label}
                </p>
                {group.items.map((v) => (
                  <Row
                    key={v.id}
                    selected={selectedId === v.id}
                    onSelect={() => {
                      setSelectedId(v.id);
                      setRenaming(null);
                    }}
                    title={versionTitle(v)}
                    subtitle={`${time(v.createdAt)} · ${v.slideCount} slide${v.slideCount === 1 ? '' : 's'}`}
                    preview={<ScenePreview doc={v.doc} maxDpr={1} />}
                    badge={
                      v.name ? (
                        <Bookmark className="size-3.5 shrink-0 fill-current text-accent-text" aria-label="Named" />
                      ) : undefined
                    }
                    testId="version-row"
                  />
                ))}
              </div>
            ))}
            {status === 'ready' && list.length === 0 && (
              <p className="px-2 py-4 text-[13px] leading-relaxed text-fg-muted">
                No earlier versions yet. As you edit, Stardeck keeps them here automatically — or save one now with a name.
              </p>
            )}
          </div>
        </div>

        <div className="order-1 flex min-w-0 flex-col gap-3 sm:order-2" data-testid="version-preview">
          <div className="flex min-h-10 items-center gap-2">
            {version && renaming === version.id ? (
              <form
                className="flex flex-1 items-center gap-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  const value = new FormData(e.currentTarget).get('name');
                  void rename(version.id, typeof value === 'string' && value.trim() ? value : null).then(() => setRenaming(null));
                }}
              >
                <TextField
                  name="name"
                  aria-label="Rename version"
                  defaultValue={version.name ?? ''}
                  placeholder="Version name"
                  maxLength={MAX_VERSION_NAME}
                  autoFocus
                  className="flex-1"
                />
                <IconButton type="submit" label="Save name" icon={<Check />} size="sm" />
                <IconButton type="button" label="Cancel" icon={<X />} size="sm" onClick={() => setRenaming(null)} />
              </form>
            ) : (
              <>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-display text-lg font-bold">{version ? versionTitle(version) : 'Current design'}</p>
                  <p className="text-[12.5px] text-fg-muted">
                    {version
                      ? `${dayLabel(version.createdAt, now)} at ${time(version.createdAt)} · ${version.slideCount} slide${version.slideCount === 1 ? '' : 's'}`
                      : 'What you’re editing now'}
                  </p>
                </div>
                {version && (
                  <>
                    <IconButton label="Rename version" icon={<PenLine />} size="sm" onClick={() => setRenaming(version.id)} />
                    <IconButton label="Delete version" icon={<Trash2 />} size="sm" onClick={() => setConfirmDelete(version)} />
                  </>
                )}
              </>
            )}
          </div>

          <div className="hide-scrollbar flex gap-2 overflow-x-auto rounded-[18px] bg-bg-sunken/60 p-2">
            {previewDoc.slides.map((slide, i) => (
              <div
                key={slide.id}
                className={cn(
                  'shrink-0 overflow-hidden rounded-[10px] border border-line',
                  previewDoc.slides.length === 1 ? 'w-36 sm:w-full sm:max-w-[320px]' : 'w-28 sm:w-48',
                )}
              >
                <ScenePreview doc={previewDoc} slide={i} maxDpr={1.5} label={`Slide ${i + 1}`} />
              </div>
            ))}
          </div>

          {version ? (
            <div className="flex flex-wrap gap-2">
              <Button
                variant="primary"
                icon={<RotateCcw className="size-4" />}
                loading={busy}
                onClick={() => void restore(version)}
                data-testid="restore-version"
              >
                Restore this version
              </Button>
              <Button icon={<Copy className="size-4" />} disabled={busy} onClick={() => void openCopy(version)}>
                Save as a new design
              </Button>
            </div>
          ) : (
            <p className="hidden items-center gap-2 text-[13px] text-fg-muted sm:flex">
              <History className="size-4 shrink-0" /> Pick a version to preview it, restore it or save it as a new design.
            </p>
          )}
        </div>
      </div>

      <p className="mt-4 flex items-start gap-1.5 text-[11.5px] leading-snug text-fg-subtle">
        <ShieldCheck className="mt-px size-3.5 shrink-0 text-success" />
        Versions stay on this device: every change from the last hour, one an hour for a day and one a day for{' '}
        {VERSION_RETENTION_DAYS} days. Named versions are kept until you delete them. Restoring can be undone.
      </p>

      <ConfirmDialog
        open={confirmDelete !== null}
        onOpenChange={(open) => !open && setConfirmDelete(null)}
        title="Delete this version?"
        description="It’s removed from this device. Your current design isn’t affected."
        confirmLabel="Delete version"
        destructive
        onConfirm={async () => {
          if (!confirmDelete) return;
          await remove(confirmDelete.id);
          setSelectedId('current');
          toast({ title: 'Version deleted', duration: 2000 });
        }}
      />
    </Dialog>
  );
}

/** Version history for the design open in the editor. */
export function VersionHistoryDialog() {
  const open = useUi((s) => s.historyOpen);
  const setOpen = useUi((s) => s.setHistoryOpen);
  if (!open) return null;
  return <Body onClose={() => setOpen(false)} />;
}
