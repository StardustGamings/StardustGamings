'use client';

import Link from 'next/link';
import { ChevronLeft, Command, Download, Maximize, Minus, Plus, Redo2, Undo2 } from 'lucide-react';
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
import { useEditor } from './store';
import { nextZoom } from './zoom';

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

export function EditorTopBar({ zoom }: { zoom: number }) {
  const undo = useEditor((s) => s.undo);
  const redo = useEditor((s) => s.redo);
  const canUndo = useEditor((s) => Boolean(s.history?.past.length));
  const canRedo = useEditor((s) => Boolean(s.history?.future.length));
  const setZoom = useEditor((s) => s.setZoom);
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
            onClick={() => setZoom(nextZoom(zoom, -1))}
            tooltipSide="bottom"
          />
          <Tooltip content="Fit to screen" shortcut="⇧ 1" side="bottom">
            <button
              type="button"
              onClick={() => setZoom(null)}
              className="h-8 w-14 rounded-[10px] text-center font-mono text-xs font-semibold text-fg-muted transition-colors hover:bg-surface-hover hover:text-fg"
              aria-label={`Zoom ${Math.round(zoom * 100)} percent. Click to fit.`}
            >
              {Math.round(zoom * 100)}%
            </button>
          </Tooltip>
          <IconButton
            label="Zoom in"
            shortcut={`${mod} +`}
            icon={<Plus />}
            size="sm"
            onClick={() => setZoom(nextZoom(zoom, 1))}
            tooltipSide="bottom"
          />
          <IconButton
            label="Fit canvas"
            shortcut="⇧ 1"
            icon={<Maximize />}
            size="sm"
            onClick={() => setZoom(null)}
            tooltipSide="bottom"
          />
        </div>
        <IconButton
          label="Command palette"
          shortcut={`${mod} K`}
          icon={<Command />}
          onClick={() => setPaletteOpen(true)}
          tooltipSide="bottom"
          className="hidden sm:inline-flex"
        />
        <Tooltip content="Exporting arrives in an upcoming update — no watermark, no paywall." side="bottom">
          <span tabIndex={0} className="ml-1 rounded-[13px]">
            <Button
              variant="primary"
              size="sm"
              disabled
              aria-disabled
              icon={<Download className="size-4" />}
              className="pointer-events-none"
            >
              <span className="hidden sm:inline">Export</span>
              <span className="rounded-full bg-accent-fg/15 px-1.5 text-[9px] font-bold tracking-wide uppercase">Soon</span>
            </Button>
          </span>
        </Tooltip>
      </div>
    </header>
  );
}
