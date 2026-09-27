/**
 * Spreads canvas redraws over short tasks, so a page of previews (or a strip of
 * 30 slide thumbnails) never blocks input. Each key (usually a canvas) keeps
 * only its latest job: a thumbnail asked to redraw five times while it waits
 * draws once.
 */

const jobs = new Map<object, () => void>();
const SLICE_MS = 8;
let scheduled = false;
let post: (() => void) | null = null;

function pump() {
  scheduled = false;
  const until = performance.now() + SLICE_MS;
  for (const [key, job] of jobs) {
    jobs.delete(key);
    job();
    if (performance.now() >= until) break;
  }
  if (jobs.size > 0) schedule();
}

function schedule() {
  if (scheduled) return;
  scheduled = true;
  if (!post) {
    // A message is the fastest way to yield to the browser (setTimeout(0) gets clamped when nested).
    if (typeof MessageChannel !== 'undefined') {
      const channel = new MessageChannel();
      channel.port1.onmessage = pump;
      post = () => channel.port2.postMessage(null);
    } else post = () => setTimeout(pump, 0);
  }
  post();
}

/** Runs `job` soon, in a short slice. Returns a cancel function (for effect clean-ups). */
export function scheduleDraw(key: object, job: () => void): () => void {
  jobs.set(key, job);
  schedule();
  return () => {
    if (jobs.get(key) === job) jobs.delete(key);
  };
}
