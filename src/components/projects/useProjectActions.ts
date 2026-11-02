'use client';

import { useMemo } from 'react';
import { useProjects } from '@/projects/store';
import { useUi } from '@/settings/ui-store';
import { toast } from '@/components/ui/toast-store';

const oops = (what: string) =>
  toast({ title: `Couldn’t ${what}`, description: 'Something blocked local storage. Please try again.', tone: 'error' });

/** Project mutations with friendly feedback and undo where it makes sense. */
export function useProjectActions() {
  const setRenameId = useUi((s) => s.setRenameId);
  const setPurgeId = useUi((s) => s.setPurgeId);

  return useMemo(
    () => ({
      rename: (id: string) => setRenameId(id),
      duplicate: async (id: string) => {
        try {
          const copy = await useProjects.getState().duplicate(id);
          toast({ title: 'Duplicated', description: copy.name, tone: 'success' });
        } catch {
          oops('duplicate that project');
        }
      },
      toggleFavorite: async (id: string) => {
        try {
          await useProjects.getState().toggleFavorite(id);
        } catch {
          oops('update favourites');
        }
      },
      trash: async (id: string) => {
        try {
          await useProjects.getState().trash(id);
          toast({
            title: 'Moved to trash',
            description: 'Kept for 30 days, then cleared automatically.',
            action: { label: 'Undo', onClick: () => void useProjects.getState().restore(id) },
          });
        } catch {
          oops('move that to the trash');
        }
      },
      restore: async (id: string) => {
        try {
          await useProjects.getState().restore(id);
          toast({ title: 'Restored', tone: 'success' });
        } catch {
          oops('restore that project');
        }
      },
      deleteForever: (id: string) => setPurgeId(id),
    }),
    [setRenameId, setPurgeId],
  );
}
