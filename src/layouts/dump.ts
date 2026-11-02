import type { DesignDocument, DesignElement, Fill, ImageElement, ShapeElement, TextElement } from '@/types/document';
import { createDocument } from '@/projects/document';
import { MAX_SLIDES } from '@/projects/formats';
import { createId } from '@/utils/id';
import { clamp, seededRandom } from '@/utils/math';
import { fromHsl, readableOn, toHsl } from '@/utils/color';
import { createSticker, createText, TEXT_PRESETS } from '@/editor/core/factory';
import { createCollage } from './apply';
import type { DumpStyle } from './dump-styles';
import type { PhotoRef } from './types';

/**
 * Smart Photo Dump: turns 2–20 photos into a finished carousel using a style's
 * rules — a cover, then content slides whose photo counts follow the style's
 * rhythm. Every content slide is a real collage, so it can be shuffled later.
 */

export interface DumpInput {
  photos: PhotoRef[];
  style: DumpStyle;
  width: number;
  height: number;
  seed: number;
  /** Replaces the style's default title. */
  title?: string;
}

/** A background tint from the photos' colours: light (pastel) or dark. */
export function paletteTint(photos: PhotoRef[], mode: 'light' | 'dark', index = 0): string {
  const colours = photos.flatMap((p) => p.palette ?? []);
  const vivid = [...colours].sort((a, b) => toHsl(b).s - toHsl(a).s);
  const base = vivid[index % Math.max(1, vivid.length)] ?? '#C9B8FF';
  const { h, s } = toHsl(base);
  return mode === 'light' ? fromHsl({ h, s: clamp(s * 0.55, 18, 60), l: 92 }) : fromHsl({ h, s: clamp(s * 0.5, 10, 40), l: 9 });
}

function resolveBackground(style: DumpStyle, photos: PhotoRef[]): Fill {
  if (style.background === 'palette-light') return { type: 'solid', color: paletteTint(photos, 'light') };
  if (style.background === 'palette-dark') return { type: 'solid', color: paletteTint(photos, 'dark') };
  return style.background;
}

/** Splits photos into the cover group and content slides following the style's rhythm. */
export function planSlides(count: number, style: DumpStyle): { cover: number; groups: number[] } {
  const cover = style.cover === 'collage' ? Math.min(3, count) : Math.min(1, count);
  const groups: number[] = [];
  let left = count - cover;
  let k = 0;
  while (left > 0 && groups.length < MAX_SLIDES - 1) {
    const want = style.perSlide[k++ % style.perSlide.length]!;
    let take = Math.min(want, left);
    // Don't leave a lonely last photo when the rhythm wants groups.
    if (left - take === 1 && want > 1) take += 1;
    groups.push(take);
    left -= take;
  }
  return { cover, groups };
}

const bar = (x: number, y: number, width: number, height: number): ShapeElement => ({
  id: createId('el'),
  type: 'shape',
  shape: 'rect',
  x,
  y,
  width,
  height,
  rotation: 0,
  opacity: 1,
  fill: { type: 'solid', color: '#000000' },
});

const photoEl = (ref: PhotoRef, x: number, y: number, width: number, height: number): ImageElement => ({
  id: createId('el'),
  type: 'image',
  x,
  y,
  width,
  height,
  rotation: 0,
  opacity: 1,
  assetId: ref.assetId,
  fit: 'cover',
});

export function generatePhotoDump(input: DumpInput): DesignDocument {
  const { photos, style } = input;
  const rnd = seededRandom(input.seed);
  const plan = planSlides(photos.length, style);
  const W = input.width;
  const H = input.height;
  const short = Math.min(W, H);
  const margin = short * style.margin;
  let doc: DesignDocument = createDocument({
    width: W,
    height: H,
    slideCount: 1 + plan.groups.length,
    background: resolveBackground(style, photos),
  });
  if (style.tintSlides) {
    doc = {
      ...doc,
      slides: doc.slides.map((s, i) =>
        i > 0 && i % 2 === 0 ? { ...s, fill: { type: 'solid', color: paletteTint(photos, 'light', i) } } : s,
      ),
    };
  }
  const extra: DesignElement[] = [];
  const titleSpace = H * 0.16;
  const letterbox = H * 0.11;

  /* Cover */
  const coverPhotos = photos.slice(0, plan.cover);
  const titlePreset = TEXT_PRESETS.find((p) => p.id === style.title.preset) ?? TEXT_PRESETS[0]!;
  let titleOnPhoto = false;
  if (style.cover === 'full-bleed' && coverPhotos[0]) {
    const y = style.letterbox ? letterbox : 0;
    extra.push(photoEl(coverPhotos[0], 0, y, W, H - 2 * y));
    if (style.letterbox) extra.push(bar(0, 0, W, letterbox), bar(0, H - letterbox, W, letterbox));
    titleOnPhoto = !style.letterbox;
  } else if (style.cover === 'framed' && coverPhotos[0]) {
    const top = style.title.placement === 'top' ? margin + titleSpace : margin;
    extra.push(photoEl(coverPhotos[0], margin, top, W - 2 * margin, H - 2 * margin - titleSpace));
  } else if (coverPhotos.length) {
    const top = style.title.placement === 'top' ? margin + titleSpace : margin;
    doc = createCollage(doc, {
      slide: 0,
      family: style.collage.family,
      seed: Math.floor(rnd() * 2 ** 31),
      photos: coverPhotos,
      frame: { x: margin, y: top, width: W - 2 * margin, height: H - 2 * margin - titleSpace },
      dims: () => null,
      overrides: style.collage,
    }).doc;
  }
  doc = { ...doc, elements: [...doc.elements, ...extra] };
  extra.length = 0;

  // Title
  const titleY =
    style.title.placement === 'top'
      ? margin + titleSpace / 2
      : style.title.placement === 'center'
        ? H / 2
        : H - (style.letterbox ? letterbox + titleSpace * 0.2 : margin) - titleSpace / 2;
  let title: TextElement = createText(doc, { x: W / 2, y: titleY }, titlePreset, input.title?.trim() || style.title.text);
  if (titleOnPhoto && !titlePreset.fixedColors) {
    title = { ...title, fill: { type: 'solid', color: '#FFFFFF' }, shadow: { color: 'rgba(0,0,0,0.45)', blur: 24, x: 0, y: 4 } };
  } else if (style.letterbox) {
    title = { ...title, fill: { type: 'solid', color: '#FFFFFF' } };
  }
  extra.push(title);

  // Cover stickers around the title
  for (let i = 0; i < Math.min(style.coverStickers, style.stickers.length ? 4 : 0); i++) {
    const id = style.stickers[Math.floor(rnd() * style.stickers.length)]!;
    const side = i % 2 === 0 ? -1 : 1;
    const size = short * (0.1 + rnd() * 0.05);
    // Beside the title when there's room, otherwise tucked into the slide's side margin.
    const x = clamp(W / 2 + side * (title.width / 2 + short * 0.07), size / 2 + margin * 0.5, W - size / 2 - margin * 0.5);
    const above = style.title.placement === 'top' ? 1 : -1;
    const y = clamp(titleY + above * (title.height / 2 + size * 0.3) * (i >= 2 ? 1 : 0.4), size / 2, H - size / 2);
    const s = createSticker(doc, { x, y }, id, size);
    extra.push({ ...s, rotation: (rnd() * 2 - 1) * 18 });
  }

  /* Content slides */
  let cursor = plan.cover;
  const captionPreset = TEXT_PRESETS.find((p) => p.id === style.caption?.preset);
  plan.groups.forEach((count, j) => {
    const slide = j + 1;
    const group = photos.slice(cursor, cursor + count);
    cursor += count;
    const x0 = slide * W;
    const captionSpace = style.caption ? H * 0.07 : 0;
    if (count === 1 && style.letterbox) {
      extra.push(
        photoEl(group[0]!, x0, letterbox, W, H - 2 * letterbox),
        bar(x0, 0, W, letterbox),
        bar(x0, H - letterbox, W, letterbox),
      );
    } else {
      doc = createCollage(doc, {
        slide,
        family: style.collage.family,
        seed: Math.floor(rnd() * 2 ** 31),
        photos: group,
        frame: { x: margin, y: margin, width: W - 2 * margin, height: H - 2 * margin - captionSpace },
        dims: () => null,
        overrides: style.collage,
      }).doc;
    }
    if (style.caption && captionPreset) {
      const text =
        style.caption.kind === 'counter'
          ? `${String(slide).padStart(2, '0')} / ${String(plan.groups.length).padStart(2, '0')}`
          : (style.caption.text ?? '');
      const y = style.letterbox ? H - letterbox / 2 : H - margin - captionSpace / 2;
      let caption = createText(doc, { x: x0 + W / 2, y }, captionPreset, text);
      if (style.letterbox) caption = { ...caption, fill: { type: 'solid', color: '#FFFFFF' } };
      else {
        const bg = doc.slides[slide]?.fill ?? doc.background;
        const colour = bg.type === 'solid' ? bg.color : (bg.stops[0]?.color ?? '#FFFFFF');
        caption = { ...caption, fill: { type: 'solid', color: readableOn(colour) } };
      }
      extra.push(caption);
    }
  });

  doc = { ...doc, elements: [...doc.elements, ...extra] };

  // The style's photo look.
  if (style.adjust) {
    doc = {
      ...doc,
      elements: doc.elements.map((e) => (e.type === 'image' && e.assetId ? { ...e, adjust: { ...style.adjust } } : e)),
    };
  }
  return doc;
}
