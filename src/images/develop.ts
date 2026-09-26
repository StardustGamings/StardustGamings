import type { Fill, ImageElement } from '@/types/document';
import type { DrawableImage } from '@/canvas/render/types';
import { createFillStyle } from '@/canvas/render/fill';
import { markAssetsChanged, type LoadedAsset } from '@/assets/cache';
import { createWorkerClient, type WorkerClient } from '@/utils/worker-rpc';
import { effectiveAdjust, effectiveEffects, effectiveLut } from '@/filters/compose';
import { effectParams, glowRadius } from '@/effects/effects';
import {
  backdropBlurRadius,
  blurRadius,
  developSignature,
  featherRadius,
  hasPerspective,
  perspectiveMatrix,
  pixelParams,
} from './adjustments';
import { glProcessor, type DevelopInput } from './gl';
import { developCpu, type CpuDevelopInput, type Pixels } from './develop-cpu';

/**
 * Turns (photo + adjustments + cut-out) into drawable pixels, cached per
 * element and resolution. The GPU path is synchronous; the CPU fallback runs in
 * a worker and shows the previous result (or the untouched photo) meanwhile.
 */

interface Slot {
  key: string;
  canvas: HTMLCanvasElement;
  alpha: boolean;
  bytes: number;
  used: number;
}

/** Phones with little memory get a smaller cache (navigator.deviceMemory is in GB, Chromium only). */
const deviceMemory = () =>
  (typeof navigator !== 'undefined' && (navigator as Navigator & { deviceMemory?: number }).deviceMemory) || 4;
const BUDGET_BYTES = (deviceMemory() >= 8 ? 256 : 128) * 1024 * 1024;
const slots = new Map<string, Slot>();
let clock = 0;
let totalBytes = 0;

const ids = new WeakMap<object, number>();
let nextId = 1;
const identity = (o: object | null | undefined) => {
  if (!o) return 0;
  let v = ids.get(o);
  if (!v) {
    v = nextId++;
    ids.set(o, v);
  }
  return v;
};

export interface DevelopResult {
  image: DrawableImage;
  alpha: boolean;
}

function makeCanvas(w: number, h: number): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

function evict(protect: string) {
  if (totalBytes <= BUDGET_BYTES) return;
  const order = [...slots.entries()].filter(([k]) => k !== protect).sort((a, b) => a[1].used - b[1].used);
  for (const [k, s] of order) {
    if (totalBytes <= BUDGET_BYTES * 0.8) break;
    slots.delete(k);
    totalBytes -= s.bytes;
    s.canvas.width = 0;
    s.canvas.height = 0;
  }
}

function writeSlot(
  slotKey: string,
  key: string,
  alpha: boolean,
  draw: (ctx: CanvasRenderingContext2D, w: number, h: number) => void,
  w: number,
  h: number,
): Slot {
  let slot = slots.get(slotKey);
  if (!slot) {
    slot = { key, canvas: makeCanvas(w, h), alpha, bytes: w * h * 4, used: ++clock };
    slots.set(slotKey, slot);
    totalBytes += slot.bytes;
  } else if (slot.canvas.width !== w || slot.canvas.height !== h) {
    totalBytes -= slot.bytes;
    slot.canvas.width = w;
    slot.canvas.height = h;
    slot.bytes = w * h * 4;
    totalBytes += slot.bytes;
  }
  const ctx = slot.canvas.getContext('2d')!;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, w, h);
  draw(ctx, w, h);
  slot.key = key;
  slot.alpha = alpha;
  slot.used = ++clock;
  evict(slotKey);
  return slot;
}

/* ───────────── Backdrops ───────────── */

const backdropCache = new Map<string, HTMLCanvasElement>();

function cachedBackdrop(key: string, w: number, h: number, paint: (ctx: CanvasRenderingContext2D) => void): HTMLCanvasElement {
  const hit = backdropCache.get(key);
  if (hit) return hit;
  const c = makeCanvas(w, h);
  paint(c.getContext('2d')!);
  backdropCache.set(key, c);
  if (backdropCache.size > 8) backdropCache.delete(backdropCache.keys().next().value!);
  return c;
}

function fillBackdrop(fill: Fill, width: number, height: number): HTMLCanvasElement {
  // Gradients are smooth, so a small canvas upscaled by the GPU looks identical.
  const s = Math.min(1, 512 / Math.max(width, height));
  const w = Math.max(1, Math.round(width * s));
  const h = Math.max(1, Math.round(height * s));
  return cachedBackdrop(`fill:${JSON.stringify(fill)}:${w}x${h}`, w, h, (ctx) => {
    ctx.fillStyle = createFillStyle(ctx, fill, 0, 0, w, h);
    ctx.fillRect(0, 0, w, h);
  });
}

function photoBackdrop(asset: LoadedAsset, width: number, height: number): HTMLCanvasElement {
  const s = Math.min(1, 1600 / Math.max(width, height));
  const w = Math.max(1, Math.round(width * s));
  const h = Math.max(1, Math.round(height * s));
  return cachedBackdrop(`photo:${identity(asset.image)}:${w}x${h}`, w, h, (ctx) => {
    const img = asset.image;
    const k = Math.max(w / img.width, h / img.height);
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, (w - img.width * k) / 2, (h - img.height * k) / 2, img.width * k, img.height * k);
  });
}

/* ───────────── Pipeline input ───────────── */

function gpuInput(el: ImageElement, base: LoadedAsset, mask: LoadedAsset | null, backdrop: LoadedAsset | null): DevelopInput {
  const width = base.image.width;
  const height = base.image.height;
  const maxDim = Math.max(width, height);
  // The photo's own edits with its look (filter) blended in.
  const a = effectiveAdjust(el);
  let cutout: DevelopInput['cutout'] = null;
  if (el.cutout && mask) {
    const bd = el.cutout.backdrop;
    cutout = {
      mask: mask.image,
      feather: featherRadius(el.cutout.feather, maxDim),
      backdrop:
        bd.type === 'fill'
          ? { kind: 'image', image: fillBackdrop(bd.fill, width, height) }
          : bd.type === 'image' && backdrop
            ? { kind: 'image', image: photoBackdrop(backdrop, width, height) }
            : bd.type === 'blur'
              ? { kind: 'blur', radius: backdropBlurRadius(bd.amount, maxDim) }
              : { kind: 'none' },
    };
  }
  return {
    source: base.image,
    width,
    height,
    // The vignette is drawn by the renderer (it follows the frame, not the photo).
    params: { ...pixelParams(a), vignette: 0 },
    lut: effectiveLut(el),
    warp: hasPerspective(el.perspective) ? perspectiveMatrix(el.perspective) : null,
    sharpen: (a?.sharpness ?? 0) / 100,
    blur: blurRadius(a?.blur ?? 0, maxDim),
    effects: effectParams(effectiveEffects(el)),
    glowRadius: glowRadius(maxDim),
    cutout,
  };
}

const transparentResult = (el: ImageElement, mask: LoadedAsset | null) =>
  !!el.cutout && !!mask && el.cutout.backdrop.type === 'none';

/* ───────────── CPU fallback ───────────── */

let cpuClient: WorkerClient<CpuDevelopInput, Pixels> | null | undefined;
const cpuJobs = new Map<string, { running: boolean; next: (() => void) | null }>();

function pixelsOf(image: DrawableImage, maxDim = Infinity): Pixels {
  const s = Math.min(1, maxDim / Math.max(image.width, image.height));
  const w = Math.max(1, Math.round(image.width * s));
  const h = Math.max(1, Math.round(image.height * s));
  const c = makeCanvas(w, h);
  const ctx = c.getContext('2d', { willReadFrequently: true })!;
  ctx.drawImage(image, 0, 0, w, h);
  return { data: ctx.getImageData(0, 0, w, h).data, width: w, height: h };
}

/** Runs the CPU pipeline (in the worker when there is one). `limit` caps the working size. */
function cpuDevelop(input: DevelopInput, limit: number): Promise<Pixels> {
  const source = pixelsOf(input.source, limit);
  const scale = source.width / input.width;
  const cpu: CpuDevelopInput = {
    source,
    params: input.params,
    lut: input.lut,
    warp: input.warp,
    sharpen: input.sharpen,
    blur: input.blur * scale,
    effects: input.effects,
    glowRadius: input.glowRadius * scale,
    cutout: input.cutout && {
      mask: pixelsOf(input.cutout.mask, limit),
      feather: input.cutout.feather * scale,
      backdrop:
        input.cutout.backdrop.kind === 'image'
          ? { kind: 'image', pixels: pixelsOf(input.cutout.backdrop.image, limit) }
          : input.cutout.backdrop.kind === 'blur'
            ? { kind: 'blur', radius: input.cutout.backdrop.radius * scale }
            : { kind: 'none' },
    },
  };
  if (cpuClient === undefined) {
    cpuClient =
      typeof Worker !== 'undefined'
        ? createWorkerClient(() => new Worker('/workers/develop.js', { name: 'photo-develop' }))
        : null;
  }
  return cpuClient
    ? cpuClient.call(cpu).catch(() => developCpu(cpu))
    : new Promise((resolve) => setTimeout(() => resolve(developCpu(cpu)), 0));
}

function runCpu(slotKey: string, key: string, input: DevelopInput, alpha: boolean) {
  const job = cpuJobs.get(slotKey) ?? { running: false, next: null };
  cpuJobs.set(slotKey, job);
  if (job.running) {
    job.next = () => runCpu(slotKey, key, input, alpha);
    return;
  }
  job.running = true;
  // Without workers the main thread does the work, at a smaller size to stay responsive.
  const limit = typeof Worker === 'undefined' ? 1024 : Infinity;
  void cpuDevelop(input, limit)
    .then((out) => {
      writeSlot(
        slotKey,
        key,
        alpha,
        (ctx) => ctx.putImageData(new ImageData(new Uint8ClampedArray(out.data), out.width, out.height), 0, 0),
        out.width,
        out.height,
      );
      markAssetsChanged();
    })
    .catch(() => {
      /* Leave the untouched photo showing. */
    })
    .finally(() => {
      job.running = false;
      const next = job.next;
      job.next = null;
      next?.();
    });
}

/**
 * Developed pixels for an element, or null if nothing is ready yet (callers
 * then draw the untouched photo).
 */
export function developImage(
  el: ImageElement,
  variant: string,
  base: LoadedAsset,
  mask: LoadedAsset | null,
  backdrop: LoadedAsset | null,
): DevelopResult | null {
  const slotKey = `${el.id}|${variant}`;
  const key = `${developSignature(el)}|${identity(base.image)}|${identity(mask?.image)}|${identity(backdrop?.image)}`;
  const slot = slots.get(slotKey);
  if (slot && slot.key === key) {
    slot.used = ++clock;
    return { image: slot.canvas, alpha: slot.alpha };
  }
  if (typeof document === 'undefined') return null;
  const input = gpuInput(el, base, mask, backdrop);
  const alpha = transparentResult(el, mask);
  const gl = glProcessor();
  const out = gl?.develop(input);
  if (out) {
    const s = writeSlot(slotKey, key, alpha, (ctx) => ctx.drawImage(out, 0, 0), out.width, out.height);
    return { image: s.canvas, alpha };
  }
  runCpu(slotKey, key, input, alpha);
  return slot ? { image: slot.canvas, alpha: slot.alpha } : null;
}

/**
 * Looks and adjustments on a video frame (live preview). GPU only — per-frame
 * CPU processing can't keep up, so without WebGL the frame shows unfiltered.
 */
export function developFrame(el: ImageElement, frame: DrawableImage, width: number, height: number): DrawableImage | null {
  if (typeof document === 'undefined') return null;
  const gl = glProcessor();
  if (!gl) return null;
  const input = gpuInput(el, { image: frame } as LoadedAsset, null, null);
  const out = gl.develop({ ...input, source: frame, width, height, dynamic: true, cutout: null });
  if (!out) return null;
  const s = writeSlot(`${el.id}|video`, `frame${++clock}`, false, (ctx) => ctx.drawImage(out, 0, 0), out.width, out.height);
  return s.canvas;
}

/** Whether looks and adjustments can run on video frames here. */
export const canDevelopVideo = () => typeof document !== 'undefined' && glProcessor() !== null;

/**
 * Developed pixels for an export: full quality, never from the editor's cache,
 * awaited even on the CPU path. The caller owns (and should free) the canvas.
 */
export async function developForExport(
  el: ImageElement,
  base: LoadedAsset,
  mask: LoadedAsset | null,
  backdrop: LoadedAsset | null,
): Promise<DevelopResult | null> {
  if (typeof document === 'undefined') return null;
  const input = gpuInput(el, base, mask, backdrop);
  const alpha = transparentResult(el, mask);
  const out = glProcessor()?.develop(input);
  if (out) {
    const c = makeCanvas(out.width, out.height);
    c.getContext('2d')!.drawImage(out, 0, 0);
    return { image: c, alpha };
  }
  try {
    const px = await cpuDevelop(input, Infinity);
    const c = makeCanvas(px.width, px.height);
    c.getContext('2d')!.putImageData(new ImageData(new Uint8ClampedArray(px.data), px.width, px.height), 0, 0);
    return { image: c, alpha };
  } catch {
    return null;
  }
}

/** Frees developed images (e.g. when the editor closes). */
export function clearDevelopCache(): void {
  for (const s of slots.values()) {
    s.canvas.width = 0;
    s.canvas.height = 0;
  }
  slots.clear();
  backdropCache.clear();
  totalBytes = 0;
}
