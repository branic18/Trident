"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.runGooseForVuln = runGooseForVuln;
exports.runGooseForVulnLegacy = runGooseForVuln;
exports.runGooseWithRetry = runGooseWithRetry;
const child_process_1 = require("child_process");
const security_1 = require("./security");
const validator_1 = require("./validator");
/**
 * Secure Goose execution with comprehensive input sanitization and output validation
 */
async function runGooseForVuln(context) {
    const validator = (0, validator_1.createGooseValidator)();
    return new Promise((resolve, reject) => {
        void (async () => {
            // Serialize params for Goose CLI
            const contextJson = JSON.stringify(context);
            const params = [
                `vuln_context=${contextJson}`,
                'validation_mode=strict',
                'accessibility_level=wcag_aa'
            ];
            // Spawn Goose with secure configuration
            const proc = (0, child_process_1.spawn)("goose", [
                "run",
                "--recipe",
                "./recipes/trident_vuln_explainer.yaml",
                "--params",
                params[0],
                "--params",
                params[1],
                "--params",
                params[2],
                "--quiet",
                "--no-session"
            ], {
                cwd: (0, security_1.sanitizeWorkingDirectory)(),
                env: (0, security_1.getMinimalEnvironment)(),
                stdio: ['ignore', 'pipe', 'pipe'], // Secure stdio configuration
                timeout: 30000, // 30 second timeout
                windowsHide: true // Hide process window on Windows
            });
            let stdout = "";
            let stderr = "";
            proc.stdout.on("data", (d) => {
                stdout += d.toString();
                // Prevent excessive output accumulation (DoS protection)
                if (stdout.length > 50000) { // 50KB limit
                    proc.kill('SIGTERM');
                    reject(new Error('Goose output too large'));
                    return;
                }
            });
            proc.stderr.on("data", (d) => {
                stderr += d.toString();
                // Limit stderr as well
                if (stderr.length > 10000) { // 10KB limit
                    proc.kill('SIGTERM');
                    reject(new Error('Goose error output too large'));
                    return;
                }
            });
            proc.on("close", (code) => {
                if (code !== 0) {
                    return reject(new Error(`Goose exited with code ${code}: ${stderr.substring(0, 500)}`));
                }
                try {
                    // Parse and validate Goose output
                    const lines = stdout
                        .trim()
                        .split("\n")
                        .filter((line) => line.trim().length > 0);
                    if (lines.length === 0) {
                        return reject(new Error('No output from Goose'));
                    }
                    const lastLine = lines[lines.length - 1];
                    // Basic JSON validation before parsing
                    if (!lastLine.startsWith('{') || !lastLine.endsWith('}')) {
                        return reject(new Error('Invalid JSON format from Goose'));
                    }
                    const parsed = JSON.parse(lastLine);
                    // Comprehensive validation and sanitization of AI output
                    const validatedInsight = validator.validate(parsed);
                    resolve(validatedInsight);
                }
                catch (err) {
                    if (err instanceof Error) {
                        reject(new Error(`Failed to parse Goose output: ${err.message}`));
                    }
                    else {
                        reject(new Error('Failed to parse Goose output: Unknown error'));
                    }
                }
            });
            proc.on("error", (err) => {
                reject(new Error(`Failed to spawn Goose process: ${err.message}`));
            });
            // Handle timeout
            setTimeout(() => {
                if (!proc.killed) {
                    proc.kill('SIGTERM');
                    reject(new Error('Goose execution timed out'));
                }
            }, 30000);
        })().catch(reject);
    });
}
/**
 * Enhanced error handling wrapper for Goose execution with retry logic
 */
async function runGooseWithRetry(context, maxRetries = 2) {
    let lastError;
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
            return await runGooseForVuln(context);
        }
        catch (error) {
            lastError = error instanceof Error ? error : new Error('Unknown error');
            // Don't retry on certain types of errors
            if (isNonRetryableError(lastError)) {
                throw lastError;
            }
            // Exponential backoff for retries
            if (attempt < maxRetries) {
                const delay = Math.pow(2, attempt) * 1000; // 1s, 2s, 4s...
                await new Promise(resolve => setTimeout(resolve, delay));
            }
        }
    }
    throw lastError;
}
/**
 * Determines if an error should not be retried
 */
function isNonRetryableError(error) {
    const nonRetryablePatterns = [
        'Invalid', 'Validation failed', 'Schema error',
        'Too large', 'Malformed', 'Permission denied'
    ];
    return nonRetryablePatterns.some(pattern => error.message.includes(pattern));
}
//# sourceMappingURL=runGoose.js.map