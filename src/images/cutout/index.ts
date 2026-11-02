'use client';

import { create } from 'zustand';
import type { Cutout, ImageElement } from '@/types/document';
import { getAssetBlob, saveGeneratedAsset } from '@/assets/repository';
import { primeAsset } from '@/assets/cache';
import { createWorkerClient, WorkerCallError, type WorkerClient } from '@/utils/worker-rpc';
import type { Pixels } from '../develop-cpu';
import { colourKeyMask } from './colour-key';
import { grayGuide, guidedFilter } from './guided-filter';
import {
  MASK_MAX,
  type CutoutMethod,
  type CutoutProgress,
  type CutoutRequest,
  type CutoutResult,
  type LocalCutoutMethod,
} from './types';

/**
 * Background removal behind one interface, with three kinds of provider:
 *
 * - `ai`         U²-Netp (Apache-2.0) on ONNX Runtime Web, in a worker. Fully on-device;
 *                the model + runtime (~19 MB) download once from this site and are cached.
 * - `colour-key` Classic flood-fill keying for plain backgrounds. Instant, no download.
 * - `server`     Optional. Only exists when the site is built with NEXT_PUBLIC_CUTOUT_ENDPOINT,
 *                and only runs after the person explicitly agrees to upload the photo.
 *
 * Providers return a grayscale mask; the develop pipeline composites it non-destructively.
 */

export const MODEL_URL = '/ml/u2netp.onnx';
export const ORT_WASM_URL = '/ml/ort/ort-wasm-simd-threaded.wasm';
/** Model + runtime download size, shown before the first run. */
export const AI_DOWNLOAD_BYTES = 4_574_861 + 14_239_897;

const SERVER_ENDPOINT = process.env.NEXT_PUBLIC_CUTOUT_ENDPOINT ?? '';

export interface CutoutProviderInfo {
  id: CutoutMethod;
  label: string;
  description: string;
  /** The photo leaves the device. */
  uploads: boolean;
  available: boolean;
  /** Why it's unavailable (shown instead of hiding it silently). */
  unavailableReason?: string;
}

function supportsWasmSimd(): boolean {
  try {
    // Minimal module using a v128 instruction; validates only where SIMD is supported.
    return WebAssembly.validate(
      new Uint8Array([
        0, 97, 115, 109, 1, 0, 0, 0, 1, 5, 1, 96, 0, 1, 123, 3, 2, 1, 0, 10, 10, 1, 8, 0, 65, 0, 253, 15, 253, 98, 11,
      ]),
    );
  } catch {
    return false;
  }
}

export function serverHost(): string | null {
  if (!SERVER_ENDPOINT) return null;
  try {
    return new URL(SERVER_ENDPOINT).host;
  } catch {
    return null;
  }
}

let providersCache: CutoutProviderInfo[] | null = null;

/** Available providers (computed once; stable for useSyncExternalStore). */
export function cutoutProviders(): CutoutProviderInfo[] {
  if (providersCache) return providersCache;
  const aiOk = typeof Worker !== 'undefined' && typeof OffscreenCanvas !== 'undefined' && supportsWasmSimd();
  const list: CutoutProviderInfo[] = [
    {
      id: 'ai',
      label: 'On-device AI',
      description: 'Best for people, pets and products. Runs privately in your browser.',
      uploads: false,
      available: aiOk,
      unavailableReason: aiOk
        ? undefined
        : 'This browser can’t run the on-device model — try Chrome, Edge, Firefox or Safari 16.4+.',
    },
    {
      id: 'colour-key',
      label: 'Colour key',
      description: 'Instant. Best for plain, studio or screenshot backgrounds.',
      uploads: false,
      available: true,
    },
  ];
  const host = serverHost();
  if (host) {
    list.push({
      id: 'server',
      label: `Cloud (${host})`,
      description: `Sends this photo to ${host} for processing.`,
      uploads: true,
      available: true,
    });
  }
  providersCache = list;
  return list;
}

/* ───────────── Progress state ───────────── */

export interface CutoutJob {
  elementId: string;
  method: CutoutMethod;
  stage: 'prepare' | CutoutProgress['stage'] | 'upload';
  /** 0..1 for downloads, otherwise null (indeterminate). */
  progress: number | null;
}

export const useCutoutJob = create<{ job: CutoutJob | null; set: (job: CutoutJob | null) => void }>()((set) => ({
  job: null,
  set: (job) => set({ job }),
}));

/* ───────────── Running providers ───────────── */

export class CutoutError extends Error {
  constructor(readonly code: 'model-download' | 'unsupported' | 'failed' | 'missing' | 'server') {
    super(code);
    this.name = 'CutoutError';
  }
}

let client: WorkerClient<CutoutRequest, CutoutResult> | null = null;

function workerClient(): WorkerClient<CutoutRequest, CutoutResult> {
  client ??= createWorkerClient(() => new Worker('/workers/cutout.js', { type: 'module', name: 'cutout' }));
  return client;
}

async function localMask(method: LocalCutoutMethod, blob: Blob, onProgress: (p: CutoutProgress) => void): Promise<Pixels> {
  try {
    const image = await createImageBitmap(blob);
    const { mask } = await workerClient().call({ method, image, modelUrl: MODEL_URL, wasmUrl: ORT_WASM_URL }, [image], (p) =>
      onProgress(p as CutoutProgress),
    );
    return mask;
  } catch (err) {
    if (!(err instanceof WorkerCallError)) throw err;
    if (err.code === 'model-download' || err.code === 'unsupported') throw new CutoutError(err.code);
    if (err.code !== 'worker-crashed' && err.code !== 'worker-unavailable') throw new CutoutError('failed');
    client?.terminate();
    client = null;
    if (method === 'ai') throw new CutoutError('unsupported');
  }
  // Colour key still works on the main thread where module workers aren't supported.
  return colourKeyOnMainThread(await createImageBitmap(blob));
}

function colourKeyOnMainThread(image: ImageBitmap): Pixels {
  const s = Math.min(1, MASK_MAX / Math.max(image.width, image.height));
  const w = Math.max(1, Math.round(image.width * s));
  const h = Math.max(1, Math.round(image.height * s));
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
  ctx.drawImage(image, 0, 0, w, h);
  image.close();
  const data = ctx.getImageData(0, 0, w, h).data;
  const refined = guidedFilter(grayGuide(data, w * h), colourKeyMask(data, w, h), w, h, 3, 1e-3);
  const out = new Uint8ClampedArray(w * h * 4);
  for (let i = 0; i < w * h; i++) {
    const v = Math.round(refined[i]! * 255);
    out[i * 4] = v;
    out[i * 4 + 1] = v;
    out[i * 4 + 2] = v;
    out[i * 4 + 3] = 255;
  }
  return { data: out, width: w, height: h };
}

/** Optional self-hosted service: POST the photo, get back a PNG cut-out or mask. */
async function serverMask(blob: Blob): Promise<Pixels> {
  const form = new FormData();
  form.append('image', blob, 'photo');
  let res: Response;
  try {
    res = await fetch(SERVER_ENDPOINT, { method: 'POST', body: form, credentials: 'omit', referrerPolicy: 'no-referrer' });
  } catch {
    throw new CutoutError('server');
  }
  if (!res.ok) throw new CutoutError('server');
  const bitmap = await createImageBitmap(await res.blob()).catch(() => {
    throw new CutoutError('server');
  });
  const s = Math.min(1, MASK_MAX / Math.max(bitmap.width, bitmap.height));
  const w = Math.max(1, Math.round(bitmap.width * s));
  const h = Math.max(1, Math.round(bitmap.height * s));
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close();
  const data = ctx.getImageData(0, 0, w, h).data;
  // A transparent PNG is a cut-out (use its alpha); an opaque one is a mask (use its luminance).
  let transparent = false;
  for (let i = 3; i < data.length; i += 4) if (data[i]! < 250) transparent = true;
  const out = new Uint8ClampedArray(w * h * 4);
  for (let i = 0; i < w * h; i++) {
    const v = transparent
      ? data[i * 4 + 3]!
      : Math.round(data[i * 4]! * 0.299 + data[i * 4 + 1]! * 0.587 + data[i * 4 + 2]! * 0.114);
    out[i * 4] = v;
    out[i * 4 + 1] = v;
    out[i * 4 + 2] = v;
    out[i * 4 + 3] = 255;
  }
  return { data: out, width: w, height: h };
}

/**
 * Computes a mask for an image element and stores it as a local asset.
 * The element itself isn't changed — callers apply the returned cut-out.
 */
export async function computeCutout(el: ImageElement, method: CutoutMethod): Promise<Cutout> {
  if (!el.assetId) throw new CutoutError('missing');
  const setJob = useCutoutJob.getState().set;
  setJob({ elementId: el.id, method, stage: method === 'server' ? 'upload' : 'prepare', progress: null });
  try {
    const blob = await getAssetBlob(el.assetId, 'preview');
    if (!blob) throw new CutoutError('missing');
    let mask: Pixels;
    if (method === 'server') {
      mask = await serverMask(blob);
    } else {
      mask = await localMask(method, blob, (p) =>
        setJob({
          elementId: el.id,
          method,
          stage: p.stage,
          progress: p.stage === 'download' && p.total ? p.loaded / p.total : null,
        }),
      );
    }
    const canvas = document.createElement('canvas');
    canvas.width = mask.width;
    canvas.height = mask.height;
    canvas.getContext('2d')!.putImageData(new ImageData(new Uint8ClampedArray(mask.data), mask.width, mask.height), 0, 0);
    const meta = await saveGeneratedAsset('mask', canvas, 'Cut-out mask');
    // Seed the decode cache so the result shows without a round trip through IndexedDB.
    primeAsset(meta, 'preview', await createImageBitmap(canvas));
    return { maskAssetId: meta.id, feather: 8, backdrop: { type: 'none' }, method };
  } finally {
    setJob(null);
  }
}

export function describeCutoutError(err: unknown): { title: string; description: string } {
  const code = err instanceof CutoutError ? err.code : 'failed';
  switch (code) {
    case 'model-download':
      return {
        title: 'The on-device AI hasn’t been downloaded yet',
        description: 'Connect to the internet once so it can download (about 19 MB). After that it works offline.',
      };
    case 'unsupported':
      return {
        title: 'This browser can’t run the on-device AI',
        description: 'Try the Colour key method, or open Stardeck in a recent Chrome, Edge, Firefox or Safari.',
      };
    case 'server':
      return {
        title: 'The cloud service didn’t respond',
        description: 'Nothing was changed. Try again, or use an on-device method.',
      };
    case 'missing':
      return { title: 'That photo is no longer on this device', description: 'Replace it and try again.' };
    default:
      return { title: 'We couldn’t cut that one out', description: 'Try the other method, or a photo with a clearer subject.' };
  }
}
