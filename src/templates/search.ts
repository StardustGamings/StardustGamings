import type { FormatId } from '@/types/project';
import { FORMATS } from '@/projects/formats';
import { STYLE_LABELS, type TemplateStyle } from './schema';

interface Searchable {
  name: string;
  description: string;
  tags: string[];
  style: TemplateStyle;
  format: FormatId;
}

export interface TemplateFilter {
  query?: string;
  format?: FormatId | 'all';
  style?: TemplateStyle | 'all';
}

const normalize = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '');

/** Every word of the query must appear in the name, description, tags, style or format. */
export function filterTemplates<T extends Searchable>(list: T[], filter: TemplateFilter): T[] {
  const words = normalize(filter.query ?? '')
    .split(/\s+/)
    .filter(Boolean);
  return list.filter((t) => {
    if (filter.format && filter.format !== 'all' && t.format !== filter.format) return false;
    if (filter.style && filter.style !== 'all' && t.style !== filter.style) return false;
    if (!words.length) return true;
    const haystack = normalize([t.name, t.description, ...t.tags, STYLE_LABELS[t.style], FORMATS[t.format].label].join(' '));
    return words.every((w) => haystack.includes(w));
  });
}
