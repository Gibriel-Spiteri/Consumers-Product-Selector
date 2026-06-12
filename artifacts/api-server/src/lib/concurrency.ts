/**
 * A minimal counting semaphore. Limits how many async operations may run
 * concurrently; callers beyond the cap queue FIFO until a slot frees up.
 */
export class Semaphore {
  private active = 0;
  private readonly queue: Array<() => void> = [];
  private readonly max: number;

  constructor(max: number) {
    this.max = Math.max(1, Math.floor(max) || 1);
  }

  private acquire(): Promise<void> {
    if (this.active < this.max) {
      this.active += 1;
      return Promise.resolve();
    }
    return new Promise<void>((resolve) => {
      this.queue.push(() => {
        this.active += 1;
        resolve();
      });
    });
  }

  private release(): void {
    this.active -= 1;
    const next = this.queue.shift();
    if (next) next();
  }

  /** Runs `fn` once a slot is available, releasing the slot when it settles. */
  async run<T>(fn: () => Promise<T>): Promise<T> {
    await this.acquire();
    try {
      return await fn();
    } finally {
      this.release();
    }
  }
}
