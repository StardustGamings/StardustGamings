import { clamp } from '@/utils/math';
import { adjustPixel, applyMatrix, type PixelParams } from './adjustments';

/**
 * CPU implementation of the develop pipeline, used where WebGL is unavailable
 * (it runs inside a Web Worker) and by the unit tests. Same stages and maths
 * as the shader pipeline in gl.ts.
 */

export interface Pixels {
  data: Uint8ClampedArray;
  width: number;
  height: number;
}

export interface CpuDevelopInput {
  source: Pixels;
  params: PixelParams;
  lut: Uint8Array | null;
  warp: number[] | null;
  sharpen: number;
  blur: number;
  cutout: null | {
    mask: Pixels;
    feather: number;
    backdrop: { kind: 'none' } | { kind: 'image'; pixels: Pixels } | { kind: 'blur'; radius: number };
  };
}

/** Bilinear sample (straight alpha, clamped to edge) at pixel-space coordinates. */
function sample(src: Pixels, x: number, y: number, out: number[]): void {
  const { data, width, height } = src;
  const fx = clamp(x - 0.5, 0, width - 1);
  const fy = clamp(y - 0.5, 0, height - 1);
  const x0 = Math.floor(fx);
  const y0 = Math.floor(fy);
  const x1 = Math.min(width - 1, x0 + 1);
  const y1 = Math.min(height - 1, y0 + 1);
  const tx = fx - x0;
  const ty = fy - y0;
  for (let c = 0; c < 4; c++) {
    const a = data[(y0 * width + x0) * 4 + c]!;
    const b = data[(y0 * width + x1) * 4 + c]!;
    const d = data[(y1 * width + x0) * 4 + c]!;
    const e = data[(y1 * width + x1) * 4 + c]!;
    out[c] = (a * (1 - tx) + b * tx) * (1 - ty) + (d * (1 - tx) + e * tx) * ty;
  }
}

/** Resamples `src` to `width`×`height`, optionally through a uv warp. */
export function resample(src: Pixels, width: number, height: number, warp: number[] | null = null): Pixels {
  const data = new Uint8ClampedArray(width * height * 4);
  const px = [0, 0, 0, 0];
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let u = (x + 0.5) / width;
      let v = (y + 0.5) / height;
      if (warp) [u, v] = applyMatrix(warp, u, v);
      sample(src, u * src.width, v * src.height, px);
      const o = (y * width + x) * 4;
      data[o] = px[0]!;
      data[o + 1] = px[1]!;
      data[o + 2] = px[2]!;
      data[o + 3] = px[3]!;
    }
  }
  return { data, width, height };
}

/** Box sizes whose three successive passes approximate a Gaussian of `sigma`. */
function boxesForGauss(sigma: number, n = 3): number[] {
  const wIdeal = Math.sqrt((12 * sigma * sigma) / n + 1);
  let wl = Math.floor(wIdeal);
  if (wl % 2 === 0) wl--;
  const wu = wl + 2;
  const mIdeal = (12 * sigma * sigma - n * wl * wl - 4 * n * wl - 3 * n) / (-4 * wl - 4);
  const m = Math.round(mIdeal);
  return Array.from({ length: n }, (_, i) => (i < m ? wl : wu));
}

function boxPass(src: Float32Array, dst: Float32Array, w: number, h: number, r: number, horizontal: boolean) {
  const len = horizontal ? w : h;
  const lines = horizontal ? h : w;
  const scale = 1 / (2 * r + 1);
  for (let line = 0; line < lines; line++) {
    const idx = (i: number) => {
      const k = clamp(i, 0, len - 1);
      return (horizontal ? line * w + k : k * w + line) * 4;
    };
    for (let c = 0; c < 4; c++) {
      let acc = 0;
      for (let i = -r; i <= r; i++) acc += src[idx(i) + c]!;
      for (let i = 0; i < len; i++) {
        dst[idx(i) + c] = acc * scale;
        acc += src[idx(i + r + 1) + c]! - src[idx(i - r) + c]!;
      }
    }
  }
}

/** Gaussian-ish blur (3 box passes each way) on premultiplied colour. */
export function blurPixels(src: Pixels, radius: number): Pixels {
  const { width: w, height: h } = src;
  if (radius < 0.5) return src;
  const a = new Float32Array(w * h * 4);
  for (let i = 0; i < w * h; i++) {
    const al = src.data[i * 4 + 3]! / 255;
    a[i * 4] = src.data[i * 4]! * al;
    a[i * 4 + 1] = src.data[i * 4 + 1]! * al;
    a[i * 4 + 2] = src.data[i * 4 + 2]! * al;
    a[i * 4 + 3] = src.data[i * 4 + 3]!;
  }
  const b = new Float32Array(a.length);
  for (const size of boxesForGauss(radius / 2.5)) {
    const r = Math.max(0, (size - 1) / 2);
    boxPass(a, b, w, h, r, true);
    boxPass(b, a, w, h, r, false);
  }
  const data = new Uint8ClampedArray(w * h * 4);
  for (let i = 0; i < w * h; i++) {
    const al = a[i * 4 + 3]!;
    const k = al > 0.01 ? 255 / al : 0;
    data[i * 4] = a[i * 4]! * k;
    data[i * 4 + 1] = a[i * 4 + 1]! * k;
    data[i * 4 + 2] = a[i * 4 + 2]! * k;
    data[i * 4 + 3] = al;
  }
  return { data, width: w, height: h };
}

export function developCpu(input: CpuDevelopInput): Pixels {
  const { width, height } = input.source;
  let base = input.warp ? resample(input.source, width, height, input.warp) : input.source;
  if (input.blur > 0.5) base = blurPixels(base, input.blur);

  const out = new Uint8ClampedArray(width * height * 4);
  const src = base.data;
  const aspect = width / height;
  const k = input.sharpen * 1.5;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const o = (y * width + x) * 4;
      let r = src[o]! / 255;
      let g = src[o + 1]! / 255;
      let b = src[o + 2]! / 255;
      if (k > 0) {
        const at = (xx: number, yy: number, c: number) =>
          src[(clamp(yy, 0, height - 1) * width + clamp(xx, 0, width - 1)) * 4 + c]! / 255;
        const avg = (c: number) => (at(x, y - 1, c) + at(x, y + 1, c) + at(x - 1, y, c) + at(x + 1, y, c)) / 4;
        r = clamp(r + k * (r - avg(0)), 0, 1);
        g = clamp(g + k * (g - avg(1)), 0, 1);
        b = clamp(b + k * (b - avg(2)), 0, 1);
      }
      // Curves are applied before fade/vignette/grain, matching the shader order.
      const p = input.params;
      const pre = adjustPixel([r, g, b], { ...p, fade: 0, vignette: 0, grain: 0 }, 0, 0, 0, 0, aspect);
      let [rr, gg, bb] = pre;
      if (input.lut) {
        rr = input.lut[Math.round(rr * 255) * 4]! / 255;
        gg = input.lut[Math.round(gg * 255) * 4 + 1]! / 255;
        bb = input.lut[Math.round(bb * 255) * 4 + 2]! / 255;
      }
      const post = adjustPixel(
        [rr, gg, bb],
        {
          exposure: 0,
          brightness: 0,
          contrast: 0,
          highlights: 0,
          shadows: 0,
          temperature: 0,
          tint: 0,
          saturation: 0,
          vibrance: 0,
          fade: p.fade,
          vignette: p.vignette,
          grain: p.grain,
        },
        (x + 0.5) / width,
        (y + 0.5) / height,
        x % 257,
        y % 257,
        aspect,
      );
      out[o] = post[0] * 255;
      out[o + 1] = post[1] * 255;
      out[o + 2] = post[2] * 255;
      out[o + 3] = src[o + 3]!;
    }
  }
  const developed: Pixels = { data: out, width, height };
  if (!input.cutout) return developed;

  // Cut-out: warp + resize the mask to the output, feather it, then composite.
  let mask = resample(input.cutout.mask, width, height, input.warp);
  if (input.cutout.feather > 0.3) mask = blurPixels(mask, input.cutout.feather);
  const bd = input.cutout.backdrop;
  let backdrop: Pixels | null = null;
  if (bd.kind === 'image') backdrop = resample(bd.pixels, width, height);
  if (bd.kind === 'blur') {
    // Blur the background only (alpha = 1 − mask) so the subject doesn't halo, then make it opaque.
    const bg = new Uint8ClampedArray(out);
    for (let i = 0; i < width * height; i++) bg[i * 4 + 3] = (out[i * 4 + 3]! * (255 - mask.data[i * 4]!)) / 255;
    backdrop = blurPixels({ data: bg, width, height }, Math.max(1, bd.radius));
    for (let i = 0; i < width * height; i++) backdrop.data[i * 4 + 3] = 255;
  }
  const result = new Uint8ClampedArray(width * height * 4);
  for (let i = 0; i < width * height; i++) {
    const o = i * 4;
    const m = (mask.data[o]! / 255) * (out[o + 3]! / 255);
    let pr = out[o]! * m;
    let pg = out[o + 1]! * m;
    let pb = out[o + 2]! * m;
    let a = m;
    if (backdrop) {
      const ba = (backdrop.data[o + 3]! / 255) * (1 - m);
      pr += backdrop.data[o]! * ba;
      pg += backdrop.data[o + 1]! * ba;
      pb += backdrop.data[o + 2]! * ba;
      a += ba;
    }
    result[o] = a > 0 ? pr / a : 0;
    result[o + 1] = a > 0 ? pg / a : 0;
    result[o + 2] = a > 0 ? pb / a : 0;
    result[o + 3] = a * 255;
  }
  return { data: result, width, height };
}
