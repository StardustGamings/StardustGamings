'use client';

import { useId, useState } from 'react';
import type { Fill } from '@/types/document';
import { fillPrimaryColor, fillToCss } from '@/canvas/render';
import { normalizeHex } from '@/utils/color';
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
}

/** Solid swatches, gradient presets and a validated custom HEX field. */
export function FillPicker({ value, onChange, label }: FillPickerProps) {
  const hexId = useId();
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
                'aspect-square rounded-[10px] border border-line-strong transition-transform hover:scale-110',
                active && 'ring-2 ring-ring ring-offset-2 ring-offset-bg-elevated',
              )}
              style={{ background: c }}
            />
          );
        })}
      </div>
      <div className="grid grid-cols-4 gap-2">
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
                'h-10 rounded-[10px] border border-line-strong transition-transform hover:scale-105',
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
          className="relative size-10 shrink-0 cursor-pointer overflow-hidden rounded-[12px] border border-line-strong"
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
            'h-10 min-w-0 flex-1 rounded-[12px] border bg-bg-sunken/70 px-3 font-mono text-sm uppercase outline-none focus:border-ring',
            valid ? 'border-line' : 'border-danger',
          )}
        />
      </div>
    </div>
  );
}
