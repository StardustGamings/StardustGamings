'use client';

import {
  Image as ImageIcon,
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

export type PanelId = 'design';

interface Tool {
  id: string;
  label: string;
  icon: ReactNode;
  /** Panel it opens; tools without one are not built yet. */
  panel?: PanelId;
  mode?: boolean;
}

export const TOOLS: Tool[] = [
  { id: 'select', label: 'Select', icon: <MousePointer2 />, mode: true },
  { id: 'design', label: 'Background', icon: <PaintBucket />, panel: 'design' },
  { id: 'text', label: 'Text', icon: <Type /> },
  { id: 'image', label: 'Photos', icon: <ImageIcon /> },
  { id: 'shapes', label: 'Shapes', icon: <Shapes /> },
  { id: 'stickers', label: 'Stickers', icon: <Smile /> },
  { id: 'templates', label: 'Layouts', icon: <LayoutTemplate /> },
  { id: 'filters', label: 'Filters', icon: <Wand2 /> },
  { id: 'animate', label: 'Animate', icon: <Sparkles /> },
];

export function ToolButton({
  tool,
  active,
  onClick,
  orientation,
}: {
  tool: Tool;
  active: boolean;
  onClick: () => void;
  orientation: 'vertical' | 'horizontal';
}) {
  const available = Boolean(tool.panel || tool.mode);
  return (
    <Tooltip
      content={available ? tool.label : `${tool.label} — coming in the next update`}
      side={orientation === 'vertical' ? 'right' : 'top'}
    >
      <button
        type="button"
        onClick={available ? onClick : undefined}
        aria-disabled={!available}
        aria-pressed={available ? active : undefined}
        aria-label={available ? tool.label : `${tool.label} (coming soon)`}
        className={cn(
          'relative flex shrink-0 flex-col items-center justify-center gap-1 rounded-[14px] text-[10px] font-semibold transition-colors [&_svg]:size-5',
          orientation === 'vertical' ? 'h-14 w-[66px]' : 'h-14 w-16',
          active
            ? 'bg-accent text-accent-fg'
            : available
              ? 'text-fg-muted hover:bg-surface-hover hover:text-fg'
              : 'cursor-not-allowed text-fg-subtle/60',
        )}
      >
        {tool.icon}
        {tool.label}
        {!available && <span aria-hidden className="absolute top-2 right-2 size-1.5 rounded-full bg-fg-subtle/60" />}
      </button>
    </Tooltip>
  );
}

export function ToolRail({ panel, onPanel }: { panel: PanelId | null; onPanel: (panel: PanelId | null) => void }) {
  return (
    <nav
      aria-label="Tools"
      className="z-10 hidden w-[80px] shrink-0 flex-col items-center gap-1 overflow-y-auto border-y-0 border-l-0 py-3 glass-strong lg:flex"
    >
      {TOOLS.map((tool) => (
        <ToolButton
          key={tool.id}
          tool={tool}
          orientation="vertical"
          active={tool.panel ? panel === tool.panel : tool.mode === true && panel === null}
          onClick={() => onPanel(tool.panel ?? null)}
        />
      ))}
    </nav>
  );
}
