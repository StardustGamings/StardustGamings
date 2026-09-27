'use client';

import { AlertTriangle, Check, CloudOff, Loader2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { formatRelativeTime } from '@/utils/time';
import { useEditor } from './store';

export function SaveIndicator() {
  const saveState = useEditor((s) => s.saveState);
  const lastSavedAt = useEditor((s) => s.lastSavedAt);
  const save = useEditor((s) => s.save);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(t);
  }, []);

  const content = {
    saved: {
      icon: <Check className="size-3.5 text-success" />,
      text: lastSavedAt ? `Saved ${formatRelativeTime(lastSavedAt, Math.max(now, lastSavedAt))}` : 'Saved',
    },
    dirty: { icon: <CloudOff className="size-3.5" />, text: 'Unsaved changes' },
    saving: { icon: <Loader2 className="size-3.5 animate-spin" />, text: 'Saving…' },
    error: { icon: <AlertTriangle className="size-3.5 text-danger" />, text: 'Couldn’t save — retry' },
  }[saveState];

  return (
    <button
      type="button"
      onClick={() => void save()}
      aria-live="polite"
      className="hidden h-8 items-center gap-1.5 rounded-md px-2.5 text-xs font-medium text-fg-muted transition-colors hover:bg-surface-hover hover:text-fg sm:inline-flex"
      title="Saved on this device. Click to save now."
      data-testid="save-indicator"
      data-state={saveState}
    >
      {content.icon}
      {content.text}
    </button>
  );
}
