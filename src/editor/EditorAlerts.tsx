'use client';

import { AnimatePresence, motion } from 'motion/react';
import { useRouter } from 'next/navigation';
import { AlertTriangle, CopyCheck, FileDown, RefreshCw } from 'lucide-react';
import type { ReactNode } from 'react';
import { downloadProjectFile } from '@/components/projects/project-files';
import { Button } from '@/components/ui/Button';
import { selectDoc, useEditor } from './store';

function Alert({
  icon,
  title,
  description,
  actions,
}: {
  icon: ReactNode;
  title: string;
  description: string;
  actions: ReactNode;
}) {
  return (
    <motion.div
      role="alert"
      data-testid="editor-alert"
      initial={{ opacity: 0, y: -12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -12 }}
      className="absolute top-3 left-1/2 z-30 flex w-[min(560px,calc(100%-24px))] -translate-x-1/2 flex-col gap-3 rounded-lg border border-warning/40 p-4 shadow-[var(--shadow-float)] glass-strong sm:flex-row sm:items-center"
    >
      <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-warning/15 text-warning">{icon}</span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-bold">{title}</p>
        <p className="text-[12.5px] leading-snug text-fg-muted">{description}</p>
      </div>
      <div className="flex shrink-0 flex-wrap gap-2">{actions}</div>
    </motion.div>
  );
}

const rescue = () => {
  const ed = useEditor.getState();
  if (ed.meta) void downloadProjectFile(ed.meta.id, selectDoc(ed) ?? undefined);
};

/** Save failures and edits made in another tab — each with a way out that never loses work. */
export function EditorAlerts() {
  const router = useRouter();
  const conflict = useEditor((s) => s.conflict);
  const saveError = useEditor((s) => s.saveError);
  const saveState = useEditor((s) => s.saveState);
  const resolve = useEditor((s) => s.resolveConflict);
  const save = useEditor((s) => s.save);

  let content: ReactNode = null;
  if (conflict === 'changed') {
    content = (
      <Alert
        key="changed"
        icon={<CopyCheck className="size-5" />}
        title="This design was changed in another tab"
        description="Your edits here aren’t saved yet. Load the latest version, or keep yours and save over it."
        actions={
          <>
            <Button size="sm" onClick={() => void resolve('theirs')} data-testid="conflict-theirs">
              Load latest
            </Button>
            <Button size="sm" variant="primary" onClick={() => void resolve('mine')} data-testid="conflict-mine">
              Keep mine
            </Button>
          </>
        }
      />
    );
  } else if (conflict === 'trashed') {
    content = (
      <Alert
        key="trashed"
        icon={<AlertTriangle className="size-5" />}
        title="This design was deleted in another tab"
        description="Keep working on it to bring it back, or leave it in the trash."
        actions={
          <>
            <Button size="sm" onClick={() => router.push('/projects/?view=trash')}>
              Leave it
            </Button>
            <Button size="sm" variant="primary" onClick={() => void resolve('mine')} data-testid="conflict-restore">
              Keep editing
            </Button>
          </>
        }
      />
    );
  } else if (saveState === 'error' && saveError === 'quota') {
    content = (
      <Alert
        key="quota"
        icon={<AlertTriangle className="size-5" />}
        title="Your device is out of space"
        description="Your latest changes aren’t saved. Download a copy to be safe, then free up space in Settings → Storage."
        actions={
          <>
            <Button size="sm" icon={<FileDown className="size-4" />} onClick={rescue}>
              Download a copy
            </Button>
            <Button size="sm" variant="primary" icon={<RefreshCw className="size-4" />} onClick={() => void save()}>
              Try again
            </Button>
          </>
        }
      />
    );
  } else if (saveState === 'error') {
    content = (
      <Alert
        key="failed"
        icon={<AlertTriangle className="size-5" />}
        title="Couldn’t save your latest changes"
        description="Retrying on its own. If it keeps failing, download a copy so nothing is lost."
        actions={
          <>
            <Button size="sm" icon={<FileDown className="size-4" />} onClick={rescue}>
              Download a copy
            </Button>
            <Button size="sm" variant="primary" icon={<RefreshCw className="size-4" />} onClick={() => void save()}>
              Try again
            </Button>
          </>
        }
      />
    );
  }
  return <AnimatePresence>{content}</AnimatePresence>;
}
