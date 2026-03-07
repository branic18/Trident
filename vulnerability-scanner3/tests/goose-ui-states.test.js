const assert = require('assert');
const fs = require('fs');
const path = require('path');

function run() {
  const extensionPath = path.join(__dirname, '..', 'out', 'extension.js');
  const contents = fs.readFileSync(extensionPath, 'utf8');

  assert.ok(
    contents.includes('Generating AI analysis…'),
    'Pending state text not found in webview content'
  );
  assert.ok(
    contents.includes('AI Analysis Unavailable'),
    'Error state text not found in webview content'
  );

  console.log('✅ Goose UI states test passed');
}

try {
  run();
} catch (err) {
  console.error('❌ Goose UI states test failed');
  console.error(err);
  process.exit(1);
}
