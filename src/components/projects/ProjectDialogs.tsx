'use client';

import { useState } from 'react';
import { useProjects } from '@/projects/store';
import { MAX_NAME_LENGTH } from '@/projects/repository';
import { useUi } from '@/settings/ui-store';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Dialog } from '@/components/ui/Dialog';
import { TextField } from '@/components/ui/TextField';
import { toast } from '@/components/ui/toast-store';

function RenameDialog() {
  const id = useUi((s) => s.renameId);
  const setId = useUi((s) => s.setRenameId);
  const project = useProjects((s) => s.projects.find((p) => p.id === id));
  const rename = useProjects((s) => s.rename);
  const [name, setName] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  if (id !== editingId) {
    setEditingId(id);
    if (project) setName(project.name);
  }

  const save = async () => {
    if (!id) return;
    try {
      await rename(id, name);
      setId(null);
    } catch {
      toast({ title: 'Couldn’t rename that project', tone: 'error' });
    }
  };

  return (
    <Dialog
      open={Boolean(id && project)}
      onOpenChange={(open) => !open && setId(null)}
      title="Rename project"
      size="sm"
      footer={
        <>
          <Button variant="ghost" onClick={() => setId(null)}>
            Cancel
          </Button>
          <Button variant="primary" onClick={save} disabled={!name.trim()}>
            Save name
          </Button>
        </>
      }
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void save();
        }}
      >
        <TextField
          label="Name"
          value={name}
          autoFocus
          maxLength={MAX_NAME_LENGTH}
          onChange={(e) => setName(e.target.value)}
          onFocus={(e) => e.currentTarget.select()}
          hint={`${name.length}/${MAX_NAME_LENGTH}`}
        />
      </form>
    </Dialog>
  );
}

function PurgeDialog() {
  const id = useUi((s) => s.purgeId);
  const setId = useUi((s) => s.setPurgeId);
  const project = useProjects((s) => s.projects.find((p) => p.id === id));
  const deleteForever = useProjects((s) => s.deleteForever);
  return (
    <ConfirmDialog
      open={Boolean(id && project)}
      onOpenChange={(open) => !open && setId(null)}
      title="Delete forever?"
      description={`“${project?.name ?? ''}” will be permanently removed from this device. This can’t be undone.`}
      confirmLabel="Delete forever"
      destructive
      onConfirm={async () => {
        if (!id) return;
        await deleteForever(id);
        toast({ title: 'Deleted permanently' });
      }}
    />
  );
}

export function ProjectDialogs() {
  return (
    <>
      <RenameDialog />
      <PurgeDialog />
    </>
  );
}
