'use client';

import { Flame, FileJson, RefreshCw } from 'lucide-react';
import { useRef, useState } from 'react';
import { useSettings } from '@/settings/store';
import { useTrends } from '@/trends/store';
import { TRENDS_INDEX_URL } from '@/trends/loader';
import { formatRelativeTime } from '@/utils/time';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Switch } from '@/components/ui/Switch';
import { toast } from '@/components/ui/toast-store';
import { SettingRow, SettingsSection } from './SettingRow';

const SOURCE_LABELS = {
  network: 'from the trend feed',
  cache: 'saved on this device',
  bundled: 'built into the app',
  file: 'a pack file you’re previewing',
} as const;

/** Trend drops: whether to download new ones, what's showing, and a preview for pack authors. */
export function TrendsSection() {
  const updates = useSettings((s) => s.privacy.trendUpdates);
  const updatePrivacy = useSettings((s) => s.updatePrivacy);
  const { pack, latest, source, checkedAt, status, drops, refresh, previewPack, endPreview } = useTrends();
  const input = useRef<HTMLInputElement>(null);
  const [problems, setProblems] = useState<string[] | null>(null);

  const readFile = async (file: File) => {
    try {
      if (file.size > 512 * 1024) throw new Error('too big');
      const result = previewPack(JSON.parse(await file.text()));
      setProblems(result.problems);
      toast(
        result.ok
          ? {
              title: `Previewing ${useTrends.getState().pack.title}`,
              description: result.problems.length ? 'It loads, with warnings below.' : 'Open Discover to see it.',
              tone: 'success',
            }
          : { title: 'That isn’t a valid trend pack', description: 'The problems are listed below.', tone: 'error' },
      );
    } catch {
      setProblems(['The file isn’t JSON (or is over 512 KB).']);
      toast({ title: 'That isn’t a valid trend pack', tone: 'error' });
    }
  };

  return (
    <SettingsSection
      id="trends"
      title="Trends"
      icon={<Flame />}
      description="Monthly drops of templates, fonts, colours, filters, stickers and formats."
    >
      <SettingRow
        title="Check for new trend drops"
        description={`Downloads new drops as plain files from ${TRENDS_INDEX_URL.startsWith('/') ? 'this app’s own site' : new URL(TRENDS_INDEX_URL).host}. Nothing about you or your designs is sent. Off: only the drops built into the app are shown.`}
        control={({ descriptionId }) => (
          <Switch
            checked={updates}
            onCheckedChange={(v) => {
              updatePrivacy({ trendUpdates: v });
              if (v) void refresh({ force: true });
            }}
            aria-label="Check for new trend drops"
            aria-describedby={descriptionId}
          />
        )}
      />
      <SettingRow
        title={`Showing: ${pack.title}`}
        description={`${pack.id === latest.id ? 'The newest drop' : `An earlier drop (newest: ${latest.title})`}, ${SOURCE_LABELS[source]}. ${drops.length || 1} drop${drops.length === 1 ? '' : 's'} available${checkedAt ? ` · checked ${formatRelativeTime(checkedAt)}` : ''}.`}
        control={() =>
          updates && source !== 'file' ? (
            <Button
              size="sm"
              icon={<RefreshCw className="size-4" />}
              loading={status === 'loading'}
              onClick={async () => {
                await refresh({ force: true });
                const s = useTrends.getState();
                toast({
                  title: s.error ? 'Couldn’t reach the trend feed' : `Up to date: ${s.latest.title}`,
                  tone: s.error ? 'info' : 'success',
                  duration: 2400,
                });
              }}
            >
              Check now
            </Button>
          ) : source === 'file' ? (
            <Badge tone="violet">Preview</Badge>
          ) : null
        }
      />
      <SettingRow
        title="Preview a pack file"
        description="For pack authors: load a trend pack JSON from this device to see it in Discover and the editor before publishing. It’s checked strictly, and nothing is uploaded. The preview ends when you reload."
        stacked
        control={() => (
          <div className="flex flex-col gap-3">
            <div className="flex flex-wrap gap-2">
              <Button size="sm" icon={<FileJson className="size-4" />} onClick={() => input.current?.click()}>
                Choose pack file…
              </Button>
              {source === 'file' && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    endPreview();
                    setProblems(null);
                  }}
                >
                  End preview
                </Button>
              )}
              <input
                ref={input}
                type="file"
                accept="application/json,.json"
                className="hidden"
                data-testid="pack-file-input"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  e.target.value = '';
                  if (file) void readFile(file);
                }}
              />
            </div>
            {problems && problems.length > 0 && (
              <ul
                className="max-h-48 list-inside list-disc overflow-y-auto rounded-lg border border-warning/30 bg-warning/8 p-3 font-mono text-[11.5px] text-fg-muted"
                data-testid="pack-problems"
              >
                {problems.slice(0, 50).map((p) => (
                  <li key={p}>{p}</li>
                ))}
              </ul>
            )}
            {problems && problems.length === 0 && (
              <p className="text-[12.5px] font-semibold text-success" data-testid="pack-ok">
                The pack is valid and every reference resolves.
              </p>
            )}
          </div>
        )}
      />
    </SettingsSection>
  );
}
