'use client';

import Link from 'next/link';
import { HardDrive, ShieldAlert } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useProjects } from '@/projects/store';
import { browserEstimate, isLowOnSpace } from '@/storage/usage';

/** Warns when storage is blocked (projects live in memory) or the device is nearly full. */
export function StorageNotice() {
  const kind = useProjects((s) => s.storageKind);
  const count = useProjects((s) => s.projects.length);
  const [low, setLow] = useState(false);
  useEffect(() => {
    void browserEstimate().then((e) => setLow(isLowOnSpace(e)));
  }, [count]);

  if (kind === 'memory') {
    return (
      <div
        role="status"
        className="mb-6 flex items-start gap-3 rounded-[18px] border border-warning/40 bg-warning/10 p-4 text-sm"
      >
        <ShieldAlert className="mt-0.5 size-5 shrink-0 text-warning" aria-hidden />
        <p>
          <strong className="font-semibold">Your browser is blocking local storage</strong> (often private browsing). You can keep
          designing, but projects will disappear when this tab closes — download a project file to keep one.
        </p>
      </div>
    );
  }
  if (!low) return null;
  return (
    <div role="status" className="mb-6 flex items-start gap-3 rounded-[18px] border border-warning/40 bg-warning/10 p-4 text-sm">
      <HardDrive className="mt-0.5 size-5 shrink-0 text-warning" aria-hidden />
      <p>
        <strong className="font-semibold">Your device is running low on space.</strong> Saving may stop working soon.{' '}
        <Link href="/settings/#storage" className="font-semibold underline underline-offset-2">
          Back up and free up space
        </Link>
      </p>
    </div>
  );
}
