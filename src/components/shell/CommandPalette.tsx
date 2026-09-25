'use client';

import { Command as Cmdk } from 'cmdk';
import { Dialog as D } from 'radix-ui';
import {
  Compass,
  FolderOpen,
  Home,
  LayoutTemplate,
  Monitor,
  Moon,
  Play,
  Search,
  Settings,
  Sparkles,
  Sun,
  Trash2,
  Wand2,
  Zap,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import { FORMAT_ORDER, FORMATS } from '@/projects/formats';
import { useProjects } from '@/projects/store';
import { useSettings } from '@/settings/store';
import { useUi } from '@/settings/ui-store';
import { TEMPLATES } from '@/templates/registry';
import { useHotkeys } from '@/hooks/useHotkeys';
import { Kbd } from '@/components/ui/Kbd';
import { toast } from '@/components/ui/toast-store';
import { FormatIcon } from '@/components/home/FormatIcon';
import { scoreCommand } from './command-score';
import { useCommandRegistry, type Command } from './commands';
import { useCreateFromTemplate } from '../projects/useCreateProject';

const MOTION_CYCLE = { system: 'full', full: 'reduced', reduced: 'off', off: 'system' } as const;

export function CommandPalette() {
  const open = useUi((s) => s.paletteOpen);
  const setOpen = useUi((s) => s.setPaletteOpen);
  const openNewProject = useUi((s) => s.openNewProject);
  const setOnboardingReplay = useUi((s) => s.setOnboardingReplay);
  const router = useRouter();
  const projects = useProjects((s) => s.projects);
  const update = useSettings((s) => s.update);
  const motionPref = useSettings((s) => s.motion);
  const ambient = useSettings((s) => s.ambientEffects);
  const scoped = useCommandRegistry((s) => s.scoped);
  const createFromTemplate = useCreateFromTemplate();
  const [search, setSearch] = useState('');

  useHotkeys({ 'mod+k': () => setOpen(!useUi.getState().paletteOpen) }, { allowInInputs: true });

  const go = (href: string) => () => router.push(href);

  const groups = useMemo(() => {
    const commands: Command[] = [];
    Object.values(scoped).forEach((list) => commands.push(...list));

    FORMAT_ORDER.forEach((id) =>
      commands.push({
        id: `create-${id}`,
        label: `New ${FORMATS[id].label.toLowerCase()}`,
        group: 'Create',
        icon: <FormatIcon format={id} className="size-4" />,
        keywords: ['create', 'new', 'project', FORMATS[id].tagline],
        run: () => openNewProject(id),
      }),
    );

    projects
      .filter((p) => p.deletedAt === null)
      .slice(0, 6)
      .forEach((p) =>
        commands.push({
          id: `open-${p.id}`,
          label: p.name,
          group: 'Recent projects',
          icon: <FolderOpen />,
          keywords: ['open', 'project', FORMATS[p.format].label],
          run: go(`/editor/?id=${encodeURIComponent(p.id)}`),
        }),
      );

    commands.push(
      { id: 'nav-home', label: 'Go to Home', group: 'Navigate', icon: <Home />, run: go('/') },
      { id: 'nav-projects', label: 'Go to Projects', group: 'Navigate', icon: <FolderOpen />, run: go('/projects/') },
      {
        id: 'nav-discover',
        label: 'Go to Discover',
        group: 'Navigate',
        icon: <Compass />,
        keywords: ['trending', 'inspiration'],
        run: go('/discover/'),
      },
      {
        id: 'nav-trash',
        label: 'Open Trash',
        group: 'Navigate',
        icon: <Trash2 />,
        keywords: ['deleted', 'restore'],
        run: go('/projects/?view=trash'),
      },
      {
        id: 'nav-settings',
        label: 'Open Settings',
        group: 'Navigate',
        icon: <Settings />,
        keywords: ['preferences'],
        run: go('/settings/'),
      },
    );

    TEMPLATES.forEach((t) =>
      commands.push({
        id: `tpl-${t.id}`,
        label: t.name,
        group: 'Templates',
        hint: FORMATS[t.format].label,
        icon: <LayoutTemplate />,
        keywords: ['template', 'search templates', ...t.tags],
        run: () => void createFromTemplate(t),
      }),
    );

    commands.push(
      {
        id: 'theme-dark',
        label: 'Theme: Dark',
        group: 'Appearance',
        icon: <Moon />,
        keywords: ['mode'],
        run: () => update({ theme: 'dark' }),
      },
      {
        id: 'theme-oled',
        label: 'Theme: OLED black',
        group: 'Appearance',
        icon: <Moon />,
        keywords: ['mode', 'amoled'],
        run: () => update({ theme: 'oled' }),
      },
      {
        id: 'theme-light',
        label: 'Theme: Light',
        group: 'Appearance',
        icon: <Sun />,
        keywords: ['mode'],
        run: () => update({ theme: 'light' }),
      },
      {
        id: 'theme-system',
        label: 'Theme: Match system',
        group: 'Appearance',
        icon: <Monitor />,
        keywords: ['mode', 'auto'],
        run: () => update({ theme: 'system' }),
      },
      {
        id: 'motion-cycle',
        label: `Animations: switch to ${MOTION_CYCLE[motionPref]}`,
        group: 'Appearance',
        icon: <Zap />,
        keywords: ['reduce motion', 'animation', 'accessibility'],
        run: () => {
          const next = MOTION_CYCLE[motionPref];
          update({ motion: next });
          toast({ title: `Animations: ${next}`, tone: 'info' });
        },
      },
      {
        id: 'ambient-toggle',
        label: ambient ? 'Turn off background effects' : 'Turn on background effects',
        group: 'Appearance',
        icon: <Sparkles />,
        keywords: ['particles', 'aurora', 'performance'],
        run: () => update({ ambientEffects: !ambient }),
      },
      {
        id: 'help-onboarding',
        label: 'Replay the intro',
        group: 'Help',
        icon: <Play />,
        keywords: ['onboarding', 'tour'],
        run: () => setOnboardingReplay(true),
      },
      {
        id: 'help-shortcuts',
        label: 'Keyboard shortcuts',
        group: 'Help',
        icon: <Wand2 />,
        keywords: ['keys', 'hotkeys'],
        run: go('/settings/#shortcuts'),
      },
    );

    const byGroup = new Map<string, Command[]>();
    for (const c of commands) byGroup.set(c.group, [...(byGroup.get(c.group) ?? []), c]);
    return [...byGroup.entries()];
    // `go` is recreated each render but only closes over the stable router.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scoped, projects, motionPref, ambient, openNewProject, update, setOnboardingReplay, createFromTemplate, router]);

  // Filter + rank ourselves (cmdk's filtering is disabled) so the best match is
  // always first, across groups.
  const ranked = useMemo(() => {
    if (!search.trim()) return groups;
    return groups
      .map(([group, commands]) => {
        const scored = commands
          .map((c) => ({ c, score: scoreCommand(c.label, search, c.keywords) }))
          .filter((x) => x.score > 0)
          .sort((a, b) => b.score - a.score);
        return { group, commands: scored.map((x) => x.c), best: scored[0]?.score ?? 0 };
      })
      .filter((g) => g.commands.length > 0)
      .sort((a, b) => b.best - a.best)
      .map((g) => [g.group, g.commands] as [string, Command[]]);
  }, [groups, search]);

  const run = (command: Command) => {
    setOpen(false);
    setSearch('');
    // Let the dialog close before running (navigation, other dialogs).
    requestAnimationFrame(() => command.run());
  };

  return (
    <D.Root
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (!v) setSearch('');
      }}
    >
      <D.Portal>
        <D.Overlay className="anim-overlay fixed inset-0 z-[75] bg-[rgb(5_5_10/0.5)] backdrop-blur-[4px]" />
        <D.Content className="anim-palette fixed inset-x-3 top-[max(12vh,env(safe-area-inset-top))] z-[76] mx-auto max-w-[640px] overflow-hidden rounded-[24px] shadow-[var(--shadow-float)] glass-strong outline-none">
          <D.Title className="sr-only">Command palette</D.Title>
          <D.Description className="sr-only">Search for actions, templates and projects</D.Description>
          <Cmdk label="Command palette" loop shouldFilter={false} className="flex max-h-[min(70dvh,560px)] flex-col">
            <div className="flex items-center gap-3 border-b border-line px-4">
              <Search className="size-[18px] shrink-0 text-fg-subtle" aria-hidden />
              <Cmdk.Input
                value={search}
                onValueChange={setSearch}
                autoFocus
                placeholder="Search actions, templates, projects…"
                className="h-14 flex-1 bg-transparent text-[15px] outline-none placeholder:text-fg-subtle"
              />
              <Kbd>Esc</Kbd>
            </div>
            <Cmdk.List className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-2 [&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:pt-3 [&_[cmdk-group-heading]]:pb-1.5 [&_[cmdk-group-heading]]:text-[11px] [&_[cmdk-group-heading]]:font-semibold [&_[cmdk-group-heading]]:tracking-[0.08em] [&_[cmdk-group-heading]]:text-fg-subtle [&_[cmdk-group-heading]]:uppercase">
              <Cmdk.Empty className="px-4 py-10 text-center text-sm text-fg-muted">
                Nothing matches “{search}” — try “carousel”, “y2k” or “theme”.
              </Cmdk.Empty>
              {ranked.map(([group, commands]) => (
                <Cmdk.Group key={group} heading={group} value={group}>
                  {commands.map((c) => (
                    <Cmdk.Item
                      key={c.id}
                      value={c.id}
                      onSelect={() => run(c)}
                      className="flex h-11 cursor-pointer items-center gap-3 rounded-[12px] px-3 text-sm text-fg transition-colors outline-none data-[selected=true]:bg-surface-active [&_svg]:size-4 [&_svg]:shrink-0 [&_svg]:text-fg-muted data-[selected=true]:[&_svg]:text-fg"
                    >
                      {c.icon}
                      <span className="min-w-0 flex-1 truncate">{c.label}</span>
                      {c.hint && <span className="text-xs text-fg-subtle">{c.hint}</span>}
                      {c.shortcut && <Kbd>{c.shortcut}</Kbd>}
                    </Cmdk.Item>
                  ))}
                </Cmdk.Group>
              ))}
            </Cmdk.List>
            <div className="hidden items-center gap-4 border-t border-line px-4 py-2.5 text-[11px] text-fg-subtle sm:flex">
              <span className="flex items-center gap-1.5">
                <Kbd>↑</Kbd>
                <Kbd>↓</Kbd> navigate
              </span>
              <span className="flex items-center gap-1.5">
                <Kbd>↵</Kbd> run
              </span>
              <span className="ml-auto">Everything here works offline ✦</span>
            </div>
          </Cmdk>
        </D.Content>
      </D.Portal>
    </D.Root>
  );
}
