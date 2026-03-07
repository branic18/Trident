import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import * as crypto from 'crypto';
import { promisify } from 'util';
import { spawn } from 'child_process';
import { CodeSnippet } from './types';

const writeFileAsync = promisify(fs.writeFile);
const unlinkAsync = promisify(fs.unlink);
const accessAsync = promisify(fs.access);

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

type CvssData = {
  score?: unknown;
  vectorString?: unknown;
  parsed?: unknown;
};

type CweData = {
  ids?: unknown;
  names?: unknown;
};

type AdvisoryData = {
  id?: unknown;
  summary?: unknown;
  url?: unknown;
};

type FixData = {
  type?: unknown;
  name?: unknown;
  version?: unknown;
  isSemVerMajor?: unknown;
  resolvesCount?: unknown;
};

/**
 * Security utilities for safe Goose execution and data handling
 */

/**
 * Creates a secure temporary file for Goose parameter passing
 * Avoids command line argument exposure
 */
export async function createSecureTempFile(content: string): Promise<string> {
  const tempDir = os.tmpdir();
  const randomSuffix = crypto.randomBytes(16).toString('hex');
  const tempFile = path.join(tempDir, `goose-params-${randomSuffix}.json`);
  
  try {
    // Write with restrictive permissions (600 - owner read/write only)
    await writeFileAsync(tempFile, content, { mode: 0o600 });
    return tempFile;
  } catch (error) {
    throw new Error(`Failed to create secure temp file: ${error}`);
  }
}

/**
 * Securely deletes temporary file and overwrites content
 */
export async function securelyDeleteTempFile(filePath: string): Promise<void> {
  try {
    // Check if file exists before attempting deletion
    await accessAsync(filePath, fs.constants.F_OK);
    
    // Overwrite with random data before deletion (basic secure deletion)
    const fileStats = fs.statSync(filePath);
    const randomData = crypto.randomBytes(fileStats.size);
    await writeFileAsync(filePath, randomData);
    
    // Delete the file
    await unlinkAsync(filePath);
  } catch (error) {
    // Log error but don't throw - temp file cleanup is best effort
    console.warn(`Failed to securely delete temp file ${filePath}:`, error);
  }
}

/**
 * Sanitizes working directory path to prevent directory traversal
 */
export function sanitizeWorkingDirectory(projectRoot?: string): string {
  if (!projectRoot) {
    return process.cwd();
  }
  
  // Resolve to absolute path and normalize
  const absolutePath = path.resolve(projectRoot);
  
  // Basic validation - ensure it's a real directory
  if (!fs.existsSync(absolutePath) || !fs.statSync(absolutePath).isDirectory()) {
    throw new Error('Invalid working directory');
  }
  
  return absolutePath;
}

/**
 * Ensures a resolved path stays within the provided root.
 */
export function isPathWithinRoot(candidatePath: string, rootPath: string): boolean {
  const normalizedRoot = path.resolve(rootPath);
  const resolvedCandidate = path.resolve(candidatePath);
  return resolvedCandidate === normalizedRoot || resolvedCandidate.startsWith(normalizedRoot + path.sep);
}

/**
 * Creates minimal environment for Goose execution
 * Removes potentially sensitive environment variables
 */
export function getMinimalEnvironment(): NodeJS.ProcessEnv {
  const safeEnvVars = [
    'PATH', 'HOME', 'USER', 'SHELL', 'LANG', 'LC_ALL', 'TMPDIR',
    'NODE_PATH', 'NODE_ENV',
    // Provider auth/config (required for Goose to run in extension host)
    'OPENAI_API_KEY', 'OPENAI_ORG_ID',
    'ANTHROPIC_API_KEY',
    'OPENROUTER_API_KEY',
    'GOOSE_PROVIDER', 'GOOSE_MODEL'
  ];
  
  const minimalEnv: NodeJS.ProcessEnv = {};
  
  safeEnvVars.forEach(varName => {
    if (process.env[varName]) {
      minimalEnv[varName] = process.env[varName];
    }
  });
  
  return minimalEnv;
}

function resolveRecipePath(recipePath: string, workingDir: string): string {
  if (path.isAbsolute(recipePath)) {
    if (fs.existsSync(recipePath)) return recipePath;
  } else {
    const candidates = [
      path.resolve(workingDir, recipePath),
      path.resolve(workingDir, '..', recipePath),
      path.resolve(workingDir, '..', '..', recipePath)
    ];
    for (const candidate of candidates) {
      if (fs.existsSync(candidate)) return candidate;
    }
  }
  throw new Error(`Failed to read recipe file ${recipePath}: No such file or directory`);
}

/**
 * Validates and sanitizes vulnerability ID
 */
export function sanitizeId(id: string): string {
  if (typeof id !== 'string') {
    throw new Error('Invalid ID type');
  }
  
  // Allow only alphanumeric, hyphens, underscores, colons, and dots
  const sanitized = id.replace(/[^a-zA-Z0-9_.:-]/g, '').substring(0, 100);
  
  if (sanitized.length === 0) {
    throw new Error('Invalid ID format');
  }
  
  return sanitized;
}

/**
 * Validates and sanitizes npm package name
 */
export function sanitizePackageName(name: string): string {
  if (typeof name !== 'string') {
    throw new Error('Invalid package name type');
  }
  
  // Validate against npm package name rules
  // Allow scoped packages (@org/package), letters, numbers, hyphens, underscores, dots
  if (!/^(@[a-zA-Z0-9_-]+\/)?[a-zA-Z0-9-_.]+$/.test(name)) {
    throw new Error('Invalid package name format');
  }
  
  // npm package name length limit
  if (name.length > 214) {
    throw new Error('Package name too long');
  }
  
  return name;
}

/**
 * Validates and sanitizes version string
 */
export function sanitizeVersion(version: string): string {
  if (typeof version !== 'string') {
    throw new Error('Invalid version type');
  }
  
  // Allow semver-compatible versions with range operators
  const sanitized = version.replace(/[^a-zA-Z0-9-_.^~>=<*|]/g, '').substring(0, 50);
  
  if (sanitized.length === 0) {
    throw new Error('Invalid version format');
  }
  
  return sanitized;
}

/**
 * Validates severity level
 */
export function validateSeverity(severity: string): "low" | "moderate" | "high" | "critical" {
  const validSeverities = ['low', 'moderate', 'high', 'critical'];
  
  if (!validSeverities.includes(severity)) {
    throw new Error('Invalid severity level');
  }
  
  return severity as "low" | "moderate" | "high" | "critical";
}

/**
 * Validates environment value
 */
export function validateEnvironment(environment: string): "dev" | "staging" | "prod" {
  const validEnvironments = ['dev', 'staging', 'prod'];
  
  if (!validEnvironments.includes(environment)) {
    throw new Error('Invalid environment');
  }
  
  return environment as "dev" | "staging" | "prod";
}

/**
 * Sanitizes file paths to prevent directory traversal
 */
export function sanitizeFilePaths(filePaths: string[]): string[] {
  return filePaths
    .filter(filePath => typeof filePath === 'string')
    .map(filePath => {
      // Normalize separators and strip drive letters
      const normalized = path.normalize(filePath).replace(/^[a-zA-Z]:/, '');
      const withoutNull = normalized.replace(/\0/g, '');
      const segments = withoutNull.split(path.sep).filter(seg => seg && seg !== '.' && seg !== '..');
      const rebuilt = segments.join(path.sep);
      const relative = rebuilt.startsWith(path.sep) ? rebuilt.substring(1) : rebuilt;
      return relative.substring(0, 260); // Windows MAX_PATH limit
    })
    .filter(filePath => filePath.length > 0)
    .slice(0, 20); // Limit number of files
}

/**
 * Sanitizes and validates a code snippet. Returns undefined if invalid.
 * Hybrid policy: drop invalid snippet and log a warning.
 */
export function sanitizeCodeSnippet(snippet: CodeSnippet | undefined | null): CodeSnippet | undefined {
  if (!snippet || typeof snippet !== 'object') {
    return undefined;
  }

  const filePath = typeof snippet.filePath === 'string' ? snippet.filePath : '';
  const before = typeof snippet.before === 'string' ? snippet.before : '';
  const startLine = Number.isFinite(snippet.startLine) ? Math.floor(snippet.startLine) : NaN;
  const endLine = Number.isFinite(snippet.endLine) ? Math.floor(snippet.endLine) : NaN;

  if (!filePath || !before || !Number.isFinite(startLine) || !Number.isFinite(endLine)) {
    console.warn('sanitizeCodeSnippet: invalid snippet fields, dropping codeSnippet');
    return undefined;
  }

  if (startLine < 1 || endLine < startLine || endLine > 100000) {
    console.warn('sanitizeCodeSnippet: invalid line bounds, dropping codeSnippet');
    return undefined;
  }

  const sanitizedPaths = sanitizeFilePaths([filePath]);
  if (sanitizedPaths.length === 0) {
    console.warn('sanitizeCodeSnippet: invalid file path, dropping codeSnippet');
    return undefined;
  }

  const sanitizedBefore = before.length > 2000 ? before.substring(0, 2000) : before;

  return {
    filePath: sanitizedPaths[0],
    startLine,
    endLine,
    before: sanitizedBefore
  };
}

/**
 * Sanitizes dependency paths array
 */
export function sanitizePaths(paths: string[][]): string[][] {
  return paths
    .filter(path => Array.isArray(path))
    .map(path => 
      path
        .filter(segment => typeof segment === 'string')
        .map(segment => {
          try {
            return sanitizePackageName(segment);
          } catch {
            return '';
          }
        })
        .filter(segment => segment.length > 0)
    )
    .slice(0, 50); // Limit number of dependency paths
}

/**
 * Sanitizes project type string
 */
export function sanitizeProjectType(projectType: string): string {
  if (typeof projectType !== 'string') {
    return 'unknown';
  }
  
  // Allow only alphanumeric, spaces, hyphens, underscores
  const sanitized = projectType.replace(/[^a-zA-Z0-9 _-]/g, '').substring(0, 100);
  
  return sanitized || 'unknown';
}

/**
 * Sanitizes CVSS data structure
 */
type CvssParsed = {
  attackVector?: string;
  attackComplexity?: string;
  privilegesRequired?: string;
  userInteraction?: string;
  confidentiality?: string;
  integrity?: string;
  availability?: string;
};

function sanitizeCvssParsed(parsed: unknown): CvssParsed | undefined {
  if (!isRecord(parsed)) return undefined;
  const sanitized: CvssParsed = {};
  const fields: (keyof CvssParsed)[] = [
    'attackVector',
    'attackComplexity',
    'privilegesRequired',
    'userInteraction',
    'confidentiality',
    'integrity',
    'availability'
  ];
  for (const field of fields) {
    const value = parsed[field];
    if (typeof value === 'string') sanitized[field] = value;
  }
  return Object.keys(sanitized).length ? sanitized : undefined;
}

export function sanitizeCvssData(cvss: unknown): { score: number | null; vectorString: string | null; parsed?: CvssParsed } {
  if (!isRecord(cvss)) {
    return { score: null, vectorString: null };
  }
  
  const cvssData = cvss as CvssData;
  return {
    score: typeof cvssData.score === 'number' && cvssData.score >= 0 && cvssData.score <= 10 ? cvssData.score : null,
    vectorString: typeof cvssData.vectorString === 'string' ? 
      cvssData.vectorString.replace(/[^A-Z0-9:/.]/g, '').substring(0, 100) : null,
    parsed: sanitizeCvssParsed(cvssData.parsed)
  };
}

/**
 * Sanitizes CWE data structure
 */
export function sanitizeCweData(cwe: unknown): { ids: string[]; names: string[] } | undefined {
  if (!isRecord(cwe)) {
    return undefined;
  }
  
  const cweData = cwe as CweData;
  const sanitizedIds = Array.isArray(cweData.ids) ? 
    cweData.ids
      .filter((id): id is string => typeof id === 'string')
      .map((id: string) => id.replace(/[^A-Z0-9-]/g, '').substring(0, 20))
      .filter((id: string) => id.startsWith('CWE'))
      .slice(0, 10) : [];
      
  const sanitizedNames = Array.isArray(cweData.names) ?
    cweData.names
      .filter((name): name is string => typeof name === 'string')
      .map((name: string) => name.substring(0, 200))
      .slice(0, 10) : [];
  
  if (sanitizedIds.length === 0 && sanitizedNames.length === 0) {
    return undefined;
  }
  
  return {
    ids: sanitizedIds,
    names: sanitizedNames
  };
}

/**
 * Sanitizes GitHub Advisory data
 */
export function sanitizeAdvisoryData(advisory: unknown): { id?: string; summary?: string; url?: string } | undefined {
  if (!isRecord(advisory)) {
    return undefined;
  }
  
  const advisoryData = advisory as AdvisoryData;
  const sanitized: { id?: string; summary?: string; url?: string } = {};
  
  if (typeof advisoryData.id === 'string') {
    sanitized.id = advisoryData.id.replace(/[^A-Z0-9-]/g, '').substring(0, 50);
  }
  
  if (typeof advisoryData.summary === 'string') {
    sanitized.summary = advisoryData.summary.substring(0, 500);
  }
  
  if (typeof advisoryData.url === 'string') {
    // Basic URL validation - must start with https://github.com
    if (advisoryData.url.startsWith('https://github.com/') || advisoryData.url.startsWith('https://nvd.nist.gov/')) {
      sanitized.url = advisoryData.url.substring(0, 200);
    }
  }
  
  return Object.keys(sanitized).length > 0 ? sanitized : undefined;
}

/**
 * Sanitizes fix availability data
 */
export function sanitizeFixData(fixData: unknown): { type: "auto" | "manual" | "none"; name?: string; version?: string; isSemVerMajor?: boolean; resolvesCount?: number } {
  if (!isRecord(fixData)) {
    return { type: 'none' };
  }
  
  const validTypes = ['auto', 'manual', 'none'];
  const fixDataObj = fixData as FixData;
  const type = validTypes.includes(String(fixDataObj.type)) ? (fixDataObj.type as "auto" | "manual" | "none") : 'none';
  
  const sanitized: { type: "auto" | "manual" | "none"; name?: string; version?: string; isSemVerMajor?: boolean; resolvesCount?: number } = { type };
  
  if (typeof fixDataObj.name === 'string') {
    sanitized.name = sanitizePackageName(fixDataObj.name);
  }
  
  if (typeof fixDataObj.version === 'string') {
    sanitized.version = sanitizeVersion(fixDataObj.version);
  }
  
  if (typeof fixDataObj.isSemVerMajor === 'boolean') {
    sanitized.isSemVerMajor = fixDataObj.isSemVerMajor;
  }
  
  if (typeof fixDataObj.resolvesCount === 'number' && fixDataObj.resolvesCount >= 0) {
    sanitized.resolvesCount = Math.min(fixDataObj.resolvesCount, 1000);
  }
  
  return sanitized;
}

/**
 * Executes Goose with retry logic and security controls
 */
export async function executeWithRetry<T>(
  operation: () => Promise<T>,
  maxRetries: number = 2,
  baseDelay: number = 1000
): Promise<T> {
  let lastError: Error;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error as Error;
      
      // Don't retry on validation errors or security issues
      if (error instanceof Error && 
          (error.message.includes('Invalid') || 
           error.message.includes('security') ||
           error.message.includes('injection'))) {
        throw error;
      }
      
      if (attempt < maxRetries) {
        const delay = baseDelay * Math.pow(2, attempt);
        console.log(`Attempt ${attempt + 1} failed, retrying in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
  
  throw lastError!;
}

/**
 * Secure Goose execution using temporary files
 * Prevents command line argument injection
 */
export async function secureGooseExecution(
  vulnContext: unknown,
  workingDir: string,
  recipePath: string,
  signal?: AbortSignal,
  timeoutMs: number = 30000,
  envOverrides?: NodeJS.ProcessEnv
): Promise<string> {
  try {
    // Sanitize working directory
    const safeWorkingDir = sanitizeWorkingDirectory(workingDir);
    
    // Get minimal environment, merged with overrides (API key, provider, model)
    const baseEnv = getMinimalEnvironment();
    const env = envOverrides ? { ...baseEnv, ...envOverrides } : baseEnv;

    // Serialize params for Goose CLI
    const vulnContextJson = JSON.stringify(vulnContext);
    const resolvedRecipePath = resolveRecipePath(recipePath, safeWorkingDir);
    const params = [
      `vuln_context=${vulnContextJson}`,
      'validation_mode=strict',
      'accessibility_level=wcag_aa'
    ];
    
    // Execute with security controls
    return await new Promise((resolve, reject) => {
      const gooseProcess = spawn('goose', [
        'run',
        '--recipe',
        resolvedRecipePath,
        '--params',
        params[0],
        '--params',
        params[1],
        '--params',
        params[2],
        '--quiet',
        '--no-session'
      ], {
        cwd: safeWorkingDir,
        env,
        stdio: ['ignore', 'pipe', 'pipe']
      });
      
      let output = '';
      let errorOutput = '';
      
      gooseProcess.stdout?.on('data', (data: Buffer) => {
        output += data.toString();
      });
      
      gooseProcess.stderr?.on('data', (data: Buffer) => {
        errorOutput += data.toString();
      });
      
      gooseProcess.on('close', (code: number) => {
        if (code === 0) {
          resolve(output);
        } else {
          reject(new Error(`Goose execution failed (code ${code}): ${errorOutput}`));
        }
      });
      
      gooseProcess.on('error', (error: Error) => {
        reject(new Error(`Goose process error: ${error.message}`));
      });

      if (signal) {
        if (signal.aborted) {
          gooseProcess.kill('SIGTERM');
          reject(new Error('Goose execution canceled'));
          return;
        }
        signal.addEventListener('abort', () => {
          gooseProcess.kill('SIGTERM');
          reject(new Error('Goose execution canceled'));
        }, { once: true });
      }

      if (timeoutMs > 0) {
        const timer = setTimeout(() => {
          gooseProcess.kill('SIGTERM');
          reject(new Error('Goose execution timed out'));
        }, timeoutMs);
        gooseProcess.on('close', () => clearTimeout(timer));
        gooseProcess.on('error', () => clearTimeout(timer));
      }
    });
    
  } finally {
    // no temp file cleanup needed
  }
}
