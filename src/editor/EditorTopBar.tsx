'use client';

import Link from 'next/link';
import {
  BookmarkPlus,
  Check,
  ChevronDown,
  ChevronLeft,
  Command,
  Download,
  History,
  Bookmark,
  MoreHorizontal,
  FileDown,
  Play,
  Maximize,
  Minus,
  Plus,
  Redo2,
  Undo2,
  ZoomIn,
  ZoomOut,
  Maximize2,
} from 'lucide-react';
import { useState } from 'react';
import { FORMATS } from '@/projects/formats';
import { MAX_NAME_LENGTH } from '@/projects/repository';
import { useUi } from '@/settings/ui-store';
import { modKey } from '@/hooks/useHotkeys';
import { useClientValue } from '@/hooks/useClientValue';
import { Button } from '@/components/ui/Button';
import { IconButton } from '@/components/ui/IconButton';
import { Tooltip } from '@/components/ui/Tooltip';
import { LogoMark } from '@/components/ui/Logo';
import { FormatIcon } from '@/components/home/FormatIcon';
import { SaveIndicator } from './SaveIndicator';
import { selectDoc, useEditor } from './store';
import * as actions from './actions';
import { saveVersion } from './versioning';
import { downloadProjectFile } from '@/components/projects/project-files';
import { toast } from '@/components/ui/toast-store';
import { useCamera } from './camera';
import { Menu, MenuContent, MenuItem, MenuSeparator, MenuTrigger } from '@/components/ui/Menu';

function NameField() {
  const meta = useEditor((s) => s.meta);
  if (!meta) return null;
  // Re-keyed so the draft resets whenever the saved name changes.
  return <NameInput key={meta.name} />;
}

function NameInput() {
  const meta = useEditor((s) => s.meta)!;
  const rename = useEditor((s) => s.rename);
  const [value, setValue] = useState(meta.name);

  const commit = () => {
    const trimmed = value.trim();
    if (!trimmed) setValue(meta.name);
    else if (trimmed !== meta.name) void rename(trimmed);
  };

  return (
    <div className="flex min-w-0 items-center gap-2">
      <span
        className="hidden size-7 shrink-0 items-center justify-center rounded-[9px] bg-surface-active text-fg-muted sm:flex"
        title={FORMATS[meta.format].label}
      >
        <FormatIcon format={meta.format} className="size-4" />
      </span>
      <label htmlFor="project-name" className="sr-only">
        Project name
      </label>
      <input
        id="project-name"
        value={value}
        maxLength={MAX_NAME_LENGTH}
        onChange={(e) => setValue(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') e.currentTarget.blur();
          if (e.key === 'Escape') {
            setValue(meta.name);
            e.currentTarget.blur();
          }
        }}
        className="h-9 max-w-[40vw] min-w-0 truncate rounded-[10px] bg-transparent px-2 font-display text-[15px] font-bold transition-colors outline-none hover:bg-surface-hover focus:bg-surface-hover sm:max-w-[320px]"
      />
    </div>
  );
}

/** Everything that doesn't fit in the bar (all of it on phones). */
function MoreMenu() {
  const mod = useClientValue(modKey, 'Ctrl');
  return (
    <Menu>
      <MenuTrigger asChild>
        <IconButton label="More" icon={<MoreHorizontal />} tooltip={false} data-testid="editor-more" />
      </MenuTrigger>
      <MenuContent align="end">
        <MenuItem icon={<History />} onSelect={() => useUi.getState().setHistoryOpen(true)}>
          Version history
        </MenuItem>
        <MenuItem
          icon={<Bookmark />}
          shortcut={`${mod === 'Ctrl' ? 'Ctrl' : '⌘'} S`}
          onSelect={async () => {
            await useEditor.getState().save();
            const version = await saveVersion().catch(() => null);
            toast({
              title: version ? 'Version saved' : 'Already saved',
              description: version ? 'Find it in Version history.' : 'Nothing changed since the last version.',
              tone: version ? 'success' : 'default',
              duration: 2200,
            });
          }}
        >
          Save a version
        </MenuItem>
        <MenuSeparator />
        <MenuItem icon={<Maximize2 />} onSelect={() => useUi.getState().openResize()}>
          Resize design…
        </MenuItem>
        <MenuItem icon={<Play />} onSelect={() => useUi.getState().setCarouselPreview(true)}>
          Swipe preview
        </MenuItem>
        <MenuItem icon={<BookmarkPlus />} onSelect={() => useUi.getState().openSaveTemplate({ source: 'editor' })}>
          Save as template
        </MenuItem>
        <MenuItem
          icon={<FileDown />}
          onSelect={() => {
            const ed = useEditor.getState();
            if (ed.meta) void downloadProjectFile(ed.meta.id, selectDoc(ed) ?? undefined);
          }}
        >
          Download project file
        </MenuItem>
        <MenuItem icon={<Command />} shortcut={`${mod} K`} onSelect={() => useUi.getState().setPaletteOpen(true)}>
          Command palette
        </MenuItem>
      </MenuContent>
    </Menu>
  );
}

function ZoomMenu() {
  const zoom = useCamera((s) => s.zoom);
  const showGrid = useEditor((s) => s.showGrid);
  const showRulers = useEditor((s) => s.showRulers);
  const showSafeArea = useEditor((s) => s.showSafeArea);
  const snapping = useEditor((s) => s.snapping);
  const ed = useEditor.getState();
  const check = (on: boolean) => <Check className={on ? 'opacity-100' : 'opacity-0'} />;
  return (
    <Menu>
      <MenuTrigger asChild>
        <button
          type="button"
          className="flex h-8 items-center gap-1 rounded-[10px] px-2 font-mono text-xs font-semibold text-fg-muted transition-colors hover:bg-surface-hover hover:text-fg data-[state=open]:bg-surface-active"
          aria-label={`Zoom ${Math.round(zoom * 100)} percent — view options`}
          data-testid="zoom-menu"
        >
          {Math.round(zoom * 100)}%
          <ChevronDown className="size-3.5" />
        </button>
      </MenuTrigger>
      <MenuContent align="end">
        <MenuItem icon={<ZoomIn />} shortcut="⌘ +" onSelect={() => actions.zoomStep(1)}>
          Zoom in
        </MenuItem>
        <MenuItem icon={<ZoomOut />} shortcut="⌘ −" onSelect={() => actions.zoomStep(-1)}>
          Zoom out
        </MenuItem>
        <MenuItem icon={<Maximize />} shortcut="⇧ 1" onSelect={() => actions.fitSlide()}>
          Fit slide
        </MenuItem>
        <MenuItem icon={<Maximize />} shortcut="⇧ 2" onSelect={actions.fitAll}>
          Fit all slides
        </MenuItem>
        <MenuItem
          icon={<span className="w-4 text-center font-mono text-[10px]">1:1</span>}
          shortcut="⌘ 0"
          onSelect={() => actions.zoomTo(1)}
        >
          Actual size
        </MenuItem>
        <MenuSeparator />
        <MenuItem icon={check(snapping)} onSelect={(e) => (e.preventDefault(), ed.toggleSnapping())}>
          Snapping
        </MenuItem>
        <MenuItem icon={check(showGrid)} shortcut="'" onSelect={(e) => (e.preventDefault(), ed.toggleGrid())}>
          Grid
        </MenuItem>
        <MenuItem icon={check(showRulers)} shortcut="⇧ R" onSelect={(e) => (e.preventDefault(), ed.toggleRulers())}>
          Rulers & guides
        </MenuItem>
        <MenuItem icon={check(showSafeArea)} onSelect={(e) => (e.preventDefault(), ed.toggleSafeArea())}>
          Safe areas
        </MenuItem>
      </MenuContent>
    </Menu>
  );
}

export function EditorTopBar() {
  const undo = useEditor((s) => s.undo);
  const redo = useEditor((s) => s.redo);
  const canUndo = useEditor((s) => Boolean(s.history?.past.length));
  const canRedo = useEditor((s) => Boolean(s.history?.future.length));
  const setPaletteOpen = useUi((s) => s.setPaletteOpen);
  const mod = useClientValue(modKey, 'Ctrl');

  return (
    <header className="relative z-20 flex h-14 shrink-0 items-center gap-1 border-x-0 border-t-0 px-2 glass-strong sm:gap-2 sm:px-3">
      <Tooltip content="Back to home" side="bottom">
        <Link
          href="/"
          aria-label="Back to home"
          className="flex h-10 items-center gap-1 rounded-[12px] pr-2 pl-1 text-fg-muted transition-colors hover:bg-surface-hover hover:text-fg"
        >
          <ChevronLeft className="size-5" />
          <LogoMark className="size-7" />
        </Link>
      </Tooltip>
      <NameField />
      <SaveIndicator />

      <div className="ml-auto flex items-center gap-0.5 sm:gap-1">
        <IconButton label="Undo" shortcut={`${mod} Z`} icon={<Undo2 />} disabled={!canUndo} onClick={undo} tooltipSide="bottom" />
        <IconButton
          label="Redo"
          shortcut={`${mod} ⇧ Z`}
          icon={<Redo2 />}
          disabled={!canRedo}
          onClick={redo}
          tooltipSide="bottom"
        />
        <div className="mx-1 hidden h-6 w-px bg-line md:block" />
        <div className="hidden items-center md:flex">
          <IconButton
            label="Zoom out"
            shortcut={`${mod} −`}
            icon={<Minus />}
            size="sm"
            onClick={() => actions.zoomStep(-1)}
            tooltipSide="bottom"
          />
          <ZoomMenu />
          <IconButton
            label="Zoom in"
            shortcut={`${mod} +`}
            icon={<Plus />}
            size="sm"
            onClick={() => actions.zoomStep(1)}
            tooltipSide="bottom"
          />
          <IconButton
            label="Fit canvas"
            shortcut="⇧ 1"
            icon={<Maximize />}
            size="sm"
            onClick={() => actions.fitSlide()}
            tooltipSide="bottom"
          />
        </div>
        <IconButton
          label="Swipe preview"
          icon={<Play />}
          onClick={() => useUi.getState().setCarouselPreview(true)}
          tooltipSide="bottom"
        />
        <IconButton
          label="Version history"
          icon={<History />}
          onClick={() => useUi.getState().setHistoryOpen(true)}
          tooltipSide="bottom"
          className="max-sm:hidden"
          data-testid="open-history"
        />
        <IconButton
          label="Save as template"
          icon={<BookmarkPlus />}
          onClick={() => useUi.getState().openSaveTemplate({ source: 'editor' })}
          tooltipSide="bottom"
          className="max-sm:hidden"
        />
        <IconButton
          label="Command palette"
          shortcut={`${mod} K`}
          icon={<Command />}
          onClick={() => setPaletteOpen(true)}
          tooltipSide="bottom"
          className="max-sm:hidden"
        />
        <MoreMenu />
        <Tooltip content={`Export — PNG, JPG, WebP or PDF (${mod} ⇧ E). No watermark, ever.`} side="bottom">
          <Button
            variant="primary"
            size="sm"
            aria-label="Export"
            icon={<Download className="size-4" />}
            className="ml-1"
            onClick={() => useUi.getState().openExport({ source: 'editor' })}
            data-testid="open-export"
          >
            <span className="hidden sm:inline">Export</span>
          </Button>
        </Tooltip>
      </div>
    </header>
  );
}
