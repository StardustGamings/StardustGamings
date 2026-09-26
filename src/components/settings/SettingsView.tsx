'use client';

import {
  Accessibility,
  Download,
  Gauge,
  HardDrive,
  Info,
  Keyboard,
  Lock,
  Minus,
  Palette,
  PenTool,
  Plus,
  Share2,
  UserRound,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useClientValue } from '@/hooks/useClientValue';
import { DEFAULT_SETTINGS } from '@/settings/defaults';
import type { FormatId } from '@/types/project';
import { FORMAT_ORDER, FORMATS, MAX_SLIDES } from '@/projects/formats';
import { useProjects } from '@/projects/store';
import { SETTINGS_STORAGE_KEY, UI_SCALE_RANGE } from '@/settings/defaults';
import { useSettings } from '@/settings/store';
import { useUi } from '@/settings/ui-store';
import { BUNDLED_FONTS } from '@/typography/fonts';
import { useInstallPrompt } from '@/hooks/useInstallPrompt';
import { modKey } from '@/hooks/useHotkeys';
import { Badge, SoonBadge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { IconButton } from '@/components/ui/IconButton';
import { Kbd } from '@/components/ui/Kbd';
import { Segmented } from '@/components/ui/Segmented';
import { Slider } from '@/components/ui/Slider';
import { Switch } from '@/components/ui/Switch';
import { TextField } from '@/components/ui/TextField';
import { toast } from '@/components/ui/toast-store';
import { clamp } from '@/utils/math';
import { formatBytes } from '@/utils/time';
import { cn } from '@/utils/cn';
import { SettingRow, SettingsSection } from './SettingRow';
import { useAssets } from '@/assets/store';
import { assetUsage, cleanupUnusedAssets } from '@/assets/repository';
import { ThemePicker } from './ThemePicker';

const SECTIONS = [
  { id: 'account', label: 'Account', icon: UserRound },
  { id: 'appearance', label: 'Appearance', icon: Palette },
  { id: 'editor', label: 'Editor', icon: PenTool },
  { id: 'export', label: 'Export', icon: Share2 },
  { id: 'performance', label: 'Performance', icon: Gauge },
  { id: 'privacy', label: 'Privacy', icon: Lock },
  { id: 'storage', label: 'Storage', icon: HardDrive },
  { id: 'shortcuts', label: 'Shortcuts', icon: Keyboard },
  { id: 'accessibility', label: 'Accessibility', icon: Accessibility },
  { id: 'about', label: 'About', icon: Info },
] as const;

const MOTION_OPTIONS = [
  { value: 'system' as const, label: 'System' },
  { value: 'full' as const, label: 'Full' },
  { value: 'reduced' as const, label: 'Reduced' },
  { value: 'off' as const, label: 'Off' },
];

function SectionNav() {
  return (
    <nav aria-label="Settings sections" className="min-w-0 lg:sticky lg:top-24 lg:self-start">
      <ul className="-mx-4 hide-scrollbar flex gap-2 overflow-x-auto px-4 lg:mx-0 lg:flex-col lg:gap-0.5 lg:px-0">
        {SECTIONS.map(({ id, label, icon: Icon }) => (
          <li key={id}>
            <a
              href={`#${id}`}
              className="flex h-9 shrink-0 items-center gap-2.5 rounded-full border border-line px-3 text-[13px] font-semibold whitespace-nowrap text-fg-muted transition-colors hover:bg-surface-hover hover:text-fg lg:rounded-[12px] lg:border-transparent"
            >
              <Icon className="size-4" aria-hidden />
              {label}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}

function AccountSection() {
  const displayName = useSettings((s) => s.displayName);
  const update = useSettings((s) => s.update);
  return (
    <SettingsSection
      id="account"
      title="Account"
      icon={<UserRound />}
      description="No sign-up, no email, no password. Stardeck works fully without an account."
    >
      <SettingRow
        title="Display name"
        description="Only used to greet you. Stored on this device."
        stacked
        control={({ labelId }) => (
          <TextField
            aria-labelledby={labelId}
            placeholder="What should we call you?"
            value={displayName}
            maxLength={40}
            onChange={(e) => update({ displayName: e.target.value })}
            className="max-w-sm"
          />
        )}
      />
      <SettingRow
        title="Cloud backup & sync"
        description="Optional, opt-in backup across devices is planned. Your work will never require it."
        control={() => <SoonBadge />}
      />
    </SettingsSection>
  );
}

function AppearanceSection() {
  const motion = useSettings((s) => s.motion);
  const ambient = useSettings((s) => s.ambientEffects);
  const update = useSettings((s) => s.update);
  return (
    <SettingsSection id="appearance" title="Appearance" icon={<Palette />} description="Dark-first, but it’s your call.">
      <SettingRow title="Theme" stacked control={({ labelId }) => <ThemePicker labelId={labelId} />} />
      <SettingRow
        title="Animation"
        description="System follows your device’s reduce-motion setting."
        stacked
        control={() => (
          <Segmented
            aria-label="Animation level"
            value={motion}
            onChange={(v) => update({ motion: v })}
            options={MOTION_OPTIONS}
          />
        )}
      />
      <SettingRow
        title="Background effects"
        description="Aurora glow and twinkling stardust behind the app."
        control={({ labelId, descriptionId }) => (
          <Switch
            checked={ambient}
            onCheckedChange={(v) => update({ ambientEffects: v })}
            aria-label="Background effects"
            aria-describedby={descriptionId ?? labelId}
          />
        )}
      />
    </SettingsSection>
  );
}

function EditorSection() {
  const editor = useSettings((s) => s.editor);
  const updateEditor = useSettings((s) => s.updateEditor);
  return (
    <SettingsSection id="editor" title="Editor" icon={<PenTool />} description="Defaults for new designs.">
      <SettingRow
        title="New design button creates"
        description="What the + button starts with."
        control={({ labelId }) => (
          <select
            aria-labelledby={labelId}
            value={editor.defaultFormat}
            onChange={(e) => updateEditor({ defaultFormat: e.target.value as FormatId })}
            className="h-10 rounded-[12px] border border-line bg-bg-sunken/70 px-3 text-sm outline-none focus:border-ring"
          >
            {FORMAT_ORDER.map((f) => (
              <option key={f} value={f}>
                {FORMATS[f].label}
              </option>
            ))}
          </select>
        )}
      />
      <SettingRow
        title="Carousel slides"
        description="Starting slide count for new carousels."
        control={() => (
          <div className="flex items-center gap-2">
            <IconButton
              label="Fewer slides"
              icon={<Minus />}
              size="sm"
              variant="solid"
              disabled={editor.carouselSlides <= 1}
              onClick={() => updateEditor({ carouselSlides: clamp(editor.carouselSlides - 1, 1, MAX_SLIDES) })}
            />
            <output className="w-8 text-center font-display text-lg font-bold tabular-nums">{editor.carouselSlides}</output>
            <IconButton
              label="More slides"
              icon={<Plus />}
              size="sm"
              variant="solid"
              disabled={editor.carouselSlides >= MAX_SLIDES}
              onClick={() => updateEditor({ carouselSlides: clamp(editor.carouselSlides + 1, 1, MAX_SLIDES) })}
            />
          </div>
        )}
      />
      <SettingRow
        title="Show grid"
        description="Overlay a layout grid on the canvas when a project opens."
        control={({ descriptionId }) => (
          <Switch
            checked={editor.showGrid}
            onCheckedChange={(v) => updateEditor({ showGrid: v })}
            aria-label="Show grid"
            aria-describedby={descriptionId}
          />
        )}
      />
      <SettingRow
        title="Show safe areas"
        description="Mark where app UI (usernames, buttons) covers your design."
        control={({ descriptionId }) => (
          <Switch
            checked={editor.showSafeArea}
            onCheckedChange={(v) => updateEditor({ showSafeArea: v })}
            aria-label="Show safe areas"
            aria-describedby={descriptionId}
          />
        )}
      />
    </SettingsSection>
  );
}

function ExportSection() {
  const exp = useSettings((s) => s.export);
  const updateExport = useSettings((s) => s.updateExport);
  return (
    <SettingsSection
      id="export"
      title="Export"
      icon={<Share2 />}
      badge={<SoonBadge>Exporter soon</SoonBadge>}
      description="Your defaults are saved now and used as soon as exporting ships. Never watermarked, never paywalled."
    >
      <SettingRow
        title="Default file type"
        control={() => (
          <Segmented
            aria-label="Default file type"
            value={exp.format}
            onChange={(v) => updateExport({ format: v })}
            options={[
              { value: 'png', label: 'PNG' },
              { value: 'jpg', label: 'JPG' },
              { value: 'webp', label: 'WebP' },
            ]}
          />
        )}
      />
      <SettingRow
        title="Quality"
        description="Maximum exports at 2× resolution."
        control={() => (
          <Segmented
            aria-label="Export quality"
            value={exp.quality}
            onChange={(v) => updateExport({ quality: v })}
            options={[
              { value: 'standard', label: 'Standard' },
              { value: 'high', label: 'High' },
              { value: 'max', label: 'Maximum' },
            ]}
          />
        )}
      />
    </SettingsSection>
  );
}

type Capability = { label: string; ok: boolean; detail?: string };
let capabilityCache: Capability[] | null = null;

function detectCapabilities(): Capability[] {
  if (capabilityCache) return capabilityCache;
  const nav = navigator as Navigator & { deviceMemory?: number };
  let webgl2 = false;
  try {
    const gl = document.createElement('canvas').getContext('webgl2');
    webgl2 = Boolean(gl);
    // Release the probe context immediately so it doesn't count against the GPU limit.
    gl?.getExtension('WEBGL_lose_context')?.loseContext();
  } catch {
    webgl2 = false;
  }
  capabilityCache = [
    { label: 'CPU cores', ok: true, detail: String(nav.hardwareConcurrency || '?') },
    ...(nav.deviceMemory ? [{ label: 'Memory', ok: true, detail: `${nav.deviceMemory} GB+` }] : []),
    { label: 'Web Workers', ok: typeof Worker !== 'undefined' },
    { label: 'OffscreenCanvas', ok: typeof OffscreenCanvas !== 'undefined' },
    { label: 'WebGL 2', ok: webgl2 },
    { label: 'IndexedDB', ok: typeof indexedDB !== 'undefined' },
  ];
  return capabilityCache;
}

const NO_CAPABILITIES: Capability[] = [];

function PerformanceSection() {
  const glass = useSettings((s) => s.glass);
  const ambient = useSettings((s) => s.ambientEffects);
  const update = useSettings((s) => s.update);
  const caps = useClientValue(detectCapabilities, NO_CAPABILITIES);
  return (
    <SettingsSection id="performance" title="Performance" icon={<Gauge />} description="Dial things down on older phones.">
      <SettingRow
        title="Frosted glass"
        description="Blurred translucent panels. Turn off if scrolling feels heavy."
        control={({ descriptionId }) => (
          <Switch
            checked={glass}
            onCheckedChange={(v) => update({ glass: v })}
            aria-label="Frosted glass"
            aria-describedby={descriptionId}
          />
        )}
      />
      <SettingRow
        title="Background effects"
        description="Particles pause automatically when the tab is hidden."
        control={({ descriptionId }) => (
          <Switch
            checked={ambient}
            onCheckedChange={(v) => update({ ambientEffects: v })}
            aria-label="Background effects (performance)"
            aria-describedby={descriptionId}
          />
        )}
      />
      <SettingRow
        title="This device"
        description="What your browser supports for heavy image work."
        stacked
        control={() => (
          <ul className="flex flex-wrap gap-2">
            {caps.map((c) => (
              <li
                key={c.label}
                className={cn(
                  'inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-xs font-semibold',
                  c.ok ? 'border-success/30 text-success' : 'border-line text-fg-subtle line-through',
                )}
              >
                {c.label}
                {c.detail && <span className="text-fg-muted">{c.detail}</span>}
              </li>
            ))}
          </ul>
        )}
      />
    </SettingsSection>
  );
}

function PrivacySection() {
  return (
    <SettingsSection id="privacy" title="Privacy" icon={<Lock />} description="Local-first means your work lives with you.">
      <div className="grid gap-3 py-1 sm:grid-cols-2">
        <div className="rounded-[18px] border border-success/25 bg-success/8 p-4">
          <p className="text-sm font-bold text-success">Stays on this device</p>
          <ul className="mt-2 list-inside list-disc space-y-1 text-[13px] text-fg-muted">
            <li>Every project, slide and thumbnail</li>
            <li>Photos and stickers you add — and all photo editing</li>
            <li>Background removal (the AI runs in your browser)</li>
            <li>Your settings and display name</li>
          </ul>
        </div>
        <div className="rounded-[18px] border border-line p-4">
          <p className="text-sm font-bold">Leaves this device</p>
          <ul className="mt-2 list-inside list-disc space-y-1 text-[13px] text-fg-muted">
            <li>Nothing you create.</li>
            <li>The app only downloads its own files, trend packs and (once, if you use it) its background-removal model.</li>
            <li>No analytics, no ad trackers, no account.</li>
          </ul>
        </div>
      </div>
      <SettingRow
        title="Optional AI & cloud tools"
        description="Background removal runs on your device. Any cloud tool is off by default, clearly labelled, and asks before anything is uploaded."
        control={() => <Badge tone="success">Nothing uploaded</Badge>}
      />
    </SettingsSection>
  );
}

/** Local photo library size, with a one-tap cleanup of photos no design uses. */
function PhotoStorageRow() {
  const assets = useAssets((s) => s.assets);
  const load = useAssets((s) => s.load);
  const [unused, setUnused] = useState<{ count: number; bytes: number } | null>(null);
  const [confirm, setConfirm] = useState(false);
  useEffect(() => {
    void load();
  }, [load]);
  useEffect(() => {
    let alive = true;
    void assetUsage().then((usage) => {
      if (!alive) return;
      const list = assets.filter((a) => a.kind !== 'sticker' && !usage.has(a.id));
      setUnused({ count: list.length, bytes: list.reduce((n, a) => n + a.bytes, 0) });
    });
    return () => {
      alive = false;
    };
  }, [assets]);
  const photos = assets.filter((a) => a.kind === 'photo').length;
  const stickers = assets.filter((a) => a.kind === 'sticker').length;
  const total = assets.reduce((n, a) => n + a.bytes, 0);
  return (
    <>
      <SettingRow
        title="Photos & stickers"
        description={`${photos} photo${photos === 1 ? '' : 's'} · ${stickers} sticker${stickers === 1 ? '' : 's'} · ${formatBytes(total)}${
          unused && unused.count ? ` · ${unused.count} not used in any design (${formatBytes(unused.bytes)})` : ''
        }`}
        control={() => (
          <Button size="sm" disabled={!unused?.count} onClick={() => setConfirm(true)}>
            Clean up
          </Button>
        )}
      />
      <ConfirmDialog
        open={confirm}
        onOpenChange={setConfirm}
        title="Delete photos no design uses?"
        description={`Frees ${formatBytes(unused?.bytes ?? 0)}. Photos in any design (including ones in the trash) and your sticker library are kept.`}
        confirmLabel="Clean up"
        destructive
        onConfirm={async () => {
          const result = await cleanupUnusedAssets();
          useAssets.setState({ status: 'idle', assets: [] });
          await useAssets.getState().load();
          toast({ title: `Freed ${formatBytes(result.bytes)}`, tone: 'success' });
        }}
      />
    </>
  );
}

function StorageSection() {
  const projects = useProjects((s) => s.projects);
  const kind = useProjects((s) => s.storageKind);
  const clearAll = useProjects((s) => s.clearAll);
  const router = useRouter();
  const [estimate, setEstimate] = useState<{ usage: number; quota: number } | null>(null);
  const [persisted, setPersisted] = useState<boolean | null>(null);
  const [confirm, setConfirm] = useState(false);

  useEffect(() => {
    void navigator.storage?.estimate?.().then((e) => setEstimate({ usage: e.usage ?? 0, quota: e.quota ?? 0 }));
    void navigator.storage?.persisted?.().then(setPersisted);
  }, [projects.length]);

  const active = projects.filter((p) => p.deletedAt === null).length;
  const trashed = projects.length - active;
  const pct = estimate && estimate.quota > 0 ? Math.min(100, (estimate.usage / estimate.quota) * 100) : 0;

  return (
    <SettingsSection
      id="storage"
      title="Storage"
      icon={<HardDrive />}
      description="Projects are stored in your browser’s private database."
    >
      <div className="pb-4">
        <div className="flex items-baseline justify-between text-sm">
          <span className="font-semibold">
            {estimate ? formatBytes(estimate.usage) : '—'} <span className="font-normal text-fg-muted">used</span>
          </span>
          <span className="text-fg-subtle">
            {estimate ? `${formatBytes(estimate.quota)} available to Stardeck` : 'Estimating…'}
          </span>
        </div>
        <div
          className="mt-2 h-2 overflow-hidden rounded-full bg-surface-active"
          role="progressbar"
          aria-valuenow={Math.round(pct)}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Storage used"
        >
          <div className="h-full rounded-full bg-nova" style={{ width: `${Math.max(pct, 1.5)}%` }} />
        </div>
        <p className="mt-2 text-xs text-fg-subtle">
          {active} project{active === 1 ? '' : 's'} · {trashed} in trash ·{' '}
          {kind === 'memory' ? 'temporary (private mode)' : 'IndexedDB'}
        </p>
      </div>
      <PhotoStorageRow />
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
                        description: 'Installing Stardeck as an app usually unlocks this.',
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
        description="Deletes all projects, photos and settings from this device. There’s no undo."
        control={() => (
          <Button variant="danger" size="sm" onClick={() => setConfirm(true)}>
            Erase…
          </Button>
        )}
      />
      <ConfirmDialog
        open={confirm}
        onOpenChange={setConfirm}
        title="Erase all local data?"
        description={`This permanently deletes ${projects.length} project${projects.length === 1 ? '' : 's'} and resets every setting.`}
        confirmLabel="Erase everything"
        destructive
        onConfirm={async () => {
          await clearAll();
          useAssets.setState({ status: 'idle', assets: [] });
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

function ShortcutsSection() {
  const mod = useClientValue(modKey, 'Ctrl');
  const rows: { keys: string[]; action: string; soon?: boolean }[] = [
    { keys: [mod, 'K'], action: 'Command palette' },
    { keys: [mod, 'S'], action: 'Save now' },
    { keys: [mod, 'Z'], action: 'Undo' },
    { keys: [mod, '⇧', 'Z'], action: 'Redo' },
    { keys: [mod, 'C'], action: 'Copy' },
    { keys: [mod, 'X'], action: 'Cut' },
    { keys: [mod, 'V'], action: 'Paste (elements, photos or plain text)' },
    { keys: [mod, 'D'], action: 'Duplicate selection (or slide)' },
    { keys: ['Delete'], action: 'Delete selection' },
    { keys: [mod, 'A'], action: 'Select all on slide (again: all)' },
    { keys: [mod, 'G'], action: 'Group' },
    { keys: [mod, '⇧', 'G'], action: 'Ungroup' },
    { keys: [mod, ']'], action: 'Bring forward (⇧: to front)' },
    { keys: [mod, '['], action: 'Send backward (⇧: to back)' },
    { keys: [mod, '⇧', 'L'], action: 'Lock / unlock' },
    { keys: [mod, '⇧', 'H'], action: 'Hide' },
    { keys: ['←', '↑', '→', '↓'], action: 'Nudge 1px (⇧: 10px) · slides when nothing selected' },
    { keys: ['Enter'], action: 'Edit selected text · crop selected photo · finish cropping' },
    { keys: ['Esc'], action: 'Deselect · cancel cropping · close dialogs' },
    { keys: ['V'], action: 'Select tool' },
    { keys: ['T'], action: 'Text tool (click to place)' },
    { keys: ['P'], action: 'Photos panel' },
    { keys: ['H'], action: 'Pan tool' },
    { keys: ['Space'], action: 'Hold and drag to pan' },
    { keys: [mod, 'Scroll'], action: 'Zoom at the pointer' },
    { keys: [mod, '+'], action: 'Zoom in' },
    { keys: [mod, '−'], action: 'Zoom out' },
    { keys: [mod, '0'], action: 'Actual size' },
    { keys: ['⇧', '1'], action: 'Fit slide' },
    { keys: ['⇧', '2'], action: 'Fit all slides' },
    { keys: ["'"], action: 'Toggle grid' },
    { keys: ['⇧', 'R'], action: 'Toggle rulers & guides' },
    { keys: ['Alt', 'Drag'], action: 'Duplicate while dragging' },
    { keys: ['⇧', 'Drag'], action: 'Constrain / keep proportions' },
    { keys: [mod, 'Drag'], action: 'Move without snapping · deep-select in groups' },
  ];
  return (
    <SettingsSection
      id="shortcuts"
      title="Keyboard shortcuts"
      icon={<Keyboard />}
      description="Editor shortcuts apply on the canvas. Touch: one finger drags, two fingers pan and pinch-zoom, double-tap edits text or crops a photo."
    >
      <ul className="grid gap-x-8 sm:grid-cols-2">
        {rows.map((r) => (
          <li key={r.action} className="flex items-center justify-between gap-3 border-b border-line py-2.5 text-sm">
            <span className={cn(r.soon && 'text-fg-subtle')}>{r.action}</span>
            <span className="flex items-center gap-1">
              {r.soon && <SoonBadge className="mr-1" />}
              {r.keys.map((k) => (
                <Kbd key={k}>{k}</Kbd>
              ))}
            </span>
          </li>
        ))}
      </ul>
    </SettingsSection>
  );
}

function AccessibilitySection() {
  const uiScale = useSettings((s) => s.uiScale);
  const highContrast = useSettings((s) => s.highContrast);
  const motion = useSettings((s) => s.motion);
  const update = useSettings((s) => s.update);
  return (
    <SettingsSection
      id="accessibility"
      title="Accessibility"
      icon={<Accessibility />}
      description="Make Stardeck comfortable for you."
    >
      <SettingRow
        title="Interface size"
        description={`${Math.round(uiScale * 100)}% — scales all text and controls.`}
        stacked
        control={({ labelId }) => (
          <div className="flex max-w-sm items-center gap-3">
            <span className="text-xs text-fg-subtle">A</span>
            <Slider
              aria-label="Interface size"
              value={uiScale}
              min={UI_SCALE_RANGE.min}
              max={UI_SCALE_RANGE.max}
              step={UI_SCALE_RANGE.step}
              valueText={`${Math.round(uiScale * 100)} percent`}
              onChange={(v) => update({ uiScale: v })}
            />
            <span className="text-lg text-fg-subtle" id={`${labelId}-max`}>
              A
            </span>
          </div>
        )}
      />
      <SettingRow
        title="High contrast"
        description="Stronger borders and text, calmer backgrounds."
        control={({ descriptionId }) => (
          <Switch
            checked={highContrast}
            onCheckedChange={(v) => update({ highContrast: v })}
            aria-label="High contrast"
            aria-describedby={descriptionId}
          />
        )}
      />
      <SettingRow
        title="Motion"
        description="Reduced keeps fades but drops movement. Off disables animation entirely."
        stacked
        control={() => (
          <Segmented aria-label="Motion level" value={motion} onChange={(v) => update({ motion: v })} options={MOTION_OPTIONS} />
        )}
      />
    </SettingsSection>
  );
}

function AboutSection() {
  const { state, install } = useInstallPrompt();
  const setOnboardingReplay = useUi((s) => s.setOnboardingReplay);
  return (
    <SettingsSection id="about" title="About Stardeck" icon={<Info />} badge={<Badge>v0.3 · Phase 3</Badge>}>
      <div className="pb-4 text-sm leading-relaxed text-fg-muted">
        <p>
          <strong className="text-fg">Free forever.</strong> No watermarks, no “Pro” locks on the basics, no forced subscription.
          If Stardeck ever makes money it’ll be from optional extras — donations, creator packs or opt-in cloud storage — never by
          holding your designs hostage.
        </p>
      </div>
      <SettingRow
        title="Install the app"
        description={
          state === 'installed'
            ? 'You’re running the installed app.'
            : state === 'ios'
              ? 'On iPhone/iPad: tap Share, then “Add to Home Screen”.'
              : state === 'available'
                ? 'Launch from your home screen or dock, full-screen and offline.'
                : 'Use your browser menu’s “Install” or “Add to Home Screen” option.'
        }
        control={() =>
          state === 'available' ? (
            <Button
              variant="primary"
              size="sm"
              icon={<Download className="size-4" />}
              onClick={async () => {
                if (await install()) toast({ title: 'Installed — see you on your home screen ✦', tone: 'success' });
              }}
            >
              Install
            </Button>
          ) : state === 'installed' ? (
            <Badge tone="success">Installed</Badge>
          ) : null
        }
      />
      <SettingRow
        title="Intro tour"
        description="Watch the five-step welcome again."
        control={() => (
          <Button size="sm" onClick={() => setOnboardingReplay(true)}>
            Replay
          </Button>
        )}
      />
      <SettingRow
        title="Open-source fonts"
        description={`${BUNDLED_FONTS.length} families bundled under the SIL Open Font License: ${BUNDLED_FONTS.map((f) => f.family).join(', ')}.`}
        stacked
        control={() => null}
      />
    </SettingsSection>
  );
}

export function SettingsView() {
  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-8 lg:grid-cols-[200px_minmax(0,1fr)]">
      <SectionNav />
      <div className="flex min-w-0 flex-col gap-6">
        <AccountSection />
        <AppearanceSection />
        <EditorSection />
        <ExportSection />
        <PerformanceSection />
        <PrivacySection />
        <StorageSection />
        <ShortcutsSection />
        <AccessibilitySection />
        <AboutSection />
      </div>
    </div>
  );
}
