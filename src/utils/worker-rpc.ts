/**
 * Tiny request/response layer over Web Workers: every call gets an id, the
 * worker answers `{ id, ok, value | error }`. If the worker crashes, pending
 * calls reject and the next call starts a fresh worker.
 */

interface Envelope<T> {
  id: number;
  request: T;
}

type Reply<R> = { id: number; ok: true; value: R } | { id: number; ok: false; error: string } | { id: number; progress: unknown };

export interface WorkerClient<Req, Res> {
  call(request: Req, transfer?: Transferable[], onProgress?: (progress: unknown) => void): Promise<Res>;
  terminate(): void;
}

export class WorkerCallError extends Error {
  constructor(readonly code: string) {
    super(code);
    this.name = 'WorkerCallError';
  }
}

export function createWorkerClient<Req, Res>(spawn: () => Worker): WorkerClient<Req, Res> {
  let worker: Worker | null = null;
  let nextId = 1;
  const pending = new Map<
    number,
    { resolve: (v: Res) => void; reject: (e: Error) => void; onProgress?: (progress: unknown) => void }
  >();

  const failAll = (code: string) => {
    for (const p of pending.values()) p.reject(new WorkerCallError(code));
    pending.clear();
  };

  const ensure = () => {
    if (worker) return worker;
    const w = spawn();
    w.addEventListener('message', (e: MessageEvent<Reply<Res>>) => {
      const reply = e.data;
      const p = pending.get(reply.id);
      if (!p) return;
      if ('progress' in reply) {
        p.onProgress?.(reply.progress);
        return;
      }
      pending.delete(reply.id);
      if (reply.ok) p.resolve(reply.value);
      else p.reject(new WorkerCallError(reply.error));
    });
    w.addEventListener('error', (e) => {
      e.preventDefault();
      failAll('worker-crashed');
      w.terminate();
      if (worker === w) worker = null;
    });
    worker = w;
    return w;
  };

  return {
    call(request, transfer = [], onProgress) {
      return new Promise<Res>((resolve, reject) => {
        let w: Worker;
        try {
          w = ensure();
        } catch {
          reject(new WorkerCallError('worker-unavailable'));
          return;
        }
        const id = nextId++;
        pending.set(id, { resolve, reject, onProgress });
        const envelope: Envelope<Req> = { id, request };
        w.postMessage(envelope, transfer);
      });
    },
    terminate() {
      failAll('terminated');
      worker?.terminate();
      worker = null;
    },
  };
}

interface WorkerScope {
  postMessage(message: unknown, transfer?: Transferable[]): void;
  addEventListener(type: 'message', listener: (e: MessageEvent) => void): void;
}

/**
 * Worker side. The handler returns the value (and optionally transferables);
 * thrown errors with a string `code` are forwarded as that code.
 */
export function serveWorker<Req, Res>(
  handler: (request: Req, progress: (value: unknown) => void) => Promise<{ value: Res; transfer?: Transferable[] }>,
): void {
  const scope = self as unknown as WorkerScope;
  scope.addEventListener('message', (e: MessageEvent<Envelope<Req>>) => {
    const { id, request } = e.data;
    const progress = (value: unknown) => scope.postMessage({ id, progress: value } satisfies Reply<Res>);
    handler(request, progress).then(
      ({ value, transfer }) => scope.postMessage({ id, ok: true, value } satisfies Reply<Res>, transfer ?? []),
      (err: unknown) => {
        const code = err && typeof err === 'object' && 'code' in err ? String((err as { code: unknown }).code) : 'failed';
        scope.postMessage({ id, ok: false, error: code } satisfies Reply<Res>);
      },
    );
  });
}
