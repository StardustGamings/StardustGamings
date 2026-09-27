'use client';

import { create } from 'zustand';

/**
 * Lets any part of the editor (a double-tap on an empty frame, a panel button,
 * a palette command) open the device's photo picker. The hidden <input> lives
 * in <PhotoPicker/>; opening must happen inside the user's tap/click.
 */
export interface PickerRequest {
  /** Image frame to fill with the first chosen photo. */
  targetId?: string | null;
  kind?: 'photo' | 'sticker';
  /** Pick a single photo (replace) instead of several. */
  single?: boolean;
}

interface PickerState {
  open: ((request: PickerRequest) => void) | null;
  register: (open: ((request: PickerRequest) => void) | null) => void;
}

export const usePicker = create<PickerState>()((set) => ({
  open: null,
  register: (open) => set({ open }),
}));

export function openPhotoPicker(request: PickerRequest = {}) {
  usePicker.getState().open?.(request);
}
