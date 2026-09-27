'use client';

import { Check } from 'lucide-react';
import type { ThemePreference } from '@/types/settings';
import { useSettings } from '@/settings/store';
import { cn } from '@/utils/cn';

const THEMES: { value: ThemePreference; label: string; bg: string; panel: string; text: string; accent: string }[] = [
  { value: 'dark', label: 'Dark', bg: '#101012', panel: '#1E1E22', text: '#EDEDEA', accent: '#C6FF3D' },
  { value: 'light', label: 'Light', bg: '#F4F4F1', panel: '#FFFFFF', text: '#161616', accent: '#C6FF3D' },
  { value: 'oled', label: 'OLED', bg: '#000000', panel: '#141416', text: '#EDEDEA', accent: '#C6FF3D' },
];

function Swatch({ t }: { t: (typeof THEMES)[number] }) {
  return (
    <span className="block h-full w-full p-2.5" style={{ background: t.bg }}>
      <span className="flex h-full gap-1.5">
        <span className="w-3 rounded-xs" style={{ background: t.panel }} />
        <span className="flex flex-1 flex-col gap-1.5">
          <span className="h-2 w-2/3 rounded-full" style={{ background: t.text, opacity: 0.9 }} />
          <span className="h-1.5 w-1/2 rounded-full" style={{ background: t.text, opacity: 0.35 }} />
          <span className="mt-auto h-4 w-10 rounded-xs" style={{ background: t.accent }} />
        </span>
      </span>
    </span>
  );
}

export function ThemePicker({ labelId }: { labelId: string }) {
  const theme = useSettings((s) => s.theme);
  const update = useSettings((s) => s.update);
  const options = [
    ...THEMES.map((t) => ({ ...t, system: false })),
    { ...THEMES[0]!, value: 'system' as const, label: 'System', system: true },
  ];

  return (
    <div role="radiogroup" aria-labelledby={labelId} className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
      {options.map((t) => {
        const active = theme === t.value;
        return (
          <button
            key={t.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => update({ theme: t.value })}
            className={cn('group text-left', active && 'text-fg')}
          >
            <span
              className={cn(
                'relative block h-16 overflow-hidden rounded-md border-2 transition-[border-color] duration-150',
                active ? 'border-accent' : 'border-line group-hover:border-line-strong',
              )}
            >
              {t.system ? (
                <span className="flex h-full">
                  <span className="w-1/2 overflow-hidden">
                    <Swatch t={THEMES[1]!} />
                  </span>
                  <span className="w-1/2 overflow-hidden">
                    <Swatch t={THEMES[0]!} />
                  </span>
                </span>
              ) : (
                <Swatch t={t} />
              )}
              {active && (
                <span className="absolute top-1.5 right-1.5 flex size-5 items-center justify-center rounded-full bg-accent text-accent-fg">
                  <Check className="size-3" strokeWidth={3} />
                </span>
              )}
            </span>
            <span className="mt-1.5 block text-[13px] font-medium">{t.label}</span>
          </button>
        );
      })}
    </div>
  );
}
