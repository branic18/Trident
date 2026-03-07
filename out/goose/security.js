"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.createSecureTempFile = createSecureTempFile;
exports.securelyDeleteTempFile = securelyDeleteTempFile;
exports.sanitizeWorkingDirectory = sanitizeWorkingDirectory;
exports.isPathWithinRoot = isPathWithinRoot;
exports.getMinimalEnvironment = getMinimalEnvironment;
exports.sanitizeId = sanitizeId;
exports.sanitizePackageName = sanitizePackageName;
exports.sanitizeVersion = sanitizeVersion;
exports.validateSeverity = validateSeverity;
exports.validateEnvironment = validateEnvironment;
exports.sanitizeFilePaths = sanitizeFilePaths;
exports.sanitizeCodeSnippet = sanitizeCodeSnippet;
exports.sanitizePaths = sanitizePaths;
exports.sanitizeProjectType = sanitizeProjectType;
exports.sanitizeCvssData = sanitizeCvssData;
exports.sanitizeCweData = sanitizeCweData;
exports.sanitizeAdvisoryData = sanitizeAdvisoryData;
exports.sanitizeFixData = sanitizeFixData;
exports.executeWithRetry = executeWithRetry;
exports.secureGooseExecution = secureGooseExecution;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const os = __importStar(require("os"));
const crypto = __importStar(require("crypto"));
const util_1 = require("util");
const child_process_1 = require("child_process");
const writeFileAsync = (0, util_1.promisify)(fs.writeFile);
const unlinkAsync = (0, util_1.promisify)(fs.unlink);
const accessAsync = (0, util_1.promisify)(fs.access);
function isRecord(value) {
    return !!value && typeof value === 'object' && !Array.isArray(value);
}
/**
 * Security utilities for safe Goose execution and data handling
 */
/**
 * Creates a secure temporary file for Goose parameter passing
 * Avoids command line argument exposure
 */
async function createSecureTempFile(content) {
    const tempDir = os.tmpdir();
    const randomSuffix = crypto.randomBytes(16).toString('hex');
    const tempFile = path.join(tempDir, `goose-params-${randomSuffix}.json`);
    try {
        // Write with restrictive permissions (600 - owner read/write only)
        await writeFileAsync(tempFile, content, { mode: 0o600 });
        return tempFile;
    }
    catch (error) {
        throw new Error(`Failed to create secure temp file: ${error}`);
    }
}
/**
 * Securely deletes temporary file and overwrites content
 */
async function securelyDeleteTempFile(filePath) {
    try {
        // Check if file exists before attempting deletion
        await accessAsync(filePath, fs.constants.F_OK);
        // Overwrite with random data before deletion (basic secure deletion)
        const fileStats = fs.statSync(filePath);
        const randomData = crypto.randomBytes(fileStats.size);
        await writeFileAsync(filePath, randomData);
        // Delete the file
        await unlinkAsync(filePath);
    }
    catch (error) {
        // Log error but don't throw - temp file cleanup is best effort
        console.warn(`Failed to securely delete temp file ${filePath}:`, error);
    }
}
/**
 * Sanitizes working directory path to prevent directory traversal
 */
function sanitizeWorkingDirectory(projectRoot) {
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
function isPathWithinRoot(candidatePath, rootPath) {
    const normalizedRoot = path.resolve(rootPath);
    const resolvedCandidate = path.resolve(candidatePath);
    return resolvedCandidate === normalizedRoot || resolvedCandidate.startsWith(normalizedRoot + path.sep);
}
/**
 * Creates minimal environment for Goose execution
 * Removes potentially sensitive environment variables
 */
function getMinimalEnvironment() {
    const safeEnvVars = [
        'PATH', 'HOME', 'USER', 'SHELL', 'LANG', 'LC_ALL', 'TMPDIR',
        'NODE_PATH', 'NODE_ENV',
        // Provider auth/config (required for Goose to run in extension host)
        'OPENAI_API_KEY', 'OPENAI_ORG_ID',
        'ANTHROPIC_API_KEY',
        'OPENROUTER_API_KEY',
        'GOOSE_PROVIDER', 'GOOSE_MODEL'
    ];
    const minimalEnv = {};
    safeEnvVars.forEach(varName => {
        if (process.env[varName]) {
            minimalEnv[varName] = process.env[varName];
        }
    });
    return minimalEnv;
}
function resolveRecipePath(recipePath, workingDir) {
    if (path.isAbsolute(recipePath)) {
        if (fs.existsSync(recipePath))
            return recipePath;
    }
    else {
        const candidates = [
            path.resolve(workingDir, recipePath),
            path.resolve(workingDir, '..', recipePath),
            path.resolve(workingDir, '..', '..', recipePath)
        ];
        for (const candidate of candidates) {
            if (fs.existsSync(candidate))
                return candidate;
        }
    }
    throw new Error(`Failed to read recipe file ${recipePath}: No such file or directory`);
}
/**
 * Validates and sanitizes vulnerability ID
 */
function sanitizeId(id) {
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
function sanitizePackageName(name) {
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
function sanitizeVersion(version) {
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
function validateSeverity(severity) {
    const validSeverities = ['low', 'moderate', 'high', 'critical'];
    if (!validSeverities.includes(severity)) {
        throw new Error('Invalid severity level');
    }
    return severity;
}
/**
 * Validates environment value
 */
function validateEnvironment(environment) {
    const validEnvironments = ['dev', 'staging', 'prod'];
    if (!validEnvironments.includes(environment)) {
        throw new Error('Invalid environment');
    }
    return environment;
}
/**
 * Sanitizes file paths to prevent directory traversal
 */
function sanitizeFilePaths(filePaths) {
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
function sanitizeCodeSnippet(snippet) {
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
function sanitizePaths(paths) {
    return paths
        .filter(path => Array.isArray(path))
        .map(path => path
        .filter(segment => typeof segment === 'string')
        .map(segment => {
        try {
            return sanitizePackageName(segment);
        }
        catch {
            return '';
        }
    })
        .filter(segment => segment.length > 0))
        .slice(0, 50); // Limit number of dependency paths
}
/**
 * Sanitizes project type string
 */
function sanitizeProjectType(projectType) {
    if (typeof projectType !== 'string') {
        return 'unknown';
    }
    // Allow only alphanumeric, spaces, hyphens, underscores
    const sanitized = projectType.replace(/[^a-zA-Z0-9 _-]/g, '').substring(0, 100);
    return sanitized || 'unknown';
}
function sanitizeCvssParsed(parsed) {
    if (!isRecord(parsed))
        return undefined;
    const sanitized = {};
    const fields = [
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
        if (typeof value === 'string')
            sanitized[field] = value;
    }
    return Object.keys(sanitized).length ? sanitized : undefined;
}
function sanitizeCvssData(cvss) {
    if (!isRecord(cvss)) {
        return { score: null, vectorString: null };
    }
    const cvssData = cvss;
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
function sanitizeCweData(cwe) {
    if (!isRecord(cwe)) {
        return undefined;
    }
    const cweData = cwe;
    const sanitizedIds = Array.isArray(cweData.ids) ?
        cweData.ids
            .filter((id) => typeof id === 'string')
            .map((id) => id.replace(/[^A-Z0-9-]/g, '').substring(0, 20))
            .filter((id) => id.startsWith('CWE'))
            .slice(0, 10) : [];
    const sanitizedNames = Array.isArray(cweData.names) ?
        cweData.names
            .filter((name) => typeof name === 'string')
            .map((name) => name.substring(0, 200))
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
function sanitizeAdvisoryData(advisory) {
    if (!isRecord(advisory)) {
        return undefined;
    }
    const advisoryData = advisory;
    const sanitized = {};
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
function sanitizeFixData(fixData) {
    if (!isRecord(fixData)) {
        return { type: 'none' };
    }
    const validTypes = ['auto', 'manual', 'none'];
    const fixDataObj = fixData;
    const type = validTypes.includes(String(fixDataObj.type)) ? fixDataObj.type : 'none';
    const sanitized = { type };
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
async function executeWithRetry(operation, maxRetries = 2, baseDelay = 1000) {
    let lastError;
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
            return await operation();
        }
        catch (error) {
            lastError = error;
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
    throw lastError;
}
/**
 * Secure Goose execution using temporary files
 * Prevents command line argument injection
 */
async function secureGooseExecution(vulnContext, workingDir, recipePath, signal, timeoutMs = 30000, envOverrides) {
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
            const gooseProcess = (0, child_process_1.spawn)('goose', [
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
            gooseProcess.stdout?.on('data', (data) => {
                output += data.toString();
            });
            gooseProcess.stderr?.on('data', (data) => {
                errorOutput += data.toString();
            });
            gooseProcess.on('close', (code) => {
                if (code === 0) {
                    resolve(output);
                }
                else {
                    reject(new Error(`Goose execution failed (code ${code}): ${errorOutput}`));
                }
            });
            gooseProcess.on('error', (error) => {
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
    }
    finally {
        // no temp file cleanup needed
    }
}
//# sourceMappingURL=security.js.map