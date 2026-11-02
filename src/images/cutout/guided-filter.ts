/**
 * Guided filter (He et al.) — snaps a rough mask to the photo's real edges
 * (hair, fur, product outlines) using the photo itself as the guide. O(n) via
 * box filters on integral images, so it's fast even at 1–2 MP.
 */

function boxFilter(src: Float32Array, w: number, h: number, r: number): Float32Array {
  const integral = new Float64Array((w + 1) * (h + 1));
  for (let y = 0; y < h; y++) {
    let row = 0;
    for (let x = 0; x < w; x++) {
      row += src[y * w + x]!;
      integral[(y + 1) * (w + 1) + x + 1] = integral[y * (w + 1) + x + 1]! + row;
    }
  }
  const out = new Float32Array(w * h);
  for (let y = 0; y < h; y++) {
    const y0 = Math.max(0, y - r);
    const y1 = Math.min(h - 1, y + r) + 1;
    for (let x = 0; x < w; x++) {
      const x0 = Math.max(0, x - r);
      const x1 = Math.min(w - 1, x + r) + 1;
      const sum =
        integral[y1 * (w + 1) + x1]! - integral[y0 * (w + 1) + x1]! - integral[y1 * (w + 1) + x0]! + integral[y0 * (w + 1) + x0]!;
      out[y * w + x] = sum / ((x1 - x0) * (y1 - y0));
    }
  }
  return out;
}

/** Luminance guide (0..1) from RGBA pixels. */
export function grayGuide(data: Uint8ClampedArray, count: number): Float32Array {
  const g = new Float32Array(count);
  for (let i = 0; i < count; i++) g[i] = (data[i * 4]! * 0.299 + data[i * 4 + 1]! * 0.587 + data[i * 4 + 2]! * 0.114) / 255;
  return g;
}

export function guidedFilter(
  guide: Float32Array,
  input: Float32Array,
  w: number,
  h: number,
  r: number,
  eps: number,
): Float32Array {
  const n = w * h;
  const meanI = boxFilter(guide, w, h, r);
  const meanP = boxFilter(input, w, h, r);
  const ii = new Float32Array(n);
  const ip = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    ii[i] = guide[i]! * guide[i]!;
    ip[i] = guide[i]! * input[i]!;
  }
  const corrI = boxFilter(ii, w, h, r);
  const corrIp = boxFilter(ip, w, h, r);
  const a = new Float32Array(n);
  const b = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const varI = corrI[i]! - meanI[i]! * meanI[i]!;
    const covIp = corrIp[i]! - meanI[i]! * meanP[i]!;
    a[i] = covIp / (varI + eps);
    b[i] = meanP[i]! - a[i]! * meanI[i]!;
  }
  const meanA = boxFilter(a, w, h, r);
  const meanB = boxFilter(b, w, h, r);
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) out[i] = Math.min(1, Math.max(0, meanA[i]! * guide[i]! + meanB[i]!));
  return out;
}

/** Bilinear resize of a single-channel map. */
export function resizeMap(src: Float32Array, sw: number, sh: number, dw: number, dh: number): Float32Array {
  const out = new Float32Array(dw * dh);
  for (let y = 0; y < dh; y++) {
    const fy = Math.min(sh - 1, Math.max(0, ((y + 0.5) * sh) / dh - 0.5));
    const y0 = Math.floor(fy);
    const y1 = Math.min(sh - 1, y0 + 1);
    const ty = fy - y0;
    for (let x = 0; x < dw; x++) {
      const fx = Math.min(sw - 1, Math.max(0, ((x + 0.5) * sw) / dw - 0.5));
      const x0 = Math.floor(fx);
      const x1 = Math.min(sw - 1, x0 + 1);
      const tx = fx - x0;
      const top = src[y0 * sw + x0]! * (1 - tx) + src[y0 * sw + x1]! * tx;
      const bottom = src[y1 * sw + x0]! * (1 - tx) + src[y1 * sw + x1]! * tx;
      out[y * dw + x] = top * (1 - ty) + bottom * ty;
    }
  }
  return out;
}
