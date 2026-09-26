'use client';

import { create } from 'zustand';
import type { DesignDocument } from '@/types/document';
import { useAssets } from '@/assets/store';
import { renderThumbnail } from '@/canvas/thumbnail';
import { getProject } from '@/projects/repository';
import { useProjects } from '@/projects/store';
import { importProjectFile, PROJECT_FILE_EXTENSION, ProjectFileError, writeProjectFile } from '@/storage/project-file';
import { useTemplateLibrary } from '@/templates/store';
import { downloadBlob } from '@/utils/download';
import { formatBytes } from '@/utils/time';
import { toast } from '@/components/ui/toast-store';

/** Long-running file work (backups, imports), shown as a progress pill. */
interface TransferState {
  label: string | null;
  progress: number | null;
  start: (label: string) => void;
  update: (label: string, done: number, total: number) => void;
  finish: () => void;
}

export const useTransfer = create<TransferState>()((set) => ({
  label: null,
  progress: null,
  start: (label) => set({ label, progress: null }),
  update: (label, done, total) => set({ label, progress: total > 0 ? Math.min(1, done / total) : null }),
  finish: () => set({ label: null, progress: null }),
}));

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

/** Saves one design as a `.stardeck` file (with its photos). */
export async function downloadProjectFile(projectId: string, doc?: DesignDocument): Promise<void> {
  const transfer = useTransfer.getState();
  transfer.start('Packing your design…');
  try {
    const { file, photos } = await writeProjectFile([projectId], {
      kind: 'project',
      docs: doc ? new Map([[projectId, doc]]) : undefined,
    });
    downloadBlob(file, file.name);
    toast({
      title: `Saved ${file.name}`,
      description: `${formatBytes(file.size)}${photos ? ` · includes ${plural(photos, 'photo')} — share it only with people you trust` : ''}. Open it in Stardeck on any device.`,
      tone: 'success',
    });
  } catch (e) {
    toast({
      title: 'Couldn’t save the project file',
      description: e instanceof ProjectFileError ? e.message : undefined,
      tone: 'error',
    });
  } finally {
    transfer.finish();
  }
}

/** Saves everything on this device as one backup file. */
export async function downloadBackup(): Promise<void> {
  const transfer = useTransfer.getState();
  transfer.start('Backing up…');
  try {
    const { file, projects, photos } = await writeProjectFile('all', {
      kind: 'backup',
      onProgress: (done, total) => transfer.update('Backing up photos…', done, total),
    });
    downloadBlob(file, file.name);
    toast({
      title: 'Backup saved',
      description: `${file.name} · ${formatBytes(file.size)} · ${plural(projects, 'design')}, ${plural(photos, 'photo')}. Keep it somewhere safe.`,
      tone: 'success',
    });
  } catch (e) {
    toast({
      title: 'Couldn’t make the backup',
      description: e instanceof RangeError ? e.message : 'Try again, or free up some space first.',
      tone: 'error',
    });
  } finally {
    transfer.finish();
  }
}

export const isProjectFile = (file: File) => /\.(stardeck|zip)$/i.test(file.name);
export const PROJECT_FILE_ACCEPT = `${PROJECT_FILE_EXTENSION},.zip,application/zip`;

/**
 * Imports project files and backups. Returns the ids of the designs added,
 * so callers can open a single imported design.
 */
export async function importFiles(files: File[]): Promise<string[]> {
  const transfer = useTransfer.getState();
  const added: string[] = [];
  for (const file of files) {
    transfer.start(`Opening ${file.name}…`);
    try {
      const report = await importProjectFile(file, { onProgress: (done, total, label) => transfer.update(label, done, total) });
      added.push(...report.projects.map((p) => p.id));
      await Promise.all([useProjects.getState().reload(), useAssets.getState().reload()]);
      if (report.templates) useTemplateLibrary.getState().resetUser();
      // Designs without a stored preview get one rendered now.
      for (const meta of report.projects) {
        if (useProjects.getState().thumbnails[meta.id]) continue;
        const project = await getProject(meta.id);
        if (!project) continue;
        void renderThumbnail(project.doc).then((blob) => blob && useProjects.getState().setThumbnail(meta.id, blob));
      }
      const parts = [
        report.projects.length ? plural(report.projects.length, 'design') : null,
        report.photos.added ? plural(report.photos.added, 'photo') : null,
        report.folders ? plural(report.folders, 'folder') : null,
        report.templates ? plural(report.templates, 'template') : null,
      ].filter(Boolean);
      toast({
        title: parts.length ? `Added ${parts.join(', ')}` : 'Everything in that file is already here',
        description:
          [
            report.unchanged ? `${plural(report.unchanged, 'design')} already on this device.` : '',
            report.skipped ? `${plural(report.skipped, 'damaged part')} skipped.` : '',
          ]
            .filter(Boolean)
            .join(' ') || undefined,
        tone: report.skipped ? 'info' : 'success',
      });
    } catch (e) {
      toast({
        title: `Couldn’t open ${file.name}`,
        description: e instanceof ProjectFileError ? e.message : 'That file isn’t a Stardeck project.',
        tone: 'error',
      });
    } finally {
      transfer.finish();
    }
  }
  return added;
}
