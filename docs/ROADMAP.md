# Stardeck roadmap

Stardeck is built in phases. Each phase ends with the project building, linting, type-checking and passing its unit and
end-to-end tests before the next one starts. Anything not yet built is labelled **Soon** in the UI.

| #   | Phase                      | Status  |
| --- | -------------------------- | ------- |
| 1   | App shell & design system  | ✅ Done |
| 2   | Canvas editor              | ⏭️ Next |
| 3   | Image manipulation         | Planned |
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

## Phase 2 — Canvas editor (next)

Element editing on the existing renderer: selection & transform handles (DOM overlay), text/shape/sticker tools with
inline text editing, snapping & smart guides, rulers, multi-select, grouping, lock/hide, layers panel, copy/paste,
duplicate, delete, arrow-key nudging, space-to-pan, pinch-zoom and two-finger pan, properties panel.

## Later phases (summary)

- **3 · Images:** local asset store, drag-and-drop/upload with Web Worker decode + downscale, crop/rotate/flip, focal
  point, adjustments (brightness → curves) via WebGL with a Canvas2D fallback, background removal behind a pluggable
  local-model / WASM / optional-server interface.
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
