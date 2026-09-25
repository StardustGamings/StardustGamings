'use client';

import { useEffect, useEffectEvent } from 'react';

export interface HotkeyOptions {
  /** Fire even while typing in inputs/textareas. */
  allowInInputs?: boolean;
  enabled?: boolean;
  preventDefault?: boolean;
}

const isMac = () => typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);

/** Platform-appropriate label for the primary modifier. */
export const modKey = () => (isMac() ? '⌘' : 'Ctrl');

function isEditable(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName);
}

/**
 * Parses combos like `mod+k`, `mod+shift+z`, `delete`, `?`. `mod` is ⌘ on Apple
 * platforms and Ctrl elsewhere.
 */
export function matchesHotkey(event: KeyboardEvent, combo: string): boolean {
  const lower = combo.toLowerCase();
  // `mod++` means "mod and the + key", so a trailing plus is the key itself.
  const key = lower === '+' || lower.endsWith('++') ? '+' : lower.slice(lower.lastIndexOf('+') + 1);
  const parts = lower
    .slice(0, lower.length - key.length)
    .split('+')
    .filter(Boolean);
  const wantMod = parts.includes('mod');
  const wantShift = parts.includes('shift');
  const wantAlt = parts.includes('alt');
  const mod = isMac() ? event.metaKey : event.ctrlKey;
  if (wantMod !== mod) return false;
  // Symbols such as `?` need Shift to type, so an unspecified Shift is tolerated for them.
  const isSymbol = key.length === 1 && !/[a-z0-9]/.test(key);
  if (wantShift !== event.shiftKey && !(isSymbol && !wantShift)) return false;
  if (wantAlt !== event.altKey) return false;
  const pressed = event.key.toLowerCase();
  return pressed === key || (key === 'delete' && pressed === 'backspace') || (key === 'space' && pressed === ' ');
}

export function useHotkeys(bindings: Record<string, (e: KeyboardEvent) => void>, options: HotkeyOptions = {}): void {
  const { allowInInputs = false, enabled = true, preventDefault = true } = options;

  const onKey = useEffectEvent((event: KeyboardEvent) => {
    if (event.defaultPrevented) return;
    for (const [combo, handler] of Object.entries(bindings)) {
      if (!matchesHotkey(event, combo)) continue;
      if (!allowInInputs && isEditable(event.target)) continue;
      if (preventDefault) event.preventDefault();
      handler(event);
      return;
    }
  });

  useEffect(() => {
    if (!enabled) return;
    const listener = (event: KeyboardEvent) => onKey(event);
    window.addEventListener('keydown', listener);
    return () => window.removeEventListener('keydown', listener);
  }, [enabled]);
}
