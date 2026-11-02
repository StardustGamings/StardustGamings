/** Minimal types for gifenc (MIT) — the small, fast GIF encoder used for GIF export. */
declare module 'gifenc' {
  export type Palette = number[][];
  export interface GifFrameOptions {
    palette?: Palette;
    /** ms. */
    delay?: number;
    /** -1 = play once, 0 = loop forever. */
    repeat?: number;
    transparent?: boolean;
    transparentIndex?: number;
    first?: boolean;
    dispose?: number;
  }
  export interface Encoder {
    writeFrame(index: Uint8Array, width: number, height: number, opts?: GifFrameOptions): void;
    finish(): void;
    bytes(): Uint8Array;
    bytesView(): Uint8Array;
    reset(): void;
  }
  export function GIFEncoder(opts?: { initialCapacity?: number; auto?: boolean }): Encoder;
  export function quantize(
    rgba: Uint8Array | Uint8ClampedArray,
    maxColors: number,
    opts?: { format?: 'rgb565' | 'rgb444' | 'rgba4444'; oneBitAlpha?: boolean | number; clearAlpha?: boolean },
  ): Palette;
  export function applyPalette(
    rgba: Uint8Array | Uint8ClampedArray,
    palette: Palette,
    format?: 'rgb565' | 'rgb444' | 'rgba4444',
  ): Uint8Array;
}
