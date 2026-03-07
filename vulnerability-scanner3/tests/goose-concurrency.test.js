const assert = require('assert');
const { ConcurrencyLimiter } = require('../out/goose/concurrency');

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function run() {
  const limiter = new ConcurrencyLimiter(2);
  let active = 0;
  let maxActive = 0;

  const tasks = Array.from({ length: 5 }).map(() =>
    limiter.run(async () => {
      active += 1;
      maxActive = Math.max(maxActive, active);
      await delay(25);
      active -= 1;
    })
  );

  await Promise.all(tasks);
  assert.ok(maxActive <= 2, `Expected max concurrency 2, saw ${maxActive}`);

  console.log('✅ Goose concurrency tests passed');
}

run().catch(err => {
  console.error('❌ Goose concurrency tests failed');
  console.error(err);
  process.exit(1);
});
