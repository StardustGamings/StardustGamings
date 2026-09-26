'use client';

import { Check, Folder as FolderIcon, FolderMinus, FolderPlus } from 'lucide-react';
import { useMemo, useState } from 'react';
import { FOLDER_COLORS, MAX_FOLDER_NAME } from '@/projects/folders';
import { useProjects } from '@/projects/store';
import { useUi, type FolderDialogRequest } from '@/settings/ui-store';
import { Button } from '@/components/ui/Button';
import { Dialog } from '@/components/ui/Dialog';
import { TextField } from '@/components/ui/TextField';
import { toast } from '@/components/ui/toast-store';
import { cn } from '@/utils/cn';

const COLOR_NAMES = ['Lime', 'Mint', 'Sky', 'Violet', 'Pink', 'Coral', 'Amber', 'Slate'];

/** Moves projects and says so, with an undo. */
export async function moveWithToast(ids: string[], folderId: string | null) {
  const { projects, folders, moveToFolder } = useProjects.getState();
  const before = new Map(projects.filter((p) => ids.includes(p.id)).map((p) => [p.id, p.folderId]));
  if ([...before.values()].every((f) => f === folderId)) return;
  await moveToFolder(ids, folderId);
  const folder = folders.find((f) => f.id === folderId);
  const what = ids.length === 1 ? `“${projects.find((p) => p.id === ids[0])?.name ?? 'Project'}”` : `${ids.length} projects`;
  toast({
    title: folder ? `Moved ${what} to ${folder.name}` : `Took ${what} out of its folder`,
    tone: 'success',
    action: {
      label: 'Undo',
      onClick: () => {
        for (const [id, previous] of before) void useProjects.getState().moveToFolder([id], previous);
      },
    },
  });
}

function FolderForm({ request, onClose }: { request: FolderDialogRequest; onClose: () => void }) {
  const folder = useProjects((s) => (request.mode === 'edit' ? s.folders.find((f) => f.id === request.id) : undefined));
  const folderCount = useProjects((s) => s.folders.length);
  const [name, setName] = useState(folder?.name ?? '');
  const [color, setColor] = useState<string>(folder?.color ?? FOLDER_COLORS[folderCount % FOLDER_COLORS.length]!);
  const [busy, setBusy] = useState(false);
  const editing = request.mode === 'edit';

  const save = async () => {
    if (!name.trim()) return;
    setBusy(true);
    try {
      const store = useProjects.getState();
      if (request.mode === 'edit') {
        await store.updateFolder(request.id, { name, color });
      } else {
        const created = await store.createFolder(name, color);
        if (request.moveIds?.length) await moveWithToast(request.moveIds, created.id);
        else toast({ title: `Created “${created.name}”`, tone: 'success', duration: 2000 });
      }
      onClose();
    } catch {
      toast({ title: 'Couldn’t save that folder', tone: 'error' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog
      open
      onOpenChange={(open) => !open && onClose()}
      title={editing ? 'Edit folder' : 'New folder'}
      size="sm"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" onClick={() => void save()} disabled={!name.trim()} loading={busy} data-testid="folder-save">
            {editing ? 'Save' : request.moveIds?.length ? 'Create and move' : 'Create folder'}
          </Button>
        </>
      }
    >
      <form
        className="flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          void save();
        }}
      >
        <TextField
          label="Folder name"
          value={name}
          autoFocus
          placeholder="e.g. Client work"
          maxLength={MAX_FOLDER_NAME}
          onChange={(e) => setName(e.target.value)}
          onFocus={(e) => e.currentTarget.select()}
        />
        <div>
          <p className="mb-2 text-[13px] font-semibold">Colour</p>
          <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Folder colour">
            {FOLDER_COLORS.map((c, i) => (
              <button
                key={c}
                type="button"
                role="radio"
                aria-checked={color === c}
                aria-label={COLOR_NAMES[i] ?? c}
                onClick={() => setColor(c)}
                className={cn(
                  'flex size-9 items-center justify-center rounded-full border-2 transition-transform hover:scale-105',
                  color === c ? 'border-fg' : 'border-transparent',
                )}
                style={{ background: c }}
              >
                {color === c && <Check className="size-4 text-ink" strokeWidth={3} />}
              </button>
            ))}
          </div>
        </div>
      </form>
    </Dialog>
  );
}

function MoveForm({ ids, onClose }: { ids: string[]; onClose: () => void }) {
  const folders = useProjects((s) => s.folders);
  const all = useProjects((s) => s.projects);
  const projects = useMemo(() => all.filter((p) => ids.includes(p.id)), [all, ids]);
  const current =
    projects.length && projects.every((p) => p.folderId === projects[0]!.folderId) ? projects[0]!.folderId : undefined;
  const [target, setTarget] = useState<string | null>(current ?? null);
  const title = projects.length === 1 ? `Move “${projects[0]!.name}”` : `Move ${projects.length} projects`;

  return (
    <Dialog
      open
      onOpenChange={(open) => !open && onClose()}
      title={title}
      size="sm"
      footer={
        <>
          <Button
            variant="ghost"
            icon={<FolderPlus className="size-4" />}
            onClick={() => {
              onClose();
              useUi.getState().openFolderDialog({ mode: 'create', moveIds: ids });
            }}
          >
            New folder
          </Button>
          <Button
            variant="primary"
            data-testid="move-confirm"
            onClick={async () => {
              await moveWithToast(ids, target);
              onClose();
            }}
          >
            Move
          </Button>
        </>
      }
    >
      <div role="radiogroup" aria-label="Folder" className="flex flex-col gap-1">
        {[{ id: null, name: 'No folder', color: null }, ...folders].map((f) => (
          <button
            key={f.id ?? 'none'}
            type="button"
            role="radio"
            aria-checked={target === f.id}
            onClick={() => setTarget(f.id)}
            className={cn(
              'flex h-11 items-center gap-3 rounded-[12px] px-3 text-left text-sm font-semibold transition-colors',
              target === f.id ? 'bg-surface-active ring-1 ring-ring' : 'hover:bg-surface-hover',
            )}
          >
            {f.color ? (
              <FolderIcon className="size-4.5 shrink-0" style={{ color: f.color }} fill={f.color} fillOpacity={0.25} />
            ) : (
              <FolderMinus className="size-4.5 shrink-0 text-fg-muted" />
            )}
            <span className="flex-1 truncate">{f.name}</span>
            {current === f.id && <span className="text-[11px] font-medium text-fg-subtle">Current</span>}
          </button>
        ))}
        {folders.length === 0 && (
          <p className="px-3 pt-2 text-[13px] text-fg-muted">No folders yet — make one to start sorting your designs.</p>
        )}
      </div>
    </Dialog>
  );
}

export function FolderDialogs() {
  const folderRequest = useUi((s) => s.folderDialog);
  const closeFolder = useUi((s) => s.closeFolderDialog);
  const moveIds = useUi((s) => s.moveIds);
  const closeMove = useUi((s) => s.closeMove);
  return (
    <>
      {folderRequest && (
        <FolderForm
          key={folderRequest.mode === 'edit' ? folderRequest.id : 'new'}
          request={folderRequest}
          onClose={closeFolder}
        />
      )}
      {moveIds && <MoveForm ids={moveIds} onClose={closeMove} />}
    </>
  );
}
