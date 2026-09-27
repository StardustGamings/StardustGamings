'use client';

import type { ReactNode } from 'react';
import { create } from 'zustand';

export interface Command {
  id: string;
  label: string;
  group: string;
  icon?: ReactNode;
  shortcut?: string;
  keywords?: string[];
  hint?: string;
  run: () => void;
}

interface CommandRegistry {
  scoped: Record<string, Command[]>;
  register: (scope: string, commands: Command[]) => void;
  unregister: (scope: string) => void;
}

/** Pages (e.g. the editor) register contextual commands that the palette shows on top. */
export const useCommandRegistry = create<CommandRegistry>()((set) => ({
  scoped: {},
  register: (scope, commands) => set((s) => ({ scoped: { ...s.scoped, [scope]: commands } })),
  unregister: (scope) =>
    set((s) => {
      const { [scope]: _removed, ...rest } = s.scoped;
      return { scoped: rest };
    }),
}));
