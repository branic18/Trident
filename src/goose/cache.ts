import * as crypto from 'crypto';

export type CacheEntry<T> = {
  data: T;
  timestamp: number;
  contextHash: string;
  recipeVersion: string;
  accessCount: number;
  lastAccess: number;
};

export type GooseCacheConfig = {
  maxEntries: number;
  maxAgeMs: number;
};

export function computeContextHash(context: unknown): string {
  const payload = JSON.stringify(context);
  return crypto.createHash('sha256').update(payload).digest('hex');
}

export class GooseCache<T> {
  private entries = new Map<string, CacheEntry<T>>();
  private maxEntries: number;
  private maxAgeMs: number;

  constructor(config: GooseCacheConfig) {
    this.maxEntries = Math.max(1, Math.floor(config.maxEntries));
    this.maxAgeMs = Math.max(1, Math.floor(config.maxAgeMs));
  }

  configure(config: Partial<GooseCacheConfig>): void {
    if (typeof config.maxEntries === 'number') {
      this.maxEntries = Math.max(1, Math.floor(config.maxEntries));
    }
    if (typeof config.maxAgeMs === 'number') {
      this.maxAgeMs = Math.max(1, Math.floor(config.maxAgeMs));
    }
  }

  get(vulnId: string, contextHash: string, recipeVersion: string): T | null {
    const entry = this.entries.get(vulnId);
    if (!entry) return null;
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

  set(vulnId: string, data: T, contextHash: string, recipeVersion: string): void {
    const now = Date.now();
    const entry: CacheEntry<T> = {
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

  getStats(): { size: number; maxEntries: number; maxAgeMs: number } {
    return {
      size: this.entries.size,
      maxEntries: this.maxEntries,
      maxAgeMs: this.maxAgeMs
    };
  }

  exportEntries(): { key: string; entry: CacheEntry<T> }[] {
    const items: { key: string; entry: CacheEntry<T> }[] = [];
    for (const [key, entry] of this.entries.entries()) {
      items.push({ key, entry });
    }
    return items;
  }

  loadEntries(items: { key: string; entry: CacheEntry<T> }[]): void {
    this.entries.clear();
    const now = Date.now();
    for (const item of items) {
      if (!item || !item.key || !item.entry) continue;
      const entry = item.entry;
      if (!entry || typeof entry.timestamp !== 'number') continue;
      if (now - entry.timestamp > this.maxAgeMs) continue;
      this.entries.set(item.key, entry);
    }
    this.evictIfNeeded();
  }

  clearAll(): void {
    this.entries.clear();
  }

  pruneByKeys(validKeys: Set<string>): void {
    for (const key of this.entries.keys()) {
      if (!validKeys.has(key)) {
        this.entries.delete(key);
      }
    }
  }

  private evictIfNeeded(): void {
    while (this.entries.size > this.maxEntries) {
      const oldestKey = this.entries.keys().next().value as string | undefined;
      if (!oldestKey) return;
      this.entries.delete(oldestKey);
    }
  }
}
