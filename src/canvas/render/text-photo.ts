import type { ImageElement, TextElement } from '@/types/document';

const frames = new WeakMap<TextElement, ImageElement>();

/**
 * The photo behind a photo-filled text element, as an image frame covering the text box. Image resolvers
 * (editor, previews, exports) load and size it like any photo; its id is the text's id plus `~photo`.
 * Designs are immutable, so one frame per text element is kept.
 */
export function textPhotoFrame(el: TextElement): ImageElement | null {
  if (!el.photoFill) return null;
  let frame = frames.get(el);
  if (!frame) {
    const { assetId, focusX, focusY, zoom } = el.photoFill;
    frame = {
      id: `${el.id}~photo`,
      type: 'image',
      x: el.x,
      y: el.y,
      width: el.width,
      height: el.height,
      rotation: el.rotation,
      opacity: 1,
      assetId,
      fit: 'cover',
      ...(focusX !== undefined ? { focusX } : {}),
      ...(focusY !== undefined ? { focusY } : {}),
      ...(zoom !== undefined ? { zoom } : {}),
    };
    frames.set(el, frame);
  }
  return frame;
}
