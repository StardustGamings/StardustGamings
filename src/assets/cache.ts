import type { DrawableImage } from '@/canvas/render/types';
import { budgetBytes } from '@/utils/memory';
import { getAssetBlob, getAssetMeta } from './repository';
import type { AssetMeta, AssetVariant } from './types';

/**
 * Decoded photos kept in memory for drawing. Lookups are synchronous (the
 * renderer is synchronous): a miss starts loading in the background and
 * listeners are notified when it lands, so views simply redraw.
 *
 * Memory is bounded: least-recently-used bitmaps are released past the budget.
 */

export interface LoadedAsset {
  image: DrawableImage;
  meta: AssetMeta;
}

type Entry =
  | { state: 'loading'; promise: Promise<LoadedAsset | null> }
  | { state: 'ready'; asset: LoadedAsset; bytes: number; used: number }
  | { state: 'missing' };

const BUDGET_BYTES = budgetBytes({ low: 96, normal: 160, high: 320 });
const entries = new Map<string, Entry>();
const listeners = new Set<() => void>();
let version = 0;
let totalBytes = 0;
let clock = 0;
let notifyQueued = false;

const key = (id: string, variant: AssetVariant) => `${id}/${variant}`;

function notify() {
  version++;
  if (notifyQueued) return;
  notifyQueued = true;
  // Batch bursts of loads (e.g. opening a design with 20 photos) into one redraw.
  queueMicrotask(() => {
    notifyQueued = false;
    listeners.forEach((l) => l());
  });
}

export function subscribeAssets(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Bumps whenever a photo finishes loading (or an asset is invalidated). */
export function assetsVersion(): number {
  return version;
}

function release(image: DrawableImage) {
  if (typeof ImageBitmap !== 'undefined' && image instanceof ImageBitmap) image.close();
}

function evict() {
  if (totalBytes <= BUDGET_BYTES) return;
  const ready = [...entries.entries()]
    .filter((e): e is [string, Extract<Entry, { state: 'ready' }>] => e[1].state === 'ready')
    .sort((a, b) => a[1].used - b[1].used);
  for (const [k, e] of ready) {
    if (totalBytes <= BUDGET_BYTES * 0.8) break;
    entries.delete(k);
    totalBytes -= e.bytes;
    release(e.asset.image);
  }
}

async function decode(blob: Blob): Promise<DrawableImage> {
  if (typeof createImageBitmap !== 'undefined') {
    try {
      return await createImageBitmap(blob);
    } catch {
      /* fall through to <img> (older Safari can't make bitmaps from some blobs) */
    }
  }
  const url = URL.createObjectURL(blob);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    return img as DrawableImage;
  } finally {
    URL.revokeObjectURL(url);
  }
}

async function load(id: string, variant: AssetVariant): Promise<LoadedAsset | null> {
  try {
    const [meta, blob] = await Promise.all([getAssetMeta(id), getAssetBlob(id, variant)]);
    if (!meta || !blob) return null;
    return { image: await decode(blob), meta };
  } catch {
    return null;
  }
}

function start(id: string, variant: AssetVariant): Promise<LoadedAsset | null> {
  const k = key(id, variant);
  const promise = load(id, variant).then((asset) => {
    // The entry may have been invalidated while loading.
    if (entries.get(k)?.state !== 'loading') {
      if (asset) release(asset.image);
      return asset;
    }
    if (asset) {
      const bytes = asset.image.width * asset.image.height * 4;
      entries.set(k, { state: 'ready', asset, bytes, used: ++clock });
      totalBytes += bytes;
      evict();
    } else {
      entries.set(k, { state: 'missing' });
    }
    notify();
    return asset;
  });
  entries.set(k, { state: 'loading', promise });
  return promise;
}

/**
 * The decoded asset if it's in memory; `undefined` while loading (loading is
 * started on first request) and `null` if it doesn't exist.
 */
export function peekAsset(id: string, variant: AssetVariant, options: { load?: boolean } = {}): LoadedAsset | null | undefined {
  const e = entries.get(key(id, variant));
  if (e?.state === 'ready') {
    e.used = ++clock;
    return e.asset;
  }
  if (e?.state === 'missing') return null;
  if (!e && options.load !== false) void start(id, variant);
  return undefined;
}

export function loadAsset(id: string, variant: AssetVariant): Promise<LoadedAsset | null> {
  const e = entries.get(key(id, variant));
  if (e?.state === 'ready') return Promise.resolve(e.asset);
  if (e?.state === 'missing') return Promise.resolve(null);
  if (e?.state === 'loading') return e.promise;
  return start(id, variant);
}

/** Loads every asset in `ids`; resolves `true` if anything new became available. */
export async function ensureAssets(ids: Iterable<string>, variant: AssetVariant): Promise<boolean> {
  const before = version;
  await Promise.all([...ids].map((id) => loadAsset(id, variant)));
  return version !== before;
}

/** Drops cached decodes of an asset (after it's deleted or replaced). */
export function invalidateAsset(id: string): void {
  let changed = false;
  for (const [k, e] of entries) {
    if (!k.startsWith(`${id}/`)) continue;
    entries.delete(k);
    if (e.state === 'ready') {
      totalBytes -= e.bytes;
      release(e.asset.image);
    }
    changed = true;
  }
  if (changed) notify();
}

/** Seeds the cache with an image we already have decoded (e.g. right after import). */
export function primeAsset(meta: AssetMeta, variant: AssetVariant, image: DrawableImage): void {
  const k = key(meta.id, variant);
  const prev = entries.get(k);
  if (prev?.state === 'ready') {
    totalBytes -= prev.bytes;
    release(prev.asset.image);
  }
  const bytes = image.width * image.height * 4;
  entries.set(k, { state: 'ready', asset: { image, meta }, bytes, used: ++clock });
  totalBytes += bytes;
  evict();
  notify();
}

/** Tells views to redraw because derived image data changed (e.g. a developed photo landed). */
export function markAssetsChanged(): void {
  notify();
}
