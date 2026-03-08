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
exports.findFilesUsingPackage = findFilesUsingPackage;
exports.extractCodeSnippet = extractCodeSnippet;
exports.detectEnvironment = detectEnvironment;
const path = __importStar(require("path"));
const fs = __importStar(require("fs"));
const util_1 = require("util");
const child_process_1 = require("child_process");
const security_1 = require("./security");
const execAsync = (0, util_1.promisify)(child_process_1.exec);
const readFileAsync = (0, util_1.promisify)(fs.readFile);
const existsAsync = (0, util_1.promisify)(fs.exists);
const fileUseCache = new Map();
const snippetCache = new Map();
const MAX_CACHE_ENTRIES = 200;
/**
 * Analyzes project files to find actual usage of a vulnerable package
 * Returns file paths where the package is imported/required/used
 */
async function findFilesUsingPackage(packageName, projectRoot) {
    const cacheKey = `${projectRoot}::${packageName}`;
    const cached = fileUseCache.get(cacheKey);
    if (cached)
        return cached;
    const usedInFiles = [];
    try {
        // Use ripgrep to find import/require statements efficiently
        const patterns = [
            `import.*from.*['"\`]${packageName}['"\`]`,
            `import.*['"\`]${packageName}['"\`]`,
            `require\\(['"\`]${packageName}['"\`]\\)`,
            `from.*['"\`]${packageName}['"\`]`,
            // Dynamic imports
            `import\\(['"\`]${packageName}['"\`]\\)`,
            // Package usage in package.json and config files
            `['"\`]${packageName}['"\`]\\s*:`
        ];
        for (const pattern of patterns) {
            try {
                const { stdout } = await execAsync(`rg -l --type js --type ts --type jsx --type tsx --type json --type yaml --type yml "${pattern}" "${projectRoot}"`, { timeout: 5000 });
                if (stdout.trim()) {
                    const files = stdout.trim().split('\n')
                        .filter(file => (0, security_1.isPathWithinRoot)(file, projectRoot))
                        .map(file => path.relative(projectRoot, file))
                        .filter(file => !file.includes('node_modules'))
                        .filter(file => !file.includes('.git'));
                    usedInFiles.push(...files);
                }
            }
            catch {
                // Continue with other patterns if one fails
                continue;
            }
        }
        // Also check package.json and common config files directly
        await checkConfigFiles(packageName, projectRoot, usedInFiles);
        // Remove duplicates and return
        const result = [...new Set(usedInFiles)].slice(0, 10); // Limit to 10 most relevant files
        fileUseCache.set(cacheKey, result);
        if (fileUseCache.size > MAX_CACHE_ENTRIES)
            fileUseCache.clear();
        return result;
    }
    catch (error) {
        console.error(`Error finding files using package ${packageName}:`, error);
        // Fallback: check common locations
        const result = await fallbackFileSearch(packageName, projectRoot);
        fileUseCache.set(cacheKey, result);
        if (fileUseCache.size > MAX_CACHE_ENTRIES)
            fileUseCache.clear();
        return result;
    }
}
/**
 * Checks common configuration files for package usage
 */
async function checkConfigFiles(packageName, projectRoot, usedInFiles) {
    const configFiles = [
        'package.json',
        'webpack.config.js',
        'webpack.config.ts',
        'vite.config.js',
        'vite.config.ts',
        'rollup.config.js',
        'rollup.config.ts',
        'tsconfig.json',
        '.eslintrc.js',
        '.eslintrc.json',
        'babel.config.js'
    ];
    for (const configFile of configFiles) {
        const filePath = path.join(projectRoot, configFile);
        if (!(0, security_1.isPathWithinRoot)(filePath, projectRoot)) {
            console.warn(`Skipping config file outside project root: ${filePath}`);
            continue;
        }
        if (await existsAsync(filePath)) {
            try {
                const content = await readFileAsync(filePath, 'utf8');
                if (content.includes(packageName)) {
                    usedInFiles.push(configFile);
                }
            }
            catch {
                // Continue if file can't be read
                continue;
            }
        }
    }
}
/**
 * Fallback search when ripgrep isn't available or fails
 */
async function fallbackFileSearch(packageName, projectRoot) {
    const usedInFiles = [];
    // Check if package is in dependencies
    const packageJsonPath = path.join(projectRoot, 'package.json');
    if (!(0, security_1.isPathWithinRoot)(packageJsonPath, projectRoot)) {
        console.warn(`Skipping package.json outside project root: ${packageJsonPath}`);
        return usedInFiles;
    }
    if (await existsAsync(packageJsonPath)) {
        try {
            const packageJson = JSON.parse(await readFileAsync(packageJsonPath, 'utf8'));
            const isDependency = packageJson.dependencies?.[packageName] ||
                packageJson.devDependencies?.[packageName] ||
                packageJson.peerDependencies?.[packageName];
            if (isDependency) {
                usedInFiles.push('package.json');
            }
        }
        catch {
            // Continue even if package.json can't be parsed
        }
    }
    return usedInFiles;
}
/**
 * Extracts a code snippet around package usage for AI analysis
 * Returns ~10-20 lines of context around import/usage
 */
async function extractCodeSnippet(filePath, packageName, projectRoot) {
    const cacheKey = `${projectRoot}::${packageName}::${filePath}`;
    if (snippetCache.has(cacheKey))
        return snippetCache.get(cacheKey);
    try {
        const fullPath = path.join(projectRoot, filePath);
        if (!(0, security_1.isPathWithinRoot)(fullPath, projectRoot)) {
            console.warn(`Skipping code snippet extraction outside project root: ${fullPath}`);
            snippetCache.set(cacheKey, undefined);
            if (snippetCache.size > MAX_CACHE_ENTRIES)
                snippetCache.clear();
            return undefined;
        }
        if (!await existsAsync(fullPath)) {
            snippetCache.set(cacheKey, undefined);
            if (snippetCache.size > MAX_CACHE_ENTRIES)
                snippetCache.clear();
            return undefined;
        }
        const content = await readFileAsync(fullPath, 'utf8');
        const lines = content.split('\n');
        // Find line with package import/usage
        let targetLine = -1;
        const searchPatterns = [
            new RegExp(`import.*from.*['"\`]${packageName}['"\`]`),
            new RegExp(`import.*['"\`]${packageName}['"\`]`),
            new RegExp(`require\\(['"\`]${packageName}['"\`]\\)`),
            new RegExp(`from.*['"\`]${packageName}['"\`]`)
        ];
        for (let i = 0; i < lines.length; i++) {
            for (const pattern of searchPatterns) {
                if (pattern.test(lines[i])) {
                    targetLine = i;
                    break;
                }
            }
            if (targetLine !== -1)
                break;
        }
        if (targetLine === -1) {
            // No specific import found, return early lines if it's a config file
            if (filePath.includes('config') || filePath.includes('package.json')) {
                const snippetLines = lines.slice(0, Math.min(15, lines.length));
                const result = {
                    filePath: filePath,
                    startLine: 1,
                    endLine: snippetLines.length,
                    before: sanitizeCodeSnippet(snippetLines.join('\n'))
                };
                snippetCache.set(cacheKey, result);
                if (snippetCache.size > MAX_CACHE_ENTRIES)
                    snippetCache.clear();
                return result;
            }
            snippetCache.set(cacheKey, undefined);
            if (snippetCache.size > MAX_CACHE_ENTRIES)
                snippetCache.clear();
            return undefined;
        }
        // Extract context around the target line
        const contextLines = 8; // ~8 lines before and after
        const startLine = Math.max(0, targetLine - contextLines);
        const endLine = Math.min(lines.length - 1, targetLine + contextLines);
        const snippetLines = lines.slice(startLine, endLine + 1);
        const result = {
            filePath: filePath,
            startLine: startLine + 1, // 1-indexed for display
            endLine: endLine + 1,
            before: sanitizeCodeSnippet(snippetLines.join('\n'))
        };
        snippetCache.set(cacheKey, result);
        if (snippetCache.size > MAX_CACHE_ENTRIES)
            snippetCache.clear();
        return result;
    }
    catch (error) {
        console.error(`Error extracting code snippet from ${filePath}:`, error);
        snippetCache.set(cacheKey, undefined);
        if (snippetCache.size > MAX_CACHE_ENTRIES)
            snippetCache.clear();
        return undefined;
    }
}
/**
 * Sanitizes code snippet to remove potential secrets and limit size
 */
function sanitizeCodeSnippet(code) {
    // Remove potential secrets
    let sanitized = code
        .replace(/(['"`])(?:sk_|pk_|tok_|key_|secret_|password_|pwd_)[^'"`]*\1/gi, '$1[REDACTED]$1')
        .replace(/(['"`])[A-Za-z0-9+/]{20,}={0,2}\1/g, '$1[REDACTED]$1') // Base64-like strings
        .replace(/(['"`])[0-9a-f]{32,}\1/gi, '$1[REDACTED]$1') // Hex tokens
        .replace(/(token|key|secret|password|pwd)\s*[:=]\s*['"`][^'"`]*['"`]/gi, '$1: "[REDACTED]"');
    // Limit size to prevent excessive data transmission
    if (sanitized.length > 2000) {
        sanitized = sanitized.substring(0, 1950) + '\n// ... (truncated)';
    }
    return sanitized;
}
/**
 * Detects the environment context for a package based on dependency analysis
 */
function detectEnvironment(packageName, paths, projectRoot) {
    try {
        // Check package.json to see if it's in devDependencies
        const packageJsonPath = path.join(projectRoot, 'package.json');
        if (fs.existsSync(packageJsonPath)) {
            const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
            // If explicitly in devDependencies, it's dev
            if (packageJson.devDependencies?.[packageName]) {
                return 'dev';
            }
            // If in regular dependencies, analyze further
            if (packageJson.dependencies?.[packageName]) {
                // Analyze dependency paths to determine usage context
                const buildToolPatterns = [
                    'webpack', 'vite', 'rollup', 'parcel', 'esbuild', 'babel',
                    'eslint', 'prettier', 'typescript', '@types/', 'jest', 'mocha',
                    'cypress', 'playwright', 'storybook', 'nodemon', 'concurrently'
                ];
                // Check if any path contains build tools (indicates dev usage)
                const hasBuildToolInPath = paths.some(path => path.some(pkg => buildToolPatterns.some(tool => pkg.includes(tool))));
                if (hasBuildToolInPath) {
                    return 'dev';
                }
                // If it's a direct dependency without build tools, assume prod
                const isDirectDependency = paths.some(path => path.length === 1);
                if (isDirectDependency) {
                    return 'prod';
                }
            }
        }
        // Default to 'prod' for conservative security prioritization
        return 'prod';
    }
    catch (error) {
        console.error('Error detecting environment:', error);
        return 'prod'; // Conservative default
    }
}
//# sourceMappingURL=fileAnalysis.js.map