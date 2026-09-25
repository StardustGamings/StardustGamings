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
}

export function Slider({ value, onChange, min, max, step = 1, valueText, className, ...aria }: SliderProps) {
  return (
    <S.Root
      value={[value]}
      onValueChange={([v]) => v !== undefined && onChange(v)}
      min={min}
      max={max}
      step={step}
      className={cn('relative flex h-6 w-full touch-none items-center select-none', className)}
    >
      <S.Track className="relative h-1.5 grow overflow-hidden rounded-full bg-surface-active">
        <S.Range className="absolute h-full rounded-full bg-accent" />
      </S.Track>
      <S.Thumb
        {...aria}
        aria-valuetext={valueText}
        className="block size-5 rounded-full border-2 border-accent bg-bg-elevated shadow-[var(--shadow-soft)] transition-transform hover:scale-110 focus-visible:scale-110"
      />
    </S.Root>
  );
}
