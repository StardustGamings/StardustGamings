/**
 * How much memory this device has, as a tier for cache budgets. `navigator.deviceMemory`
 * (GB, rounded down; Chromium only) — elsewhere we assume a typical 4 GB phone.
 */
export type MemoryTier = 'low' | 'normal' | 'high';

export function memoryTier(): MemoryTier {
  const gb = (typeof navigator !== 'undefined' && (navigator as Navigator & { deviceMemory?: number }).deviceMemory) || 4;
  return gb <= 2 ? 'low' : gb >= 8 ? 'high' : 'normal';
}

/** A budget in bytes for this device, from megabytes per tier. */
export const budgetBytes = (mb: Record<MemoryTier, number>): number => mb[memoryTier()] * 1024 * 1024;
