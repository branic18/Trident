"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GooseCache = void 0;
exports.computeContextHash = computeContextHash;
const crypto = require("crypto");
function computeContextHash(context) {
    const payload = JSON.stringify(context);
    return crypto.createHash('sha256').update(payload).digest('hex');
}
class GooseCache {
    constructor(config) {
        this.entries = new Map();
        this.maxEntries = Math.max(1, Math.floor(config.maxEntries));
        this.maxAgeMs = Math.max(1, Math.floor(config.maxAgeMs));
    }
    configure(config) {
        if (typeof config.maxEntries === 'number') {
            this.maxEntries = Math.max(1, Math.floor(config.maxEntries));
        }
        if (typeof config.maxAgeMs === 'number') {
            this.maxAgeMs = Math.max(1, Math.floor(config.maxAgeMs));
        }
    }
    get(vulnId, contextHash, recipeVersion) {
        const entry = this.entries.get(vulnId);
        if (!entry)
            return null;
        if (entry.contextHash !== contextHash || entry.recipeVersion !== recipeVersion) {
            this.entries.delete(vulnId);
            return null;
        }
        const now = Date.now();
        if (now - entry.timestamp > this.maxAgeMs) {
            this.entries.delete(vulnId);
            return null;
        }
        entry.accessCount += 1;
        entry.lastAccess = now;
        this.entries.delete(vulnId);
        this.entries.set(vulnId, entry);
        return entry.data;
    }
    set(vulnId, data, contextHash, recipeVersion) {
        const now = Date.now();
        const entry = {
            data,
            contextHash,
            recipeVersion,
            timestamp: now,
            accessCount: 1,
            lastAccess: now
        };
        this.entries.set(vulnId, entry);
        this.evictIfNeeded();
    }
    getStats() {
        return {
            size: this.entries.size,
            maxEntries: this.maxEntries,
            maxAgeMs: this.maxAgeMs
        };
    }
    exportEntries() {
        const items = [];
        for (const [key, entry] of this.entries.entries()) {
            items.push({ key, entry });
        }
        return items;
    }
    loadEntries(items) {
        this.entries.clear();
        const now = Date.now();
        for (const item of items) {
            if (!item || !item.key || !item.entry)
                continue;
            const entry = item.entry;
            if (!entry || typeof entry.timestamp !== 'number')
                continue;
            if (now - entry.timestamp > this.maxAgeMs)
                continue;
            this.entries.set(item.key, entry);
        }
        this.evictIfNeeded();
    }
    pruneByKeys(validKeys) {
        for (const key of this.entries.keys()) {
            if (!validKeys.has(key)) {
                this.entries.delete(key);
            }
        }
    }
    evictIfNeeded() {
        while (this.entries.size > this.maxEntries) {
            const oldestKey = this.entries.keys().next().value;
            if (!oldestKey)
                return;
            this.entries.delete(oldestKey);
        }
    }
}
exports.GooseCache = GooseCache;
//# sourceMappingURL=cache.js.map