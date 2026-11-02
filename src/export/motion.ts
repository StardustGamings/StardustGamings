'use client';

import { ArrayBufferTarget, Muxer } from 'mp4-muxer';
import { applyPalette, GIFEncoder, quantize } from 'gifenc';
import type { DesignDocument, ImageElement } from '@/types/document';
import type { ImageResolver, ResolvedImage } from '@/canvas/render/types';
import { stripRegion } from '@/canvas/render/renderer';
import { ensureDocumentFonts } from '@/canvas/fonts';
import { drawFrame } from '@/animations/frame';
import { clipTime, frameAt, homeSlide, planSequence, type Sequence } from '@/animations/sequence';
import { getAssetBlob, getAssetMeta } from '@/assets/repository';
import { VideoFrames } from '@/assets/video';
import { needsDevelop } from '@/images/adjustments';
import { developForExport } from '@/images/develop';
import { prepareRegionImages } from './images';
import type { ExportQuality } from './plan';
import {
  MAX_GIF_MS,
  MAX_VIDEO_MS,
  MOTION_QUALITY,
  motionFileName,
  motionFps,
  motionSize,
  pickAudioCodec,
  pickVideoCodec,
  type CodecChoice,
  type MotionFormat,
} from './motion-plan';

export type { MotionFormat } from './motion-plan';

/**
 * Animated export: plays the design (slides in order, with their animations,
 * videos and transitions) frame by frame through the same renderer as the
 * editor, and encodes on this device — MP4 via the browser's WebCodecs encoder
 * (H.264 where available, otherwise VP9 / AV1), GIF via gifenc. Nothing is
 * uploaded and nothing is watermarked.
 */

export interface MotionOptions {
  format: MotionFormat;
  quality: ExportQuality;
  /** Slides to play, in order (default: all). */
  slides?: number[];
}

export interface MotionResult {
  file: File;
  width: number;
  height: number;
  /** ms. */
  duration: number;
  fps: number;
  /** Video codec used (MP4), e.g. "H.264". */
  codec: string | null;
  /** Sound: mixed in, none in the design, muted everywhere, or the browser can't encode it. */
  audio: 'included' | 'none' | 'unsupported';
}

export interface MotionProgress {
  done: number;
  total: number;
  label: string;
}

export class MotionExportError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'MotionExportError';
  }
}

/* ───────────── Audio ───────────── */

const SAMPLE_RATE = 48000;

function soundingVideos(doc: DesignDocument, seq: Sequence): { el: ImageElement; position: number }[] {
  const out: { el: ImageElement; position: number }[] = [];
  for (const el of doc.elements) {
    if (el.type !== 'image' || !el.video || el.video.muted || !el.assetId || el.hidden) continue;
    const position = seq.slides.indexOf(homeSlide(doc, el));
    if (position >= 0) out.push({ el, position });
  }
  return out;
}

/** Mixes the design's unmuted clips (trimmed, sped up or slowed, looped) into one track. */
async function mixAudio(doc: DesignDocument, seq: Sequence, signal?: AbortSignal): Promise<AudioBuffer | null> {
  const sources = soundingVideos(doc, seq);
  if (sources.length === 0 || typeof OfflineAudioContext === 'undefined') return null;
  const length = Math.max(1, Math.ceil((seq.total / 1000) * SAMPLE_RATE));
  const mix = new OfflineAudioContext(2, length, SAMPLE_RATE);
  const decoded = new Map<string, AudioBuffer | null>();
  let any = false;
  for (const { el, position } of sources) {
    signal?.throwIfAborted();
    const clip = el.video!;
    if (!decoded.has(el.assetId!)) {
      const blob = await getAssetBlob(el.assetId!, 'original');
      let buffer: AudioBuffer | null = null;
      if (blob) {
        try {
          buffer = await mix.decodeAudioData(await blob.arrayBuffer());
        } catch {
          buffer = null; // no audio track (or a codec this browser can't decode)
        }
      }
      decoded.set(el.assetId!, buffer);
    }
    const buffer = decoded.get(el.assetId!);
    if (!buffer) continue;
    const start = seq.starts[position]! / 1000;
    const end = start + seq.durations[position]! / 1000;
    const src = mix.createBufferSource();
    src.buffer = buffer;
    src.playbackRate.value = clip.speed;
    if (clip.loop) {
      src.loop = true;
      src.loopStart = clip.trimStart;
      src.loopEnd = Math.min(clip.trimEnd, buffer.duration);
    }
    src.connect(mix.destination);
    src.start(start, Math.min(clip.trimStart, buffer.duration));
    src.stop(clip.loop ? end : Math.min(end, start + (clip.trimEnd - clip.trimStart) / clip.speed));
    any = true;
  }
  return any ? mix.startRendering() : null;
}

async function encodeAudio(buffer: AudioBuffer, codec: string, muxer: Muxer<ArrayBufferTarget>): Promise<void> {
  let failure: unknown = null;
  const encoder = new AudioEncoder({
    output: (chunk, meta) => muxer.addAudioChunk(chunk, meta),
    error: (e) => (failure = e),
  });
  encoder.configure({ codec, sampleRate: SAMPLE_RATE, numberOfChannels: 2, bitrate: 128_000 });
  const left = buffer.getChannelData(0);
  const right = buffer.numberOfChannels > 1 ? buffer.getChannelData(1) : left;
  const step = 4800;
  for (let i = 0; i < buffer.length; i += step) {
    const n = Math.min(step, buffer.length - i);
    const data = new Float32Array(n * 2);
    data.set(left.subarray(i, i + n), 0);
    data.set(right.subarray(i, i + n), n);
    const frame = new AudioData({
      format: 'f32-planar',
      sampleRate: SAMPLE_RATE,
      numberOfFrames: n,
      numberOfChannels: 2,
      timestamp: Math.round((i / SAMPLE_RATE) * 1e6),
      data,
    });
    encoder.encode(frame);
    frame.close();
  }
  await encoder.flush();
  encoder.close();
  if (failure) throw failure;
}

/* ───────────── Video frames in the design ───────────── */

class VideoLayer {
  private sources = new Map<string, { frames: VideoFrames; el: ImageElement; width: number; height: number }>();
  private current = new Map<string, ResolvedImage>();
  private owned: HTMLCanvasElement[] = [];

  async open(doc: DesignDocument, seq: Sequence, scale: number): Promise<void> {
    for (const el of doc.elements) {
      if (el.type !== 'image' || !el.video || !el.assetId || el.hidden) continue;
      if (!seq.slides.includes(homeSlide(doc, el))) continue;
      const meta = await getAssetMeta(el.assetId);
      if (!meta) continue;
      const needed = Math.max(el.width, el.height) * scale * Math.max(1, el.zoom ?? 1);
      const frames = new VideoFrames(el.assetId, Math.min(1920, Math.max(256, Math.ceil(needed))));
      if (await frames.open().catch(() => false)) this.sources.set(el.id, { frames, el, width: meta.width, height: meta.height });
    }
  }

  /** Seeks every clip on screen to its frame for this moment. */
  async prepare(doc: DesignDocument, times: Map<number, number>): Promise<void> {
    this.owned.forEach((c) => {
      c.width = 0;
      c.height = 0;
    });
    this.owned = [];
    for (const [id, s] of this.sources) {
      const t = times.get(homeSlide(doc, s.el));
      if (t === undefined) continue;
      const canvas = await s.frames.frame(clipTime(s.el.video!, t));
      let source: ResolvedImage['source'] = canvas;
      if (needsDevelop(s.el)) {
        const developed = await developForExport(s.el, { image: canvas, meta: (await getAssetMeta(s.el.assetId!))! }, null, null);
        if (developed) {
          source = developed.image;
          if (developed.image instanceof HTMLCanvasElement) this.owned.push(developed.image);
        }
      }
      this.current.set(id, { source, width: s.width, height: s.height, alpha: false });
    }
  }

  get(id: string): ResolvedImage | undefined {
    return this.current.get(id);
  }

  close(): void {
    for (const s of this.sources.values()) s.frames.close();
    this.owned.forEach((c) => {
      c.width = 0;
      c.height = 0;
    });
    this.sources.clear();
    this.current.clear();
  }
}

/* ───────────── Export ───────────── */

export async function exportMotion(
  source: { doc: DesignDocument; name: string },
  options: MotionOptions,
  hooks: { onProgress?: (p: MotionProgress) => void; signal?: AbortSignal } = {},
): Promise<MotionResult> {
  const { doc, name } = source;
  const { signal, onProgress } = hooks;
  const seq = planSequence(doc, options.slides);
  if (seq.total <= 0) throw new MotionExportError('Nothing to play — add a slide first.');
  if (options.format === 'gif' && seq.total > MAX_GIF_MS) {
    throw new MotionExportError('GIFs are limited to 30 seconds (they get huge). Export an MP4, or pick fewer slides.');
  }
  if (seq.total > MAX_VIDEO_MS) throw new MotionExportError('Videos are limited to 10 minutes.');

  const { width, height, scale } = motionSize(doc, options.format, options.quality);
  const fps = motionFps(options.format, options.quality);
  const frameCount = Math.max(1, Math.round((seq.total / 1000) * fps));
  const bitrate = Math.round(Math.min(40e6, Math.max(2e6, width * height * fps * MOTION_QUALITY[options.quality].bits)));

  let codec: CodecChoice | null = null;
  if (options.format === 'mp4') {
    codec = await pickVideoCodec(width, height, bitrate, fps);
    if (!codec) {
      throw new MotionExportError(
        'This browser can’t make MP4 videos. Try Chrome, Edge or Safari — or export a GIF, which works everywhere.',
      );
    }
  }

  onProgress?.({ done: 0, total: frameCount, label: 'Loading fonts, photos and videos…' });
  await ensureDocumentFonts(doc);
  const images = await prepareRegionImages(doc, stripRegion(doc), scale, options.quality === 'max', signal);
  const videos = new VideoLayer();
  await videos.open(doc, seq, scale);
  const resolve: ImageResolver = (el, px) => (el.video ? (videos.get(el.id) ?? images.resolve(el, px)) : images.resolve(el, px));

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d', { willReadFrequently: options.format === 'gif' });
  if (!ctx) throw new MotionExportError('This browser couldn’t create a canvas that large.');
  ctx.imageSmoothingQuality = 'high';
  const drawScale = width / doc.slideWidth;

  try {
    if (options.format === 'gif') {
      const gif = GIFEncoder();
      const delay = 1000 / fps;
      for (let i = 0; i < frameCount; i++) {
        signal?.throwIfAborted();
        const g = (i * 1000) / fps;
        await videos.prepare(doc, new Map(frameAt(seq, g).map((f) => [f.slide, f.t])));
        drawFrame(ctx, doc, seq, g, { scale: drawScale, images: resolve, placeholders: false });
        const { data } = ctx.getImageData(0, 0, width, height);
        const palette = quantize(data, 256);
        gif.writeFrame(applyPalette(data, palette), width, height, { palette, delay });
        if (i % 3 === 0) {
          onProgress?.({ done: i, total: frameCount, label: `Rendering frame ${i + 1} of ${frameCount}…` });
          await new Promise((r) => setTimeout(r, 0));
        }
      }
      gif.finish();
      const bytes = gif.bytes();
      const file = new File([bytes.slice().buffer as ArrayBuffer], motionFileName(name, 'gif', options.slides, doc), {
        type: 'image/gif',
      });
      return { file, width, height, duration: seq.total, fps, codec: null, audio: 'none' };
    }

    // MP4: sound first (the muxer needs to know about the track up front).
    onProgress?.({ done: 0, total: frameCount, label: 'Mixing sound…' });
    const sounding = soundingVideos(doc, seq).length > 0;
    const audioCodec = sounding ? await pickAudioCodec() : null;
    const audio = sounding && audioCodec ? await mixAudio(doc, seq, signal).catch(() => null) : null;
    const muxer = new Muxer({
      target: new ArrayBufferTarget(),
      video: { codec: codec!.mux, width, height, frameRate: fps },
      ...(audio && audioCodec ? { audio: { codec: audioCodec.mux, sampleRate: SAMPLE_RATE, numberOfChannels: 2 } } : {}),
      fastStart: 'in-memory',
      firstTimestampBehavior: 'offset',
    });
    let failure: unknown = null;
    const encoder = new VideoEncoder({
      output: (chunk, meta) => muxer.addVideoChunk(chunk, meta),
      error: (e) => (failure = e),
    });
    encoder.configure({ codec: codec!.codec, width, height, bitrate, framerate: fps, latencyMode: 'quality' });
    for (let i = 0; i < frameCount; i++) {
      signal?.throwIfAborted();
      if (failure) throw failure;
      const g = (i * 1000) / fps;
      await videos.prepare(doc, new Map(frameAt(seq, g).map((f) => [f.slide, f.t])));
      drawFrame(ctx, doc, seq, g, { scale: drawScale, images: resolve, placeholders: false });
      const frame = new VideoFrame(canvas, { timestamp: Math.round((i * 1e6) / fps), duration: Math.round(1e6 / fps) });
      encoder.encode(frame, { keyFrame: i % (fps * 2) === 0 });
      frame.close();
      // Keep memory flat: let the encoder catch up.
      while (encoder.encodeQueueSize > 6) await new Promise((r) => setTimeout(r, 4));
      if (i % 3 === 0) {
        onProgress?.({ done: i, total: frameCount, label: `Rendering frame ${i + 1} of ${frameCount}…` });
        await new Promise((r) => setTimeout(r, 0));
      }
    }
    onProgress?.({ done: frameCount, total: frameCount, label: 'Finishing the video…' });
    await encoder.flush();
    encoder.close();
    if (failure) throw failure;
    if (audio && audioCodec) await encodeAudio(audio, audioCodec.codec, muxer);
    muxer.finalize();
    const file = new File([muxer.target.buffer], motionFileName(name, 'mp4', options.slides, doc), { type: 'video/mp4' });
    return {
      file,
      width,
      height,
      duration: seq.total,
      fps,
      codec: codec!.label,
      audio: audio ? 'included' : sounding ? 'unsupported' : 'none',
    };
  } catch (e) {
    if (e instanceof MotionExportError || (e instanceof DOMException && e.name === 'AbortError')) throw e;
    throw new MotionExportError('Something went wrong while making the video. Try a lower quality, or fewer slides.');
  } finally {
    images.dispose();
    videos.close();
    canvas.width = 0;
    canvas.height = 0;
  }
}
