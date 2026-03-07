const assert = require('assert');
const {
  sanitizeId,
  sanitizePackageName,
  sanitizeVersion,
  sanitizeFilePaths,
  sanitizeCodeSnippet
} = require('../out/goose/security');

function run() {
  assert.strictEqual(sanitizeId('CVE-2024-1234'), 'CVE-2024-1234');
  assert.strictEqual(sanitizePackageName('@types/node'), '@types/node');
  assert.strictEqual(sanitizeVersion('^1.2.3'), '^1.2.3');

  const sanitizedPaths = sanitizeFilePaths([
    'src/index.js',
    '../etc/passwd',
    '/absolute/path',
    'normal/file.ts',
    'C:\\Windows\\System32\\drivers\\etc\\hosts'
  ]);
  assert.ok(sanitizedPaths.includes('src/index.js'));
  assert.ok(sanitizedPaths.includes('normal/file.ts'));
  assert.ok(!sanitizedPaths.some(p => p.includes('..')));

  const snippet = sanitizeCodeSnippet({
    filePath: 'src/app.ts',
    startLine: 10,
    endLine: 12,
    before: 'const token = "sk_live_ABCDEF";\nconsole.log(token);'
  });
  assert.ok(snippet, 'Expected snippet to be returned');
  assert.ok(snippet.before.includes('sk_live_ABCDEF'));

  console.log('✅ Security utils tests passed');
}

try {
  run();
} catch (err) {
  console.error('❌ Security utils tests failed');
  console.error(err);
  process.exit(1);
}
