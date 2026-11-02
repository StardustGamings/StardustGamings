import type { ImageElement } from '@/types/document';
import { getStorage } from '@/storage/db';
import { notify } from '@/storage/sync';
import { createId } from '@/utils/id';
import { fitWithin, ImportError, sha256Hex } from './process-core';
import { cleanFileName, sniffVideoFormat, VIDEO_MIME } from './sniff';
import { MAX_VIDEO_BYTES, MAX_VIDEO_SECONDS, PREVIEW_MAX, THUMB_MAX, type AssetMeta } from './types';

/**
 * Short video clips in designs. A video asset stores the original file plus
 * poster frames as its `preview` / `thumb` variants, so everything built for
 * photos (library, crop, frames, thumbnails, project files) works with videos.
 * Frames are decoded by the browser's own <video> element — nothing leaves the
 * device.
 */

const SAMPLE = 4 * 1024 * 1024;

/**
 * Content hash for de-duplication. Big files hash their size plus the first and
 * last 4 MB (hashing hundreds of MB would stall phones); small ones hash fully.
 */
export async function assetHash(blob: Blob): Promise<string> {
  if (blob.size <= SAMPLE * 8) return sha256Hex(await blob.arrayBuffer());
  const head = new Uint8Array(await blob.slice(0, SAMPLE).arrayBuffer());
  const tail = new Uint8Array(await blob.slice(blob.size - SAMPLE).arrayBuffer());
  const size = new TextEncoder().encode(`size:${blob.size}`);
  const all = new Uint8Array(size.length + head.length + tail.length);
  all.set(size);
  all.set(head, size.length);
  all.set(tail, size.length + head.length);
  return `s-${await sha256Hex(all.buffer)}`;
}

function once(target: EventTarget, events: string[], timeout: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const done = (e: Event) => {
      cleanup();
      if (e.type === 'error') reject(new ImportError('video-unplayable'));
      else resolve(e.type);
    };
    const timer = setTimeout(() => {
      cleanup();
      reject(new ImportError('video-unplayable'));
    }, timeout);
    const cleanup = () => {
      clearTimeout(timer);
      for (const ev of [...events, 'error']) target.removeEventListener(ev, done);
    };
    for (const ev of [...events, 'error']) target.addEventListener(ev, done);
  });
}

export function createVideo(url: string): HTMLVideoElement {
  const v = document.createElement('video');
  v.muted = true;
  v.playsInline = true;
  v.preload = 'auto';
  v.crossOrigin = 'anonymous';
  v.src = url;
  return v;
}

/**
 * Recordings made by browsers (MediaRecorder WebM) don't store their length, so
 * `duration` reads Infinity until the file has been scanned: seek far past the
 * end to make the browser work it out.
 */
async function resolveDuration(v: HTMLVideoElement): Promise<void> {
  if (Number.isFinite(v.duration)) return;
  const done = once(v, ['durationchange', 'seeked'], 8000).catch(() => undefined);
  v.currentTime = 1e7;
  await done;
  if (!Number.isFinite(v.duration)) await once(v, ['durationchange'], 4000).catch(() => undefined);
  const back = once(v, ['seeked'], 8000).catch(() => undefined);
  v.currentTime = 0;
  await back;
}

/** Seeks and waits until the frame at `seconds` can be drawn. */
export async function seekVideo(v: HTMLVideoElement, seconds: number, timeout = 8000): Promise<void> {
  const target = Math.max(0, Math.min(seconds, (v.duration || seconds) - 0.001));
  if (Math.abs(v.currentTime - target) < 0.0005 && v.readyState >= 2) return;
  const wait = once(v, ['seeked'], timeout);
  v.currentTime = target;
  await wait;
  // Some browsers fire `seeked` a moment before the frame is decoded.
  if (v.readyState < 2) await once(v, ['loadeddata', 'canplay'], timeout).catch(() => undefined);
}

function frameBlob(v: HTMLVideoElement, max: number, quality: number): Promise<{ blob: Blob; width: number; height: number }> {
  const { width, height } = fitWithin(v.videoWidth, v.videoHeight, max);
  const c = document.createElement('canvas');
  c.width = width;
  c.height = height;
  const ctx = c.getContext('2d')!;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(v, 0, 0, width, height);
  return new Promise((resolve, reject) =>
    c.toBlob((b) => (b ? resolve({ blob: b, width, height }) : reject(new ImportError('decode'))), 'image/jpeg', quality),
  );
}

export interface VideoImport {
  meta: AssetMeta;
  reused: boolean;
}

export async function importVideoFile(file: Blob & { name?: string }): Promise<VideoImport> {
  if (file.size === 0) throw new ImportError('empty');
  if (file.size > MAX_VIDEO_BYTES) throw new ImportError('video-too-long');
  const format = sniffVideoFormat(new Uint8Array(await file.slice(0, 64).arrayBuffer()));
  if (!format) throw new ImportError('unsupported');

  const storage = await getStorage();
  const hash = await assetHash(file);
  const existing = (await storage.findAssetByHash(hash)).find((a) => a.kind === 'video');
  if (existing) return { meta: existing, reused: true };

  const mime = VIDEO_MIME[format];
  const typed = file.type === mime ? file : new Blob([file], { type: mime });
  const url = URL.createObjectURL(typed);
  const v = createVideo(url);
  try {
    await once(v, ['loadeddata'], 20_000);
    await resolveDuration(v);
    if (!v.videoWidth || !v.videoHeight || !Number.isFinite(v.duration)) throw new ImportError('video-unplayable');
    if (v.duration > MAX_VIDEO_SECONDS + 0.5) throw new ImportError('video-too-long');
    await seekVideo(v, Math.min(0.1, v.duration / 2));
    const preview = await frameBlob(v, PREVIEW_MAX, 0.9);
    const thumb = await frameBlob(v, THUMB_MAX, 0.85);
    const meta: AssetMeta = {
      id: createId('as'),
      kind: 'video',
      name: cleanFileName(file.name ?? 'Video'),
      mime,
      width: v.videoWidth,
      height: v.videoHeight,
      previewWidth: preview.width,
      previewHeight: preview.height,
      bytes: typed.size + preview.blob.size + thumb.blob.size,
      createdAt: Date.now(),
      hash,
      hasAlpha: false,
      palette: [],
      duration: v.duration,
    };
    try {
      await storage.putAsset(meta, { original: typed, preview: preview.blob, thumb: thumb.blob });
    } catch {
      throw new ImportError('storage');
    }
    notify({ type: 'assets' });
    return { meta, reused: false };
  } finally {
    v.removeAttribute('src');
    v.load();
    URL.revokeObjectURL(url);
  }
}

/* ───────────── Live playback in the editor ───────────── */

const urls = new Map<string, Promise<string | null>>();

async function objectUrl(assetId: string): Promise<string | null> {
  let p = urls.get(assetId);
  if (!p) {
    p = (async () => {
      const blob = await (await getStorage()).getAssetBlob(assetId, 'original');
      return blob ? URL.createObjectURL(blob) : null;
    })();
    urls.set(assetId, p);
  }
  return p;
}

interface Player {
  video: HTMLVideoElement;
  assetId: string;
  used: number;
}

const players = new Map<string, Player>();
let clock = 0;
const MAX_PLAYERS = 6;
let onFrame: (() => void) | null = null;

/** Called whenever a video has a new frame to show (the editor redraws). */
export function setVideoFrameListener(listener: (() => void) | null): void {
  onFrame = listener;
}

function player(el: ImageElement): Player | null {
  if (!el.assetId || typeof document === 'undefined') return null;
  let p = players.get(el.id);
  if (p && p.assetId !== el.assetId) {
    releasePlayer(el.id);
    p = undefined;
  }
  if (!p) {
    const video = document.createElement('video');
    video.muted = true;
    video.playsInline = true;
    video.preload = 'auto';
    const created: Player = { video, assetId: el.assetId, used: ++clock };
    players.set(el.id, created);
    void objectUrl(el.assetId).then((url) => {
      if (url && players.get(el.id) === created) video.src = url;
    });
    for (const ev of ['loadeddata', 'seeked', 'timeupdate']) video.addEventListener(ev, () => onFrame?.());
    p = created;
    if (players.size > MAX_PLAYERS) {
      const oldest = [...players.entries()].sort((a, b) => a[1].used - b[1].used)[0];
      if (oldest && oldest[0] !== el.id) releasePlayer(oldest[0]);
    }
  }
  p.used = ++clock;
  return p;
}

function releasePlayer(id: string) {
  const p = players.get(id);
  if (!p) return;
  p.video.pause();
  p.video.removeAttribute('src');
  p.video.load();
  players.delete(id);
}

/** Stops and frees every editor player (editor closed). */
export function releaseAllPlayers(): void {
  for (const id of [...players.keys()]) releasePlayer(id);
}

/**
 * The drawable frame for an element at `seconds` into its source, for live
 * preview. `live` keeps the video playing (smooth) and only re-seeks when it
 * drifts; otherwise it seeks precisely (scrubbing). Returns null until a frame
 * is ready (the caller shows the poster meanwhile).
 */
export function liveFrame(el: ImageElement, seconds: number, live: boolean): HTMLVideoElement | null {
  const p = player(el);
  if (!p || !el.video) return null;
  const v = p.video;
  if (v.readyState < 1) return null;
  const drift = Math.abs(v.currentTime - seconds);
  if (live) {
    v.playbackRate = el.video.speed;
    v.muted = el.video.muted;
    if (v.paused) void v.play().catch(() => (v.muted = true));
    if (drift > 0.25) v.currentTime = seconds;
  } else {
    if (!v.paused) v.pause();
    if (drift > 0.02 && !v.seeking) v.currentTime = seconds;
  }
  return v.readyState >= 2 ? v : null;
}

/** Pauses all live players (preview paused or stopped). */
export function pauseAllPlayers(): void {
  for (const p of players.values()) if (!p.video.paused) p.video.pause();
}

/* ───────────── Exact frames for export ───────────── */

/**
 * Frame-accurate source for one video element during export: seeks to each
 * requested time and copies the frame into a canvas the renderer can draw.
 */
export class VideoFrames {
  private video: HTMLVideoElement | null = null;
  private url: string | null = null;
  readonly canvas: HTMLCanvasElement;

  constructor(
    readonly assetId: string,
    private readonly maxSize: number,
  ) {
    this.canvas = document.createElement('canvas');
  }

  async open(): Promise<boolean> {
    const blob = await (await getStorage()).getAssetBlob(this.assetId, 'original');
    if (!blob) return false;
    this.url = URL.createObjectURL(blob);
    this.video = createVideo(this.url);
    await once(this.video, ['loadeddata'], 20_000);
    const { width, height } = fitWithin(this.video.videoWidth, this.video.videoHeight, this.maxSize);
    this.canvas.width = width;
    this.canvas.height = height;
    return true;
  }

  /** Draws the frame at `seconds` into `canvas`. */
  async frame(seconds: number): Promise<HTMLCanvasElement> {
    if (!this.video) throw new Error('Video not open');
    await seekVideo(this.video, seconds);
    const ctx = this.canvas.getContext('2d')!;
    ctx.drawImage(this.video, 0, 0, this.canvas.width, this.canvas.height);
    return this.canvas;
  }

  close(): void {
    if (this.video) {
      this.video.removeAttribute('src');
      this.video.load();
    }
    if (this.url) URL.revokeObjectURL(this.url);
    this.video = null;
    this.url = null;
    this.canvas.width = 0;
    this.canvas.height = 0;
  }
}
