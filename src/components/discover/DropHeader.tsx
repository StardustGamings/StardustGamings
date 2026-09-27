'use client';

import Link from 'next/link';
import { CloudOff, FileJson, RefreshCw } from 'lucide-react';
import { useMemo } from 'react';
import { ScenePreview } from '@/canvas/ScenePreview';
import { coverDocument } from '@/trends/cover';
import { useTrends } from '@/trends/store';
import { useSettings } from '@/settings/store';
import { formatRelativeTime } from '@/utils/time';
import { cn } from '@/utils/cn';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { toast } from '@/components/ui/toast-store';

const monthLabel = (date: string) =>
  new Date(`${date}T12:00:00`).toLocaleDateString(undefined, { month: 'long', year: 'numeric' });

/** Where the drop came from, in plain words. */
function SourceLine() {
  const { source, checkedAt, error, status } = useTrends();
  const updates = useSettings((s) => s.privacy.trendUpdates);
  const refresh = useTrends((s) => s.refresh);
  let text: string;
  if (source === 'file') text = 'Previewing a pack file from this device.';
  else if (!updates) text = 'Trend updates are off — showing the drops built into the app.';
  else if (error === 'offline') text = 'Offline — showing the newest drop saved on this device.';
  else if (error === 'invalid') text = 'The trend feed sent something unreadable, so the saved drops are shown.';
  else if (checkedAt) text = `Checked for new drops ${formatRelativeTime(checkedAt)}.`;
  else text = 'Showing the drops built into the app.';
  return (
    <p className="mt-6 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-fg-subtle" data-testid="trend-source">
      {error === 'offline' && <CloudOff className="size-3.5" aria-hidden />}
      <span>{text}</span>
      {updates && source !== 'file' && (
        <button
          type="button"
          className="inline-flex items-center gap-1 font-semibold text-fg-muted underline-offset-2 hover:text-fg hover:underline"
          onClick={async () => {
            await refresh({ force: true });
            const s = useTrends.getState();
            toast({
              title: s.error ? 'Couldn’t reach the trend feed' : `Up to date: ${s.latest.title}`,
              tone: s.error ? 'info' : 'success',
              duration: 2400,
            });
          }}
          disabled={status === 'loading'}
        >
          <RefreshCw className={cn('size-3.5', status === 'loading' && 'animate-spin')} /> Check now
        </button>
      )}
      {!updates && (
        <Link href="/settings/#trends" className="font-semibold text-fg-muted underline-offset-2 hover:text-fg hover:underline">
          Settings
        </Link>
      )}
      <span>Trend packs are plain JSON — new drops arrive without an app update, and everything here works offline.</span>
    </p>
  );
}

/** The drop's cover (drawn from its own data), its title, and the archive of earlier drops. */
export function DropHeader() {
  const pack = useTrends((s) => s.pack);
  const latestId = useTrends((s) => s.latest.id);
  const drops = useTrends((s) => s.drops);
  const source = useTrends((s) => s.source);
  const loadingDrop = useTrends((s) => s.loadingDrop);
  const selectDrop = useTrends((s) => s.selectDrop);
  const endPreview = useTrends((s) => s.endPreview);
  const cover = useMemo(() => coverDocument(pack), [pack]);
  const list = drops.length ? drops : [{ id: pack.id, title: pack.title, publishedAt: pack.publishedAt, url: '' }];

  return (
    <header className="mb-6 border-b border-line pb-8" data-testid="drop-header">
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,420px)] lg:items-end">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone="accent">Trend drop · {monthLabel(pack.publishedAt)}</Badge>
            {pack.id === latestId && source !== 'file' && <Badge>Latest</Badge>}
            {source === 'file' && <Badge>Pack file preview</Badge>}
          </div>
          <h1 className="mt-3 text-display">What’s trending</h1>
          <p className="mt-2 text-heading text-fg-muted" data-testid="drop-title">
            {pack.title}
          </p>
          <p className="mt-1 max-w-xl text-caption">{pack.subtitle}</p>
          {source === 'file' ? (
            <Button className="mt-5" size="sm" icon={<FileJson className="size-4" />} onClick={() => endPreview()}>
              End preview
            </Button>
          ) : (
            list.length > 1 && (
              <div className="mt-5" role="radiogroup" aria-label="Trend drops" data-testid="drop-switcher">
                <p className="mb-1.5 text-label">Drops</p>
                <div className="flex flex-wrap gap-1.5">
                  {list.map((d) => (
                    <button
                      key={d.id}
                      type="button"
                      role="radio"
                      aria-checked={pack.id === d.id}
                      disabled={loadingDrop !== null}
                      onClick={async () => {
                        if (!(await selectDrop(d.id))) toast({ title: 'That drop isn’t available offline', tone: 'info' });
                      }}
                      className={cn(
                        'h-8 rounded-md border px-3 text-[13px] font-medium transition-colors',
                        pack.id === d.id
                          ? 'border-line-strong bg-surface-active text-fg'
                          : 'border-line text-fg-muted hover:border-line-strong hover:text-fg',
                      )}
                    >
                      {d.title ?? d.id}
                      {d.id === latestId && <span className="ml-1.5 text-[11px] text-accent-text">New</span>}
                    </button>
                  ))}
                </div>
              </div>
            )
          )}
          <SourceLine />
        </div>
        <div className="hidden overflow-hidden rounded-lg border border-line sm:block">
          <ScenePreview doc={cover} slide={0} maxDpr={1.5} label={`${pack.title} cover`} />
        </div>
      </div>
    </header>
  );
}
