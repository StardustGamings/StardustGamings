'use client';

import { useId, useState } from 'react';
import type { Fill } from '@/types/document';
import { fillPrimaryColor, fillToCss } from '@/canvas/render';
import { fromHsl, normalizeHex, parseColor, toHex, toHsl } from '@/utils/color';
import { Slider } from '@/components/ui/Slider';
import { cn } from '@/utils/cn';

const SOLIDS = [
  '#FFFFFF',
  '#F4F1EA',
  '#E9E4D8',
  '#0B0A12',
  '#1D1A17',
  '#2A1470',
  '#C6FF3D',
  '#3CF0C8',
  '#3CF0FF',
  '#7CC4FF',
  '#A06BFF',
  '#E4DAFF',
  '#FF5CAA',
  '#FF3D71',
  '#FF6B2C',
  '#FFD23D',
  '#FFE3D3',
  '#5B6B4F',
];

const lin = (angle: number, ...colors: string[]): Fill => ({
  type: 'linear',
  angle,
  stops: colors.map((color, i) => ({ offset: colors.length === 1 ? 0 : i / (colors.length - 1), color })),
});

export const GRADIENTS: Fill[] = [
  lin(90, '#C6FF3D', '#3CF0C8', '#A06BFF'),
  lin(180, '#E9DFFF', '#FFE3D3', '#FFF4E0'),
  lin(135, '#FF5CAA', '#FF9D5C'),
  lin(160, '#07070B', '#2A1470'),
  lin(90, '#3CF0FF', '#A06BFF', '#FF5CAA'),
  lin(180, '#FF6B2C', '#FFD23D'),
  {
    type: 'radial',
    cx: 0.5,
    cy: 0.3,
    radius: 0.9,
    stops: [
      { offset: 0, color: '#FFC2F2' },
      { offset: 0.45, color: '#A06BFF' },
      { offset: 1, color: '#2A1470' },
    ],
  },
  lin(180, '#F3EEE6', '#DCCFBE'),
];

const same = (a: Fill, b: Fill) => JSON.stringify(a) === JSON.stringify(b);

interface FillPickerProps {
  value: Fill;
  onChange: (fill: Fill) => void;
  label: string;
  /** Hide gradient presets (strokes, tints). */
  solidOnly?: boolean;
  /** Colours already used in the design, offered first for consistency. */
  docColors?: string[];
}

type ColourMode = 'hex' | 'rgb' | 'hsl';

const CHANNELS: Record<Exclude<ColourMode, 'hex'>, { key: string; label: string; max: number }[]> = {
  rgb: [
    { key: 'r', label: 'Red', max: 255 },
    { key: 'g', label: 'Green', max: 255 },
    { key: 'b', label: 'Blue', max: 255 },
  ],
  hsl: [
    { key: 'h', label: 'Hue', max: 360 },
    { key: 's', label: 'Saturation', max: 100 },
    { key: 'l', label: 'Lightness', max: 100 },
  ],
};

/** R/G/B or H/S/L number fields for a colour. */
function ChannelFields({ mode, color, onChange }: { mode: 'rgb' | 'hsl'; color: string; onChange: (hex: string) => void }) {
  const rgb = parseColor(color) ?? { r: 0, g: 0, b: 0, a: 1 };
  const hsl = toHsl(color);
  const values: Record<string, number> = mode === 'rgb' ? { r: rgb.r, g: rgb.g, b: rgb.b } : { h: hsl.h, s: hsl.s, l: hsl.l };
  const set = (key: string, raw: string) => {
    const n = Number(raw);
    if (!Number.isFinite(n)) return;
    const channel = CHANNELS[mode].find((c) => c.key === key)!;
    const next = { ...values, [key]: Math.max(0, Math.min(channel.max, n)) };
    onChange(
      mode === 'rgb'
        ? toHex({ r: next.r!, g: next.g!, b: next.b!, a: 1 }).toUpperCase()
        : fromHsl({ h: next.h!, s: next.s!, l: next.l! }),
    );
  };
  return (
    <div className="grid min-w-0 flex-1 grid-cols-3 gap-1.5">
      {CHANNELS[mode].map((c) => (
        <label
          key={c.key}
          className="flex h-10 min-w-0 items-center gap-1 rounded-lg border border-line bg-bg-sunken px-2 focus-within:border-ring"
        >
          <span aria-hidden className="font-mono text-[10.5px] font-bold text-fg-subtle uppercase">
            {c.key}
          </span>
          <span className="sr-only">{c.label}</span>
          <input
            type="number"
            inputMode="numeric"
            min={0}
            max={c.max}
            value={Math.round(values[c.key]!)}
            onChange={(e) => set(c.key, e.target.value)}
            className="w-full min-w-0 [appearance:textfield] bg-transparent font-mono text-sm outline-none [&::-webkit-inner-spin-button]:appearance-none"
          />
        </label>
      ))}
    </div>
  );
}

/** Solid swatches, gradient presets and a custom colour as HEX, RGB or HSL. */
export function FillPicker({ value, onChange, label, solidOnly = false, docColors = [] }: FillPickerProps) {
  const hexId = useId();
  const [mode, setMode] = useState<ColourMode>('hex');
  const primary = fillPrimaryColor(value);
  const [hex, setHex] = useState(primary);
  const [shown, setShown] = useState(primary);
  if (primary !== shown) {
    setShown(primary);
    setHex(primary);
  }
  const valid = normalizeHex(hex) !== null;

  const commitHex = (input: string) => {
    const normalized = normalizeHex(input);
    if (normalized) onChange({ type: 'solid', color: normalized });
  };

  return (
    <div className="flex flex-col gap-4" role="group" aria-label={label}>
      {docColors.length > 0 && (
        <div>
          <p className="mb-2 text-label">In this design</p>
          <div className="flex flex-wrap gap-1.5">
            {docColors.slice(0, 12).map((c) => (
              <button
                key={c}
                type="button"
                aria-label={`Design colour ${c}`}
                onClick={() => onChange({ type: 'solid', color: c })}
                className="size-7 rounded-full border border-line-strong transition-shadow hover:ring-2 hover:ring-line-strong"
                style={{ background: c }}
              />
            ))}
          </div>
        </div>
      )}
      <div className="grid grid-cols-6 gap-2">
        {SOLIDS.map((c) => {
          const active = value.type === 'solid' && value.color.toUpperCase() === c;
          return (
            <button
              key={c}
              type="button"
              aria-label={`Solid ${c}`}
              aria-pressed={active}
              onClick={() => onChange({ type: 'solid', color: c })}
              className={cn(
                'aspect-square rounded-md border border-line-strong transition-shadow hover:ring-2 hover:ring-line-strong',
                active && 'ring-2 ring-ring ring-offset-2 ring-offset-bg-elevated',
              )}
              style={{ background: c }}
            />
          );
        })}
      </div>
      <div className={cn('grid grid-cols-4 gap-2', solidOnly && 'hidden')}>
        {GRADIENTS.map((g, i) => {
          const active = same(g, value);
          return (
            <button
              key={i}
              type="button"
              aria-label={`Gradient ${i + 1}`}
              aria-pressed={active}
              onClick={() => onChange(g)}
              className={cn(
                'h-10 rounded-md border border-line-strong transition-shadow hover:ring-2 hover:ring-line-strong',
                active && 'ring-2 ring-ring ring-offset-2 ring-offset-bg-elevated',
              )}
              style={{ background: fillToCss(g) }}
            />
          );
        })}
      </div>
      {value.type === 'linear' && (
        <div>
          <p className="mb-2 text-xs font-semibold text-fg-muted">Gradient angle · {Math.round(value.angle)}°</p>
          <Slider
            aria-label="Gradient angle"
            min={0}
            max={360}
            step={1}
            value={value.angle}
            onChange={(angle) => onChange({ ...value, angle })}
          />
        </div>
      )}
      <div className="flex items-center gap-2">
        <label
          className="relative size-10 shrink-0 cursor-pointer overflow-hidden rounded-lg border border-line-strong"
          style={{ background: primary }}
        >
          <span className="sr-only">Pick a custom colour</span>
          <input
            type="color"
            value={normalizeHex(primary)?.slice(0, 7) ?? '#000000'}
            onChange={(e) => onChange({ type: 'solid', color: e.target.value.toUpperCase() })}
            className="absolute inset-0 size-full cursor-pointer opacity-0"
          />
        </label>
        {mode !== 'hex' ? (
          <ChannelFields mode={mode} color={primary} onChange={(hex) => onChange({ type: 'solid', color: hex })} />
        ) : (
          <>
            <label htmlFor={hexId} className="sr-only">
              HEX colour
            </label>
            <input
              id={hexId}
              value={hex}
              spellCheck={false}
              maxLength={9}
              onChange={(e) => setHex(e.target.value)}
              onBlur={(e) => commitHex(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && commitHex(e.currentTarget.value)}
              aria-invalid={!valid}
              className={cn(
                'h-10 min-w-0 flex-1 rounded-lg border bg-bg-sunken px-3 font-mono text-sm uppercase outline-none focus:border-ring',
                valid ? 'border-line' : 'border-danger',
              )}
            />
          </>
        )}
      </div>
      <div role="radiogroup" aria-label="Colour format" className="-mt-2 flex gap-1">
        {(['hex', 'rgb', 'hsl'] as const).map((m) => (
          <button
            key={m}
            type="button"
            role="radio"
            aria-checked={mode === m}
            onClick={() => setMode(m)}
            className={cn(
              'h-6 rounded-sm px-2 font-mono text-[10.5px] font-semibold uppercase transition-colors',
              mode === m ? 'bg-surface-active text-fg' : 'text-fg-subtle hover:text-fg',
            )}
          >
            {m}
          </button>
        ))}
      </div>
    </div>
  );
}
