import type {
  CollageFamily,
  CollageLayout,
  DesignDocument,
  DesignElement,
  ImageElement,
  LayoutSpec,
  PanoramaLayout,
} from '@/types/document';
import { insertSlide, removeSlide, slideIndexOf } from '@/projects/document';
import { createId } from '@/utils/id';
import { clamp, seededRandom } from '@/utils/math';
import { defaultCollageParams, generateCollage, shuffle } from './collage';
import { generatePanorama, type PanoramaParams } from './panorama';
import { aspectOf, type Box, type LayoutResult, type PhotoRef, type Slot } from './types';

/**
 * Turns generated slots into document elements, and regenerates existing
 * layouts. Photos keep their identity (and their crop, adjustments and
 * cut-outs) across shuffles — only their frame geometry changes. Decor is
 * recreated each time.
 */

/** Looks up a photo's pixel size (from the asset library); null if unknown. */
export type DimsLookup = (assetId: string) => { width: number; height: number } | null;

interface Member {
  el: ImageElement;
  ref: PhotoRef;
}

export function getLayout(doc: DesignDocument, id: string): LayoutSpec | undefined {
  return doc.layouts?.find((l) => l.id === id);
}

function upsertLayout(doc: DesignDocument, spec: LayoutSpec): DesignDocument {
  const layouts = doc.layouts ?? [];
  const exists = layouts.some((l) => l.id === spec.id);
  return { ...doc, layouts: exists ? layouts.map((l) => (l.id === spec.id ? spec : l)) : [...layouts, spec] };
}

/** Photo members in layout order (their stored index, then paint order). */
function photoMembers(doc: DesignDocument, layoutId: string, dims: DimsLookup): Member[] {
  return doc.elements
    .map((el, z) => ({ el, z }))
    .filter(
      (x): x is { el: ImageElement; z: number } =>
        x.el.type === 'image' && x.el.layout?.id === layoutId && x.el.layout.role === 'photo',
    )
    .sort((a, b) => (a.el.layout!.index ?? a.z) - (b.el.layout!.index ?? b.z) || a.z - b.z)
    .map(({ el }) => {
      const d = el.assetId ? dims(el.assetId) : null;
      return { el, ref: { assetId: el.assetId ?? '', width: d?.width ?? el.width, height: d?.height ?? el.height } };
    });
}

const slotFrame = (s: Slot) => ({
  x: s.x,
  y: s.y,
  width: s.width,
  height: s.height,
  rotation: s.rotation,
  clip: s.clip,
  cornerRadius: s.cornerRadius,
  stroke: s.stroke,
  shadow: s.shadow,
});

const centre = (b: { x: number; y: number; width: number; height: number }) => ({ x: b.x + b.width / 2, y: b.y + b.height / 2 });

/**
 * Final photo → slot assignment. Locked photos claim the slot nearest to where
 * they are now; the others keep the generator's choice when it's still free.
 */
function resolveAssignment(members: Member[], result: LayoutResult): number[] {
  const assign = new Array<number>(members.length).fill(-1);
  const taken = new Set<number>();
  const nearest = (from: { x: number; y: number }) => {
    let best = -1;
    let bestD = Infinity;
    result.slots.forEach((s, k) => {
      if (taken.has(k)) return;
      const c = centre(s);
      const d = Math.hypot(c.x - from.x, c.y - from.y);
      if (d < bestD) {
        bestD = d;
        best = k;
      }
    });
    return best;
  };
  members.forEach((m, i) => {
    if (!m.el.layout?.locked) return;
    const k = nearest(centre(m.el));
    assign[i] = k;
    taken.add(k);
  });
  members.forEach((_, i) => {
    if (assign[i] !== -1) return;
    const preferred = result.assign[i]!;
    const k = taken.has(preferred) ? nearest(centre(result.slots[preferred]!)) : preferred;
    assign[i] = k;
    taken.add(k);
  });
  return assign;
}

/**
 * Writes a generated layout into the document: members are replaced in one
 * block at the position of the old members (or on top for a new layout).
 */
function writeLayout(
  doc: DesignDocument,
  spec: LayoutSpec,
  members: Member[],
  result: LayoutResult,
  newPhotos: PhotoRef[] = [],
): {
  doc: DesignDocument;
  ids: string[];
} {
  const all: Member[] = [
    ...members,
    ...newPhotos.map((ref) => ({
      ref,
      el: {
        id: createId('el'),
        type: 'image',
        x: 0,
        y: 0,
        width: 1,
        height: 1,
        rotation: 0,
        opacity: 1,
        assetId: ref.assetId,
        fit: 'cover',
      } satisfies ImageElement,
    })),
  ];
  const assign = resolveAssignment(all, result);
  const bySlot = new Map<number, number>();
  assign.forEach((slot, photo) => bySlot.set(slot, photo));

  const elements: DesignElement[] = [];
  for (const layer of result.layers) {
    if ('decor' in layer) {
      elements.push({ ...layer.decor, layout: { id: spec.id, role: 'decor' } });
      continue;
    }
    const photoIndex = bySlot.get(layer.slot);
    if (photoIndex === undefined) continue;
    const m = all[photoIndex]!;
    elements.push({
      ...m.el,
      ...slotFrame(result.slots[layer.slot]!),
      layout: { id: spec.id, role: 'photo', index: photoIndex, ...(m.el.layout?.locked ? { locked: true } : {}) },
    });
  }

  const memberIds = new Set(all.map((m) => m.el.id));
  const oldIndex = doc.elements.findIndex((e) => e.layout?.id === spec.id || memberIds.has(e.id));
  const kept = doc.elements.filter((e) => e.layout?.id !== spec.id && !memberIds.has(e.id));
  const at = oldIndex === -1 ? kept.length : doc.elements.slice(0, oldIndex).filter((e) => kept.includes(e)).length;
  const next = { ...doc, elements: [...kept.slice(0, at), ...elements, ...kept.slice(at)] };
  return { doc: upsertLayout(next, spec), ids: elements.filter((e) => e.layout?.role === 'photo').map((e) => e.id) };
}

/* ───────────── Collages ───────────── */

/** Default area: the slide with a comfortable margin. */
export function defaultFrame(doc: DesignDocument, marginRatio = 0.06) {
  const m = Math.min(doc.slideWidth, doc.slideHeight) * marginRatio;
  return { x: m, y: m, width: doc.slideWidth - 2 * m, height: doc.slideHeight - 2 * m };
}

function collageBox(doc: DesignDocument, spec: CollageLayout, slide: number): Box {
  return { ...spec.frame, x: slide * doc.slideWidth + spec.frame.x };
}

/** The slide a layout lives on (from where its photos are now). */
function homeSlide(doc: DesignDocument, members: Member[]): number {
  if (members.length === 0) return 0;
  const cx = members.reduce((s, m) => s + m.el.x + m.el.width / 2, 0) / members.length;
  return clamp(Math.floor(cx / doc.slideWidth), 0, doc.slides.length - 1);
}

export function createCollage(
  doc: DesignDocument,
  options: {
    slide: number;
    family: CollageFamily;
    seed: number;
    /** New photos to add… */
    photos?: PhotoRef[];
    /** …and/or existing image elements to arrange. */
    elementIds?: string[];
    frame?: CollageLayout['frame'];
    dims: DimsLookup;
    overrides?: Partial<Pick<CollageLayout, 'chaos' | 'gutter' | 'decor'>>;
  },
): { doc: DesignDocument; layoutId: string; ids: string[] } {
  const spec: CollageLayout = {
    id: createId('lay'),
    kind: 'collage',
    ...defaultCollageParams(options.family, options.seed),
    ...options.overrides,
    frame: options.frame ?? defaultFrame(doc),
  };
  const existing: Member[] = doc.elements
    .filter((e): e is ImageElement => e.type === 'image' && !!options.elementIds?.includes(e.id))
    .map((el) => {
      const d = el.assetId ? options.dims(el.assetId) : null;
      // Existing photos leave any previous layout.
      const { layout: _old, ...rest } = el;
      return { el: rest, ref: { assetId: el.assetId ?? '', width: d?.width ?? el.width, height: d?.height ?? el.height } };
    });
  const incoming = options.photos ?? [];
  const refs = [...existing.map((m) => m.ref), ...incoming];
  const result = generateCollage(refs, collageBox(doc, spec, options.slide), spec);
  const written = writeLayout(doc, spec, existing, result, incoming);
  return { doc: written.doc, layoutId: spec.id, ids: written.ids };
}

/** Regenerates a collage with changed parameters (restyle, gutter, new seed…). */
export function regenerateCollage(
  doc: DesignDocument,
  layoutId: string,
  change: Partial<Omit<CollageLayout, 'id' | 'kind'>>,
  dims: DimsLookup,
): DesignDocument {
  const current = getLayout(doc, layoutId);
  if (current?.kind !== 'collage') return doc;
  const members = photoMembers(doc, layoutId, dims);
  if (members.length === 0) return removeLayout(doc, layoutId);
  const spec: CollageLayout = { ...current, ...change };
  const result = generateCollage(
    members.map((m) => m.ref),
    collageBox(doc, spec, homeSlide(doc, members)),
    spec,
  );
  return writeLayout(doc, spec, members, result).doc;
}

/**
 * Shuffle: a fresh arrangement. With locked photos, the layout stays and only
 * the unlocked photos trade places (locked ones don't move at all).
 */
export function shuffleCollage(doc: DesignDocument, layoutId: string, seed: number, dims: DimsLookup): DesignDocument {
  const spec = getLayout(doc, layoutId);
  if (spec?.kind !== 'collage') return doc;
  const members = photoMembers(doc, layoutId, dims);
  const rnd = seededRandom(seed);
  const unlocked = members.filter((m) => !m.el.layout?.locked);
  if (unlocked.length === members.length) {
    // Nothing locked: new order + new seed.
    const order = shuffle(
      members.map((_, i) => i),
      rnd,
    );
    const reordered = updateMembers(doc, members, (m, i) => ({ ...m.el, layout: { ...m.el.layout!, index: order[i]! } }));
    return regenerateCollage(reordered, layoutId, { seed }, dims);
  }
  if (unlocked.length < 2) return doc;
  // Rotate the unlocked photos through each other's spots (a derangement, so every one moves).
  const offset = 1 + Math.floor(rnd() * (unlocked.length - 1));
  const targets = unlocked.map((_, i) => unlocked[(i + offset) % unlocked.length]!);
  const frames = new Map(
    unlocked.map((m, i) => {
      const t = targets[i]!.el;
      return [
        m.el.id,
        {
          x: t.x,
          y: t.y,
          width: t.width,
          height: t.height,
          rotation: t.rotation,
          clip: t.clip,
          cornerRadius: t.cornerRadius,
          stroke: t.stroke,
          shadow: t.shadow,
          index: t.layout?.index,
        },
      ];
    }),
  );
  // Swap paint order too, so overlaps follow the spots.
  const positions = unlocked.map((m) => doc.elements.findIndex((e) => e.id === m.el.id));
  const elements = [...doc.elements];
  unlocked.forEach((m, i) => {
    const { index, ...frame } = frames.get(m.el.id)!;
    elements[positions[(i + offset) % unlocked.length]!] = {
      ...m.el,
      ...frame,
      layout: { ...m.el.layout!, index },
    };
  });
  return { ...doc, elements };
}

function updateMembers(doc: DesignDocument, members: Member[], fn: (m: Member, i: number) => DesignElement): DesignDocument {
  const byId = new Map(members.map((m, i) => [m.el.id, fn(m, i)]));
  return { ...doc, elements: doc.elements.map((e) => byId.get(e.id) ?? e) };
}

export function setPhotoLocked(doc: DesignDocument, elementId: string, locked: boolean): DesignDocument {
  return {
    ...doc,
    elements: doc.elements.map((e) =>
      e.id === elementId && e.layout ? { ...e, layout: { ...e.layout, locked: locked || undefined } } : e,
    ),
  };
}

/** Keeps the elements but forgets the layout (they become ordinary, independent elements). */
export function removeLayout(doc: DesignDocument, layoutId: string): DesignDocument {
  const elements = doc.elements.map((e) => {
    if (e.layout?.id !== layoutId) return e;
    const { layout: _layout, ...rest } = e;
    return rest as DesignElement;
  });
  const layouts = (doc.layouts ?? []).filter((l) => l.id !== layoutId);
  return { ...doc, elements, layouts: layouts.length ? layouts : undefined };
}

/* ───────────── Seamless panoramas ───────────── */

export const DEFAULT_PANORAMA: PanoramaParams = { slides: 3, spacing: 0, margin: 0, align: 'center' };

export function createPanorama(
  doc: DesignDocument,
  options: { startSlide: number; photos: PhotoRef[]; params: PanoramaParams; seed: number },
): { doc: DesignDocument; layoutId: string; ids: string[] } {
  const spec: PanoramaLayout = { id: createId('lay'), kind: 'panorama', seed: options.seed, ...options.params };
  let next = doc;
  while (next.slides.length < options.startSlide + spec.slides) next = insertSlide(next, next.slides.length);
  const result = generatePanorama(
    options.photos,
    { width: next.slideWidth, height: next.slideHeight },
    options.startSlide * next.slideWidth,
    spec,
  );
  const written = writeLayout(next, spec, [], result, options.photos);
  return { doc: written.doc, layoutId: spec.id, ids: written.ids };
}

export function regeneratePanorama(
  doc: DesignDocument,
  layoutId: string,
  change: Partial<PanoramaParams>,
  dims: DimsLookup,
): DesignDocument {
  const current = getLayout(doc, layoutId);
  if (current?.kind !== 'panorama') return doc;
  const members = photoMembers(doc, layoutId, dims);
  if (members.length === 0) return removeLayout(doc, layoutId);
  const spec: PanoramaLayout = { ...current, ...change, slides: clamp(Math.round(change.slides ?? current.slides), 1, 30) };
  const start = clamp(Math.floor(Math.min(...members.map((m) => m.el.x)) / doc.slideWidth + 1e-6), 0, doc.slides.length - 1);
  let next = doc;
  // More slides: insert empty ones right after the panorama (later slides move along).
  for (let i = current.slides; i < spec.slides; i++) next = insertSlide(next, Math.min(start + i, next.slides.length));
  const result = generatePanorama(
    members.map((m) => m.ref),
    { width: next.slideWidth, height: next.slideHeight },
    start * next.slideWidth,
    spec,
  );
  next = writeLayout(next, spec, members, result).doc;
  // Fewer slides: drop the panorama's trailing slides if they're now empty.
  for (let i = current.slides - 1; i >= spec.slides; i--) {
    const index = start + i;
    if (index >= next.slides.length || next.slides.length <= 1) continue;
    if (next.elements.some((e) => slideIndexOf(e, next) === index)) continue;
    next = removeSlide(next, index);
  }
  return next;
}

/** Shuffles a panorama's photo order (locked photos keep their place in the row). */
export function shufflePanorama(doc: DesignDocument, layoutId: string, seed: number, dims: DimsLookup): DesignDocument {
  const members = photoMembers(doc, layoutId, dims);
  const free = members.map((m, i) => i).filter((i) => !members[i]!.el.layout?.locked);
  if (free.length < 2) return doc;
  const rnd = seededRandom(seed);
  let order = shuffle(free, rnd);
  if (order.every((v, k) => v === free[k])) order = [...free.slice(1), free[0]!];
  const index = members.map((_, i) => i);
  free.forEach((slot, k) => (index[slot] = order[k]!));
  const reordered = updateMembers(doc, members, (m, i) => ({ ...m.el, layout: { ...m.el.layout!, index: index[i]! } }));
  return regeneratePanorama(reordered, layoutId, {}, dims);
}

export { aspectOf };
