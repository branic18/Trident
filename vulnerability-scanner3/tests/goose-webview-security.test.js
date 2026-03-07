const assert = require('assert');
const fs = require('fs');
const path = require('path');

function run() {
  const extensionPath = path.join(__dirname, '..', 'out', 'extension.js');
  const contents = fs.readFileSync(extensionPath, 'utf8');

  assert.ok(
    contents.includes('Content-Security-Policy'),
    'Expected CSP meta tag in webview content'
  );
  assert.ok(
    contents.includes("nonce-"),
    'Expected CSP nonce usage in webview content'
  );
  assert.ok(
    contents.includes('goose-onboarding'),
    'Expected onboarding banner markup'
  );
  assert.ok(
    contents.includes('Was this analysis helpful?'),
    'Expected feedback prompt text'
  );
  assert.ok(
    contents.includes('gooseFeedback'),
    'Expected feedback message handler'
  );

  console.log('✅ Goose webview security tests passed');
}

try {
  run();
} catch (err) {
  console.error('❌ Goose webview security tests failed');
  console.error(err);
  process.exit(1);
}
