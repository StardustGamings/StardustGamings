'use client';

import { ShieldAlert } from 'lucide-react';
import { useProjects } from '@/projects/store';

/** Shown only when IndexedDB is unavailable and projects live in memory. */
export function StorageNotice() {
  const kind = useProjects((s) => s.storageKind);
  if (kind !== 'memory') return null;
  return (
    <div role="status" className="mb-6 flex items-start gap-3 rounded-[18px] border border-warning/40 bg-warning/10 p-4 text-sm">
      <ShieldAlert className="mt-0.5 size-5 shrink-0 text-warning" aria-hidden />
      <p>
        <strong className="font-semibold">Your browser is blocking local storage</strong> (often private browsing). You can keep
        designing, but projects will disappear when this tab closes.
      </p>
    </div>
  );
}
