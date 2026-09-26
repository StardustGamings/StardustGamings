# Background removal

Stardeck removes photo backgrounds **on the device** by default. Every method produces a grayscale mask that is stored
as a local asset and composited non-destructively by the develop pipeline, so edges can be softened, the backdrop
changed, or the original restored at any time.

## Providers

| Method           | Where it runs                            | Best for                                   | Download                  |
| ---------------- | ---------------------------------------- | ------------------------------------------ | ------------------------- |
| **On-device AI** | Web Worker, ONNX Runtime Web (WASM SIMD) | People, pets, products — any clear subject | ~19 MB once, then offline |
| **Colour key**   | Web Worker (main thread fallback)        | Plain, studio or screenshot backgrounds    | none                      |
| **Cloud**        | A server you host (optional, opt-in)     | Whatever your server's model is good at    | the photo is uploaded     |

All providers live behind one interface in [`src/images/cutout/index.ts`](../src/images/cutout/index.ts):
`computeCutout(element, method)` returns `{ maskAssetId, feather, backdrop, method }`.

### On-device AI

- Model: **U²-Netp** (U²-Net small, salient-object detection, Apache-2.0), 320×320 input, ONNX export from rembg.
  Shipped at `public/ml/u2netp.onnx` (4.6 MB) with `public/ml/NOTICE.txt`.
- Runtime: `onnxruntime-web` (MIT), WebAssembly backend, single-threaded (works without cross-origin isolation). The
  `.wasm` (14 MB) is copied to `public/ml/ort/` by `npm run workers`.
- Worker: [`src/images/cutout/cutout.worker.ts`](../src/images/cutout/cutout.worker.ts), bundled by esbuild into
  `public/workers/cutout.js` (an ES module worker).
- The mask is upscaled to ≤ 1024 px and snapped to the photo's real edges with a **guided filter**
  ([`guided-filter.ts`](../src/images/cutout/guided-filter.ts)).
- The service worker does **not** precache `/ml/`; it caches the files the first time someone uses the feature, so
  installs stay light and the AI works offline afterwards.
- CSP needs `'wasm-unsafe-eval'` in `script-src` (it permits WebAssembly compilation only, not JavaScript `eval`).

**Swapping the model:** any ONNX model with a `1×3×H×W` float input (ImageNet mean/std normalisation) and a `1×1×H×W`
saliency/alpha output works — change `MODEL_URL`, `MODEL_SIZE` and `AI_DOWNLOAD_BYTES`. Mind the licence: several popular
background-removal models are non-commercial (e.g. BRIA RMBG) or AGPL (e.g. @imgly/background-removal); U²-Net is
Apache-2.0.

### Colour key

[`colour-key.ts`](../src/images/cutout/colour-key.ts) learns the background colours from the photo's border (k-means
in CIE Lab), flood-fills from the edges through similar colours with an adaptive tolerance, softens the edge and removes
specks. No model, no download, instant.

### Optional cloud provider

Only exists when the site is built with `NEXT_PUBLIC_CUTOUT_ENDPOINT` set, e.g.

```bash
NEXT_PUBLIC_CUTOUT_ENDPOINT=https://cutout.example.com/remove npm run build
```

It is listed as **Cloud (host)**, and before anything is sent the user must confirm a dialog naming the host. It never
runs automatically. Also add the endpoint's origin to `connect-src` in `public/_headers` (and `scripts/serve.mjs` for
local testing), otherwise the browser blocks the request.

**Contract** — keep API keys on the server; the browser sends nothing but the photo:

- `POST <endpoint>` with `multipart/form-data`, field `image` (the 2048 px preview, JPEG/PNG/WebP), no cookies.
- Respond `200` with a PNG, either
  - a **cut-out** (transparent PNG): its alpha channel is used as the mask, or
  - a **mask** (opaque grayscale PNG): its luminance is used (white = keep).
- Any other status is shown as "The cloud service didn't respond" and nothing changes.

A self-hosted [rembg](https://github.com/danielgatis/rembg) server behind a tiny proxy that maps `image` to its input
satisfies this contract. Add rate limiting on the server if it's public.

## Backdrops

Behind the subject: **none** (transparent), **colour/gradient**, **blur** (the photo's own background, blurred with a
masked normalised convolution so the subject doesn't halo — a "portrait mode" look) or **another photo** from the
library. Edge softness feathers the mask. All of it is re-rendered on the GPU as you drag.
