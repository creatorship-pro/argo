/**
 * Audio stays on the iPad until its upload succeeds. Each segment keeps its
 * own index, so a retry after a dropped connection never makes a duplicate and
 * never loses order. This file holds only the queue's rules; the browser code
 * that records audio feeds it.
 */
export interface QueuedSegment<T> {
  index: number;
  payload: T;
  attempts: number;
}

export interface QueueOptions {
  /** Waits before the next try, in ms, by attempt number (1 = first retry). */
  backoff?: (attempt: number) => number;
  maxAttempts?: number;
  sleep?: (ms: number) => Promise<void>;
}

export const defaultBackoff = (attempt: number) =>
  Math.min(30_000, 1_000 * 2 ** (attempt - 1));

export class UploadQueue<T> {
  private items: QueuedSegment<T>[] = [];
  private running = false;
  private nextIndex = 0;
  private opts: Required<QueueOptions>;

  constructor(
    private send: (segment: QueuedSegment<T>) => Promise<void>,
    opts: QueueOptions = {},
  ) {
    this.opts = {
      backoff: opts.backoff ?? defaultBackoff,
      maxAttempts: opts.maxAttempts ?? 8,
      sleep: opts.sleep ?? ((ms) => new Promise((r) => setTimeout(r, ms))),
    };
  }

  get pending(): number {
    return this.items.length;
  }

  push(payload: T): number {
    const index = this.nextIndex++;
    this.items.push({ index, payload, attempts: 0 });
    return index;
  }

  /** Sends everything in order. Stops, keeping the rest, if a segment keeps failing. */
  async flush(): Promise<{ sent: number; failed: number }> {
    if (this.running) return { sent: 0, failed: this.items.length };
    this.running = true;
    let sent = 0;
    try {
      while (this.items.length > 0) {
        const head = this.items[0];
        try {
          await this.send(head);
          this.items.shift();
          sent += 1;
        } catch {
          head.attempts += 1;
          if (head.attempts >= this.opts.maxAttempts) break;
          await this.opts.sleep(this.opts.backoff(head.attempts));
        }
      }
    } finally {
      this.running = false;
    }
    return { sent, failed: this.items.length };
  }
}
