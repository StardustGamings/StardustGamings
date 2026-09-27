'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect } from 'react';
import { isFormatId } from '@/projects/formats';
import { useUi } from '@/settings/ui-store';

/** Handles `/?new=<format>` links (PWA shortcuts) by opening the new-design dialog. */
export function NewFromQuery() {
  const params = useSearchParams();
  const router = useRouter();
  const openNewProject = useUi((s) => s.openNewProject);
  const format = params.get('new');

  useEffect(() => {
    if (!isFormatId(format)) return;
    openNewProject(format);
    router.replace('/', { scroll: false });
  }, [format, openNewProject, router]);

  return null;
}
