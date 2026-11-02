'use client';

import { AnimatePresence, motion } from 'motion/react';
import { AlertTriangle, CheckCircle2, Info, Sparkles, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { cn } from '@/utils/cn';
import { useToasts, type Toast } from './toast-store';

const ICONS = {
  default: Sparkles,
  success: CheckCircle2,
  error: AlertTriangle,
  info: Info,
};

const ICON_TONES = {
  default: 'text-accent-text',
  success: 'text-success',
  error: 'text-danger',
  info: 'text-info',
};

function ToastCard({ toast, fromTop }: { toast: Toast; fromTop: boolean }) {
  const dismiss = useToasts((s) => s.dismiss);
  const [paused, setPaused] = useState(false);
  const remaining = useRef(toast.duration);
  const startedAt = useRef(0);

  useEffect(() => {
    if (toast.duration === 0 || paused) return;
    startedAt.current = Date.now();
    const timer = window.setTimeout(() => dismiss(toast.id), remaining.current);
    return () => {
      window.clearTimeout(timer);
      remaining.current -= Date.now() - startedAt.current;
    };
  }, [paused, toast.duration, toast.id, dismiss]);

  const Icon = ICONS[toast.tone];
  return (
    <motion.li
      layout
      initial={{ opacity: 0, y: fromTop ? -12 : 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, transition: { duration: 0.14 } }}
      transition={{ duration: 0.22, ease: [0.2, 0, 0, 1] }}
      onPointerEnter={() => setPaused(true)}
      onPointerLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
      className="pointer-events-auto flex w-full items-start gap-3 rounded-lg border border-line-strong bg-bg-elevated p-3 pr-2 shadow-[var(--shadow-float)] sm:w-[360px]"
    >
      <Icon className={cn('mt-0.5 size-[18px] shrink-0', ICON_TONES[toast.tone])} aria-hidden />
      {/* The list is a polite live region; errors interrupt. */}
      <div className="min-w-0 flex-1" role={toast.tone === 'error' ? 'alert' : undefined}>
        <p className="text-sm leading-snug font-semibold">{toast.title}</p>
        {toast.description && <p className="mt-0.5 text-[13px] leading-snug text-fg-muted">{toast.description}</p>}
      </div>
      {toast.action && (
        <button
          type="button"
          onClick={() => {
            toast.action!.onClick();
            dismiss(toast.id);
          }}
          className="shrink-0 rounded-md bg-surface-active px-3 py-1.5 text-[13px] font-semibold text-fg transition-colors hover:bg-accent hover:text-accent-fg"
        >
          {toast.action.label}
        </button>
      )}
      <button
        type="button"
        aria-label="Dismiss notification"
        onClick={() => dismiss(toast.id)}
        className="shrink-0 rounded-md p-1 text-fg-subtle transition-colors hover:bg-surface-hover hover:text-fg"
      >
        <X className="size-4" />
      </button>
    </motion.li>
  );
}

/**
 * Phones and tablets keep their controls at the bottom (tab bar, toolbar, sheets and their
 * buttons), so notes drop in from the top there, just under the top bar, never over a button;
 * while a sheet is open they sit at the very top, above it (see `[data-toaster]` in globals.css).
 * Desktops use the bottom-right corner.
 */
export function Toaster() {
  const toasts = useToasts((s) => s.toasts);
  const fromTop = !useMediaQuery('(min-width: 1024px)', true);
  return (
    <ol
      aria-live="polite"
      aria-label="Notifications"
      data-toaster
      className="pointer-events-none fixed inset-x-3 top-[calc(64px+max(env(safe-area-inset-top),var(--safe-area-inset-top,0px)))] z-[90] flex flex-col items-center gap-2 lg:inset-x-auto lg:top-auto lg:right-6 lg:bottom-6 lg:items-end"
    >
      <AnimatePresence initial={false}>
        {toasts.map((t) => (
          <ToastCard key={t.id} toast={t} fromTop={fromTop} />
        ))}
      </AnimatePresence>
    </ol>
  );
}
