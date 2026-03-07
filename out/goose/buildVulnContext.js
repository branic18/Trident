"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildVulnContext = buildVulnContext;
exports.buildVulnContextSync = buildVulnContextSync;
const fileAnalysis_1 = require("./fileAnalysis");
const security_1 = require("./security");
// CVSS parsing helper functions
function parseCvssVector(vectorString) {
    if (!vectorString || typeof vectorString !== 'string') {
        return undefined;
    }
    const match = vectorString.match(/CVSS:3\.1\/(.+)/);
    if (!match) {
        return undefined;
    }
    const metrics = {};
    const parts = match[1].split('/');
    for (const part of parts) {
        const [key, value] = part.split(':');
        switch (key) {
            case 'AV':
                metrics.attackVector = value === 'N' ? 'Network' :
                    value === 'A' ? 'Adjacent' :
                        value === 'L' ? 'Local' :
                            value === 'P' ? 'Physical' : value;
                break;
            case 'AC':
                metrics.attackComplexity = value === 'L' ? 'Low' :
                    value === 'H' ? 'High' : value;
                break;
            case 'PR':
                metrics.privilegesRequired = value === 'N' ? 'None' :
                    value === 'L' ? 'Low' :
                        value === 'H' ? 'High' : value;
                break;
            case 'UI':
                metrics.userInteraction = value === 'N' ? 'None' :
                    value === 'R' ? 'Required' : value;
                break;
            case 'C':
                metrics.confidentiality = value === 'N' ? 'None' :
                    value === 'L' ? 'Low' :
                        value === 'H' ? 'High' : value;
                break;
            case 'I':
                metrics.integrity = value === 'N' ? 'None' :
                    value === 'L' ? 'Low' :
                        value === 'H' ? 'High' : value;
                break;
            case 'A':
                metrics.availability = value === 'N' ? 'None' :
                    value === 'L' ? 'Low' :
                        value === 'H' ? 'High' : value;
                break;
        }
    }
    return Object.keys(metrics).length > 0 ? metrics : undefined;
}
/**
 * Sanitizes the complete vulnerability context for secure processing
 */
function sanitizeVulnContext(context) {
    return {
        vulnId: (0, security_1.sanitizeId)(context.vulnId),
        packageName: (0, security_1.sanitizePackageName)(context.packageName),
        version: (0, security_1.sanitizeVersion)(context.version),
        npmSeverity: (0, security_1.validateSeverity)(context.npmSeverity),
        cvss: (0, security_1.sanitizeCvssData)(context.cvss),
        cwe: (0, security_1.sanitizeCweData)(context.cwe),
        githubAdvisory: (0, security_1.sanitizeAdvisoryData)(context.githubAdvisory),
        paths: (0, security_1.sanitizePaths)(context.paths),
        usedInFiles: (0, security_1.sanitizeFilePaths)(context.usedInFiles),
        environment: (0, security_1.validateEnvironment)(context.environment),
        projectType: (0, security_1.sanitizeProjectType)(context.projectType),
        fixAvailable: (0, security_1.sanitizeFixData)(context.fixAvailable),
        codeSnippet: (0, security_1.sanitizeCodeSnippet)(context.codeSnippet)
    };
}
async function buildVulnContext(args) {
    const parsedCvss = parseCvssVector(args.cvssVector);
    // Build initial context (before sanitization to allow file analysis)
    let usedInFiles = args.usedInFiles || [];
    let codeSnippet = args.codeSnippet;
    let environment = args.environment;
    if (args.projectRoot && (!args.usedInFiles || args.usedInFiles.length === 0)) {
        try {
            // Find files that actually use this package
            usedInFiles = await (0, fileAnalysis_1.findFilesUsingPackage)(args.pkgName, args.projectRoot);
            // Extract code snippet from the first relevant file
            if (usedInFiles.length > 0 && !codeSnippet) {
                // Prioritize non-config files for code snippets
                const codeFiles = usedInFiles.filter(file => !file.includes('config') &&
                    !file.includes('package.json') &&
                    (file.endsWith('.js') || file.endsWith('.ts') || file.endsWith('.jsx') || file.endsWith('.tsx')));
                const targetFile = codeFiles.length > 0 ? codeFiles[0] : usedInFiles[0];
                codeSnippet = await (0, fileAnalysis_1.extractCodeSnippet)(targetFile, args.pkgName, args.projectRoot);
            }
            // Detect environment if not provided
            if (!environment) {
                environment = (0, fileAnalysis_1.detectEnvironment)(args.pkgName, args.paths, args.projectRoot);
            }
        }
        catch (error) {
            console.error('Error during file analysis:', error);
            // Continue with provided data if file analysis fails
        }
    }
    // Default environment if still not determined
    if (!environment) {
        environment = 'prod'; // Conservative default for security prioritization
    }
    // Build the context object
    const context = {
        vulnId: args.vulnId,
        packageName: args.pkgName,
        version: args.pkgVersion,
        npmSeverity: args.npmSeverity,
        cvss: {
            score: args.cvssScore,
            vectorString: args.cvssVector,
            ...(parsedCvss && { parsed: parsedCvss })
        },
        cwe: (args.cweIds && args.cweIds.length) || (args.cweNames && args.cweNames.length)
            ? {
                ids: args.cweIds || [],
                names: args.cweNames || []
            }
            : undefined,
        githubAdvisory: (args.githubAdvisoryId || args.githubSummary || args.githubUrl)
            ? {
                id: args.githubAdvisoryId,
                summary: args.githubSummary,
                url: args.githubUrl,
            }
            : undefined,
        paths: args.paths || [],
        usedInFiles: usedInFiles,
        environment: environment,
        projectType: args.projectType,
        fixAvailable: args.fixInfo,
        codeSnippet: codeSnippet,
    };
    // Apply comprehensive security sanitization
    return sanitizeVulnContext(context);
}
// Legacy synchronous version for backward compatibility
function buildVulnContextSync(args) {
    const parsedCvss = parseCvssVector(args.cvssVector);
    const context = {
        vulnId: args.vulnId,
        packageName: args.pkgName,
        version: args.pkgVersion,
        npmSeverity: args.npmSeverity,
        cvss: {
            score: args.cvssScore,
            vectorString: args.cvssVector,
            ...(parsedCvss && { parsed: parsedCvss })
        },
        cwe: (args.cweIds && args.cweIds.length) || (args.cweNames && args.cweNames.length)
            ? {
                ids: args.cweIds || [],
                names: args.cweNames || []
            }
            : undefined,
        githubAdvisory: (args.githubAdvisoryId || args.githubSummary || args.githubUrl)
            ? {
                id: args.githubAdvisoryId,
                summary: args.githubSummary,
                url: args.githubUrl,
            }
            : undefined,
        paths: args.paths || [],
        usedInFiles: args.usedInFiles || [],
        environment: args.environment,
        projectType: args.projectType,
        fixAvailable: args.fixInfo,
        codeSnippet: args.codeSnippet,
    };
    // Apply security sanitization
    return sanitizeVulnContext(context);
}
//# sourceMappingURL=buildVulnContext.js.map