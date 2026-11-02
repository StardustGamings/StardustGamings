# AI tools

Stardeck's AI tools are optional helpers. They all work **on the device**, with no account, key or network, and the app is
fully usable without them. A site can also run an **AI server** that writes freer captions, font pairings, background
concepts and carousel plans. The server is off unless the site was built with one _and_ the person turns it on, and it never
receives photos.

Whatever a tool produces is ordinary, editable design content: a text box, colours, fonts, locked shapes you can unlock,
a new size. Every change to a design is one undo step.

## Where the tools are

| Place                                         | Tool                                                                                                                               |
| --------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| **Editor → Magic** (<kbd>M</kbd>)             | Captions & hashtags, colour palettes, font pairing, background ideas, resize, and a shortcut to the photo dump                     |
| **Editor → ⋯ → Resize design…**               | Smart resize: preview the design at another size, then save a copy or resize this one (also in the command palette)                |
| **Smart photo dump → Auto**                   | AI layout: the photos choose the cover, order, vibe and title                                                                      |
| **Colour picker** (every fill and background) | HEX, RGB and HSL input, the design's own colours, gradients                                                                        |
| **Settings → AI tools**                       | What runs where, and — only on a site with an AI server — the switch that turns it on. _Settings → Privacy_ shows whether it is on |

## The tools (on the device)

| Tool (brief)         | What it does                                                                                                                                                                                                                                                                                                                                                                                                                                               | Code                    |
| -------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------- |
| **AI Caption**       | Reads the design's words: the headline (the largest text that has real words in it, so a big decorative “ doesn't count) and then the rest in reading order. Writes four captions in a tone (casual, hype, minimal, witty, aesthetic, pro) with a call to action that fits the format and slide count, plus hashtags from the design's keywords (filler words, @handles and links left out). _More ideas_ gives four more. Copy, or add one as a text box. | `src/ai/captions.ts`    |
| **AI Color Palette** | Extracts a palette from the photos in the design (the colours measured when each photo was imported, merged, plus a light and a dark for text). Builds harmonies around a base colour: complementary, analogous, triadic, monochromatic, cinematic, pastel, neon, Y2K and dark luxury. Tap one to recolour the design (text contrast is kept) or copy its HEX codes.                                                                                       | `src/ai/palettes.ts`    |
| **AI Font Pairing**  | Scores every heading + body combination of the bundled fonts: contrast between the two, a body face that reads well small (never a script or display face), weight range when both are the same family, and fit with the design's mood. Keeps the headline's current font in the running. Tap one to restyle all text (headings take the heading font); text boxes re-fit.                                                                                 | `src/ai/fonts.ts`       |
| **AI Background**    | Four concepts in the design's colours: soft glow, spotlight, aurora, split block, confetti shapes, sunset bands. Each is a fill plus a few shapes that keep the middle calm. Apply to this slide or every slide. The shapes go behind everything, locked and named _Background art_; applying again replaces them.                                                                                                                                         | `src/ai/backgrounds.ts` |
| **AI Layout**        | Measures each photo from its thumbnail: brightness, saturation, warmth, sharpness and a difference hash. Leaves out near-duplicates (a similar hash _and_ a similar average colour), picks a cover that is sharp, well exposed and colourful, orders the rest so colours flow from slide to slide, picks a vibe from the mood and writes a short title. Explains its choice in one sentence.                                                               | `src/ai/layout.ts`      |
| **AI Resize**        | 4:5, 1:1, 9:16 and 16:9, plus 1.91:1, 2:3 and A-series. Full-bleed pieces stretch to the new shape (photos re-crop, since frames cover-fit). Bands stretch along their long side. Everything else scales evenly and stays near the edge it was on, inside the slide. Text re-wraps at a matching size; collages and panoramas re-arrange. A copy gets the format that fits its size.                                                                       | `src/ai/resize.ts`      |

These are deterministic algorithms, not a language model. They are quick, private and predictable, but plainer than a
model's writing. That is what the optional server is for.

## Privacy: what leaves the device

- **By default, nothing.** No tool makes a network request. The end-to-end tests check that every tool, including Auto in
  the photo dump, sends no request anywhere except the site itself.
- **With an AI server** (the site has one _and_ the person switched it on in Settings), the Magic panel says so at the
  top and names the server. What is sent per tool:

  | Tool         | Sent                                                                                                                 | Never sent            |
  | ------------ | -------------------------------------------------------------------------------------------------------------------- | --------------------- |
  | Caption      | The design's text (headline first, up to 40 pieces), format, slide count, tone, a colour mood such as "warm · vivid" | Photos, project names |
  | Font pairing | The headline, its current font, the colour mood                                                                      | Photos                |
  | Background   | Up to 8 colours, the slide's aspect ratio, the colour mood                                                           | Photos                |
  | Auto layout  | Per photo: its size, brightness, saturation, warmth, sharpness, 5-colour palette and duplicate flag                  | The photos themselves |

  Palettes and resize always stay on the device.

- If the server can't answer (offline, rate-limited, declined, an invalid reply), the tool uses its on-device result and
  says so in a short notice. It never blocks.

## Running an AI server

The server lives in `server/ai-proxy/`. It is a small Fetch-API handler with two adapters: Node (`node.ts`) and
Cloudflare Workers or similar (`worker.ts`). It calls a Claude model through the official Anthropic SDK. The model is
configurable with `AI_MODEL`.

1. **Start the server** somewhere with an Anthropic API key:

   ```bash
   ANTHROPIC_API_KEY=sk-ant-… ALLOWED_ORIGINS=https://stardeck.example npm run ai-proxy
   ```

   `npm run ai-proxy:build` bundles `server/dist/ai-proxy.mjs` (Node 20+) and `server/dist/ai-worker.mjs` (Workers) so they
   can be deployed without the repository. For Workers, set `ANTHROPIC_API_KEY` as a secret and `ALLOWED_ORIGINS` as a variable.

   | Variable            | Meaning                                                                                            |
   | ------------------- | -------------------------------------------------------------------------------------------------- |
   | `ANTHROPIC_API_KEY` | The model API key. Only ever in the server's environment.                                          |
   | `ALLOWED_ORIGINS`   | Required. Comma-separated sites allowed to call the server, e.g. `https://stardeck.example`.       |
   | `PORT`              | Node only. Default `8787`.                                                                         |
   | `TRUST_PROXY`       | Node only. `1` to rate-limit by `X-Forwarded-For` when the server sits behind a proxy you control. |
   | `RATE_LIMIT`        | Node only. Requests per client per minute (default 20).                                            |
   | `AI_MODEL`          | Optional. The Claude model id to use instead of the default.                                       |

2. **Build the app** with the server's address and allow it in the Content Security Policy:

   ```bash
   NEXT_PUBLIC_AI_ENDPOINT=https://ai.stardeck.example npm run build
   ```

   In `public/_headers`, add the same origin to `connect-src` (for example
   `connect-src 'self' https://ai.stardeck.example`). `scripts/serve.mjs` does this by itself for local testing.

3. People turn it on in **Settings → AI tools** (_Use the AI server_). It stays off until they do.

### What the server does

- **Endpoints:** `POST /caption`, `/fonts`, `/background` and `/layout`, each taking the JSON the app sends. The schemas are
  in `src/ai/schemas.ts` and shared by the app, the client and the server.
- **Requests to the model:**
  - Structured outputs: the reply must match the task's JSON schema.
  - It is checked again with the app's own schema before it is returned, and the app validates it a third time.
  - A fixed system prompt is marked for prompt caching.
  - Low effort, because these are small, well-specified tasks.
  - Server-side fallback: if the model declines, the API retries on its recommended fallback model.
- **Prompts** (`server/ai-proxy/prompts.ts`):
  - The system prompt lists the bundled fonts, so pairings only name fonts the app has.
  - The design's text is fenced in `<design_text>` tags and treated as material, not instructions. The tags are stripped
    from the text itself.
- **Security:**
  - The API key never reaches the browser, and the static app never imports server code.
  - CORS allows only `ALLOWED_ORIGINS`; other origins get `403`.
  - Each client is rate-limited (`429` with `Retry-After`).
  - Bodies are capped at 16 KB and must be `application/json`.
  - Requests are schema-checked (`400`), and unknown paths get `404`.
  - Errors are mapped without leaking upstream details: a refusal is `422`, an unusable reply `502`, rejected
    credentials `500 misconfigured` (logged on the server), other upstream errors `502`.
  - Replies carry `no-store` and `nosniff`.
- **Cost:** each request is one short model call. The rate limit and the 16 KB cap bound what one client can spend. The
  in-memory limiter is per process or isolate, so add your platform's own rate limiting for stricter guarantees.

## Tests

- `src/ai/ai.test.ts` (17): captions in every tone (valid hashtags, deterministic per seed, a long quote's first clause,
  no filler or handles in hashtags), palettes and harmonies, font scoring, background concepts (including replacing earlier
  art and single-slide designs), photo measuring, duplicate detection and carousel plans, resize (bleed, anchoring, text
  re-fit, collages), formats for sizes, and the AI-server client (validation, error kinds, not configured).
- `server/ai-proxy/handler.test.ts` (7): the model request (structured output, caching, fallback), a stable system prompt
  and text fencing, origin / method / content-type / size / schema checks and preflight, rate limiting, refusals and
  unusable replies, error mapping without leaking the key, and an end-to-end round trip with the app's client. These tests
  use a fake client, so they need no key and cost nothing.
- `src/editor/ai-actions.test.ts` (2): the headline is the biggest text with real words, the rest is read slide by slide,
  and what is sent stays small in any script.
- `src/projects/repository.test.ts`: a design's size and format follow its slides after an in-place resize and its undo.
- `e2e/ai.spec.ts` (desktop and phone):
  - captions from a template's own words, copy, other tones, add as text;
  - every palette type, recolour and undo;
  - font pairing and background concepts (this slide, every slide);
  - resize as a copy and in place, with undo;
  - HEX, RGB and HSL in the colour picker;
  - Auto in the photo dump, leaving out a near-duplicate;
  - Settings → AI;
  - the phone flow;
  - no request leaving the site in any of them.

## Known limits

- The on-device tools are rules and measurements, not a language model. Captions follow templates, and they only know the
  words in the design, not what the photos show.
- Smart resize works per element. It doesn't re-think a layout, so a busy 9:16 design moved to 16:9 may need a tidy-up.
- AI Background suggests concepts made of fills and shapes. It doesn't generate images.
- Photo-dump captions are still set per vibe. Use _Magic → Caption_ for captions written from the words in your design.
- The AI server's rate limit is in memory, per process or isolate.
