const assert = require('assert');
const fs = require('fs');
const path = require('path');

function run() {
  const securityPath = path.join(__dirname, '..', 'out', 'goose', 'security.js');
  const contents = fs.readFileSync(securityPath, 'utf8');

  assert.ok(
    contents.includes('--params-file'),
    'Expected Goose execution to use --params-file'
  );
  assert.ok(
    contents.includes('createSecureTempFile'),
    'Expected secure temp file usage'
  );

  console.log('✅ Secure Goose execution config tests passed');
}

try {
  run();
} catch (err) {
  console.error('❌ Secure Goose execution config tests failed');
  console.error(err);
  process.exit(1);
}
