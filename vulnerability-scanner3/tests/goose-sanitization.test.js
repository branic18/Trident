const assert = require('assert');
const { sanitizeCodeSnippet, sanitizeFilePaths, sanitizePaths } = require('../out/goose/security');

function run() {
  const valid = sanitizeCodeSnippet({
    filePath: '../src/index.ts',
    startLine: 1,
    endLine: 3,
    before: 'const token = "sk_live_123";'
  });
  assert.ok(valid, 'Expected valid snippet to be returned');
  assert.strictEqual(valid.filePath.includes('..'), false, 'Expected file path to be sanitized');

  const invalidLines = sanitizeCodeSnippet({
    filePath: 'src/index.ts',
    startLine: 5,
    endLine: 2,
    before: 'x'
  });
  assert.strictEqual(invalidLines, undefined, 'Expected invalid line bounds to be dropped');

  const missingBefore = sanitizeCodeSnippet({
    filePath: 'src/index.ts',
    startLine: 1,
    endLine: 2,
    before: ''
  });
  assert.strictEqual(missingBefore, undefined, 'Expected missing snippet text to be dropped');

  const paths = sanitizeFilePaths([
    '../secrets.txt',
    '/etc/passwd',
    'C:\\windows\\system32\\cmd.exe',
    'src/utils.ts'
  ]);
  assert.ok(paths.every(p => !p.includes('..')), 'Expected no traversal segments');
  assert.ok(paths.every(p => !p.startsWith('/')), 'Expected no absolute paths');
  assert.ok(paths.some(p => p.includes('src')), 'Expected relative path retained');

  const depPaths = sanitizePaths([['left-pad', '../bad', ''], ['@scope/pkg', 'ok']]);
  assert.ok(depPaths.flat().includes('left-pad'), 'Expected valid package to remain');
  assert.ok(depPaths.flat().includes('@scope/pkg'), 'Expected scoped package to remain');
  assert.ok(!depPaths.flat().includes('../bad'), 'Expected invalid package to be removed');

  console.log('✅ Goose sanitization tests passed');
}

try {
  run();
} catch (err) {
  console.error('❌ Goose sanitization tests failed');
  console.error(err);
  process.exit(1);
}
