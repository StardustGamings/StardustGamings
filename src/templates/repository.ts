import { getStorage } from '@/storage/db';
import type { UserTemplate } from './user';

/** The user's saved templates, newest first. */
export async function listUserTemplates(): Promise<UserTemplate[]> {
  const all = await (await getStorage()).getAllTemplates();
  return all.sort((a, b) => b.updatedAt - a.updatedAt);
}

export async function putUserTemplate(template: UserTemplate): Promise<void> {
  // Only the stored shape goes to disk (callers may pass a decorated object).
  const { source: _source, ...record } = template as UserTemplate & { source?: string };
  await (await getStorage()).putTemplate(record);
}

export async function deleteUserTemplate(id: string): Promise<void> {
  await (await getStorage()).deleteTemplate(id);
}
