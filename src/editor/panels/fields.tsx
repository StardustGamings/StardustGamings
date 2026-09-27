'use client';

import { Popover } from 'radix-ui';
import { useId, useRef, useState, type ReactNode } from 'react';
import type { Fill } from '@/types/document';
import { fillToCss } from '@/canvas/render/fill';
import { cn } from '@/utils/cn';
import { clamp } from '@/utils/math';
import { FillPicker } from '../FillPicker';
import { useDocColors } from './useSelection';

export function Section({ title, children, action }: { title: string; children: ReactNode; action?: ReactNode }) {
  return (
    <section className="border-b border-line px-4 py-3.5 last:border-b-0">
      <div className="mb-2.5 flex min-h-6 items-center justify-between gap-2">
        <h3 className="font-sans text-[12.5px] font-semibold tracking-normal text-fg">{title}</h3>
        {action}
      </div>
      <div className="flex flex-col gap-2.5">{children}</div>
    </section>
  );
}

export function Row({ label, children, htmlFor }: { label: string; children: ReactNode; htmlFor?: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <label htmlFor={htmlFor} className="shrink-0 text-[13px] text-fg-muted">
        {label}
      </label>
      <div className="flex min-w-0 items-center justify-end gap-2">{children}</div>
    </div>
  );
}

interface NumberFieldProps {
  label: string;
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  /** Decimals shown. */
  precision?: number;
  suffix?: string;
  className?: string;
  /** Short label shown inside the field (drag it to scrub). */
  glyph?: string;
  /** Shown but not editable (e.g. a text box's height, which follows its text). */
  disabled?: boolean;
  /** Why it's disabled, as a tooltip. */
  title?: string;
}

/**
 * Numeric input with a draggable label (scrub horizontally to change the value,
 * Shift for ×10). Commits on blur/Enter; arrow keys step.
 */
export function NumberField({
  label,
  value,
  onChange,
  min = -Infinity,
  max = Infinity,
  step = 1,
  precision = 0,
  suffix,
  className,
  glyph,
  disabled = false,
  title,
}: NumberFieldProps) {
  const id = useId();
  const [draft, setDraft] = useState<string | null>(null);
  const scrub = useRef<{ x: number; value: number } | null>(null);
  const shown = draft ?? (Number.isFinite(value) ? value.toFixed(precision) : '');
  const commit = (raw: string) => {
    setDraft(null);
    const n = Number(raw.replace(',', '.'));
    if (Number.isFinite(n)) onChange(clamp(n, min, max));
  };

  return (
    <div
      className={cn(
        'flex h-8 min-w-0 items-center rounded-md border border-line bg-bg-sunken transition-colors focus-within:border-ring hover:border-line-strong',
        disabled && 'opacity-50',
        className,
      )}
      title={title}
    >
      <span
        aria-hidden
        title={disabled ? undefined : `Drag to adjust ${label.toLowerCase()}`}
        className={cn(
          'flex h-full w-7 shrink-0 touch-none items-center justify-center font-mono text-[10.5px] font-semibold text-fg-subtle select-none',
          !disabled && 'cursor-ew-resize',
        )}
        onPointerDown={(e) => {
          if (disabled) return;
          e.currentTarget.setPointerCapture(e.pointerId);
          scrub.current = { x: e.clientX, value };
        }}
        onPointerMove={(e) => {
          if (!scrub.current) return;
          const delta = Math.round((e.clientX - scrub.current.x) / 2) * step * (e.shiftKey ? 10 : 1);
          onChange(clamp(scrub.current.value + delta, min, max));
        }}
        onPointerUp={() => (scrub.current = null)}
      >
        {glyph ?? label[0]}
      </span>
      <input
        id={id}
        aria-label={label}
        inputMode="decimal"
        disabled={disabled}
        value={shown}
        onChange={(e) => setDraft(e.target.value)}
        onFocus={(e) => e.currentTarget.select()}
        onBlur={(e) => commit(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') commit(e.currentTarget.value);
          if (e.key === 'Escape') {
            setDraft(null);
            e.currentTarget.blur();
          }
          if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
            e.preventDefault();
            const dir = e.key === 'ArrowUp' ? 1 : -1;
            onChange(clamp(value + dir * step * (e.shiftKey ? 10 : 1), min, max));
            setDraft(null);
          }
        }}
        className="h-full w-full min-w-0 bg-transparent pr-2 text-right font-mono text-[12.5px] text-fg tabular-nums outline-none"
      />
      {suffix && <span className="pr-2 text-[11px] text-fg-subtle">{suffix}</span>}
    </div>
  );
}

/** Swatch button that opens a fill/colour picker popover. */
export function FillField({
  label,
  value,
  onChange,
  solidOnly,
  allowNone,
}: {
  label: string;
  value: Fill | null;
  onChange: (fill: Fill | null) => void;
  solidOnly?: boolean;
  allowNone?: boolean;
}) {
  const docColors = useDocColors();
  return (
    <Popover.Root>
      <Popover.Trigger asChild>
        <button
          type="button"
          aria-label={`${label}: change colour`}
          className="flex h-8 min-w-0 flex-1 items-center gap-2 rounded-md border border-line bg-bg-sunken px-2 text-left text-[12.5px] transition-colors hover:border-line-strong"
        >
          <span
            className={cn('size-5 shrink-0 rounded-sm border border-line-strong', !value && 'checkerboard')}
            style={value ? { background: fillToCss(value) } : undefined}
          />
          <span className="truncate font-mono text-fg-muted">
            {value
              ? value.type === 'solid'
                ? value.color.toUpperCase()
                : value.type === 'linear'
                  ? 'Linear gradient'
                  : 'Radial gradient'
              : 'None'}
          </span>
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          side="left"
          align="start"
          sideOffset={10}
          collisionPadding={12}
          className="z-[70] w-[276px] animate-[pop-in_120ms_var(--ease-standard)] rounded-lg border border-line-strong bg-bg-elevated p-3.5 shadow-[var(--shadow-float)]"
        >
          <div className="mb-3 flex items-center justify-between">
            <p className="text-[13px] font-semibold">{label}</p>
            {allowNone && (
              <button
                type="button"
                onClick={() => onChange(null)}
                className="rounded-sm border border-line px-2.5 py-1 text-[11px] font-semibold text-fg-muted hover:text-fg"
              >
                No fill
              </button>
            )}
          </div>
          <FillPicker
            label={label}
            value={value ?? { type: 'solid', color: '#FFFFFF' }}
            onChange={onChange}
            solidOnly={solidOnly}
            docColors={docColors}
          />
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

export function IconToggle({
  label,
  title,
  pressed,
  disabled,
  onClick,
  children,
}: {
  label: string;
  /** Tooltip, when it should say more than the label (e.g. why it's disabled). */
  title?: string;
  pressed: boolean;
  disabled?: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={title ?? label}
      aria-pressed={pressed}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        'flex h-8 min-w-8 items-center justify-center rounded-md border px-2 text-[12px] font-medium transition-colors disabled:opacity-35 [&_svg]:size-4',
        pressed
          ? 'border-line-strong bg-surface-active text-fg'
          : 'border-line text-fg-muted hover:border-line-strong hover:text-fg',
      )}
    >
      {children}
    </button>
  );
}

export function ActionButton({
  label,
  onClick,
  children,
  disabled,
}: {
  label: string;
  onClick: () => void;
  children: ReactNode;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
      className="flex h-8 flex-1 items-center justify-center rounded-md border border-line text-fg-muted transition-colors hover:border-line-strong hover:bg-surface-hover hover:text-fg disabled:opacity-35 [&_svg]:size-4"
    >
      {children}
    </button>
  );
}
