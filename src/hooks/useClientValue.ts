'use client';

import { useSyncExternalStore } from 'react';

const noopSubscribe = () => () => {};

/**
 * Returns `serverValue` during prerender/hydration and `getClientValue()` after,
 * without a hydration mismatch. `getClientValue` must return a stable value
 * (primitive or cached object) between calls.
 */
export function useClientValue<T>(getClientValue: () => T, serverValue: T): T {
  return useSyncExternalStore(noopSubscribe, getClientValue, () => serverValue);
}

let minuteNow = 0;
const clockListeners = new Set<() => void>();
let clockTimer: ReturnType<typeof setInterval> | undefined;

function tick() {
  minuteNow = Math.floor(Date.now() / 30_000) * 30_000;
  clockListeners.forEach((l) => l());
}

/** Shared clock (30s resolution) for relative timestamps; `null` before hydration. */
export function useNow(): number | null {
  return useSyncExternalStore(
    (listener) => {
      clockListeners.add(listener);
      if (!clockTimer) clockTimer = setInterval(tick, 30_000);
      return () => {
        clockListeners.delete(listener);
        if (clockListeners.size === 0) {
          clearInterval(clockTimer);
          clockTimer = undefined;
        }
      };
    },
    () => {
      if (!minuteNow) minuteNow = Math.floor(Date.now() / 30_000) * 30_000;
      return minuteNow;
    },
    () => null,
  );
}
