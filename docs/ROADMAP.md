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
| 6   | Filters & effects          | ✅ Done |
| 7   | Export                     | ✅ Done |
| 8   | Offline storage & projects | ✅ Done |
| 9   | Animations & video         | ✅ Done |
| 10  | Trend system               | ✅ Done |
| 11  | Optional AI integrations   | ✅ Done |
| 12  | Performance                | ✅ Done |
| 13  | Testing & hardening        | ⏭️ Next |

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

Known limits: one-tap filter looks arrived in Phase 6 (built on these adjustments); brush-refining a
cut-out mask comes with a later phase. (Exporting from full-resolution originals arrived in Phase 7.)

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

Known limits: photo dump captions are generic per vibe (editable text). Since Phase 11, _Magic → Caption_ writes
captions from a design's own words, and _Auto_ picks the dump's cover, order, vibe and title. (Saving a collage as a reusable template arrived in Phase 5: with _Keep my photos_ on it stays shuffleable.)

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

Known limits: adapting a template to a very different shape
(e.g. a story template into a thumbnail) scales it to fit rather than re-flowing the layout. Phase 11's smart resize
(_Magic → Resize_) adapts a design to another size element by element.

## Phase 6 — Filters & effects ✅

- **14 one-tap looks** — Cinematic, Vintage, Film, Y2K, Cyberpunk, Monochrome, VHS, Disposable, Polaroid, Dreamy, Dark,
  Street, Luxury, Minimal — each plain data (adjustments, tone curves, effects). A photo stores the look's id and an
  intensity; the pipeline blends the look over the photo's own edits (sliders add and clamp, curves compose, effects
  add), so looks can be switched or removed without losing anything. See [FILTERS.md](FILTERS.md).
- **Effects:** glow (bright-pass bloom), light leaks in four colours, dust & scratches, RGB split and scanlines — new
  stages in the WebGL develop shader with an identical CPU implementation (shared reference maths in
  `src/effects/effects.ts`), resolution-independent so thumbnails, the canvas and exports match.
- **Editor:** a _Filters_ section on every photo with live thumbnails of that photo in each look, intensity and _Apply
  to all N photos_; an _Effects_ section; and a real **Filters tool** (rail, <kbd>F</kbd>, phone selection bar,
  command palette) that restyles the selected photos — or every photo in the design at once. All undoable, all
  covered by _hold to compare_.
- **Everywhere else:** Discover's "Looks of the month" render with the real filters (trend packs now name a look +
  intensity for each effect); 9 templates give their photo frames a look, so dropped-in photos arrive styled.
- **Fixed along the way:** on the GPU, tone curves could replace the photo with the curves table (a texture-unit
  mix-up since Phase 3) — now covered by an end-to-end check with WebGL on.
- **Quality:** 217 unit/component tests (every look valid and distinct, intensity blending, curve composition, each
  effect's maths and a full look through the CPU pipeline); 87 Playwright runs across desktop, phone and no-WebGL
  (looks + intensity + undo, curves on GPU, light leak colours, filters for every photo, templates carrying looks,
  trend cards, phone Filters action).

Known limits: filters apply to photos, not to text or shapes. (Trend drops started shipping their own looks as data in
Phase 10.)

## Phase 7 — Export ✅

- **Formats:** PNG, JPG, WebP (where the browser can encode it) and multi-page **PDF** (MP4 and GIF followed in
  Phase 9). Never watermarked, never behind a paywall.
- **What to export:** every slide (one **ZIP**, or separate files), one slide (picked from thumbnails), or the **full
  carousel** as one wide image. Files are named after the design (`summer-dump-01.png`, `summer-dump.zip`).
- **Quality:** Standard (1×), High (2×) and Maximum (3×, drawn from your **full-resolution originals**), kept inside
  browser canvas limits with the exact pixel size shown up front. **Transparent background** for PNG and WebP.
- **Made on this device:** the editor's own renderer draws each file, and photo looks and edits are developed at export
  size (GPU, or the CPU worker without WebGL). Our own ZIP and PDF writers mean no dependencies and no network, so
  export works offline. Progress, cancel, and a done screen with a small celebration, the file size and the dimensions.
- **Saving:** downloads right away on desktop. Phones with a share sheet get **Share** (straight into Instagram, Photos…)
  or **Save**.
- **Entry points:** the editor's Export button, <kbd>Ctrl/⌘</kbd> + <kbd>⇧</kbd> + <kbd>E</kbd>, the command palette,
  and _Export…_ on every project card. The format and quality you last used are remembered, and Settings sets the
  defaults. See [EXPORT.md](EXPORT.md).
- **Quality:** 226 unit/component tests (ZIP read-back and CRC-32, PDF structure and xref offsets, naming, scopes,
  canvas caps, transparency, PDF page sizes). 100 Playwright runs across desktop, phone and no-WebGL, with every
  download checked byte for byte: image headers and sizes, ZIP entries, separate files, the full strip, PDF pages,
  transparent pixels, photos with a look, export from a project card, the phone share/save flow, and exporting offline.

Known limits: exports are raster, with no vector PDF or SVG.
A PDF page is one image per slide, so its text isn't selectable. Very wide full-carousel images are scaled down to fit
browser canvas limits (16 million pixels).

## Phase 8 — Offline storage & projects ✅

- **Version history:** each design keeps saved states on the device.
  - A version is taken as it was when opened, every 10 minutes while editing, on <kbd>Ctrl/⌘</kbd> + <kbd>S</kbd>, as a
    named version, and before big changes (restoring a version, replacing with a template).
  - Retention: everything from the last hour, hourly for a day, daily for 30 days. Named versions stay until deleted.
  - The History dialog previews every slide. From it you can restore (one undo step, current design kept first), save a
    version as a new design, rename or delete. Photos a version uses are never cleaned up.
- **Folders:** create, rename, recolour and delete them (their designs stay).
  - Designs move by **drag and drop** or **Move to folder…**, with undo.
  - The folder filter lives in the URL, and cards show their folder.
- **Project files (`.stardeck`):** a design with its photos, to move it to another device or share it. **Back up
  everything** covers every design with its history, plus folders, templates and the photo library.
  - Import from the projects screen (button or drop) or Settings.
  - Import never trusts the file (schemas, byte-sniffed images, computed hashes), never overwrites anything, keeps ids
    when free, skips designs already here, and labels changed ones _(imported)_.
  - Our own streaming ZIP reader and writer handle stored and deflated entries and check CRCs.
- **Storage settings:** a breakdown by kind (designs, photos, stickers, versions, templates) with the browser's free
  space.
  - Low-space warnings (in Settings and on the projects screen).
  - Actions: empty trash, clean up photos, clear history (named versions kept), back up, restore, protect, erase.
- **Autosave that doesn't lose work:**
  - Writes are atomic, and transient failures retry automatically.
  - A full device gets a banner with **Download a copy** and **Try again**.
- **Several tabs:** lists, folders and photos stay in step across tabs and windows (BroadcastChannel, never leaves the
  browser).
  - A design open twice picks up the other tab's changes.
  - A real clash asks before overwriting (**Load latest** / **Keep mine**): stale saves are refused, not written.
- **Fixed along the way:** the editor top bar's desktop-only buttons showed on phones and squeezed out the design name.
  They now live in a **⋯** menu there, next to **Version history**, **Save a version** and **Download project file**.
- **Quality:**
  - 247 unit/component tests: retention, versions, folders, the ZIP reader, backup round trips, hostile files, schema
    completeness and the stale-save guard.
  - 108 Playwright runs across desktop, phone and no-WebGL: history, folders, project files and backups carried to a
    clean browser profile, two tabs in sync with a real conflict, Storage settings, a simulated full disk, and offline
    project files.

See [STORAGE.md](STORAGE.md).

Known limits:

- Storage is per browser. Moving work between devices uses project files or backups. Optional, opt-in cloud sync is
  still planned (the **Soon** row in Settings → Account).
- Browsers may still clear data under heavy storage pressure unless **Protect my projects** is granted (installing the
  app usually allows it), so backups are the safety net.
- A single backup file tops out at 4 GB.

## Phase 9 — Animations & video ✅

- **Element animation:** every element can have an entrance, an exit and a loop, each picked from tiles that preview
  the motion.
  - 10 entrances: fade, slide, zoom, bounce, pop, rotate, blur reveal, typewriter, glitch and elastic.
  - 6 exits, and 3 loops (parallax, float, pulse).
  - Delay, duration, direction and loop intensity.
  - A pure engine turns "element + moment" into a pose, and the one renderer draws it everywhere. Stills and editing
    show the design at rest.
- **Auto-animate:** one tap animates a slide or the whole design in a _Smooth_, _Playful_ or _Glitchy_ vibe.
  - Roles decide the preset (backdrop, headline, text, photo, sticker, shape), and entrances are staggered.
  - Slide lengths and a matching transition are set too. All of it stays editable.
- **Timing:** slide lengths (0.5–60 s, _Fit_ to the motion), and transitions between slides (swipe, fade, zoom, cut)
  that overlap so motion flows across them.
- **Timeline (desktop):** drag an entrance to move it and its edge to resize it, drag the slide end, scrub the playhead.
  Moves snap to 50 ms, work from the keyboard, and each drag is one undo step. Phones get a preview-time slider.
- **Playback:** _Play slide_ and loop on the canvas (editing stops it), and _Preview → Play as video_ for the whole
  design with transitions.
- **Video clips:** MP4, WebM or MOV up to 2 minutes, from the picker, drag and drop or _Add a video_. Clips are stored
  on the device next to your photos.
  - They go anywhere a photo can: frames, crop, looks, adjustments, effects, project files.
  - Playback settings: trim, speed (0.5–2×), sound, loop and _Fit slide_.
  - Browser recordings with no stored length are handled, and duplicates are detected by content hash.
- **MP4 and GIF export:** frame-exact rendering through the same renderer, encoded on the device.
  - MP4 uses WebCodecs, preferring H.264 and falling back to VP9 / AV1. Sound from unmuted clips is mixed (trim, speed,
    loop) and encoded as AAC or Opus.
  - GIF is up to 30 s, with a palette per frame.
  - All slides in order, or one slide, with sizes and frame rates per quality preset. The encoders load only when used.
- **Templates:** templates can carry motion. 14 of the 51 built-ins are animated, with an _Animated_ filter and badge,
  and _Play animation_ in the preview.
- **Security:** CSP gains `media-src 'self' blob:`, so clips play from local object URLs only.
- **Quality:**
  - 267 unit/component tests: easing, every preset settling at rest, sequence overlaps, clip timing, typewriter and blur
    in the renderer, auto-animate, video sizes and frame rates, a real GIF read back, and the schema round trip with
    motion.
  - 119 Playwright runs across desktop, phone and no-WebGL: presets, timeline drag and scrub checked by canvas pixels,
    auto-animate and _Play as video_, MP4 and GIF parsed and played back for length and size, and a recorded clip with
    sound (trimmed, sped up, exported with and without its audio track). Also animated templates and the phone flow.

See [ANIMATION.md](ANIMATION.md).

Known limits:

- Changing a clip's speed also changes its pitch.
- Where the browser has no H.264 encoder, MP4s use VP9 or AV1, which some social apps re-encode or refuse. The done
  screen says so.
- On screen, looks on moving video need WebGL (exports apply them either way).
- There is no per-word text animation and there are no keyframed motion paths.

## Phase 10 — Trend system ✅

- **Trend drops as data:** a drop is one JSON file (pack format v2; v1 still loads), published without a build.
  - It covers every category in the brief: layouts and **layout rules**, fonts, colours, **filters** (looks as data),
    effects, stickers and **sticker art** (vector paths), carousel styles, meme formats and social formats.
  - Also a cover and **trend kits**.
  - Everything is validated, allow-listed and length-capped. No images, fonts or scripts are downloaded.
- **Feed, schedule and archive:** `index.json` lists the drops.
  - A drop dated in the future goes live on its day (local midnight). The October drop is published ahead of time.
  - The newest drop is always re-downloaded, so fixes reach people.
  - Earlier drops stay browsable, and drops that arrived since your last visit get a **new-drop dot**.
  - Three drops ship: August, September and October 2026.
- **Offline:** all drops are bundled into the app, the last ones downloaded are cached on the device, and the service
  worker caches the feed.
  - A build can point at a feed hosted elsewhere (`NEXT_PUBLIC_TRENDS_URL`, e.g. for the native app).
  - **Settings → Trends** turns downloads off, shows where the drop came from, checks now, and previews a pack file for
    authors (with the strict check's findings).
- **Discover → What's trending:** the drop's cover (drawn from its data), a drop switcher, a sticky category bar, and
  sections for kits, templates, layouts and layout rules (_Try with my photos_), fonts, colours, filters, effects,
  stickers, carousel styles, meme formats, social formats and the remix feed.
  - Home's trending tabs add filters and memes & formats.
- **Editor → Trends (<kbd>R</kbd>):**
  - **Suggestions** for the open design: a kit, a filter for bare photos, a trending pairing for the headline, motion,
    a layout rule for your photos, a meme or social format.
  - **Kits** preview _your_ design restyled and apply in one tap — colours (contrast kept), heading and body fonts
    (text re-fitted), a filter and motion, each switchable.
  - The drop's palettes, fonts, filters and stickers one at a time. Every action is one undo.
  - Drop filters also appear under _Trending_ in the filter picker, drop stickers get their own tab, and layout rules
    are extra photo-dump styles.
- **Designs don't depend on drops:** a drop's filter travels inside the photo (its recipe) and its sticker art inside
  the sticker, so both work offline, after the drop is gone, and in project files.
- **12 new meme & social format templates** (63 in all): Nah / Yeah, Level Up, Nobody / Me, POV, Top & Bottom, Tier
  List, Starter Pack, Vibe Chart, Text Post Card, Thread, Hot Take, Rate My…
- **Authoring:** `npm run trends:check` validates every pack strictly (templates, stickers, looks, fonts, text styles,
  ids). `public/trends/pack.schema.json` validates in editors. See [TRENDS.md](TRENDS.md).
- **Fixed along the way:**
  - A drop going live after the build made the pre-rendered page and the browser disagree (a React hydration error). The
    first render now uses the build's drop, and today's drop follows right after.
  - Settings → About showed a stale "v0.3" badge. It now shows the real version.
  - A filters end-to-end check could mistake the empty-frame placeholder for the photo on a busy machine. It now waits
    for the photo's own colour.
- **Quality:**
  - 286 unit/component tests: feed, cache, scheduling, index path rules, sanitising and injection, kits, suggestions,
    and every published pack checked strictly and in sync with its bundled copy.
  - 128 Playwright runs across desktop, phone and no-WebGL: every Discover category and the archive, a scheduled drop
    going live, a drop from the feed then offline, downloads off (no requests), the pack-file preview, the Trends tool
    (suggestions, restyle, undo, palettes), drop filters and sticker art surviving a reload, a layout rule in the photo
    dump, the new formats, and the phone flow.

Known limits:

- Drops can only use the fonts bundled with the app, because designs must render offline and export identically.
- Layout rules are recipes over the built-in collage families.
- Suggestions are simple rules. The optional AI tools arrived in Phase 11.

## Phase 11 — Optional AI integrations ✅

All six AI tools from the brief work **on the device**, with no key, account or network. An AI server is optional.

- **Editor → Magic (<kbd>M</kbd>)**, on desktop and in the phone sheet:
  - **AI Caption:** four captions in six tones (casual, hype, minimal, witty, aesthetic, pro), written from the design's
    headline and words. Each has a call to action that fits the format, hashtags from its keywords, and a character
    count. _More ideas_ gives four more. Copy one, or add it as a text box.
  - **AI Color Palette:** a palette extracted from the design's photos, plus harmonies around any base colour —
    complementary, analogous, triadic, monochromatic, cinematic, pastel, neon, Y2K and dark luxury. Recolour in one tap
    (contrast kept) or copy the HEX codes.
  - **AI Font Pairing:** scored heading + body pairings from the bundled fonts (contrast, a readable body, the mood).
    One tap restyles all text and re-fits it.
  - **AI Background:** four concepts in the design's colours (fill + shapes that keep the middle calm) for this slide
    or every slide. The shapes are locked _Background art_ layers, and applying again replaces them.
  - **AI Resize:** 4:5, 1:1, 9:16, 16:9, and more under _Resize design…_ (also in the ⋯ menu and the command palette).
    A before/after preview, then _As a new design_ (a copy in the right format) or _Resize this one_ (one undo).
    Backgrounds stretch, pieces stay near their edges, text re-wraps, collages and panoramas re-arrange.
- **AI Layout — Auto in the smart photo dump:** measures each photo on the device (brightness, saturation, warmth,
  sharpness, a difference hash and the average colour). It leaves out near-duplicates, picks a cover, orders the photos
  so colours flow, chooses a vibe and a title, and explains the choice in one sentence.
- **Colour tools:** the colour picker takes HEX, RGB or HSL, next to the design's own colours and gradients. The
  palettes above cover extraction and the harmonies from the brief.
- **Optional AI server** (`server/ai-proxy/`): a Fetch-API handler with Node and Workers adapters that calls a Claude
  model through the Anthropic SDK.
  - The API key stays in the server's environment. The app only knows the server's address
    (`NEXT_PUBLIC_AI_ENDPOINT`).
  - Structured outputs, validated again on the server and in the app. The system prompt is cached and the design's
    text is fenced as content.
  - CORS allow-list, per-client rate limit, 16 KB body cap, and error mapping that never leaks upstream details.
  - It is only used when the site has one **and** the person turns it on in **Settings → AI tools**. It receives text,
    colours and photo measurements, never photos.
  - Any failure falls back to the on-device result with a notice. See [AI.md](AI.md).
- **Settings → AI tools** lists what runs on the device and has the server switch (or _Not set up_). Privacy says
  what leaves the device when the server is on.
- **Fixed along the way:**
  - A design's recorded size and format now follow its slides, so undoing an in-place resize restores both.
  - A single-slide design takes a background concept as its own background, so the Background tool shows it.
  - The Node AI server answered some unusual request methods by crashing. It now returns 400.
  - Version history could miss _When you opened it_ if Ctrl/⌘ S landed while the first edit was still saving. Whichever
    comes first now keeps the opened design.
- **Quality:**
  - 315 unit/component tests, including 17 for the AI tools, 7 for the AI server (fake client: no key, no cost), 2 for
    the words the tools read from a design, size/format tracking in the repository, and the version-history race.
  - 136 Playwright runs across desktop, phone and no-WebGL. New for this phase, on desktop and phone: captions from a template's words (copy, tones, add as text), every palette type
    with recolour and undo, font pairing, background concepts on one slide and every slide, resize as a copy and in
    place with undo, HEX/RGB/HSL, Auto with a near-duplicate left out, Settings → AI, and the phone flow — each checking
    that no request leaves the site.

Known limits:

- The on-device tools are rules and measurements, not a language model. Captions only know the design's words, not what
  its photos show.
- Smart resize adapts element by element and doesn't redesign a layout. A busy design moved to a very different shape
  may need a tidy-up.
- AI Background makes concepts from fills and shapes. It doesn't generate images.
- The AI server's rate limit is in memory, per process or isolate. Add the host's own limits for stricter control.

## Phase 12 — Performance ✅

Measured first (bundle analysis, CPU profiles and traces of the production build with source maps), then fixed what
the numbers showed. Details and numbers are in [PERFORMANCE.md](PERFORMANCE.md).

- **Less JavaScript up front:**
  - App-wide dialogs load on first use, prefetched when the page is idle: new design, photo flows, template preview,
    save template, export, command palette and onboarding.
  - So do the editor's tool panels and dialogs.
  - zod is imported so unused parts drop out.
  - Home went from 521 to 402 KB gzipped, the editor from 592 to 479 KB. `npm run perf:budget` (also in CI) keeps it
    that way.
- **Big photos never freeze the page:**
  - The import worker reads, hashes and scales the file itself.
  - Filter thumbnails develop in a worker, with no GPU read-backs on the page.
  - The worst stall importing a 24 MP photo went from 234 ms to about 55 ms.
- **Drawing only what changed:**
  - Mid-gesture, the editor caches what's below and above the moving elements as two layers.
  - Previews draw in short slices, only near the viewport, and only when their own slide changed. The slide strip no
    longer redraws every thumbnail on every drag move.
  - Discover's off-screen sections skip layout.
  - The top bar and rails no longer force a layout on render.
- **Memory:** photo and develop caches are sized by device memory (96/64 MB on 2 GB phones), and gesture layers and
  export canvases are freed as soon as they're done.
- **Export:** High and Maximum snapshot each slide to an encode worker. A 5-slide Maximum export went from 6.1 s to
  1.7 s.
- **Fixed along the way:**
  - The GL pipeline could sample the texture it was drawing into (a stale sampler binding), blanking a cut-out. Every
    pass now clears its texture units.
  - The new-design dialog, mounted on first use, ignored the format it was opened for.
- **Quality:** 315 unit/component tests and 139 Playwright runs across desktop, phone and no-WebGL.
  - A video test recorded its clip against the wall clock and could come out short on a busy machine; it now aims for
    the middle of the expected range.
  - New `e2e/performance.spec.ts` checks:
    - lazily loaded dialogs open for what was asked;
    - a 24-megapixel photo imports with no main-thread stall over 150 ms;
    - dragging in a carousel stays under that too.

Known limits:

- Motion (~45 KB gzipped) still loads with every page. Its lazy mode would hide elements that animate in until an
  extra chunk arrives.
- Export slides still render on the page, but encoding doesn't.

## Later phases (summary)

- **13 · Testing & hardening:** an accessibility audit, filling test gaps (large images, touch, responsive), a pass over
  every button and console message, and the brief's final quality checklist.
