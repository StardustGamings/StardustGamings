# Stardeck roadmap

Stardeck is built in phases. Each phase ends with the project building, linting, type-checking and passing its unit and
end-to-end tests before the next one starts. Anything not yet built is labelled **Soon** in the UI.

| #   | Phase                      | Status  |
| --- | -------------------------- | ------- |
| 1   | App shell & design system  | ✅ Done |
| 2   | Canvas editor              | ✅ Done |
| 3   | Image manipulation         | ⏭️ Next |
| 4   | Carousel tools             | Planned |
| 5   | Template engine            | Planned |
| 6   | Filters & effects          | Planned |
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

## Phase 3 — Image manipulation (next)

Local asset store (IndexedDB blobs), upload / drag-and-drop / paste images with Web Worker decode & downscale, image
frames you can drop photos into, crop/rotate/flip, focal point, adjustments (brightness → curves) via WebGL with a
Canvas2D fallback, and background removal behind a pluggable local-model / WASM / optional-server interface.

## Later phases (summary)

- **4 · Carousels:** seamless panorama from multiple photos with live swipe preview, smart photo dump, collage engine
  with shuffle / "more chaotic / minimal / editorial / Gen-Z" and photo locking.
- **5 · Templates:** dozens of original layouts, save-as-template, template browser.
- **6 · Filters & effects:** 14 looks with intensity, grain, vignette, light leaks.
- **7 · Export:** PNG / JPG / WebP / PDF, per-slide / all / ZIP, quality presets, share sheet — never watermarked.
- **8 · Storage:** version history, folders, import/export project files, storage management.
- **9 · Animation & video:** element animations, timeline, MP4/GIF export where supported.
- **10 · Trends:** remote pack updates, meme & social formats, trend-driven suggestions.
- **11 · AI (optional, opt-in):** palette extraction, font pairing, AI resize and layout run locally; any cloud model is
  opt-in with clear disclosure and a server-side proxy for keys.
- **12–13 · Performance & hardening:** worker rendering, memory budgets for large images, accessibility audit, visual
  regression tests.
