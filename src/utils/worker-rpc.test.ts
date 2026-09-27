import { describe, expect, it } from 'vitest';
import { createWorkerClient, WorkerCallError } from './worker-rpc';

/** A stand-in Worker that answers in-process. */
class FakeWorker extends EventTarget {
  terminated = false;
  constructor(private readonly handle: (msg: { id: number; request: unknown }, reply: (data: unknown) => void) => void) {
    super();
  }
  postMessage(msg: { id: number; request: unknown }) {
    queueMicrotask(() =>
      this.handle(msg, (data) => this.dispatchEvent(Object.assign(new Event('message'), { data }) as MessageEvent)),
    );
  }
  terminate() {
    this.terminated = true;
  }
}

describe('worker RPC', () => {
  it('matches replies to calls and forwards progress', async () => {
    const progress: unknown[] = [];
    const client = createWorkerClient<number, number>(
      () =>
        new FakeWorker(({ id, request }, reply) => {
          reply({ id, progress: 0.5 });
          reply({ id, ok: true, value: (request as number) * 2 });
        }) as unknown as Worker,
    );
    const [a, b] = await Promise.all([client.call(2, [], (p) => progress.push(p)), client.call(5)]);
    expect([a, b]).toEqual([4, 10]);
    expect(progress).toEqual([0.5]);
  });

  it('turns worker errors into coded rejections and recovers after a crash', async () => {
    let spawned = 0;
    let crash = true;
    const client = createWorkerClient<string, string>(() => {
      spawned++;
      const w = new FakeWorker(({ id, request }, reply) => {
        if (crash) {
          crash = false;
          w.dispatchEvent(new Event('error'));
          return;
        }
        reply(request === 'bad' ? { id, ok: false, error: 'decode' } : { id, ok: true, value: 'ok' });
      });
      return w as unknown as Worker;
    });
    await expect(client.call('x')).rejects.toMatchObject({ code: 'worker-crashed' });
    await expect(client.call('bad')).rejects.toBeInstanceOf(WorkerCallError);
    await expect(client.call('good')).resolves.toBe('ok');
    expect(spawned).toBe(2);
  });
});
