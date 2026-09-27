'use client';

import { Switch as S } from 'radix-ui';
import { cn } from '@/utils/cn';

interface SwitchProps {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  id?: string;
  disabled?: boolean;
  'aria-label'?: string;
  'aria-describedby'?: string;
}

export function Switch({ checked, onCheckedChange, id, disabled, ...aria }: SwitchProps) {
  return (
    <S.Root
      id={id}
      checked={checked}
      onCheckedChange={onCheckedChange}
      disabled={disabled}
      {...aria}
      className={cn(
        'relative inline-flex h-[22px] w-[38px] shrink-0 items-center rounded-full border border-line transition-colors duration-150',
        'data-[state=checked]:border-transparent data-[state=checked]:bg-accent data-[state=unchecked]:bg-surface-active',
        'disabled:opacity-40',
      )}
    >
      <S.Thumb
        className={cn(
          'block size-4 rounded-full shadow-[0_1px_2px_rgb(0_0_0/0.3)] transition-transform duration-150 ease-[var(--ease-standard)]',
          'translate-x-[2px] bg-fg data-[state=checked]:translate-x-[18px] data-[state=checked]:bg-accent-fg',
        )}
      />
    </S.Root>
  );
}
