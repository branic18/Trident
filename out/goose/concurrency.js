"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ConcurrencyLimiter = void 0;
class ConcurrencyLimiter {
    maxConcurrency;
    activeCount = 0;
    queue = [];
    constructor(maxConcurrency) {
        this.maxConcurrency = Math.max(1, Math.floor(maxConcurrency));
    }
    setMaxConcurrency(maxConcurrency) {
        this.maxConcurrency = Math.max(1, Math.floor(maxConcurrency));
        this.drainQueue();
    }
    async run(task) {
        await this.acquire();
        try {
            return await task();
        }
        finally {
            this.release();
        }
    }
    acquire() {
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
    release() {
        this.activeCount = Math.max(0, this.activeCount - 1);
        this.drainQueue();
    }
    drainQueue() {
        while (this.activeCount < this.maxConcurrency && this.queue.length > 0) {
            const next = this.queue.shift();
            if (next)
                next();
        }
    }
}
exports.ConcurrencyLimiter = ConcurrencyLimiter;
//# sourceMappingURL=concurrency.js.map