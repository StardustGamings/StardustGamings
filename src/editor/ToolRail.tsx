'use client';

import {
  Hand,
  Image as ImageIcon,
  LayoutGrid,
  Layers,
  LayoutTemplate,
  MousePointer2,
  PaintBucket,
  Shapes,
  Smile,
  Sparkles,
  Type,
  Wand2,
} from 'lucide-react';
import type { ReactNode } from 'react';
import { Tooltip } from '@/components/ui/Tooltip';
import { cn } from '@/utils/cn';
import { useEditor, type PanelId, type Tool } from './store';

export interface ToolDef {
  id: string;
  label: string;
  icon: ReactNode;
  shortcut?: string;
  /** Pointer mode it activates. */
  tool?: Tool;
  /** Panel it opens. */
  panel?: PanelId;
  /** Not built yet — shown, disabled and labelled "coming soon". */
  soon?: boolean;
}

export const MODE_TOOLS: ToolDef[] = [
  { id: 'select', label: 'Select', icon: <MousePointer2 />, tool: 'select', shortcut: 'V' },
  { id: 'hand', label: 'Pan', icon: <Hand />, tool: 'hand', shortcut: 'H' },
];

export const PANEL_TOOLS: ToolDef[] = [
  { id: 'templates', label: 'Templates', icon: <LayoutTemplate />, panel: 'templates' },
  { id: 'text', label: 'Text', icon: <Type />, panel: 'text', shortcut: 'T' },
  { id: 'photos', label: 'Photos', icon: <ImageIcon />, panel: 'photos', shortcut: 'P' },
  { id: 'shapes', label: 'Shapes', icon: <Shapes />, panel: 'shapes' },
  { id: 'stickers', label: 'Stickers', icon: <Smile />, panel: 'stickers' },
  { id: 'design', label: 'Background', icon: <PaintBucket />, panel: 'design' },
  { id: 'layers', label: 'Layers', icon: <Layers />, panel: 'layers' },
  { id: 'layouts', label: 'Layouts', icon: <LayoutGrid />, panel: 'layouts', shortcut: 'L' },
  { id: 'filters', label: 'Filters', icon: <Wand2 />, soon: true },
  { id: 'animate', label: 'Animate', icon: <Sparkles />, soon: true },
];

export function ToolButton({
  tool,
  active,
  onClick,
  orientation,
}: {
  tool: ToolDef;
  active: boolean;
  onClick: () => void;
  orientation: 'vertical' | 'horizontal';
}) {
  return (
    <Tooltip
      content={tool.soon ? `${tool.label} — coming in a later update` : tool.label}
      shortcut={tool.shortcut}
      side={orientation === 'vertical' ? 'right' : 'top'}
    >
      <button
        type="button"
        onClick={tool.soon ? undefined : onClick}
        aria-disabled={tool.soon || undefined}
        aria-pressed={tool.soon ? undefined : active}
        aria-label={tool.soon ? `${tool.label} (coming soon)` : tool.label}
        className={cn(
          'relative flex shrink-0 flex-col items-center justify-center gap-1 rounded-[14px] text-[10px] font-semibold transition-colors [&_svg]:size-5',
          orientation === 'vertical' ? 'h-14 w-[66px]' : 'h-14 w-16',
          active
            ? 'bg-accent text-accent-fg'
            : tool.soon
              ? 'cursor-not-allowed text-fg-subtle/60'
              : 'text-fg-muted hover:bg-surface-hover hover:text-fg',
        )}
      >
        {tool.icon}
        {tool.label}
        {tool.soon && <span aria-hidden className="absolute top-2 right-2 size-1.5 rounded-full bg-fg-subtle/60" />}
      </button>
    </Tooltip>
  );
}

/** Desktop tool rail: pointer modes on top, content panels below. */
export function ToolRail() {
  const tool = useEditor((s) => s.tool);
  const panel = useEditor((s) => s.panel);
  const setTool = useEditor((s) => s.setTool);
  const setPanel = useEditor((s) => s.setPanel);
  return (
    <nav
      aria-label="Tools"
      className="z-10 hidden w-[80px] shrink-0 flex-col items-center gap-1 overflow-y-auto border-y-0 border-l-0 py-3 glass-strong lg:flex"
    >
      {MODE_TOOLS.map((t) => (
        <ToolButton key={t.id} tool={t} orientation="vertical" active={tool === t.tool} onClick={() => setTool(t.tool!)} />
      ))}
      <span className="my-1 h-px w-10 bg-line" aria-hidden />
      {PANEL_TOOLS.filter((t) => t.panel !== 'layers').map((t) => (
        <ToolButton
          key={t.id}
          tool={t}
          orientation="vertical"
          active={panel === t.panel}
          onClick={() => setPanel(panel === t.panel ? null : (t.panel ?? null))}
        />
      ))}
    </nav>
  );
}
