'use client';

import { AnimatePresence, motion } from 'motion/react';
import { AlertTriangle, CheckCircle2, Info, Sparkles, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
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

function ToastCard({ toast }: { toast: Toast }) {
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
      initial={{ opacity: 0, y: 24, scale: 0.94 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, scale: 0.94, transition: { duration: 0.16 } }}
      transition={{ type: 'spring', stiffness: 460, damping: 32 }}
      onPointerEnter={() => setPaused(true)}
      onPointerLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
      className="pointer-events-auto flex w-full items-start gap-3 rounded-[18px] p-3.5 pr-2.5 shadow-[var(--shadow-float)] glass-strong sm:w-[380px]"
      role={toast.tone === 'error' ? 'alert' : 'status'}
    >
      <Icon className={cn('mt-0.5 size-[18px] shrink-0', ICON_TONES[toast.tone])} aria-hidden />
      <div className="min-w-0 flex-1">
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
          className="shrink-0 rounded-[10px] bg-surface-active px-3 py-1.5 text-[13px] font-semibold text-fg transition-colors hover:bg-accent hover:text-accent-fg"
        >
          {toast.action.label}
        </button>
      )}
      <button
        type="button"
        aria-label="Dismiss notification"
        onClick={() => dismiss(toast.id)}
        className="shrink-0 rounded-[8px] p-1 text-fg-subtle transition-colors hover:bg-surface-hover hover:text-fg"
      >
        <X className="size-4" />
      </button>
    </motion.li>
  );
}

export function Toaster() {
  const toasts = useToasts((s) => s.toasts);
  return (
    <ol
      aria-live="polite"
      aria-label="Notifications"
      className="pointer-events-none fixed inset-x-3 bottom-[calc(88px+env(safe-area-inset-bottom))] z-[90] flex flex-col items-center gap-2 lg:inset-x-auto lg:right-6 lg:bottom-6 lg:items-end"
    >
      <AnimatePresence initial={false}>
        {toasts.map((t) => (
          <ToastCard key={t.id} toast={t} />
        ))}
      </AnimatePresence>
    </ol>
  );
}
