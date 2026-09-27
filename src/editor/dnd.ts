/** Payload for dragging items from the tool panels onto the canvas. */
export const DND_TYPE = 'application/x-stardeck-item';

export type DragItem =
  | { kind: 'text'; presetId: string }
  | { kind: 'shape'; presetId: string }
  | { kind: 'sticker'; stickerId: string }
  | { kind: 'photo'; assetId: string }
  | { kind: 'frame'; presetId: string };
