"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ConcurrencyLimiter = void 0;
class ConcurrencyLimiter {
    constructor(maxConcurrency) {
        this.activeCount = 0;
        this.queue = [];
        this.maxConcurrency = Math.max(1, Math.floor(maxConcurrency));
    }
    setMaxConcurrency(maxConcurrency) {
        this.maxConcurrency = Math.max(1, Math.floor(maxConcurrency));
        this.drainQueue();
    }
    run(task) {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.acquire();
            try {
                return yield task();
            }
            finally {
                this.release();
            }
        });
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