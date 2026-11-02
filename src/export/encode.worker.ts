/// Encodes export images off the main thread: the page hands over a snapshot of the
/// rendered canvas, and reading its pixels back and compressing them happen here.
import { serveWorker } from '@/utils/worker-rpc';

export interface EncodeRequest {
  bitmap: ImageBitmap;
  type: string;
  quality?: number;
}

serveWorker<EncodeRequest, Blob>(async ({ bitmap, type, quality }) => {
  try {
    const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('no-context');
    ctx.drawImage(bitmap, 0, 0);
    return { value: await canvas.convertToBlob({ type, quality }) };
  } finally {
    bitmap.close();
  }
});
