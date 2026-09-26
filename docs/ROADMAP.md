# Stardeck roadmap

Stardeck is built in phases. Each phase ends with the project building, linting, type-checking and passing its unit and
end-to-end tests before the next one starts. Anything not yet built is labelled **Soon** in the UI.

| #   | Phase                      | Status  |
| --- | -------------------------- | ------- |
| 1   | App shell & design system  | ✅ Done |
| 2   | Canvas editor              | ✅ Done |
| 3   | Image manipulation         | ✅ Done |
| 4   | Carousel tools             | ✅ Done |
| 5   | Template engine            | ✅ Done |
| 6   | Filters & effects          | ⏭️ Next |
| 7   | Export                     | Planned |
| 8   | Offline storage & projects | Planned |
| 9   | Animations & video         | Planned |
| 10  | Trend system               | Planned |
| 11  | Optional AI integrations   | Planned |
| 12  | Performance                | Planned |
| 13  | Testing & hardening        | Planned |

## Phase 1 — App shell & design system ✅

- Static-export Next.js app (PWA-ready, Capacitor-ready), TypeScript strict mode, Tailwind 4 token system.
- Design system: dark / light / OLED / system themes, high contrast, glass on/off, UI scale, motion levels
  (full / reduced / off / system), buttons (incl. magnetic), icon buttons, segmented controls, switches, sliders, text
  fields, dialogs/bottom sheets, menus, tooltips, toasts with undo, empty states, skeletons, logo, aurora + stardust
  backdrop.
- Shell: desktop nav rail, phone bottom bar with create button, sticky top bar with search, offline indicator, page
  transitions, skip link.
- Home dashboard, Projects (search, filters, favourites, trash/restore), Discover, Settings (all sections), 5-step
  onboarding, command palette.
- Core model used by every later phase: continuous-strip document model, slide operations, Canvas2D renderer
  (gradients, text wrapping/letter-spacing/highlights/strokes, shapes, image frames, vector + emoji stickers), thumbnails,
  IndexedDB repository with memory fallback, validated JSON templates (15) and trend packs.
- Editor shell: canvas viewport with zoom/fit, grid and safe-area guides, filmstrip (add/duplicate/reorder/delete),
  background & per-slide fills, undo/redo, autosave, keyboard shortcuts, palette commands.
- PWA: manifest, icons, service worker precache, install prompt, offline mode.
- Quality: ESLint, Prettier, 65 unit/component tests, 33 Playwright tests (desktop + Pixel 7, offline, CSP-enforced).

## Phase 2 — Canvas editor ✅

- **Infinite canvas:** single viewport-sized canvas renders only the visible region (rAF-coalesced, text layouts cached
  per element and invalidated when fonts load); pan with wheel/trackpad, Space-drag, middle mouse, the Pan tool or two
  fingers; zoom at the pointer with ⌘/Ctrl + wheel, trackpad pinch (incl. Safari) or touch pinch; fit slide / fit all /
  actual size.
- **Selection & transforms:** click, Shift-click, marquee, ⌘/Ctrl deep-select inside groups, select all; move with
  snapping to slide edges/centres, other elements, guides and the grid (pink smart guides, ⌘/Ctrl to bypass), Shift to
  constrain, Alt-drag to duplicate; rotation-aware resize from 8 handles (Shift keeps ratio, Alt from centre; text side
  handles reflow, corners scale type); rotate with 15° Shift steps; live size/angle read-outs. Every gesture is one undo
  step and Esc cancels it.
- **Content tools:** text (heading/subheading/body plus 15 typography styles incl. Editorial, Luxury, Streetwear, Y2K, Minimal,
  Cyber, Meme, Magazine, Newspaper, Brutalist, Futuristic, Soft, Retro; trending pairings), in-place text editing, 10
  shape presets, 44 stickers (28 original vectors + 16 emoji) with search and categories, drag-and-drop from panels onto the canvas, text-tool click to
  place, paste plain text as a new text box.
- **Properties:** position/size/rotation/opacity with scrubbable number fields, align & distribute, font picker with
  live previews, weight/italic/size/line height/letter spacing/case/alignment, solid & gradient fills with
  "in this design" colours, outline, highlight pill, shadow, shape corner radius/points/stroke/dash, sticker recolour,
  text style presets and "pairs well with" suggestions.
- **Structure:** groups (⌘G / ⇧⌘G), lock, hide, z-order (forward/backward/front/back), layers panel with drag-reorder,
  rename, lock/visibility toggles and a this-slide filter; rulers (slide-relative units) with draggable guides.
- **Clipboard:** copy/cut/paste through native clipboard events (no permission prompts) with an in-app fallback; pastes
  land on the active slide.
- **Mobile:** contextual bottom toolbar, non-modal bottom sheet that keeps the canvas visible, large touch handles,
  double-tap to edit text.
- **Quality:** 90 unit/component tests, 45 Playwright tests including mouse drag/resize/rotate, marquee, clipboard,
  rulers, autosave, and real multi-touch drag + pinch via DevTools touch events.

Known limits (by design, for later phases): no nested groups; multi-selection resize keeps proportions; custom font
upload and the Google Fonts catalogue are labelled "Soon"; photos arrive in Phase 3.

## Phase 3 — Image manipulation ✅

- **Local photo library:** IndexedDB asset store (v2 schema: metadata + blobs) keeping an original (≤ 8192 px), a 2048 px
  editing preview and a thumbnail per photo; de-duplicated by SHA-256; dominant colours extracted for the colour
  pickers. Settings → Storage shows usage and cleans up photos no design uses.
- **Import:** picker, drag-and-drop onto the canvas or into a frame, paste (screenshots, copied images), custom PNG/WebP/SVG
  stickers. Files are identified by magic bytes; decode, EXIF orientation and high-quality downscaling run in a Web Worker
  (main-thread fallback); friendly messages for HEIC on unsupported browsers, oversized or damaged files, and full
  storage ("Oops — that image is huge. We're optimizing it for you…").
- **Frames:** 10 frame presets (square, portrait, landscape, tall, rounded, circle, arch, heart, star, hexagon); any image
  element can change shape, corner radius and border; empty frames are drop zones (double-tap to pick a photo).
- **Crop mode:** double-click / Enter / Crop — pan the photo, scale from its corners, resize the crop window while the
  photo stays put, rule-of-thirds grid, the whole photo ghosted outside the frame, aspect presets (free, original, 1:1,
  4:5, 3:4, 9:16, 3:2, 16:9), zoom, straighten (−45…45° with automatic cover), rotate 90°, flip, reset; Esc cancels,
  Enter/Done commits; every gesture is one undo step. Fill/fit and a focal point keep crops sensible when frames resize.
- **Adjustments:** exposure, brightness, contrast, highlights, shadows, temperature, tint, saturation, vibrance, fade,
  vignette (follows the frame), grain, sharpness, blur; RGB + per-channel tone curves (monotone cubic); keystone
  perspective; one-tap auto-enhance from the histogram; hold to compare. WebGL 1 pipeline, cached per element and
  resolution, with an identical CPU implementation in a worker where WebGL is unavailable.
- **Background removal:** pluggable providers — on-device AI (U²-Netp on ONNX Runtime Web, ~19 MB cached on first
  use), instant colour key, and an optional, consent-gated self-hosted server; guided-filter edge refinement; edge
  softness; transparent, colour/gradient, portrait-blur or photo backdrops. See [BACKGROUND-REMOVAL.md](BACKGROUND-REMOVAL.md).
- **Rendering:** one renderer for canvas, slide strip, previews and thumbnails; alpha-aware shadows for cut-outs and
  stickers; loading and missing-photo states; memory budgets adapt to the device.
- **Quality:** 142 unit/component tests, 56 Playwright tests (incl. upload, crop, adjustments, drop into frame,
  colour-key and on-device AI cut-outs with a no-third-party-requests check, paste, sticker upload, storage cleanup, and
  phone crop flow).

Known limits: one-tap filter looks arrive in Phase 6 (the adjustments to build them exist now); brush-refining a
cut-out mask and exporting at full original resolution come with later phases (export is Phase 7).

## Phase 4 — Carousel tools ✅

- **Live layouts:** a collage or panorama is a small spec saved with the design (`doc.layouts`) plus a membership tag on
  each of its elements. Generators are pure, seeded functions, so Shuffle, remixes and slider changes re-run them while
  every photo keeps its identity, crop, adjustments and cut-out. Each change is one undo step; Detach turns the layout
  back into ordinary elements; duplicating a slide duplicates its collage.
- **Collage engine (2–20 photos):** six original styles — Grid (justified rows/columns by aspect ratio), Editorial (hero
  photo + split), Bento (rounded tiles), Scrapbook (tilted, taped, overlapping), Polaroid (framed prints) and Filmstrip.
  Controls: Shuffle, _More chaotic / minimal / aesthetic / editorial / Gen-Z_, style chips, spacing, messiness, tape &
  stickers. **Keep in place:** kept photos never move when shuffling; when the style changes they take the nearest new
  spot. Available from the Layouts panel (<kbd>L</kbd>), the canvas context menu and the phone selection bar.
- **Seamless swipe:** one continuous panorama across 2–10 slides (auto-suggested from the photos' shapes), with slide
  count, spacing between photos, margin, alignment (centre / top / bottom / stagger), crop position via crop mode, and
  manual adjustment. Changing the slide count adds or removes empty slides at the end and re-flows the photos.
- **Smart photo dump:** 3–20 photos + 12 vibes (Chaotic Gen-Z, Clean, Cinematic, Y2K, Travel, Birthday, College,
  Streetwear, Vacation, Night out, Minimal, Aesthetic). Each vibe is a set of design rules — cover style, fonts, palette
  (tinted from the photos' own colours), collage styles, stickers, captions, letterbox bars and a light adjustment look —
  so it runs entirely on the device with no AI service. Starts a new project from the home screen, or appends slides to
  the open design.
- **Swipe preview:** a phone-style preview with scroll-snap slides, drag/swipe, arrow keys, previous/next and slide dots
  — live inside every photo flow, and from the editor's top bar or the command palette.
- **Photo chooser:** pick from the local library or straight from the device, in order, with limits per tool.
- **Quality:** 179 unit/component tests (37 for layouts: partitioning, every style inside its frame, keep-in-place across
  shuffles and restyles, detaching, slide duplication, panorama slide changes, and schema-valid output for all 12 vibes);
  70 Playwright runs across desktop, phone and no-WebGL (photo dump from home and into an existing carousel, seamless
  swipe + slide count + preview navigation, collage remix + keep-in-place + undo, phone shuffle).

Known limits: photo dump captions are generic per vibe (editable text) — smarter wording is an optional AI feature in
Phase 11. (Saving a collage as a reusable template arrived in Phase 5: with _Keep my photos_ on it stays shuffleable.)

## Phase 5 — Template engine ✅

- **Format:** a template is JSON — metadata (name, format, size, style, tags, palette) plus a full design document
  carrying the canvas size, slides, backgrounds and every element with its position, fonts, colours and photo frames.
  One Zod schema validates bundled templates, saved ones and imported files. See [TEMPLATES.md](TEMPLATES.md).
- **Library:** 51 original templates (36 new) across all 8 formats and 12 styles — magazine issue, tips list, polaroid
  wall, cinema stills, diagonal lookbook, sticker board, torn-paper journal, then & now split screen, month recap,
  brutalist portfolio, giant seamless type, overlapping photos, Y2K; quote card, launch post, gilded frame, ransom-note
  news, date-stamped print; this-or-that, Q&A, countdown, film roll and cinematic stories; episode, minimal and GRWM reel
  covers; versus, reaction and vlog thumbnails; nine-grid and taped-strip collages; Swiss, gig and exhibition posters;
  editorial and cork-board moodboards. 46 of them have photo frames.
- **Engine:** JSON files in `src/templates/library/<format>/`, indexed by a script and loaded lazily (a separate,
  precached chunk) with a small synchronous catalog for search and trend packs. An authoring kit (`npm run templates`)
  writes most of them; `npm run templates:check` measures every text box with the real fonts in Chromium.
- **Using templates:** a Templates page (nav + phone tab bar) with search, format and style filters; a preview with
  swipe preview, facts, colourways from the trend palettes and _use with my photos_ (fills frames in reading order).
  In the editor, a Templates panel adds a template's slides after the current one — scaled to the canvas, seamless
  gradients kept — or fills an empty design; _Replace design_ swaps it; all undoable.
- **Your templates:** _Save as template_ from the editor, command palette or any project's menu (style, tags,
  description; photos become empty frames unless you keep them — they stay on the device and are protected from storage
  cleanup). Rename, duplicate, delete with undo. Export/import `.stardeck-template.json` files — exported files never
  include photos, personal stickers or file names; imports are validated and can't reference local photos.
- **Quality:** 202 unit/component tests (library integrity: schema, bundled fonts, known stickers, text on canvas, size
  presets, generated index in sync; engine: id remapping, photo filling, insert/replace with scaling, save/strip,
  file round-trip and rejection, store); 76 Playwright runs across desktop, phone and no-WebGL (browse/search/filter,
  preview + colourway + use, use with photos, editor panel fill/add/replace/undo, save/rename/export/delete/undo/import,
  project-menu save, phone flow).

Known limits: template animation data arrives with animations in Phase 9; adapting a template to a very different shape
(e.g. a story template into a thumbnail) scales it to fit rather than re-flowing the layout — smarter resizing is part of
the optional AI tools in Phase 11.

## Later phases (summary)

- **6 · Filters & effects:** 14 one-tap looks with intensity (built on the Phase 3 adjustment pipeline), light leaks,
  textures.
- **7 · Export:** PNG / JPG / WebP / PDF, per-slide / all / ZIP, quality presets, share sheet — never watermarked.
- **8 · Storage:** version history, folders, import/export project files, storage management.
- **9 · Animation & video:** element animations, timeline, MP4/GIF export where supported.
- **10 · Trends:** remote pack updates, meme & social formats, trend-driven suggestions.
- **11 · AI (optional, opt-in):** palette extraction, font pairing, AI resize and layout run locally; any cloud model is
  opt-in with clear disclosure and a server-side proxy for keys.
- **12–13 · Performance & hardening:** worker rendering, memory budgets for large images, accessibility audit, visual
  regression tests.
