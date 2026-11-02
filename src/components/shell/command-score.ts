/**
 * Ranking for the command palette. Prefers, in order: label prefix, every query
 * word appearing in the label, words found in keywords, and finally an in-order
 * character match within the label. Unrelated fuzzy matches score 0.
 */
export function scoreCommand(label: string, search: string, keywords: string[] = []): number {
  const q = search.trim().toLowerCase();
  if (!q) return 1;
  const l = label.toLowerCase();
  const words = q.split(/\s+/).filter(Boolean);
  const haystack = `${l} ${keywords.join(' ').toLowerCase()}`;

  if (l.startsWith(q)) return 1;
  if (l.includes(q)) return 0.95;
  const inLabel = words.filter((w) => l.includes(w)).length;
  if (inLabel === words.length) return 0.9;
  const inAny = words.filter((w) => haystack.includes(w)).length;
  if (inAny === words.length) return 0.5 + 0.3 * (inLabel / words.length);

  // Compact query typed without spaces ("newcar") as an in-order subsequence.
  const compact = q.replace(/\s+/g, '');
  let i = 0;
  for (const ch of l) if (ch === compact[i]) i++;
  return i === compact.length && compact.length >= 3 ? 0.2 : 0;
}
