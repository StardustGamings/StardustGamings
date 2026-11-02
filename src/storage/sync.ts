/**
 * Keeps several open tabs (or installed-app windows) in step. Every write to
 * local storage announces what changed on a BroadcastChannel, and the other
 * tabs refresh their lists — or, for a design open in two places, offer to
 * load the newer copy instead of silently overwriting it.
 *
 * Nothing leaves the device: BroadcastChannel only reaches same-origin tabs of
 * this browser. A channel never receives its own messages, so a tab doesn't
 * react to its own writes.
 */

export type SyncMessage =
  /** A project's meta or document changed, or it was deleted. */
  | { type: 'project'; id: string }
  /** Many projects or folders changed at once (import, empty trash, erase…). */
  | { type: 'library' }
  /** A project's version history changed. */
  | { type: 'versions'; projectId: string }
  /** Photos or stickers were added or removed. */
  | { type: 'assets' };

type Handler = (message: SyncMessage) => void;

const CHANNEL = 'stardeck-sync';
let channel: BroadcastChannel | null | undefined;
const handlers = new Set<Handler>();

function getChannel(): BroadcastChannel | null {
  if (channel !== undefined) return channel;
  if (typeof window === 'undefined' || typeof window.BroadcastChannel !== 'function') return (channel = null);
  try {
    channel = new window.BroadcastChannel(CHANNEL);
    channel.onmessage = (e: MessageEvent<SyncMessage>) => {
      if (!e.data || typeof e.data !== 'object' || typeof e.data.type !== 'string') return;
      for (const handler of handlers) handler(e.data);
    };
  } catch {
    channel = null;
  }
  return channel;
}

/** Tells other tabs that something changed. */
export function notify(message: SyncMessage): void {
  try {
    getChannel()?.postMessage(message);
  } catch {
    /* A closed channel (page unloading) — nothing to tell. */
  }
}

/** Listens for changes made in other tabs. Returns an unsubscribe function. */
export function subscribe(handler: Handler): () => void {
  getChannel();
  handlers.add(handler);
  return () => handlers.delete(handler);
}
