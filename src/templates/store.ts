'use client';

import { useEffect, useMemo } from 'react';
import { create } from 'zustand';
import { useShallow } from 'zustand/react/shallow';
import { loadBundledTemplates, type Template } from './registry';
import { deleteUserTemplate, listUserTemplates, putUserTemplate } from './repository';
import { cleanTags, newUserTemplateId, type UserTemplate } from './user';
import type { TemplateStyle } from './schema';

type Status = 'idle' | 'loading' | 'ready' | 'error';

export interface TemplatePatch {
  name?: string;
  description?: string;
  style?: TemplateStyle;
  tags?: string[];
}

interface TemplateLibraryState {
  bundled: Template[];
  user: Template[];
  status: Status;
  userStatus: Status;
  /** Loads the bundled library and the user's templates (once; retries after errors). */
  load: () => Promise<void>;
  saveUser: (template: UserTemplate) => Promise<Template>;
  updateUser: (id: string, patch: TemplatePatch) => Promise<void>;
  duplicateUser: (id: string) => Promise<Template | null>;
  /** Removes a user template; returns it so the caller can offer undo. */
  removeUser: (id: string) => Promise<Template | null>;
  /** Forget in-memory user templates (after "erase everything"). */
  resetUser: () => void;
}

const asTemplate = (t: UserTemplate): Template => ({ ...t, source: 'user' });
const toRecord = ({ source: _source, ...rest }: Template): UserTemplate => rest as UserTemplate;
const newestFirst = (list: Template[]) => [...list].sort((a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0));

let bundledJob: Promise<void> | null = null;
let userJob: Promise<void> | null = null;

function ensureBundled(): Promise<void> {
  const { status } = useTemplateLibrary.getState();
  if (status === 'ready') return Promise.resolve();
  bundledJob ??= (async () => {
    useTemplateLibrary.setState({ status: 'loading' });
    try {
      useTemplateLibrary.setState({ bundled: await loadBundledTemplates(), status: 'ready' });
    } catch {
      useTemplateLibrary.setState({ status: 'error' });
    } finally {
      bundledJob = null;
    }
  })();
  return bundledJob;
}

function ensureUser(): Promise<void> {
  const { userStatus } = useTemplateLibrary.getState();
  if (userStatus === 'ready') return Promise.resolve();
  userJob ??= (async () => {
    useTemplateLibrary.setState({ userStatus: 'loading' });
    try {
      const list = await listUserTemplates();
      useTemplateLibrary.setState({ user: list.map(asTemplate), userStatus: 'ready' });
    } catch {
      useTemplateLibrary.setState({ userStatus: 'error' });
    } finally {
      userJob = null;
    }
  })();
  return userJob;
}

export const useTemplateLibrary = create<TemplateLibraryState>()((set, get) => ({
  bundled: [],
  user: [],
  status: 'idle',
  userStatus: 'idle',

  load: () => Promise.all([ensureBundled(), ensureUser()]).then(() => undefined),

  saveUser: async (record) => {
    await putUserTemplate(record);
    const template = asTemplate(record);
    set((s) => ({ user: newestFirst([template, ...s.user.filter((t) => t.id !== record.id)]) }));
    return template;
  },

  updateUser: async (id, patch) => {
    const current = get().user.find((t) => t.id === id);
    if (!current) return;
    const next: Template = {
      ...current,
      ...(patch.name !== undefined ? { name: patch.name.trim().slice(0, 60) || current.name } : {}),
      ...(patch.description !== undefined ? { description: patch.description.trim().slice(0, 240) } : {}),
      ...(patch.style ? { style: patch.style } : {}),
      ...(patch.tags ? { tags: cleanTags(patch.tags) } : {}),
      updatedAt: Date.now(),
    };
    await putUserTemplate(toRecord(next));
    set((s) => ({ user: newestFirst(s.user.map((t) => (t.id === id ? next : t))) }));
  },

  duplicateUser: async (id) => {
    const current = get().user.find((t) => t.id === id);
    if (!current) return null;
    const now = Date.now();
    const copy = toRecord({
      ...structuredClone(current),
      id: newUserTemplateId(),
      name: `${current.name} copy`.slice(0, 60),
      createdAt: now,
      updatedAt: now,
    });
    return get().saveUser(copy);
  },

  removeUser: async (id) => {
    const current = get().user.find((t) => t.id === id) ?? null;
    if (!current) return null;
    await deleteUserTemplate(id);
    set((s) => ({ user: s.user.filter((t) => t.id !== id) }));
    return current;
  },

  resetUser: () => set({ user: [], userStatus: 'idle' }),
}));

/** Every template (yours first), loading the library on first use. */
export function useTemplates() {
  const state = useTemplateLibrary(
    useShallow((s) => ({ bundled: s.bundled, user: s.user, status: s.status, userStatus: s.userStatus })),
  );
  useEffect(() => {
    void useTemplateLibrary.getState().load();
  }, []);
  return { ...state, ready: state.status === 'ready' };
}

/** Id → template lookup over the bundled library and the user's templates (loads on first use). */
export function useTemplateLookup() {
  const { bundled, user, ready } = useTemplates();
  const map = useMemo(() => new Map([...bundled, ...user].map((t) => [t.id, t])), [bundled, user]);
  return { get: (id: string) => map.get(id), ready };
}

/** Finds a template by id (user templates first), loading the library if needed. */
export async function findTemplate(id: string): Promise<Template | undefined> {
  const store = useTemplateLibrary.getState();
  await store.load();
  const { user, bundled } = useTemplateLibrary.getState();
  return user.find((t) => t.id === id) ?? bundled.find((t) => t.id === id);
}

/** Recreates a removed user template (undo). */
export async function restoreUserTemplate(template: Template): Promise<void> {
  await useTemplateLibrary.getState().saveUser(toRecord(template));
}
