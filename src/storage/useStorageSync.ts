'use client';

import { useEffect } from 'react';
import { useAssets } from '@/assets/store';
import { useProjects } from '@/projects/store';
import { subscribe } from './sync';

/** Applies changes made in other tabs to this one's lists (projects, folders, photos). The editor adds its own listener. */
export function useStorageSync(): void {
  useEffect(
    () =>
      subscribe((message) => {
        if (message.type === 'project') void useProjects.getState().refresh(message.id);
        else if (message.type === 'library') void useProjects.getState().reload();
        else if (message.type === 'assets') void useAssets.getState().reload();
      }),
    [],
  );
}
