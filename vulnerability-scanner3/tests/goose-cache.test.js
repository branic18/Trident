const assert = require('assert');
const { GooseCache } = require('../out/goose/cache');

function run() {
  const originalNow = Date.now;
  try {
    const cache = new GooseCache({ maxEntries: 2, maxAgeMs: 1000 });

    Date.now = () => 1000;
    cache.set('a', { ok: 1 }, 'hash1', 'v1');
    cache.set('b', { ok: 2 }, 'hash2', 'v1');

    Date.now = () => 1200;
    assert.deepStrictEqual(cache.get('a', 'hash1', 'v1'), { ok: 1 });

    // LRU: access 'a' so 'b' becomes least recently used
    Date.now = () => 1300;
    cache.set('c', { ok: 3 }, 'hash3', 'v1');
    assert.strictEqual(cache.get('b', 'hash2', 'v1'), null, 'Expected LRU eviction');
    assert.deepStrictEqual(cache.get('a', 'hash1', 'v1'), { ok: 1 });

    // TTL expiration
    Date.now = () => 3005;
    assert.strictEqual(cache.get('a', 'hash1', 'v1'), null, 'Expected TTL expiration');

    // Context hash mismatch
    Date.now = () => 4000;
    cache.set('d', { ok: 4 }, 'hash4', 'v1');
    assert.strictEqual(cache.get('d', 'hashX', 'v1'), null, 'Expected context hash mismatch to invalidate');

    console.log('✅ Goose cache tests passed');
  } finally {
    Date.now = originalNow;
  }
}

try {
  run();
} catch (err) {
  console.error('❌ Goose cache tests failed');
  console.error(err);
  process.exit(1);
}
