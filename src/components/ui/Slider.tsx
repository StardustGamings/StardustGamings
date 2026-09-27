'use client';

import { Slider as S } from 'radix-ui';
import { cn } from '@/utils/cn';

interface SliderProps {
  value: number;
  onChange: (value: number) => void;
  min: number;
  max: number;
  step?: number;
  'aria-label': string;
  valueText?: string;
  className?: string;
  /** Fill from this value instead of from `min` (for -100…100 style controls). */
  origin?: number;
}

export function Slider({ value, onChange, min, max, step = 1, valueText, className, origin, ...aria }: SliderProps) {
  const pct = (v: number) => ((Math.min(max, Math.max(min, v)) - min) / (max - min)) * 100;
  return (
    <S.Root
      value={[value]}
      onValueChange={([v]) => v !== undefined && onChange(v)}
      min={min}
      max={max}
      step={step}
      className={cn('relative flex h-6 w-full touch-none items-center select-none', className)}
    >
      <S.Track className="relative h-1 grow overflow-hidden rounded-full bg-surface-active">
        {origin === undefined ? (
          <S.Range className="absolute h-full rounded-full bg-accent" />
        ) : (
          <span
            aria-hidden
            className="absolute h-full rounded-full bg-accent"
            style={{ left: `${Math.min(pct(origin), pct(value))}%`, width: `${Math.abs(pct(value) - pct(origin))}%` }}
          />
        )}
      </S.Track>
      <S.Thumb
        {...aria}
        aria-valuetext={valueText}
        className="block size-4 rounded-full border-2 border-accent bg-bg-elevated shadow-[var(--shadow-soft)] transition-[transform,box-shadow] duration-150 hover:scale-110 focus-visible:scale-110"
      />
    </S.Root>
  );
}
