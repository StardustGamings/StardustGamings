import type { DesignDocument } from '@/types/document';
import { fileStem, type ExportQuality } from './plan';

/**
 * Sizes, frame rates, names and browser capabilities for animated export —
 * kept apart from the encoder (./motion) so the Export dialog stays light and
 * the encoding libraries load only when a video is actually made.
 */

export type MotionFormat = 'mp4' | 'gif';

export const MOTION_QUALITY: Record<
  ExportQuality,
  { edge: number; scale: number; bits: number; gifEdge: number; gifFps: number }
> = {
  standard: { edge: 1920, scale: 1, bits: 0.09, gifEdge: 480, gifFps: 15 },
  high: { edge: 2560, scale: 1.5, bits: 0.12, gifEdge: 720, gifFps: 20 },
  max: { edge: 3840, scale: 2, bits: 0.16, gifEdge: 1080, gifFps: 24 },
};

export const MP4_FPS = 30;
/** GIFs get huge; longer designs should go out as MP4. */
export const MAX_GIF_MS = 30_000;
export const MAX_VIDEO_MS = 10 * 60_000;

const even = (v: number) => Math.max(2, Math.floor(v / 2) * 2);

/** Output size in pixels for a format and quality. */
export function motionSize(
  doc: DesignDocument,
  format: MotionFormat,
  quality: ExportQuality,
): { width: number; height: number; scale: number } {
  const q = MOTION_QUALITY[quality];
  const long = Math.max(doc.slideWidth, doc.slideHeight);
  const scale = format === 'gif' ? Math.min(1, q.gifEdge / long) : Math.min(q.scale, q.edge / long);
  return { width: even(doc.slideWidth * scale), height: even(doc.slideHeight * scale), scale };
}

export const motionFps = (format: MotionFormat, quality: ExportQuality) =>
  format === 'gif' ? MOTION_QUALITY[quality].gifFps : MP4_FPS;

export function motionFileName(name: string, format: MotionFormat, slides: number[] | undefined, doc: DesignDocument): string {
  const stem = fileStem(name);
  const suffix = slides && slides.length === 1 && doc.slides.length > 1 ? `-${String(slides[0]! + 1).padStart(2, '0')}` : '';
  return `${stem}${suffix}.${format}`;
}

/* ───────────── Capabilities ───────────── */

export interface CodecChoice {
  codec: string;
  mux: 'avc' | 'vp9' | 'av1';
  label: string;
}

const VIDEO_CODECS: CodecChoice[] = [
  { codec: 'avc1.640033', mux: 'avc', label: 'H.264' },
  { codec: 'avc1.640028', mux: 'avc', label: 'H.264' },
  { codec: 'avc1.4d0033', mux: 'avc', label: 'H.264' },
  { codec: 'avc1.42e033', mux: 'avc', label: 'H.264' },
  { codec: 'avc1.42001f', mux: 'avc', label: 'H.264' },
  { codec: 'vp09.00.40.08', mux: 'vp9', label: 'VP9' },
  { codec: 'vp09.00.10.08', mux: 'vp9', label: 'VP9' },
  { codec: 'av01.0.08M.08', mux: 'av1', label: 'AV1' },
  { codec: 'av01.0.04M.08', mux: 'av1', label: 'AV1' },
];

export async function pickVideoCodec(width: number, height: number, bitrate: number, fps: number): Promise<CodecChoice | null> {
  if (typeof VideoEncoder === 'undefined') return null;
  for (const c of VIDEO_CODECS) {
    try {
      const { supported } = await VideoEncoder.isConfigSupported({ codec: c.codec, width, height, bitrate, framerate: fps });
      if (supported) return c;
    } catch {
      /* try the next one */
    }
  }
  return null;
}

export async function pickAudioCodec(): Promise<{ codec: string; mux: 'aac' | 'opus' } | null> {
  if (typeof AudioEncoder === 'undefined') return null;
  for (const c of [
    { codec: 'mp4a.40.2', mux: 'aac' as const },
    { codec: 'opus', mux: 'opus' as const },
  ]) {
    try {
      const { supported } = await AudioEncoder.isConfigSupported({
        codec: c.codec,
        sampleRate: 48000,
        numberOfChannels: 2,
        bitrate: 128000,
      });
      if (supported) return c;
    } catch {
      /* next */
    }
  }
  return null;
}

/** Whether this browser can make MP4s at all (checked at a common size). */
export async function canExportMp4(): Promise<boolean> {
  return (await pickVideoCodec(1080, 1350, 6_000_000, 30)) !== null;
}
