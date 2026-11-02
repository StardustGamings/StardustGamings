'use client';

import { ChevronDown, Copy } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import type { ImageElement } from '@/types/document';
import { EFFECT_DEFS, LEAK_STYLES, hasEffects } from '@/effects/effects';
import { resolveLook } from '@/filters/looks';
import { Slider } from '@/components/ui/Slider';
import { toast } from '@/components/ui/toast-store';
import { cn } from '@/utils/cn';
import { applyLook, lookTargets, resetEffects, setEffect, setLeakStyle, setLookIntensity } from '../filter-actions';
import { LookPicker, usePickerExtras } from './LookPicker';

/** Collapsible section matching the other photo tools. */
export function ToolSection({
  title,
  edited,
  defaultOpen,
  action,
  children,
}: {
  title: string;
  edited?: boolean;
  defaultOpen?: boolean;
  action?: ReactNode;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen ?? false);
  return (
    <section className="border-b border-line last:border-b-0">
      <div className="flex items-center gap-2 px-4">
        <button
          type="button"
          aria-expanded={open}
          onClick={() => setOpen(!open)}
          className="flex h-12 min-w-0 flex-1 items-center gap-2 text-left"
        >
          <h3 className="text-label">{title}</h3>
          {edited && <span className="size-1.5 rounded-full bg-accent" aria-label="edited" />}
          <ChevronDown className={cn('ml-auto size-4 text-fg-subtle transition-transform', open && 'rotate-180')} />
        </button>
        {action}
      </div>
      {open && <div className="flex flex-col gap-3 px-4 pb-4">{children}</div>}
    </section>
  );
}

export function PercentSlider({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-[12.5px]">
        <button
          type="button"
          className="text-fg-muted hover:text-fg"
          title="Double-click to reset"
          onDoubleClick={() => onChange(0)}
        >
          {label}
        </button>
        <span className={cn('font-mono text-[11.5px] tabular-nums', value ? 'text-fg' : 'text-fg-subtle')}>
          {Math.round(value)}
        </span>
      </div>
      <Slider aria-label={label} min={0} max={100} value={value} onChange={onChange} />
    </div>
  );
}

/** One-tap looks for the selected photo(s), with intensity and "apply to every photo". */
export function FiltersSection({ el }: { el: ImageElement }) {
  const look = resolveLook(el.filter);
  const others = lookTargets('all').length - 1;
  const { looks: extra, label } = usePickerExtras(look);
  return (
    <ToolSection title="Filters" edited={!!look} defaultOpen>
      <LookPicker assetId={el.assetId} value={look?.id ?? null} onPick={(l) => applyLook(l)} extra={extra} extraLabel={label} />
      {look && (
        <>
          <PercentSlider label="Intensity" value={el.filter?.intensity ?? 0} onChange={(v) => setLookIntensity(v)} />
          {others > 0 && (
            <button
              type="button"
              onClick={() => {
                applyLook(look, 'all', el.filter?.intensity);
                toast({
                  title: `${look.name} on all ${others + 1} photos`,
                  description: 'One undo takes it back.',
                  tone: 'success',
                  duration: 2400,
                });
              }}
              className="flex h-9 items-center justify-center gap-1.5 rounded-md border border-line text-[12.5px] font-semibold transition-colors hover:border-accent"
            >
              <Copy className="size-4" /> Apply to all {others + 1} photos
            </button>
          )}
        </>
      )}
    </ToolSection>
  );
}

/** Creative effects: glow, light leak, dust, RGB split, scanlines. */
export function EffectsSection({ el }: { el: ImageElement }) {
  const fx = el.effects;
  const edited = hasEffects(fx);
  return (
    <ToolSection
      title="Effects"
      edited={edited}
      action={
        edited ? (
          <button type="button" onClick={resetEffects} className="text-[12px] font-semibold text-fg-muted hover:text-fg">
            Reset
          </button>
        ) : undefined
      }
    >
      {EFFECT_DEFS.map((def) => (
        <div key={def.key} className="flex flex-col gap-2">
          <PercentSlider label={def.label} value={fx?.[def.key] ?? 0} onChange={(v) => setEffect(def.key, v)} />
          {def.key === 'leak' && (
            <div className="flex gap-1.5" role="radiogroup" aria-label="Light leak colour">
              {LEAK_STYLES.map((s) => {
                const active = (fx?.leak ?? 0) > 0 && (fx?.leakStyle ?? 'amber') === s.id;
                return (
                  <button
                    key={s.id}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    onClick={() => setLeakStyle(s.id)}
                    className={cn(
                      'flex h-7 flex-1 items-center justify-center rounded-full border text-[11px] font-semibold text-white transition-[border-color,transform] [text-shadow:0_1px_2px_rgb(0_0_0/0.35)]',
                      active ? 'scale-[1.04] border-fg' : 'border-transparent opacity-85 hover:opacity-100',
                    )}
                    style={{ background: s.swatch }}
                  >
                    {s.label}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      ))}
      <p className="text-[11.5px] text-fg-subtle">
        Effects stack with the filter and your adjustments. Everything stays editable.
      </p>
    </ToolSection>
  );
}
