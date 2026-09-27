# Performance

Stardeck runs entirely in the browser, often on phones, with photos straight off a camera. The rules this code follows:

1. Load only what the screen needs, and fetch the rest while the page is idle.
2. Keep the main thread free: heavy pixel work runs in workers, and anything unavoidable is cut into short slices.
3. Redraw only what changed.
4. Bound memory by device, and free large buffers as soon as they're done.

## What loads when

| Loads with every page                                            | Loads on first use (and in the background once the page is idle)                                                                                                          |
| ---------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| The shell, stores, design system, the renderer used for previews | New-design, photo-flow, template-preview, save-template and export dialogs, the command palette, onboarding (`src/components/shell/LazyDialogs.tsx`)                      |
| The editor's canvas, layers and properties panels                | The editor's Templates, Photos, Layouts, Filters, Animate, Trends and Magic tools, the timeline, swipe preview, version history and resize dialog (`src/editor/lazy.tsx`) |
|                                                                  | The template library (JSON), MP4/GIF encoders, the background-removal model, the AI tools' server client                                                                  |

Each lazily loaded dialog stays mounted once it has opened, so it can animate closed. The Ctrl/⌘ K shortcut is bound
before the palette's code has loaded. The service worker precaches every chunk, so first use works offline too.

zod is imported as `import * as z from 'zod'`, so the bundler drops the parts the app doesn't use (locales and JSON-schema
conversion). Importing `{ z }` would pull all of it in.

**Budget:** `npm run perf:budget`, run after `npm run build` and in CI, checks the gzipped JavaScript each page loads up
front:

| Page      | Phase 11 | Now    | Budget |
| --------- | -------- | ------ | ------ |
| Home      | 521 KB   | 402 KB | 430 KB |
| Editor    | 592 KB   | 479 KB | 510 KB |
| Templates | 506 KB   | 384 KB | 420 KB |
| Discover  | 516 KB   | 393 KB | 430 KB |
| Projects  | 515 KB   | 394 KB | 430 KB |
| Settings  | 515 KB   | 409 KB | 440 KB |

About 200 KB of each is Next.js and React.

## Big photos

- **Import** (`src/assets`): the worker gets the file itself. It reads, hashes (for de-duplication), decodes and scales
  it, producing a ≤ 8192 px original, a 2048 px preview and a 384 px thumbnail, and it extracts the palette. The page never
  copies or hashes the megabytes. A re-import is found by the worker's hash.
- **Filter thumbnails** (`src/filters/preview.ts`): the photo is scaled down once per size and shared by every look.
  Each thumbnail is developed by the CPU pipeline in the develop worker (the same maths as the GPU path), so a panel of
  15+ looks needs no GPU read-backs on the page.
- **Editing** uses the 2048 px preview. The GPU develop pipeline runs there, with the CPU worker where WebGL is missing.
  Exports at Maximum go back to the originals.

Result, measured in headless Chromium (software GPU) importing a 6000 × 4000 JPEG:

| Before this phase                        | After                   |
| ---------------------------------------- | ----------------------- |
| three stalls of 103 ms, 59 ms and 234 ms | one ~55 ms React update |

`e2e/performance.spec.ts` fails if importing a 24-megapixel photo blocks the page for 150 ms or more.

## Drawing

- **Editor canvas** (`src/editor/canvas/useSceneRenderer.ts`): one viewport-sized canvas draws only the visible
  region, once per animation frame.
  - During a gesture (drag, resize, a slider), the elements below and above the ones changing are drawn once into two
    cached layers.
  - Each frame then draws two bitmaps plus the changing elements.
  - The cache is rebuilt when the camera, fonts, photos or the set of changing elements changes, and freed when the
    gesture ends.
  - Dragging a photo in a 20-photo dump went from 9 long tasks (up to 118 ms) to at most one of ~55 ms.
- **Previews** (`src/canvas/ScenePreview.tsx`, `src/canvas/draw-queue.ts`):
  - They draw only when scrolled near the viewport.
  - Drawing goes through a shared queue in ~8 ms slices, and each canvas keeps only its latest job.
  - A preview redraws only when something in its own slide changed. Designs are immutable, so an identity check is
    enough. The editor's slide strip no longer redraws every thumbnail on every drag move.
  - Sizes come from `ResizeObserver`, never from reading layout during a render.
- **Long pages:** Discover's sections use `content-visibility: auto` (the `defer-render` utility), so off-screen
  sections skip layout and paint.
- **No forced layouts on render:** the top bar reads `scrollY` only in scroll events and animation frames, and rails
  measure their scroll edges after layout.

## Memory

| Cache                                      | Budget (≤ 2 GB / typical / ≥ 8 GB device) | Evicts              |
| ------------------------------------------ | ----------------------------------------- | ------------------- |
| Decoded photos (`src/assets/cache.ts`)     | 96 / 160 / 320 MB                         | least recently used |
| Developed photos (`src/images/develop.ts`) | 64 / 128 / 256 MB                         | least recently used |
| Look thumbnails                            | 160 small canvases                        | oldest              |
| Live video players (`src/assets/video.ts`) | 6                                         | least recently used |
| Undo history                               | 100 steps                                 | oldest              |

- Undo steps share every element the step didn't change (designs are immutable), so 100 steps cost little more than
  one design.
- ImageBitmaps are closed when evicted.
- Export canvases are released after each slide.
- The editor's gesture layers are freed when the gesture ends.

## Export

Slides render one at a time. At High and Maximum, the canvas is snapshotted (an ImageBitmap stays on the GPU) and
handed to an encode worker (`src/export/encode.worker.ts`), which reads it back and compresses it. The page no longer
blocks on `toBlob`. Exporting a 5-slide carousel at Maximum went from 6.1 s to 1.7 s, and browsers without
OffscreenCanvas encoding fall back to `toBlob`.

## Fixed along the way

- The GL pipeline could sample the texture it was drawing into, through a stale sampler binding on a unit the pass
  didn't use. The draw failed and a cut-out came out blank. Every pass now starts with its texture units cleared.
- The new-design dialog, now mounted on first use, ignored the format it was opened for.

## Measuring

- `npm run perf:budget` checks the initial JavaScript per page.
- `SOURCE_MAPS=1 npm run build` builds with browser source maps, so CPU profiles and traces of the production build
  map back to source files.
- `npx next experimental-analyze -o` writes the bundle analysis to `.next/diagnostics/analyze`.
- `e2e/performance.spec.ts` covers lazy dialogs opening correctly, a 24-megapixel import, and dragging in a carousel.

## Known limits

- Motion (the animation library, ~45 KB gzipped) loads with every page. Its lazy mode would hide elements that animate
  in from `initial` until an extra chunk arrives, so it isn't used.
- Rendering an export slide still happens on the page. A 12-megapixel slide can take a few hundred milliseconds on a
  slow phone; the progress dialog stays up meanwhile.
- The first open of a template-heavy page still measures text for the visible previews, spread over short slices.
