import { seededRandom } from '@/utils/math';
import { toHex } from '@/utils/color';

/**
 * Dominant colours of an RGBA buffer via k-means (deterministic seed, so the
 * same photo always yields the same palette). Most prominent first.
 */
export function extractPalette(data: Uint8ClampedArray, k = 5, maxSamples = 4096): string[] {
  const pixels: [number, number, number][] = [];
  const total = data.length / 4;
  const stride = Math.max(1, Math.floor(total / maxSamples));
  for (let i = 0; i < total; i += stride) {
    const o = i * 4;
    if (data[o + 3]! < 128) continue;
    pixels.push([data[o]!, data[o + 1]!, data[o + 2]!]);
  }
  if (pixels.length === 0) return [];

  const random = seededRandom(pixels.length);
  const dist = (a: number[], b: number[]) => (a[0]! - b[0]!) ** 2 + (a[1]! - b[1]!) ** 2 + (a[2]! - b[2]!) ** 2;

  // k-means++ seeding.
  const centers: number[][] = [[...pixels[Math.floor(random() * pixels.length)]!]];
  while (centers.length < Math.min(k, pixels.length)) {
    const d = pixels.map((p) => Math.min(...centers.map((c) => dist(p, c))));
    const sum = d.reduce((a, b) => a + b, 0);
    if (sum === 0) break;
    let r = random() * sum;
    let idx = 0;
    while (r > d[idx]! && idx < d.length - 1) r -= d[idx++]!;
    centers.push([...pixels[idx]!]);
  }

  const assign = new Array<number>(pixels.length).fill(0);
  for (let iter = 0; iter < 10; iter++) {
    const sums = centers.map(() => [0, 0, 0, 0]);
    pixels.forEach((p, i) => {
      let best = 0;
      let bestD = Infinity;
      centers.forEach((c, ci) => {
        const dd = dist(p, c);
        if (dd < bestD) {
          bestD = dd;
          best = ci;
        }
      });
      assign[i] = best;
      const s = sums[best]!;
      s[0]! += p[0];
      s[1]! += p[1];
      s[2]! += p[2];
      s[3]! += 1;
    });
    sums.forEach((s, ci) => {
      if (s[3]! > 0) centers[ci] = [s[0]! / s[3]!, s[1]! / s[3]!, s[2]! / s[3]!];
    });
  }

  const counts = centers.map((_, ci) => assign.filter((a) => a === ci).length);
  const ranked = centers
    .map((c, ci) => ({ c, n: counts[ci]! }))
    .filter((x) => x.n > 0)
    .sort((a, b) => b.n - a.n);

  // Drop near-duplicates so the palette is varied.
  const out: number[][] = [];
  for (const { c } of ranked) if (out.every((o) => dist(o, c) > 24 * 24)) out.push(c);
  return out.map((c) => toHex({ r: c[0]!, g: c[1]!, b: c[2]!, a: 1 }).toUpperCase());
}
