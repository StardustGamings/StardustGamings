'use client';

import { useAssets } from '@/assets/store';
import type { Template } from '@/templates/registry';
import { useTemplateLibrary } from '@/templates/store';
import { parseTemplateFile, serializeTemplateFile, TemplateFileError, templateFileName } from '@/templates/user';
import { toast } from '@/components/ui/toast-store';
import { downloadBlob } from '@/utils/download';

/** Asset ids of the user's own stickers — kept in local templates, left out of exported files. */
export function stickerAssetIds(): Set<string> {
  return new Set(
    useAssets
      .getState()
      .assets.filter((a) => a.kind === 'sticker')
      .map((a) => a.id),
  );
}

/** Downloads a template as a shareable `.stardeck-template.json` file (no photos). */
export async function exportTemplate(template: Template): Promise<void> {
  await useAssets.getState().load();
  const json = serializeTemplateFile(template, { stickerAssetIds: stickerAssetIds() });
  downloadBlob(new Blob([json], { type: 'application/json' }), templateFileName(template.name));
  toast({
    title: 'Template file saved',
    description: 'Photos aren’t included — they stay on this device. Frames come through empty.',
    tone: 'success',
  });
}

/** Imports template files picked by the user. Returns the templates that were added. */
export async function importTemplateFiles(files: File[]): Promise<Template[]> {
  const added: Template[] = [];
  for (const file of files) {
    try {
      const template = parseTemplateFile(await file.text());
      added.push(await useTemplateLibrary.getState().saveUser(template));
    } catch (error) {
      toast({
        title: `Couldn’t import ${file.name}`,
        description: error instanceof TemplateFileError ? error.message : 'Your browser storage might be full.',
        tone: 'error',
      });
    }
  }
  if (added.length) {
    toast({
      title: added.length === 1 ? `Added “${added[0]!.name}” to your templates` : `Added ${added.length} templates`,
      tone: 'success',
    });
  }
  return added;
}
