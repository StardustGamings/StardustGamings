import type { Pixels } from '../develop-cpu';

export type LocalCutoutMethod = 'ai' | 'colour-key';
export type CutoutMethod = LocalCutoutMethod | 'server';

export interface CutoutRequest {
  method: LocalCutoutMethod;
  image: ImageBitmap;
  /** Colour key: extra tolerance -1..1. */
  tolerance?: number;
  modelUrl: string;
  /** URL of the ONNX Runtime .wasm binary. */
  wasmUrl: string;
}

export interface CutoutResult {
  /** Grayscale mask as RGBA (r = g = b = alpha, a = 255). */
  mask: Pixels;
}

export type CutoutProgress = { stage: 'download'; loaded: number; total: number } | { stage: 'analyse' } | { stage: 'refine' };

/** Longest edge the mask is computed at (it's upscaled smoothly when drawn). */
export const MASK_MAX = 1024;
/** U²-Netp input resolution. */
export const MODEL_SIZE = 320;
