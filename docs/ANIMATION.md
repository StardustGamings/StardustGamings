# Animation & video

Any design can move: elements animate in, out and on a loop, slides play in order with a transition between them, and
photo frames can hold short video clips. It all plays in the editor and exports as **MP4** or **GIF**, made on this
device and never watermarked. Still exports (PNG, JPG, WebP, PDF) always show the finished design, with every element
in place.

## Animating elements

Open the **Animate** tool: the rail button, <kbd>A</kbd>, _Animate_ in the command palette, or the phone selection bar.
With something selected you get three independent choices, each with a live mini preview:

| Kind         | Presets                                                                                                                                             | Settings                                               |
| ------------ | --------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------ |
| **Entrance** | Fade, Slide, Zoom, Bounce, Pop, Rotate, Blur reveal, Typewriter (text types out letter by letter in place; other elements wipe in), Glitch, Elastic | Delay, duration, and direction for Slide and Bounce    |
| **Exit**     | Fade, Slide, Zoom, Pop, Rotate, Blur                                                                                                                | Duration (it ends with the slide), direction for Slide |
| **Loop**     | Parallax (a slow drift that gives depth), Float, Pulse                                                                                              | Intensity, direction for Parallax                      |

Picking an entrance plays the slide from the start so you see it straight away. Each change is one undo step.

**Auto-animate** animates a whole design (or just this slide) in one of three vibes. Each element gets an entrance that
suits its role (headlines, body text, photos, stickers, shapes), and backgrounds stay put. Entrances are staggered top
to bottom, slide lengths fit the motion, and a matching transition is set:

- **Smooth:** fades, slides and slow parallax, with a swipe between slides.
- **Playful:** pops, bounces and elastic snaps, with zooms between slides.
- **Glitchy:** glitches, typewriter text and hard cuts.

Everything auto-animate sets can be edited afterwards, and _Remove animations_ clears it.

## Timing and the timeline

- **Slide length.** Each slide lasts 3 s by default (0.5–60 s). _Fit_ sets it to when the last element settles plus
  1.5 s to take it in (at least 3 s), or longer when a video clip needs the time to play through.
- **Transition.** Swipe, Fade, Zoom or Cut, with its own duration. The next slide starts animating as the transition
  begins, so the motion flows across the cut.
- **Timeline (desktop).** It opens under the canvas with the Animate tool and shows the active slide:
  - Each element is a row. Its entrance is a bar: drag it to change the delay, and drag its right edge to change the
    duration. Exits and loops show too.
  - Drag the slide's end marker to change its length.
  - Click or drag the ruler to scrub. The canvas shows that exact moment.
  - Moves snap to 50 ms. Arrow keys move a focused bar (<kbd>⇧</kbd> resizes it), and every drag is a single undo step.
- **Phones** get the same controls in the Animate sheet, with a _Preview time_ slider in place of the timeline.
- **Playing.** _Play slide_ runs the active slide on the canvas, and _Loop_ repeats it. Touching the canvas or closing
  the tool stops the preview and puts the design back at rest, ready to edit. _Preview → Play as video_ plays the whole
  design with its transitions, exactly as the export will.

## Video clips

- **Adding a clip.** Use _Add a video_ in the Photos tool, drop a file on the canvas (onto a frame to fill it), or use
  the photo picker. MP4, WebM and MOV work, up to **2 minutes** and 300 MB. Clips live in the local library next to
  your photos, marked with their length.
- **Clips behave like photos.** They crop, sit in frames, take looks, adjustments and effects, and travel in `.stardeck`
  project files and backups.
- **Playback settings** (the _Playback_ section when a clip is selected):
  - Trim start and end.
  - Speed: 0.5×, 1×, 1.5× or 2×.
  - Sound on or off, and _Loop clip_. When looping is off, the last frame holds.
  - _Fit slide_ sets the slide to the clip's length.
  - A new clip plays its first 15 seconds, looped, with sound, and the slide stretches to fit it.
- **On-screen playback.** The editor shows the clip moving while you preview and a still (poster) frame while you edit.
  Looks and adjustments on moving video need WebGL on screen. Without it the panel says so and shows them on the still
  frame, and exports still apply them.
- **Privacy.** Clips never leave the device. They are decoded by the browser's own video element and stored in
  IndexedDB. The Content-Security-Policy allows `media-src 'self' blob:` for exactly this: local object URLs, no remote
  media.

## Export: MP4 and GIF

Choose **MP4** or **GIF** in the Export dialog. They play **all slides, in order**, or one slide. The dialog shows the
output size, frame rate and length before you start.

| Quality      | MP4                                           | GIF                       |
| ------------ | --------------------------------------------- | ------------------------- |
| **Standard** | Design size (1×, long edge up to 1920 px)     | Long edge 480 px, 15 fps  |
| **High**     | 1.5× (long edge up to 2560 px)                | Long edge 720 px, 20 fps  |
| **Maximum**  | 2× (long edge up to 3840 px), highest bitrate | Long edge 1080 px, 24 fps |

- **MP4** is 30 fps, encoded by the browser's own WebCodecs `VideoEncoder` and packed with
  [mp4-muxer](https://github.com/Vanilagy/mp4-muxer) (MIT). The codec is **H.264** wherever the browser has it (Chrome,
  Edge, Safari), otherwise VP9 or AV1. The done screen names the codec, and suggests Chrome, Edge or Safari when H.264
  wasn't available, since some social apps only accept H.264. Where the browser can't encode video at all, MP4 is
  disabled with a note, and GIF still works.
- **Sound.** Unmuted clips are mixed (trimmed, sped up or slowed, looped, placed on their slide) with an
  `OfflineAudioContext` and encoded as **AAC**, or Opus where AAC isn't available. A design with no sound, or with every
  clip muted, exports a silent MP4 with no audio track.
- **GIF** is encoded by [gifenc](https://github.com/mattdesl/gifenc) (MIT), with a palette per frame and an endless
  loop. GIFs are limited to **30 s**. MP4s are limited to 10 minutes.
- **Frame accuracy.** Every frame is drawn by the same renderer as the editor at an exact time. Video clips are seeked
  frame by frame rather than played in real time, and looks on video are developed per frame (GPU, or the CPU worker
  without WebGL). The output doesn't depend on how fast the device is. A slower device just takes longer.
- **Loading.** The encoders are loaded only when a video export starts, so the rest of the app stays light. Like every
  export, it works offline and can be cancelled.

## Templates

Templates can carry motion. 14 of the 51 built-in templates are **animated**, using the same vibes as auto-animate:
The Issue, Five Tips, Cinema Frames, Sticker Board, Y2K Era, Main Character, New Drop, Breaking News, Countdown,
Episode Cover, GRWM, Quote Card, Versus and Loud Hours. The Templates page has an **✦ Animated** filter, animated
cards carry a badge, and the preview can **Play animation** before you use one. Templates you save keep their
animations. Video clips are removed from saved templates, like photos.

## How it works

```
document (animation data)  ─▶  planSequence (slide order, starts, overlaps)  ─▶  frameAt(t)  ─▶  poseAt per element
                                                                                               │
                                              editor canvas · Preview · MP4/GIF frames  ◀──  drawFrame / renderDocument
```

| File                                                 | Role                                                                                                                                 |
| ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| `src/types/animation.ts`                             | The model: `element.animation {enter, exit, loop}`, `slide.duration`, `doc.motion {transition}`, `image.video` clip                  |
| `src/animations/engine.ts`                           | Pure: presets, easing, and `poseAt(element, time)`, which gives opacity, offset, scale, rotation, blur, reveal and glitch, or hidden |
| `src/animations/sequence.ts`                         | Pure: slide timings, transition overlap, which slides are on screen at a moment, and clip time for trimmed or sped-up video          |
| `src/animations/auto.ts`                             | Auto-animate: element roles, vibe presets, stagger, slide lengths                                                                    |
| `src/animations/frame.ts`                            | `drawFrame`: one moment of the design, with swipe, fade, zoom or cut transitions                                                     |
| `src/canvas/render/renderer.ts`                      | Applies poses when given a `time` (without one, it shows the design at rest). Typewriter text keeps its final layout                 |
| `src/editor/playback.ts`                             | The preview clock (play, pause, seek, loop) the canvas and timeline follow                                                           |
| `src/editor/Timeline.tsx`, `panels/AnimatePanel.tsx` | Editing UI                                                                                                                           |
| `src/assets/video.ts`                                | Video import (sniffed, poster frames, de-duplicated), the live player pool, and exact frames for export                              |
| `src/export/motion-plan.ts`, `motion.ts`             | Sizes, frame rates, codec choice, then frame-by-frame rendering, audio mixing and MP4 or GIF encoding                                |

Animation data is validated by the project schema like everything else, so `.stardeck` files and templates carrying
motion are checked on import. Designs from earlier versions simply have no animation: they play as still slides.

## Tests

- `src/animations/animations.test.ts`: easing end points, every preset settling at rest, poses before, during and after
  entrances and exits, transition overlaps, clip timing (trim, speed, loop), typewriter and blur in the renderer, and
  auto-animate.
- `src/export/motion.test.ts`: output sizes (even pixels, caps), frame rates, file names and a real GIF encoded and
  read back.
- `e2e/motion.spec.ts` (desktop, phone, no-WebGL):
  - Presets, timeline drag and scrub checked by canvas pixels, play and undo.
  - Auto-animate with transitions, and _Play as video_.
  - MP4 and GIF downloads parsed and played back for length and size.
  - A recorded clip with sound: trimmed and sped up, then exported with and without its sound track.
  - Animated templates, and the phone flow.

## Known limits

- Changing a clip's speed changes the pitch of its sound, like a record played faster.
- Instagram and TikTok may re-encode or refuse VP9 or AV1 MP4s. Export from Chrome, Edge or Safari to get H.264.
- Elements animate as a whole. Typewriter reveals text letter by letter, but there's no per-word animation and no
  keyframed motion paths.
- Very long or very large videos take time and memory on phones. Standard quality is the safe choice there.
