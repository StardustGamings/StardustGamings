import { describe, expect, it, vi } from 'vitest';
import type { DesignDocument, ImageElement, ShapeElement, StickerElement, TextElement } from '@/types/document';
import { createDocument } from '@/projects/document';
import { documentSchema } from '@/projects/schema';
import { SIZE_PRESETS } from '@/projects/formats';
import { luminance } from '@/utils/color';
import { findBundledFont } from '@/typography/fonts';
import { DUMP_STYLES } from '@/layouts/dump-styles';
import { applyConcept, localBackgrounds } from './backgrounds';
import { captionToText, keywords, localCaptions } from './captions';
import { AiServerError, callAiServer } from './cloud';
import { scorePairing, suggestPairings } from './fonts';
import { analyzePixels, hamming, planCarousel, toFacts, validPlan } from './layout';
import { generatePalettes, paletteFromPhotos, paletteMood } from './palettes';
import { formatForSize, resizeDocument } from './resize';
import { backgroundResultSchema, captionResultSchema, CAPTION_TONES, fontResultSchema, layoutPlanSchema } from './schemas';

const text = (id: string, over: Partial<TextElement> = {}): TextElement => ({
  id,
  type: 'text',
  x: 80,
  y: 100,
  width: 600,
  height: 120,
  rotation: 0,
  opacity: 1,
  text: 'Hello',
  fontFamily: 'Manrope',
  fontSize: 64,
  fontWeight: 700,
  fontStyle: 'normal',
  fill: { type: 'solid', color: '#111111' },
  align: 'left',
  verticalAlign: 'top',
  lineHeight: 1.1,
  letterSpacing: 0,
  ...over,
});

describe('AI captions (on device)', () => {
  it('pulls keywords from the design, headline first', () => {
    expect(keywords(['@yourhandle', 'Coffee shops of Lisbon', 'the best coffee in town · www.cafe.pt'])).toEqual([
      'coffee',
      'shops',
      'lisbon',
      'best',
      'town',
    ]);
  });

  it('writes captions in every tone, with valid hashtags, deterministic per seed', () => {
    for (const tone of CAPTION_TONES) {
      const req = {
        texts: ['Coffee shops of Lisbon', '5 favourites'],
        format: 'carousel',
        slides: 5,
        tone,
        mood: 'warm · vivid · mid',
      };
      const a = localCaptions(req, 3);
      expect(captionResultSchema.safeParse(a).success, tone).toBe(true);
      expect(localCaptions(req, 3)).toEqual(a);
      expect(a.captions.length).toBe(4);
      expect(a.captions.some((c) => /coffee|lisbon/i.test(c.text))).toBe(true);
    }
    const hype = localCaptions({ texts: ['New drop'], format: 'post', slides: 1, tone: 'hype' }, 1);
    expect(localCaptions({ texts: ['New drop'], format: 'post', slides: 1, tone: 'hype' }, 2)).not.toEqual(hype);
  });

  it('quotes a long headline by its first clause and keeps filler words out of hashtags', () => {
    const r = localCaptions(
      {
        texts: ['“Make the thing you wish existed — then share it with everyone who needed it before.”', 'Ada, designer'],
        format: 'post',
        slides: 1,
        tone: 'casual',
      },
      1,
    );
    const tags = r.captions.flatMap((c) => c.hashtags);
    expect(tags.some((t) => /^#(make|thing|wish|existed|before)$/.test(t))).toBe(false);
    expect(tags).toContain('#share');
    expect(r.captions.some((c) => c.text.includes('Make the thing you wish existed'))).toBe(true);
    expect(r.captions.every((c) => !c.text.includes('“'))).toBe(true);
  });

  it('still writes something for a design with no text', () => {
    const r = localCaptions({ texts: [], format: 'story', slides: 1, tone: 'casual' }, 1);
    expect(r.captions[0]!.text.length).toBeGreaterThan(3);
    expect(captionToText(r.captions[0]!)).toContain(r.captions[0]!.text);
  });
});

describe('AI colour palettes', () => {
  it('merges photo palettes, most common first, with a light and a dark for text', () => {
    const p = paletteFromPhotos([
      ['#D9774A', '#3A2A20', '#F0D9B5'],
      ['#DA7849', '#2F5D8A', '#F2DAB4'],
    ]);
    expect(p[0]).toBe('#D9774A');
    expect(p.some((c) => luminance(c) > 0.6)).toBe(true);
    expect(p.some((c) => luminance(c) < 0.08)).toBe(true);
  });

  it('generates every harmony and style from a base colour', () => {
    const palettes = generatePalettes('#7A5CFF');
    expect(palettes.map((p) => p.id)).toEqual([
      'complementary',
      'analogous',
      'triadic',
      'monochromatic',
      'cinematic',
      'pastel',
      'neon',
      'y2k',
      'dark-luxury',
    ]);
    for (const p of palettes)
      expect(
        p.colors.every((c) => /^#[0-9A-F]{6}$/.test(c)),
        p.id,
      ).toBe(true);
    const neon = palettes.find((p) => p.id === 'neon')!;
    expect(luminance(neon.colors[0]!)).toBeLessThan(0.02);
    expect(paletteMood(['#FF8A3D', '#FFC857', '#E4572E'])).toMatch(/^warm/);
    expect(paletteMood(['#1B1F3A', '#27304F'])).toMatch(/dark$/);
  });
});

describe('AI font pairing', () => {
  it('pairs loud headlines with quiet, readable bodies', () => {
    const anton = findBundledFont('Anton')!;
    const manrope = findBundledFont('Manrope')!;
    const caveat = findBundledFont('Caveat')!;
    expect(scorePairing(anton, caveat)).toBeNull(); // a script body is not readable
    expect(scorePairing(anton, anton)).toBeNull(); // one weight can't make contrast
    expect(scorePairing(anton, manrope)!.reason).toMatch(/contrast/i);
  });

  it('suggests varied pairings, starting from the headline font you use', () => {
    const list = suggestPairings({ current: 'Playfair Display' });
    expect(fontResultSchema.safeParse({ pairings: list }).success).toBe(true);
    expect(list[0]!.heading).toBe('Playfair Display');
    expect(new Set(list.map((p) => `${p.heading}+${p.body}`)).size).toBe(list.length);
    const y2k = suggestPairings({ vibe: 'y2k' });
    expect(['Unbounded', 'Rubik Mono One', 'Silkscreen']).toContain(y2k[0]!.heading);
  });
});

describe('AI backgrounds', () => {
  const palette = ['#0B0A12', '#7A5CFF', '#C6FF3D', '#F4F1EA'];

  it('generates valid concepts that differ per seed', () => {
    const a = localBackgrounds({ palette, aspect: 0.8 }, 1);
    expect(backgroundResultSchema.safeParse({ concepts: a }).success).toBe(true);
    expect(a).toHaveLength(4);
    expect(localBackgrounds({ palette, aspect: 0.8 }, 2).map((c) => c.name)).not.toEqual(a.map((c) => c.name));
  });

  it('applies behind everything, locked, and replaces its own earlier shapes', () => {
    const doc = createDocument({ width: 1080, height: 1350, slideCount: 3 });
    doc.elements = [text('t')];
    const concept = localBackgrounds({ palette, aspect: 0.8 }, 1).find((c) => c.shapes.length > 0)!;
    const once = applyConcept(doc, concept, 'all');
    const art = once.elements.filter((e) => e.name === 'Background art');
    expect(art.length).toBe(concept.shapes.length * 3);
    expect(art.every((e) => e.locked)).toBe(true);
    expect(once.elements[once.elements.length - 1]!.id).toBe('t');
    expect(once.slides.every((s) => s.fill === null)).toBe(true);
    const twice = applyConcept(once, concept, 'all');
    expect(twice.elements.filter((e) => e.name === 'Background art')).toHaveLength(art.length);
    const one = applyConcept(doc, concept, { slide: 1 });
    expect(one.slides[1]!.fill).toEqual(concept.fill);
    expect(one.background).toEqual(doc.background);
    // A single-slide design takes it as its background (what the Background tool shows).
    const single = applyConcept({ ...doc, slides: [doc.slides[0]!] }, concept, { slide: 0 });
    expect(single.background).toEqual(concept.fill);
    expect(single.slides[0]!.fill).toBeNull();
    expect(documentSchema.safeParse(twice).success).toBe(true);
  });
});

describe('AI layout (photos → carousel)', () => {
  function image(w: number, h: number, paint: (x: number, y: number) => [number, number, number]) {
    const data = new Uint8ClampedArray(w * h * 4);
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) {
        const [r, g, b] = paint(x, y);
        data.set([r, g, b, 255], (y * w + x) * 4);
      }
    return data;
  }

  it('measures brightness, warmth, sharpness and spots near-duplicates', () => {
    const flat = analyzePixels(
      image(32, 32, () => [120, 120, 120]),
      32,
      32,
    );
    const edges = analyzePixels(
      image(32, 32, (x, y) => ((x + y) % 2 ? [255, 255, 255] : [0, 0, 0])),
      32,
      32,
    );
    const warm = analyzePixels(
      image(32, 32, () => [230, 140, 60]),
      32,
      32,
    );
    expect(edges.sharpness).toBeGreaterThan(flat.sharpness);
    expect(warm.warmth).toBeGreaterThan(0.5);
    const gradient = (x: number) => [x * 8, x * 8, x * 8] as [number, number, number];
    const a = analyzePixels(image(32, 32, gradient), 32, 32);
    const b = analyzePixels(
      image(32, 32, (x) => gradient(x).map((v) => Math.min(255, v + 6)) as [number, number, number]),
      32,
      32,
    );
    const c = analyzePixels(
      image(32, 32, (x) => gradient(31 - x)),
      32,
      32,
    );
    expect(hamming(a.hash, b.hash)).toBeLessThanOrEqual(6);
    expect(hamming(a.hash, c.hash)).toBeGreaterThan(20);
  });

  it('plans a carousel: skips duplicates, picks a cover, chooses a style that exists', () => {
    const measured = [0.2, 0.25, 0.8, 0.22].map((brightness, i) => ({
      brightness,
      saturation: 0.3,
      warmth: 0,
      sharpness: i === 2 ? 0.95 : 0.4,
      hash: BigInt(i === 3 ? 1 : i * 1_000_003 + 12345),
      mean: [0, 0, 0] as [number, number, number],
      width: 1200,
      height: 900,
      palette: ['#223344'],
    }));
    measured[3]!.hash = measured[0]!.hash; // photo 4 duplicates photo 1
    // Same brightness pattern, different colours: not a duplicate.
    const recoloured = toFacts([measured[0]!, { ...measured[0]!, mean: [200, 40, 40] as [number, number, number] }]);
    expect(recoloured[1]!.duplicateOf).toBeUndefined();
    const facts = toFacts(measured);
    expect(facts[3]!.duplicateOf).toBe(0);
    const styles = DUMP_STYLES.map((s) => ({ id: s.id, name: s.name, blurb: s.blurb }));
    const plan = planCarousel({ photos: facts, styles });
    expect(layoutPlanSchema.safeParse(plan).success).toBe(true);
    expect(plan.cover).toBe(2);
    expect(plan.order[0]).toBe(2);
    expect(plan.order).not.toContain(3);
    expect(styles.some((s) => s.id === plan.styleId)).toBe(true);
    expect(plan.reason).toMatch(/near-duplicate/);
    // A server plan naming photos or styles that don't exist is rejected.
    expect(validPlan({ ...plan, styleId: 'nope' }, { photos: facts, styles })).toBeNull();
    expect(validPlan({ ...plan, order: [9, 2, 0] }, { photos: facts, styles })!.order).toEqual([2, 0]);
  });
});

describe('AI resize', () => {
  function portrait(): DesignDocument {
    const doc = createDocument({ width: 1080, height: 1350, slideCount: 2 });
    const bg: ShapeElement = {
      id: 'bg',
      type: 'shape',
      shape: 'rect',
      x: 0,
      y: 0,
      width: 1080,
      height: 1350,
      rotation: 0,
      opacity: 1,
      fill: { type: 'solid', color: '#222222' },
    };
    const logo: StickerElement = {
      id: 'logo',
      type: 'sticker',
      stickerId: 'vector:sparkle',
      x: 940,
      y: 40,
      width: 100,
      height: 100,
      rotation: 0,
      opacity: 1,
    };
    const photo: ImageElement = {
      id: 'ph',
      type: 'image',
      assetId: null,
      fit: 'cover',
      x: 1080 + 90,
      y: 300,
      width: 900,
      height: 700,
      rotation: 0,
      opacity: 1,
    };
    const band: ShapeElement = { ...bg, id: 'band', x: 0, y: 1150, width: 1080, height: 120 };
    doc.elements = [bg, text('title', { x: 90, y: 1180, width: 900, height: 80, fontSize: 60 }), logo, photo, band];
    return doc;
  }

  it('adapts 4:5 to 9:16: backgrounds fill, corners stay in corners, bands stretch', () => {
    const story = SIZE_PRESETS.story;
    const doc = resizeDocument(portrait(), story.width, story.height);
    const get = (id: string) => doc.elements.find((e) => e.id === id)!;
    expect(doc.slideWidth).toBe(1080);
    expect(doc.slideHeight).toBe(1920);
    expect(get('bg')).toMatchObject({ x: 0, y: 0, width: 1080, height: 1920 });
    const logo = get('logo');
    expect(logo.width).toBe(logo.height);
    expect(logo.x + logo.width).toBeCloseTo(1040, 0); // still 40px from the right edge
    expect(logo.y).toBeCloseTo(40, 0); // …and from the top
    const band = get('band');
    expect(band.width).toBe(1080);
    expect(band.y + band.height).toBeGreaterThan(1800); // stays at the bottom
    const ph = get('ph');
    expect(ph.x).toBeGreaterThanOrEqual(1080); // still on slide 2
    expect(documentSchema.safeParse(doc).success).toBe(true);
  });

  it('adapts 4:5 to 16:9: everything stays inside its slide, text shrinks with its box', () => {
    const wide = SIZE_PRESETS['yt-thumbnail'];
    const src = portrait();
    const doc = resizeDocument(src, wide.width, wide.height);
    for (const el of doc.elements) {
      const slide = Math.floor((el.x + el.width / 2) / doc.slideWidth);
      expect(el.x - slide * doc.slideWidth, el.id).toBeGreaterThanOrEqual(-1);
      expect(el.x + el.width - slide * doc.slideWidth, el.id).toBeLessThanOrEqual(doc.slideWidth + 1);
      expect(el.y + el.height, el.id).toBeLessThanOrEqual(doc.slideHeight + 1);
    }
    const title = doc.elements.find((e) => e.id === 'title') as TextElement;
    expect(title.fontSize).toBeLessThan(60);
    expect(resizeDocument(src, 1080, 1350)).toBe(src);
  });

  it('picks the format a resized copy belongs to', () => {
    expect(formatForSize('story', 'post')).toBe('story');
    expect(formatForSize('yt-thumbnail', 'carousel')).toBe('thumbnail');
    expect(formatForSize('ig-square', 'carousel')).toBe('carousel');
  });
});

describe('AI server client', () => {
  const req = { texts: ['Hi'], format: 'post', slides: 1, tone: 'casual' as const };
  const reply = (body: unknown, status = 200) => vi.fn(async () => new Response(JSON.stringify(body), { status }));

  it('posts validated JSON and validates the answer', async () => {
    const fetchImpl = reply({ captions: [{ text: 'hey', hashtags: ['#hi'] }] });
    const out = await callAiServer('caption', req, { fetchImpl, endpoint: 'https://ai.example' });
    expect(out.captions[0]!.text).toBe('hey');
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('https://ai.example/caption');
    expect(init.credentials).toBe('omit');
    expect(JSON.parse(init.body as string)).toEqual(req);
  });

  it('turns failures into clear errors', async () => {
    const kind = async (fetchImpl: typeof fetch) =>
      callAiServer('caption', req, { fetchImpl, endpoint: 'https://ai.example' }).catch((e: AiServerError) => e.kind);
    expect(await kind(reply({ captions: [{ text: 'x', hashtags: ['not a tag'] }] }))).toBe('invalid');
    expect(await kind(reply({}, 429))).toBe('rate-limited');
    expect(await kind(reply({}, 422))).toBe('declined');
    expect(await kind(reply({}, 500))).toBe('server');
    expect(await kind(vi.fn(async () => Promise.reject(new TypeError('offline'))))).toBe('offline');
    expect(await callAiServer('caption', req, { endpoint: '' }).catch((e: AiServerError) => e.kind)).toBe('not-configured');
  });
});
