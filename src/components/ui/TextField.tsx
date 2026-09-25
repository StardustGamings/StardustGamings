'use client';

import { useId, type InputHTMLAttributes, type ReactNode, type Ref } from 'react';
import { cn } from '@/utils/cn';

interface TextFieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'size'> {
  label?: ReactNode;
  hint?: ReactNode;
  error?: ReactNode;
  leading?: ReactNode;
  trailing?: ReactNode;
  ref?: Ref<HTMLInputElement>;
  inputClassName?: string;
}

export function TextField({
  label,
  hint,
  error,
  leading,
  trailing,
  className,
  inputClassName,
  id,
  ref,
  ...rest
}: TextFieldProps) {
  const autoId = useId();
  const inputId = id ?? autoId;
  const hintId = hint || error ? `${inputId}-hint` : undefined;
  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      {label && (
        <label htmlFor={inputId} className="text-[13px] font-semibold text-fg">
          {label}
        </label>
      )}
      <div
        className={cn(
          'flex h-11 items-center gap-2 rounded-[13px] border bg-bg-sunken/70 px-3 transition-colors focus-within:border-ring',
          error ? 'border-danger' : 'border-line hover:border-line-strong',
        )}
      >
        {leading && <span className="text-fg-subtle [&_svg]:size-4">{leading}</span>}
        <input
          ref={ref}
          id={inputId}
          aria-invalid={error ? true : undefined}
          aria-describedby={hintId}
          className={cn(
            'h-full min-w-0 flex-1 bg-transparent text-sm text-fg outline-none placeholder:text-fg-subtle',
            inputClassName,
          )}
          {...rest}
        />
        {trailing}
      </div>
      {(hint || error) && (
        <p id={hintId} className={cn('text-xs', error ? 'text-danger' : 'text-fg-subtle')}>
          {error ?? hint}
        </p>
      )}
    </div>
  );
}
