const assert = require('assert');
const fs = require('fs');
const path = require('path');

function run() {
  const extensionPath = path.join(__dirname, '..', 'out', 'extension.js');
  const contents = fs.readFileSync(extensionPath, 'utf8');

  assert.ok(
    contents.includes('code fix payload too large'),
    'Expected code fix size guard in extension'
  );
  assert.ok(
    contents.includes('AI analysis failed due to invalid vulnerability data'),
    'Expected invalid data guard message in extension'
  );

  console.log('✅ Extension guard tests passed');
}

try {
  run();
} catch (err) {
  console.error('❌ Extension guard tests failed');
  console.error(err);
  process.exit(1);
}
