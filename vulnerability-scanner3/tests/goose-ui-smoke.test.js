const assert = require('assert');

const { createAccessibleInsightHTML } = require('../out/goose/accessibility');
const { JsonSchemaValidator } = require('../out/goose/validator');

function run() {
  const insight = {
    title: 'Prototype Pollution in xyz',
    humanExplanation: 'An attacker can modify object prototypes leading to unexpected behavior.',
    impactOnUsers: 'Could affect user data handling in production routes.',
    priorityScore: 4,
    priorityReason: 'Network exploitable and used in production code paths.',
    recommendedActions: [
      'Upgrade xyz to 2.3.4',
      'Run unit tests for auth and payments',
      'Verify no custom prototype extensions'
    ],
    fixStyle: 'non-breaking-upgrade',
    devFacingSummary: 'High risk in prod. Upgrade xyz and retest critical flows.',
    codeFix: {
      filePath: 'src/server.ts',
      before: 'const xyz = require(\'xyz\');',
      after: 'const xyz = require(\'xyz\'); // upgraded to 2.3.4',
      description: 'Update xyz to patched version.',
      warnings: ['Review any custom prototype usage.']
    }
  };

  const validator = new JsonSchemaValidator();
  const validated = validator.validate(insight);
  assert.ok(validated);

  const html = createAccessibleInsightHTML(insight);
  assert.ok(html.includes('AI-Generated Security Analysis'));
  assert.ok(html.includes('Vulnerability Explanation'));
  assert.ok(html.includes('Impact Assessment'));
  assert.ok(html.includes('Recommended Actions'));
  assert.ok(html.includes('Suggested Code Fix'));
  assert.ok(html.includes('AI-generated'));

  console.log('✅ Goose UI smoke test passed');
}

try {
  run();
} catch (err) {
  console.error('❌ Goose UI smoke test failed');
  console.error(err);
  process.exit(1);
}
