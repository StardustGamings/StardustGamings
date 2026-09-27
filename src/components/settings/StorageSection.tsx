'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Archive, ArchiveRestore, HardDrive } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { assetUsage, cleanupUnusedAssets } from '@/assets/repository';
import { useAssets } from '@/assets/store';
import { useProjects } from '@/projects/store';
import { clearVersions } from '@/projects/versions';
import { DEFAULT_SETTINGS, SETTINGS_STORAGE_KEY } from '@/settings/defaults';
import { useSettings } from '@/settings/store';
import { subscribe } from '@/storage/sync';
import { browserEstimate, isLowOnSpace, storageBreakdown, type StorageBreakdown } from '@/storage/usage';
import { useTemplateLibrary } from '@/templates/store';
import { useVersions } from '@/editor/versioning';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { buttonClasses } from '@/components/ui/button-styles';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { toast } from '@/components/ui/toast-store';
import { downloadBackup, importFiles, isProjectFile, PROJECT_FILE_ACCEPT } from '@/components/projects/project-files';
import { formatBytes } from '@/utils/time';
import { SettingRow, SettingsSection } from './SettingRow';

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

/** Keeps the numbers fresh: re-reads on mount and whenever this or another tab changes something. */
function useBreakdown() {
  const [breakdown, setBreakdown] = useState<StorageBreakdown | null>(null);
  const [estimate, setEstimate] = useState<{ usage: number; quota: number } | null>(null);
  const projects = useProjects((s) => s.projects);
  const assets = useAssets((s) => s.assets);
  const refresh = useCallback(() => {
    void storageBreakdown()
      .then(setBreakdown)
      .catch(() => undefined);
    void browserEstimate().then(setEstimate);
  }, []);
  useEffect(() => {
    // Re-read when projects or photos change here (the list stores update after every write).
    refresh();
  }, [refresh, projects, assets]);
  useEffect(() => subscribe(refresh), [refresh]);
  return { breakdown, estimate, refresh };
}

const SEGMENTS = [
  // One accent, then a neutral ramp: the bar reads by size, the legend by name.
  { key: 'projects', label: 'Designs', className: 'bg-accent' },
  { key: 'photos', label: 'Photos & cut-outs', className: 'bg-fg/75' },
  { key: 'videos', label: 'Videos', className: 'bg-fg/55' },
  { key: 'stickers', label: 'Stickers', className: 'bg-fg/40' },
  { key: 'versions', label: 'Version history', className: 'bg-fg/28' },
  { key: 'templates', label: 'Saved templates', className: 'bg-fg/18' },
] as const;

function segmentBytes(b: StorageBreakdown, key: (typeof SEGMENTS)[number]['key']): number {
  if (key === 'photos') return b.photos.bytes + b.masks.bytes;
  return b[key].bytes;
}

function UsageBar({
  breakdown,
  estimate,
}: {
  breakdown: StorageBreakdown | null;
  estimate: { usage: number; quota: number } | null;
}) {
  const total = breakdown?.total ?? 0;
  const low = isLowOnSpace(estimate);
  return (
    <div className="pb-5" data-testid="storage-usage">
      <div className="flex flex-wrap items-baseline justify-between gap-2 text-sm">
        <span className="font-semibold">
          {breakdown ? formatBytes(total) : '—'} <span className="font-normal text-fg-muted">of your work on this device</span>
        </span>
        <span className="text-fg-subtle">
          {estimate
            ? `${formatBytes(estimate.usage)} used · ${formatBytes(Math.max(0, estimate.quota - estimate.usage))} free for Stardeck`
            : 'Estimating…'}
        </span>
      </div>
      <div className="mt-2 flex h-2.5 overflow-hidden rounded-full bg-surface-active" role="img" aria-label="Storage by kind">
        {breakdown &&
          total > 0 &&
          SEGMENTS.map((s) => {
            const bytes = segmentBytes(breakdown, s.key);
            return bytes > 0 ? (
              <span key={s.key} className={s.className} style={{ width: `${Math.max(1.5, (bytes / total) * 100)}%` }} />
            ) : null;
          })}
      </div>
      {breakdown && (
        <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-fg-muted">
          {SEGMENTS.map((s) => (
            <li key={s.key} className="flex items-center gap-1.5">
              <span className={`size-2 rounded-full ${s.className}`} aria-hidden />
              {s.label} <span className="text-fg-subtle">{formatBytes(segmentBytes(breakdown, s.key))}</span>
            </li>
          ))}
        </ul>
      )}
      {low && (
        <p role="alert" className="mt-3 rounded-lg border border-warning/40 bg-warning/10 p-3 text-[13px]">
          <strong className="font-semibold">Your device is running low on space.</strong> Make a backup, then clear version
          history or photos you don’t use so saving keeps working.
        </p>
      )}
    </div>
  );
}

export function StorageSection() {
  const router = useRouter();
  const kind = useProjects((s) => s.storageKind);
  const clearAll = useProjects((s) => s.clearAll);
  const emptyTrash = useProjects((s) => s.emptyTrash);
  const loadAssets = useAssets((s) => s.load);
  const { breakdown, estimate, refresh } = useBreakdown();
  const [unused, setUnused] = useState<{ count: number; bytes: number } | null>(null);
  const [persisted, setPersisted] = useState<boolean | null>(null);
  const [confirm, setConfirm] = useState<'erase' | 'photos' | 'versions' | 'trash' | null>(null);
  const restoreInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    void loadAssets();
    void navigator.storage?.persisted?.().then(setPersisted);
  }, [loadAssets]);

  useEffect(() => {
    let alive = true;
    void Promise.all([useAssets.getState().load(), assetUsage()]).then(([, usage]) => {
      if (!alive) return;
      const list = useAssets.getState().assets.filter((a) => a.kind !== 'sticker' && !usage.has(a.id));
      setUnused({ count: list.length, bytes: list.reduce((n, a) => n + a.bytes, 0) });
    });
    return () => {
      alive = false;
    };
  }, [breakdown]);

  const b = breakdown;
  const active = b ? b.projects.count - b.projects.trashed : 0;
  const unnamed = b ? b.versions.count - b.versions.named : 0;

  return (
    <SettingsSection
      id="storage"
      title="Storage"
      icon={<HardDrive />}
      description={
        kind === 'memory'
          ? 'Your browser is blocking storage (often private browsing) — work here disappears when the tab closes. Back it up!'
          : 'Everything lives in your browser’s private database on this device. Nothing is uploaded.'
      }
    >
      <UsageBar breakdown={b} estimate={estimate} />

      <SettingRow
        title="Designs"
        description={
          b
            ? `${plural(active, 'design')} · ${b.projects.trashed} in trash · ${plural(b.folders, 'folder')} · ${formatBytes(b.projects.bytes)}`
            : 'Counting…'
        }
        control={() => (
          <Button size="sm" disabled={!b?.projects.trashed} onClick={() => setConfirm('trash')}>
            Empty trash
          </Button>
        )}
      />
      <SettingRow
        title="Photos, videos & stickers"
        description={
          b
            ? `${plural(b.photos.count, 'photo')} · ${plural(b.videos.count, 'video')} · ${plural(b.stickers.count, 'sticker')} · ${formatBytes(b.photos.bytes + b.videos.bytes + b.stickers.bytes + b.masks.bytes)}${
                unused?.count ? ` · ${unused.count} not used anywhere (${formatBytes(unused.bytes)})` : ''
              }`
            : 'Counting…'
        }
        control={() => (
          <Button size="sm" disabled={!unused?.count} onClick={() => setConfirm('photos')}>
            Clean up
          </Button>
        )}
      />
      <SettingRow
        title="Version history"
        description={
          b
            ? `${plural(b.versions.count, 'version')}${b.versions.named ? ` (${b.versions.named} named)` : ''} · ${formatBytes(b.versions.bytes)}`
            : 'Counting…'
        }
        control={() => (
          <Button size="sm" disabled={!unnamed} onClick={() => setConfirm('versions')}>
            Clear
          </Button>
        )}
      />
      <SettingRow
        title="Saved templates"
        description={b ? `${plural(b.templates.count, 'template')} · ${formatBytes(b.templates.bytes)}` : 'Counting…'}
        control={() => (
          <Link href="/templates/" className={buttonClasses({ size: 'sm' })}>
            Open
          </Link>
        )}
      />
      <SettingRow
        title="Back up everything"
        description="One .stardeck file with every design, its version history, folders, saved templates and photos. Keep it somewhere safe — it stays private until you share it."
        control={() => (
          <Button
            size="sm"
            variant="primary"
            icon={<Archive className="size-4" />}
            onClick={() => void downloadBackup()}
            data-testid="backup-all"
          >
            Back up
          </Button>
        )}
      />
      <SettingRow
        title="Restore from a backup"
        description="Adds the designs, photos and folders from a backup or project file. Nothing here is overwritten — designs already on this device are skipped."
        control={() => (
          <>
            <input
              ref={restoreInput}
              type="file"
              accept={PROJECT_FILE_ACCEPT}
              hidden
              data-testid="restore-input"
              onChange={(e) => {
                const files = [...(e.target.files ?? [])].filter(isProjectFile);
                e.target.value = '';
                if (files.length) void importFiles(files).then(refresh);
                else toast({ title: 'That isn’t a Stardeck file', tone: 'error' });
              }}
            />
            <Button size="sm" icon={<ArchiveRestore className="size-4" />} onClick={() => restoreInput.current?.click()}>
              Restore…
            </Button>
          </>
        )}
      />
      <SettingRow
        title="Protect my projects"
        description="Asks the browser not to clear Stardeck’s data when space runs low."
        control={() =>
          persisted ? (
            <Badge tone="success">Protected</Badge>
          ) : (
            <Button
              size="sm"
              onClick={async () => {
                const ok = (await navigator.storage?.persist?.()) ?? false;
                setPersisted(ok);
                toast(
                  ok
                    ? { title: 'Storage protected', tone: 'success' }
                    : {
                        title: 'Your browser said not yet',
                        description: 'Installing Stardeck as an app usually unlocks this. A backup keeps you safe either way.',
                        tone: 'info',
                      },
                );
              }}
            >
              Protect
            </Button>
          )
        }
      />
      <SettingRow
        title="Erase everything"
        description="Deletes all projects, photos, versions, folders and settings from this device. There’s no undo."
        control={() => (
          <Button variant="danger" size="sm" onClick={() => setConfirm('erase')}>
            Erase…
          </Button>
        )}
      />

      <ConfirmDialog
        open={confirm === 'trash'}
        onOpenChange={(open) => !open && setConfirm(null)}
        title="Empty the trash?"
        description={`${plural(b?.projects.trashed ?? 0, 'design')} will be permanently deleted from this device, with ${b?.projects.trashed === 1 ? 'its' : 'their'} version history.`}
        confirmLabel="Empty trash"
        destructive
        onConfirm={async () => {
          const n = await emptyTrash();
          toast({ title: `Deleted ${plural(n, 'design')} permanently` });
          refresh();
        }}
      />
      <ConfirmDialog
        open={confirm === 'photos'}
        onOpenChange={(open) => !open && setConfirm(null)}
        title="Delete photos nothing uses?"
        description={`Frees ${formatBytes(unused?.bytes ?? 0)}. Photos in any design (including ones in the trash), saved version, saved template or your sticker library are kept.`}
        confirmLabel="Clean up"
        destructive
        onConfirm={async () => {
          const result = await cleanupUnusedAssets();
          await useAssets.getState().reload();
          toast({ title: `Freed ${formatBytes(result.bytes)}`, tone: 'success' });
          refresh();
        }}
      />
      <ConfirmDialog
        open={confirm === 'versions'}
        onOpenChange={(open) => !open && setConfirm(null)}
        title="Clear version history?"
        description={`Deletes ${plural(unnamed, 'auto-saved version')} across all designs. Named versions and the designs themselves are kept.`}
        confirmLabel="Clear history"
        destructive
        onConfirm={async () => {
          const result = await clearVersions();
          const projectId = useVersions.getState().projectId;
          if (projectId) void useVersions.getState().load(projectId);
          toast({
            title: `Cleared ${plural(result.count, 'version')}`,
            description: `Freed about ${formatBytes(result.bytes)}.`,
            tone: 'success',
          });
          refresh();
        }}
      />
      <ConfirmDialog
        open={confirm === 'erase'}
        onOpenChange={(open) => !open && setConfirm(null)}
        title="Erase all local data?"
        description={`This permanently deletes ${plural(b?.projects.count ?? 0, 'project')}, your photos, version history, folders and saved templates, and resets every setting. Consider a backup first.`}
        confirmLabel="Erase everything"
        destructive
        onConfirm={async () => {
          await clearAll();
          useAssets.setState({ status: 'idle', assets: [] });
          useTemplateLibrary.getState().resetUser();
          try {
            localStorage.removeItem(SETTINGS_STORAGE_KEY);
          } catch {
            /* ignore */
          }
          // Back to factory defaults — the intro shows again like a fresh install.
          useSettings.setState({ ...DEFAULT_SETTINGS });
          router.push('/');
        }}
      />
    </SettingsSection>
  );
}
