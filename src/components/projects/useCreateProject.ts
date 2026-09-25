'use client';

import { useRouter } from 'next/navigation';
import { useCallback } from 'react';
import { useProjects } from '@/projects/store';
import type { CreateProjectInput } from '@/projects/repository';
import type { Template } from '@/templates/registry';
import { toast } from '@/components/ui/toast-store';

export const editorHref = (id: string) => `/editor/?id=${encodeURIComponent(id)}`;

/** Creates a project (blank or from a template) and opens it in the editor. */
export function useCreateProject() {
  const create = useProjects((s) => s.create);
  const router = useRouter();
  return useCallback(
    async (input: CreateProjectInput) => {
      try {
        const meta = await create(input);
        router.push(editorHref(meta.id));
        return meta;
      } catch {
        toast({
          title: 'Couldn’t create that project',
          description: 'Your browser storage might be full. Free up space in Settings → Storage and try again.',
          tone: 'error',
        });
        return null;
      }
    },
    [create, router],
  );
}

export function useCreateFromTemplate() {
  const createProject = useCreateProject();
  return useCallback(
    (template: Template, overrides?: Partial<CreateProjectInput>) =>
      createProject({
        name: template.name,
        format: template.format,
        sizeId: template.sizeId,
        doc: template.doc,
        templateId: template.id,
        ...overrides,
      }),
    [createProject],
  );
}
