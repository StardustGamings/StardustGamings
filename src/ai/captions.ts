import { seededRandom } from '@/utils/math';
import type { CaptionRequest, CaptionResult, CaptionTone } from './schemas';

/**
 * Captions on the device: the design's own words (the headline first) woven
 * into lines in the chosen tone, with a call to action that fits the format
 * and hashtags from its keywords. Deterministic for a seed — "More ideas"
 * just moves the seed. Not a language model; the optional AI server writes
 * freer copy when it's set up.
 */

const STOPWORDS = new Set(
  (
    'a an the and or but if of to in on at by for with from as is are was were be been being it its this that these those i me my we our you your ' +
    'he she they them their his her not no yes so do does did done have has had will would can could should just very really more most ' +
    'into out up down over under about than then there here what when where who why how all any each every some one two three ' +
    'new slide slides swipe post link bio ' +
    'make made makes get got gets take took want wants wanted wish need needs needed know think see saw say said go goes went come came ' +
    'give gave keep kept let put tell told try use used feel felt look find found exist existed exists thing things ' +
    'before after yourself itself myself something anything everything nothing also only still even much many ' +
    'like way own same other another ever never always'
  ).split(' '),
);

/** Up to `max` keywords: frequent first, then earliest. */
export function keywords(texts: string[], max = 6): string[] {
  const counts = new Map<string, { n: number; first: number }>();
  let pos = 0;
  for (const text of texts) {
    // @handles and links are placeholders or addresses, not what the post is about.
    const plain = text.replace(/@\S+|https?:\/\/\S+|www\.\S+/giu, ' ');
    for (const raw of plain.toLowerCase().split(/[^\p{L}\p{N}']+/u)) {
      const word = raw.replace(/^'+|'+$/g, '').replace(/'s$/, '');
      pos++;
      if (word.length < 3 || STOPWORDS.has(word) || /^\d+$/.test(word)) continue;
      const c = counts.get(word);
      if (c) c.n++;
      else counts.set(word, { n: 1, first: pos });
    }
  }
  return [...counts.entries()]
    .sort((a, b) => b[1].n - a[1].n || a[1].first - b[1].first)
    .slice(0, max)
    .map(([w]) => w);
}

const tidy = (s: string) => s.replace(/\s+/g, ' ').trim();
const capitalise = (s: string) => (s ? s[0]!.toUpperCase() + s.slice(1) : s);
const hashtag = (word: string) => `#${word.replace(/[^\p{L}\p{N}_]/gu, '').slice(0, 40)}`;

const EMOJI: Record<CaptionTone, string[]> = {
  casual: ['✨', '🫶', '📸', '🤍', '☀️'],
  hype: ['🔥', '⚡️', '🚀', '💥', '👀'],
  minimal: [''],
  witty: ['💀', '😌', '🙃', '👀', '😭'],
  aesthetic: ['☁️', '🕊️', '🌙', '✧', '🍂'],
  professional: [''],
};

const TAGS: Record<CaptionTone, string[]> = {
  casual: ['#photodump', '#weekendvibes'],
  hype: ['#newdrop', '#dontmissit', '#trending'],
  minimal: [],
  witty: ['#relatable', '#mood'],
  aesthetic: ['#aesthetic', '#softlife'],
  professional: ['#tips', '#learnontiktok'],
};

const TAG_COUNT: Record<CaptionTone, number> = { casual: 5, hype: 8, minimal: 2, witty: 4, aesthetic: 6, professional: 5 };

type Line = (v: { topic: string; kw: string; kw2: string; cta: string; e: string; n: number }) => string;

const LINES: Record<CaptionTone, Line[]> = {
  casual: [
    (v) => `${capitalise(v.topic)} — that's the post ${v.e}`,
    (v) => `a little ${v.kw} moment ${v.e} ${v.cta}`,
    (v) => `Not me posting ${v.topic} again ${v.e}`,
    (v) => `${capitalise(v.kw)}, ${v.kw2} and good company ${v.e}`,
    (v) => `Saving this ${v.kw} feeling for later ${v.e} ${v.cta}`,
  ],
  hype: [
    (v) => `${v.topic.toUpperCase()} ${v.e}${v.e} ${v.cta}`,
    (v) => `Stop scrolling — ${v.topic} ${v.e}`,
    (v) => `This is your sign: ${v.topic} ${v.e} ${v.cta}`,
    (v) => `${capitalise(v.kw)} season is officially here ${v.e}`,
    (v) => `We said what we said: ${v.topic} ${v.e}`,
  ],
  minimal: [
    (v) => `${capitalise(v.topic)}.`,
    (v) => `${v.kw}, ${v.kw2}.`,
    (v) => `— ${v.topic}`,
    (v) => `${capitalise(v.kw)}. ${v.cta}`,
  ],
  witty: [
    (v) => `${capitalise(v.topic)}? In this economy? ${v.e}`,
    (v) => `Plot twist: ${v.topic} ${v.e}`,
    (v) => `Me pretending I didn't take ${v.n > 1 ? `${v.n} slides` : 'forty photos'} for this ${v.e}`,
    (v) => `Normal amount of ${v.kw} content ${v.e} ${v.cta}`,
    (v) => `Rating ${v.topic}: 11/10, no notes ${v.e}`,
  ],
  aesthetic: [
    (v) => `${v.topic} ${v.e}`,
    (v) => `collecting ${v.kw} moments ${v.e}`,
    (v) => `soft days & ${v.kw} ${v.e}`,
    (v) => `${v.kw} / ${v.kw2} / slow ${v.e}`,
  ],
  professional: [
    (v) => `${capitalise(v.topic)}: ${v.n > 1 ? `${v.n - 1} takeaways` : 'one takeaway'} worth saving. ${v.cta}`,
    (v) => `New post: ${v.topic}. ${v.cta}`,
    (v) => `${capitalise(v.topic)} — here's what we learned.`,
    (v) => `Quick guide to ${v.kw}${v.kw2 !== v.kw ? ` and ${v.kw2}` : ''}. ${v.cta}`,
  ],
};

function callToAction(format: string, slides: number, tone: CaptionTone): string {
  if (tone === 'minimal') return slides > 1 ? '→' : '';
  if (slides > 1) return tone === 'professional' ? 'Save it for later.' : 'Swipe →';
  switch (format) {
    case 'story':
      return 'Reply with your take';
    case 'thumbnail':
    case 'reel-cover':
      return 'Out now — link in bio';
    case 'poster':
      return 'See you there';
    default:
      return tone === 'professional' ? 'Save it for later.' : 'Double tap if you agree';
  }
}

/** A headline short enough to quote: the whole thing, or its first clause if that reads on its own. */
function topicOf(headline: string): string {
  const strip = (s: string) => s.replace(/^[\s"“”'‘’«»]+|[\s"“”'‘’«».!?…,:;—–-]+$/gu, '');
  const whole = strip(headline);
  if (whole.length <= 70) return whole;
  const clause = strip(headline.split(/[.!?:;—–]/u)[0] ?? '');
  return clause.length >= 8 && clause.length <= 70 ? clause : '';
}

export function localCaptions(request: CaptionRequest, seed = 1, count = 4): CaptionResult {
  const texts = request.texts.map(tidy).filter(Boolean);
  const words = keywords(texts);
  const headline = topicOf(texts[0] ?? '');
  const fallbackTopic = request.format === 'carousel' ? 'a new carousel' : `today's ${request.format.replace('-', ' ')}`;
  const topic = headline || words.slice(0, 2).join(' & ') || fallbackTopic;
  const kw = words[0] ?? request.mood?.split(' · ')[0] ?? 'good';
  const kw2 = words[1] ?? kw;
  const rnd = seededRandom(seed * 7919 + request.tone.length);
  const pick = <T>(list: T[]) => list[Math.floor(rnd() * list.length)]!;
  const cta = callToAction(request.format, request.slides, request.tone);

  const lines = [...LINES[request.tone]];
  // Seeded shuffle, so each seed gives a different set.
  for (let i = lines.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [lines[i], lines[j]] = [lines[j]!, lines[i]!];
  }

  const tagPool = [
    ...words.filter((w) => w.length >= 4).map(hashtag),
    ...(request.slides > 1 ? ['#carousel'] : []),
    ...TAGS[request.tone],
    ...(request.mood?.includes('warm') ? ['#goldenhour'] : request.mood?.includes('dark') ? ['#afterdark'] : []),
  ].filter((t, i, all) => t.length > 2 && all.indexOf(t) === i);

  const captions = lines.slice(0, count).map((line, i) => {
    const text = tidy(line({ topic, kw, kw2, cta, e: pick(EMOJI[request.tone]), n: request.slides }));
    // Rotate the pool a little per caption so they don't all carry identical tags.
    const tags = [...tagPool.slice(i % Math.max(1, words.length)), ...tagPool.slice(0, i % Math.max(1, words.length))];
    return { text: text.slice(0, 2200), hashtags: tags.slice(0, TAG_COUNT[request.tone]) };
  });
  return { captions };
}

/** Caption and hashtags as one block, ready to paste. */
export const captionToText = (c: { text: string; hashtags: string[] }) =>
  c.hashtags.length ? `${c.text}\n\n${c.hashtags.join(' ')}` : c.text;
