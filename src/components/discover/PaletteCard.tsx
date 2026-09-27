'use client';

import { Copy } from 'lucide-react';
import type { TrendPalette } from '@/trends/schema';
import { readableOn } from '@/utils/color';
import { IconButton } from '@/components/ui/IconButton';
import { toast } from '@/components/ui/toast-store';

async function copy(text: string, label: string) {
  try {
    await navigator.clipboard.writeText(text);
    toast({ title: `Copied ${label}`, tone: 'success', duration: 2000 });
  } catch {
    toast({ title: 'Clipboard blocked', description: text, tone: 'info' });
  }
}

export function PaletteCard({ palette }: { palette: TrendPalette }) {
  return (
    <div className="overflow-hidden rounded-lg border border-line bg-surface">
      <div className="flex h-32 overflow-hidden">
        {palette.colors.map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => void copy(c, c)}
            aria-label={`Copy ${c}`}
            className="group/sw relative flex flex-1 items-end justify-center pb-2 transition-[flex-grow] duration-300 ease-[var(--ease-out-expo)] hover:flex-[2.2] focus-visible:flex-[2.2]"
            style={{ background: c, color: readableOn(c) }}
          >
            <span className="font-mono text-[10px] font-semibold opacity-0 transition-opacity group-hover/sw:opacity-100 group-focus-visible/sw:opacity-100">
              {c.replace('#', '')}
            </span>
          </button>
        ))}
      </div>
      <div className="flex items-center gap-2 p-3">
        <div className="min-w-0 flex-1">
          <p className="truncate text-subheading">{palette.name}</p>
          <p className="text-meta">{palette.mood}</p>
        </div>
        <IconButton
          label="Copy all HEX codes"
          icon={<Copy />}
          size="sm"
          onClick={() => void copy(palette.colors.join(', '), 'palette')}
        />
      </div>
    </div>
  );
}
