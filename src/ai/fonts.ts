import { BUNDLED_FONTS, findBundledFont, supportedWeight, type BundledFont } from '@/typography/fonts';
import type { FontPairing, FontRequest } from './schemas';

/**
 * Font pairing on the device: every bundled heading × body combination scored
 * with the rules designers use — contrast between the two (a display or serif
 * headline over a quiet sans), a body face that's comfortable to read, shared
 * personality, and never two loud faces together.
 */

const readableBody = (f: BundledFont) => f.category === 'sans' || f.category === 'serif' || f.category === 'mono';
const maxWeight = (f: BundledFont) => f.weights[f.weights.length - 1]!;
const minWeight = (f: BundledFont) => f.weights[0]!;

const CATEGORY_WORDS: Record<BundledFont['category'], string> = {
  sans: 'clean sans',
  serif: 'serif',
  display: 'display',
  script: 'hand-lettered',
  mono: 'monospace',
};

interface Scored extends FontPairing {
  score: number;
}

/** The weight a heading looks best at: heavy for display and sans, regular for scripts and Didones. */
function headingWeight(f: BundledFont): number {
  if (f.category === 'script') return supportedWeight(f.family, 400);
  if (f.category === 'serif') return supportedWeight(f.family, f.variable ? 700 : 400);
  return supportedWeight(f.family, Math.min(900, maxWeight(f)));
}

function bodyWeight(f: BundledFont): number {
  return supportedWeight(f.family, f.category === 'serif' ? 400 : 500);
}

export function scorePairing(heading: BundledFont, body: BundledFont, vibe?: string): Scored | null {
  if (!readableBody(body)) return null;
  const same = heading.family === body.family;
  // One family works only when it has the weight range to make contrast.
  if (same && (!heading.variable || maxWeight(heading) - minWeight(heading) < 400)) return null;

  let score = 0;
  const reasons: string[] = [];
  if (same) {
    score += 2;
    reasons.push(`one family in two weights — ${heading.family} heavy over light, very consistent`);
  } else if (heading.category !== body.category) {
    score += heading.category === 'mono' ? 1 : 3;
    reasons.push(`contrast: a ${CATEGORY_WORDS[heading.category]} headline over a ${CATEGORY_WORDS[body.category]} body`);
  } else {
    score -= heading.category === 'sans' ? 1 : 3;
    reasons.push(`two ${CATEGORY_WORDS[heading.category]} faces with different personalities`);
  }
  if (body.category === 'sans') score += 1.5;
  if (body.category === 'mono' && !heading.vibes.some((v) => v === 'tech' || v === 'cyber' || v === 'y2k')) score -= 2;
  if (heading.category === 'sans' && body.category === 'serif') score -= 0.5;

  const shared = heading.vibes.filter((v) => body.vibes.includes(v));
  if (shared.length) {
    score += shared.length;
    reasons.push(`both lean ${shared.slice(0, 2).join(' and ')}`);
  }
  if (vibe) {
    const want = vibe.toLowerCase();
    if (heading.vibes.some((v) => want.includes(v) || v.includes(want))) {
      score += 3;
      reasons.push(`the headline font fits “${vibe}”`);
    }
    if (body.vibes.some((v) => want.includes(v) || v.includes(want))) score += 1;
  }
  const reason = reasons.join('; ');
  return {
    heading: heading.family,
    body: body.family,
    headingWeight: headingWeight(heading),
    bodyWeight: bodyWeight(body),
    reason: `${reason[0]!.toUpperCase()}${reason.slice(1)}.`.slice(0, 200),
    score,
  };
}

/**
 * Pairings for a design: with `current`, bodies for the headline font you
 * already use (plus a couple of alternatives); otherwise the best overall,
 * steered by `vibe`. Always varied — no heading repeats more than twice.
 */
export function suggestPairings(request: FontRequest, count = 6): FontPairing[] {
  const current = request.current ? findBundledFont(request.current) : undefined;
  const all: Scored[] = [];
  for (const h of BUNDLED_FONTS)
    for (const b of BUNDLED_FONTS) {
      const s = scorePairing(h, b, request.vibe);
      if (s) all.push(current && h.family === current.family ? { ...s, score: s.score + 4 } : s);
    }
  all.sort((a, b) => b.score - a.score || a.heading.localeCompare(b.heading) || a.body.localeCompare(b.body));
  const out: FontPairing[] = [];
  const perHeading = new Map<string, number>();
  const perBody = new Map<string, number>();
  for (const s of all) {
    if (out.length >= count) break;
    if ((perHeading.get(s.heading) ?? 0) >= (current && s.heading === current.family ? 3 : 1)) continue;
    if ((perBody.get(s.body) ?? 0) >= 2) continue;
    perHeading.set(s.heading, (perHeading.get(s.heading) ?? 0) + 1);
    perBody.set(s.body, (perBody.get(s.body) ?? 0) + 1);
    const { score: _score, ...pairing } = s;
    out.push(pairing);
  }
  return out;
}
