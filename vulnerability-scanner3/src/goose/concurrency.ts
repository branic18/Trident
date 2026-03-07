type Task<T> = () => Promise<T>;

export class ConcurrencyLimiter {
  private maxConcurrency: number;
  private activeCount = 0;
  private queue: Array<() => void> = [];

  constructor(maxConcurrency: number) {
    this.maxConcurrency = Math.max(1, Math.floor(maxConcurrency));
  }

  setMaxConcurrency(maxConcurrency: number): void {
    this.maxConcurrency = Math.max(1, Math.floor(maxConcurrency));
    this.drainQueue();
  }

  async run<T>(task: Task<T>): Promise<T> {
    await this.acquire();
    try {
      return await task();
    } finally {
      this.release();
    }
  }

  private acquire(): Promise<void> {
    if (this.activeCount < this.maxConcurrency) {
      this.activeCount += 1;
      return Promise.resolve();
    }
    return new Promise(resolve => {
      this.queue.push(() => {
        this.activeCount += 1;
        resolve();
      });
    });
  }

  private release(): void {
    this.activeCount = Math.max(0, this.activeCount - 1);
    this.drainQueue();
  }

  private drainQueue(): void {
    while (this.activeCount < this.maxConcurrency && this.queue.length > 0) {
      const next = this.queue.shift();
      if (next) next();
    }
  }
}
