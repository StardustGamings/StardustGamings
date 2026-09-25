'use client';

import { useCallback, useRef } from 'react';
import { useMotionValue, useSpring, type MotionValue } from 'motion/react';
import { useMediaQuery } from './useMediaQuery';
import { useFullMotion } from './usePreferences';

interface Magnetic<T extends HTMLElement> {
  ref: React.RefObject<T | null>;
  x: MotionValue<number>;
  y: MotionValue<number>;
  onPointerMove: (e: React.PointerEvent<T>) => void;
  onPointerLeave: () => void;
}

/**
 * Makes an element drift toward the pointer. Disabled for touch input and when
 * motion is reduced, so it never gets in the way.
 */
export function useMagnetic<T extends HTMLElement>(strength = 0.25): Magnetic<T> {
  const ref = useRef<T>(null);
  const finePointer = useMediaQuery('(hover: hover) and (pointer: fine)');
  const enabled = useFullMotion() && finePointer;
  const rawX = useMotionValue(0);
  const rawY = useMotionValue(0);
  const x = useSpring(rawX, { stiffness: 260, damping: 18, mass: 0.4 });
  const y = useSpring(rawY, { stiffness: 260, damping: 18, mass: 0.4 });

  const onPointerMove = useCallback(
    (e: React.PointerEvent<T>) => {
      if (!enabled || !ref.current) return;
      const rect = ref.current.getBoundingClientRect();
      rawX.set((e.clientX - (rect.left + rect.width / 2)) * strength);
      rawY.set((e.clientY - (rect.top + rect.height / 2)) * strength);
    },
    [enabled, rawX, rawY, strength],
  );

  const onPointerLeave = useCallback(() => {
    rawX.set(0);
    rawY.set(0);
  }, [rawX, rawY]);

  return { ref, x, y, onPointerMove, onPointerLeave };
}
