/// Background removal worker (ES module). Built by scripts/build-workers.mjs.
import * as ort from 'onnxruntime-web/wasm';
import { serveWorker } from '@/utils/worker-rpc';
import { colourKeyMask } from './colour-key';
import { grayGuide, guidedFilter, resizeMap } from './guided-filter';
import { MASK_MAX, MODEL_SIZE, type CutoutProgress, type CutoutRequest, type CutoutResult } from './types';

class CutoutError extends Error {
  constructor(readonly code: 'model-download' | 'unsupported' | 'failed') {
    super(code);
  }
}

let session: Promise<ort.InferenceSession> | null = null;

async function download(url: string, progress: (p: CutoutProgress) => void): Promise<Uint8Array> {
  let res: Response;
  try {
    res = await fetch(url);
  } catch {
    throw new CutoutError('model-download');
  }
  if (!res.ok || !res.body) throw new CutoutError('model-download');
  const total = Number(res.headers.get('content-length')) || 0;
  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let loaded = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    loaded += value.length;
    progress({ stage: 'download', loaded, total });
  }
  const out = new Uint8Array(loaded);
  let offset = 0;
  for (const c of chunks) {
    out.set(c, offset);
    offset += c.length;
  }
  return out;
}

function getSession(req: CutoutRequest, progress: (p: CutoutProgress) => void): Promise<ort.InferenceSession> {
  if (!session) {
    // Object form: use the JS glue bundled into this worker, fetch only the .wasm binary.
    ort.env.wasm.wasmPaths = { wasm: req.wasmUrl };
    // Threads need cross-origin isolation; a single thread keeps it working everywhere.
    ort.env.wasm.numThreads = 1;
    ort.env.wasm.proxy = false;
    session = (async () => {
      const model = await download(req.modelUrl, progress);
      try {
        return await ort.InferenceSession.create(model, { executionProviders: ['wasm'], graphOptimizationLevel: 'all' });
      } catch {
        throw new CutoutError('unsupported');
      }
    })();
    session.catch(() => {
      session = null;
    });
  }
  return session;
}

function pixelsOf(image: ImageBitmap, w: number, h: number): Uint8ClampedArray {
  const canvas = new OffscreenCanvas(w, h);
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new CutoutError('unsupported');
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(image, 0, 0, w, h);
  return ctx.getImageData(0, 0, w, h).data;
}

/** U²-Netp salient-object mask, normalised to 0..1 at the model's resolution. */
async function aiMask(req: CutoutRequest, progress: (p: CutoutProgress) => void): Promise<Float32Array> {
  const sess = await getSession(req, progress);
  progress({ stage: 'analyse' });
  const S = MODEL_SIZE;
  const px = pixelsOf(req.image, S, S);
  let max = 1;
  for (let i = 0; i < px.length; i += 4) max = Math.max(max, px[i]!, px[i + 1]!, px[i + 2]!);
  const mean = [0.485, 0.456, 0.406];
  const std = [0.229, 0.224, 0.225];
  const input = new Float32Array(3 * S * S);
  for (let i = 0; i < S * S; i++) {
    for (let c = 0; c < 3; c++) input[c * S * S + i] = (px[i * 4 + c]! / max - mean[c]!) / std[c]!;
  }
  const feeds = { [sess.inputNames[0]!]: new ort.Tensor('float32', input, [1, 3, S, S]) };
  let output: ort.InferenceSession.OnnxValueMapType;
  try {
    output = await sess.run(feeds);
  } catch {
    throw new CutoutError('failed');
  }
  const pred = output[sess.outputNames[0]!]!.data as Float32Array;
  let lo = Infinity;
  let hi = -Infinity;
  for (let i = 0; i < S * S; i++) {
    lo = Math.min(lo, pred[i]!);
    hi = Math.max(hi, pred[i]!);
  }
  const range = hi - lo || 1;
  const mask = new Float32Array(S * S);
  for (let i = 0; i < S * S; i++) mask[i] = (pred[i]! - lo) / range;
  return mask;
}

serveWorker<CutoutRequest, CutoutResult>(async (req, report) => {
  const progress = (p: CutoutProgress) => report(p);
  try {
    const scale = Math.min(1, MASK_MAX / Math.max(req.image.width, req.image.height));
    const w = Math.max(1, Math.round(req.image.width * scale));
    const h = Math.max(1, Math.round(req.image.height * scale));
    const data = pixelsOf(req.image, w, h);

    let alpha: Float32Array;
    if (req.method === 'colour-key') {
      progress({ stage: 'analyse' });
      alpha = colourKeyMask(data, w, h, { tolerance: req.tolerance });
    } else {
      alpha = resizeMap(await aiMask(req, progress), MODEL_SIZE, MODEL_SIZE, w, h);
    }

    // Snap the mask to real edges, then tighten the soft ramp a little.
    progress({ stage: 'refine' });
    const radius = Math.max(2, Math.round(Math.max(w, h) / 170));
    const refined = guidedFilter(grayGuide(data, w * h), alpha, w, h, radius, 1e-3);
    const out = new Uint8ClampedArray(w * h * 4);
    for (let i = 0; i < w * h; i++) {
      const t = Math.min(1, Math.max(0, (refined[i]! - 0.12) / 0.76));
      const v = Math.round(t * t * (3 - 2 * t) * 255);
      out[i * 4] = v;
      out[i * 4 + 1] = v;
      out[i * 4 + 2] = v;
      out[i * 4 + 3] = 255;
    }
    return { value: { mask: { data: out, width: w, height: h } }, transfer: [out.buffer] };
  } finally {
    req.image.close();
  }
});
