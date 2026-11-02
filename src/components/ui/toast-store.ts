'use client';

import { create } from 'zustand';
import { createId } from '@/utils/id';

export type ToastTone = 'default' | 'success' | 'error' | 'info';

export interface ToastInput {
  title: string;
  description?: string;
  tone?: ToastTone;
  action?: { label: string; onClick: () => void };
  /** ms; 0 keeps it until dismissed. */
  duration?: number;
}

export interface Toast extends Required<Pick<ToastInput, 'title' | 'tone' | 'duration'>> {
  id: string;
  description?: string;
  action?: ToastInput['action'];
}

interface ToastState {
  toasts: Toast[];
  push: (input: ToastInput) => string;
  dismiss: (id: string) => void;
}

const MAX_VISIBLE = 4;

export const useToasts = create<ToastState>()((set) => ({
  toasts: [],
  push: (input) => {
    const id = createId('t');
    const toast: Toast = {
      id,
      title: input.title,
      description: input.description,
      tone: input.tone ?? 'default',
      action: input.action,
      duration: input.duration ?? (input.action ? 6000 : 3500),
    };
    set((s) => ({ toasts: [...s.toasts, toast].slice(-MAX_VISIBLE) }));
    return id;
  },
  dismiss: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}));

/** Imperative helper usable outside React components. */
export const toast = (input: ToastInput): string => useToasts.getState().push(input);
