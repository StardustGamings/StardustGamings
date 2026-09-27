import { seededRandom } from '@/utils/math';

let cached: string | null = null;
let cachedCanvas: HTMLCanvasElement | null = null;

/** The sample photo as a data URL (for <img>). */
export function samplePhoto(): string | null {
  if (cached) return cached;
  const canvas = samplePhotoCanvas();
  cached = canvas ? canvas.toDataURL('image/jpeg', 0.9) : null;
  return cached;
}

/**
 * A procedurally painted "sunset over hills" used to preview photo effects.
 * Generated locally so previews need no stock photos and work offline.
 */
export function samplePhotoCanvas(): HTMLCanvasElement | null {
  if (cachedCanvas) return cachedCanvas;
  if (typeof document === 'undefined') return null;
  const w = 480;
  const h = 360;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  const sky = ctx.createLinearGradient(0, 0, 0, h);
  sky.addColorStop(0, '#2B1B5E');
  sky.addColorStop(0.45, '#E0567E');
  sky.addColorStop(0.72, '#FF9D5C');
  sky.addColorStop(1, '#FFD08A');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, w, h);

  const sun = ctx.createRadialGradient(w * 0.62, h * 0.6, 0, w * 0.62, h * 0.6, 120);
  sun.addColorStop(0, 'rgba(255,244,200,1)');
  sun.addColorStop(0.25, 'rgba(255,220,150,0.9)');
  sun.addColorStop(1, 'rgba(255,160,120,0)');
  ctx.fillStyle = sun;
  ctx.fillRect(0, 0, w, h);

  const rand = seededRandom(7);
  for (let i = 0; i < 40; i++) {
    ctx.fillStyle = `rgba(255,255,255,${0.3 + rand() * 0.6})`;
    ctx.beginPath();
    ctx.arc(rand() * w, rand() * h * 0.35, rand() * 1.2 + 0.3, 0, Math.PI * 2);
    ctx.fill();
  }

  const layers = ['#6B2F63', '#4A2257', '#2C1640', '#170C26'];
  layers.forEach((color, li) => {
    ctx.fillStyle = color;
    ctx.beginPath();
    const base = h * (0.62 + li * 0.1);
    ctx.moveTo(0, h);
    for (let x = 0; x <= w; x += 8) {
      const y = base - Math.sin(x / (70 + li * 25) + li * 1.7) * (22 - li * 3) - Math.sin(x / 23 + li) * 5;
      ctx.lineTo(x, y);
    }
    ctx.lineTo(w, h);
    ctx.closePath();
    ctx.fill();
  });

  cachedCanvas = canvas;
  return canvas;
}
