const assert = require('assert');
const path = require('path');
const Module = require('module');

function enableVscodeStub() {
  process.env.NODE_PATH = __dirname;
  Module._initPaths();
}

function run() {
  enableVscodeStub();
  const extension = require('../out/extension');
  const { resolveWorkspacePath, countOccurrences } = extension;

  const projectRoot = path.join(path.sep, 'tmp', 'project');
  const insidePath = 'src/index.js';
  const outsidePath = path.join('..', 'secrets.txt');

  const resolvedInside = resolveWorkspacePath(insidePath, projectRoot);
  assert.ok(resolvedInside, 'Expected inside path to resolve');
  assert.ok(
    resolvedInside.startsWith(path.resolve(projectRoot) + path.sep),
    'Resolved inside path should be within project root'
  );

  const resolvedOutside = resolveWorkspacePath(outsidePath, projectRoot);
  assert.strictEqual(resolvedOutside, null, 'Expected traversal path to be rejected');

  const text = 'alpha\nbeta\nalpha\n';
  assert.strictEqual(countOccurrences(text, 'gamma'), 0, 'Expected missing snippet to return 0');
  assert.strictEqual(countOccurrences(text, 'alpha'), 2, 'Expected two occurrences');

  const before = 'alpha';
  const after = 'omega';
  const applyAll = text.split(before).join(after);
  const applyFirst = text.replace(before, after);
  assert.strictEqual(applyAll, 'omega\nbeta\nomega\n');
  assert.strictEqual(applyFirst, 'omega\nbeta\nalpha\n');

  console.log('✅ Apply code fix tests passed');
}

try {
  run();
} catch (err) {
  console.error('❌ Apply code fix tests failed');
  console.error(err);
  process.exit(1);
}
