"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.JsonSchemaValidator = void 0;
exports.createGooseValidator = createGooseValidator;
function isRecord(value) {
    return !!value && typeof value === 'object' && !Array.isArray(value);
}
class JsonSchemaValidator {
    validate(data) {
        if (!isRecord(data)) {
            throw new Error('Invalid GooseVulnInsight data type');
        }
        const obj = data;
        // Validate required fields
        const insight = {
            title: this.validateTitle(obj.title),
            humanExplanation: this.validateExplanation(obj.humanExplanation),
            impactOnUsers: this.validateImpact(obj.impactOnUsers),
            priorityScore: this.validatePriorityScore(obj.priorityScore),
            priorityReason: this.validatePriorityReason(obj.priorityReason),
            recommendedActions: this.validateRecommendedActions(obj.recommendedActions),
            fixStyle: this.validateFixStyle(obj.fixStyle),
            devFacingSummary: this.validateDevSummary(obj.devFacingSummary),
            codeFix: obj.codeFix ? this.validateCodeFix(obj.codeFix) : undefined
        };
        // Apply content filtering
        return this.filterSuspiciousContent(insight);
    }
    validateTitle(title) {
        if (typeof title !== 'string') {
            throw new Error('Invalid title type');
        }
        if (title.length === 0 || title.length > 200) {
            throw new Error('Invalid title length');
        }
        return title.trim();
    }
    validateExplanation(explanation) {
        if (typeof explanation !== 'string') {
            throw new Error('Invalid humanExplanation type');
        }
        if (explanation.length === 0 || explanation.length > 2000) {
            throw new Error('Invalid humanExplanation length');
        }
        return explanation.trim();
    }
    validateImpact(impact) {
        if (typeof impact !== 'string') {
            throw new Error('Invalid impactOnUsers type');
        }
        if (impact.length === 0 || impact.length > 1000) {
            throw new Error('Invalid impactOnUsers length');
        }
        return impact.trim();
    }
    validatePriorityScore(score) {
        if (typeof score !== 'number') {
            throw new Error('Invalid priorityScore type');
        }
        if (!Number.isInteger(score) || score < 1 || score > 5) {
            throw new Error('Invalid priorityScore range (must be 1-5)');
        }
        return score;
    }
    validatePriorityReason(reason) {
        if (typeof reason !== 'string') {
            throw new Error('Invalid priorityReason type');
        }
        if (reason.length === 0 || reason.length > 500) {
            throw new Error('Invalid priorityReason length');
        }
        return reason.trim();
    }
    validateRecommendedActions(actions) {
        if (!Array.isArray(actions)) {
            throw new Error('Invalid recommendedActions type');
        }
        if (actions.length === 0 || actions.length > 15) {
            throw new Error('Invalid recommendedActions count (must be 1-15)');
        }
        return actions.map((action, index) => {
            if (typeof action !== 'string') {
                throw new Error(`Invalid recommendedAction[${index}] type`);
            }
            if (action.length === 0 || action.length > 300) {
                throw new Error(`Invalid recommendedAction[${index}] length`);
            }
            return action.trim();
        });
    }
    validateFixStyle(fixStyle) {
        if (typeof fixStyle !== 'string') {
            throw new Error('Invalid fixStyle type');
        }
        const validFixStyles = [
            'non-breaking-upgrade', 'major-upgrade', 'no-fix-yet',
            'manual-fix', 'configuration-change', 'code-change'
        ];
        if (!validFixStyles.includes(fixStyle)) {
            // Allow custom fix styles but sanitize them
            const sanitized = fixStyle.replace(/[^a-zA-Z0-9\-_]/g, '').substring(0, 50);
            if (sanitized.length === 0) {
                throw new Error('Invalid fixStyle format');
            }
            return sanitized;
        }
        return fixStyle;
    }
    validateDevSummary(summary) {
        if (typeof summary !== 'string') {
            throw new Error('Invalid devFacingSummary type');
        }
        if (summary.length === 0 || summary.length > 300) {
            throw new Error('Invalid devFacingSummary length');
        }
        return summary.trim();
    }
    validateCodeFix(codeFix) {
        if (!isRecord(codeFix)) {
            throw new Error('Invalid codeFix type');
        }
        const obj = codeFix;
        return {
            filePath: this.validateFilePath(obj.filePath),
            before: this.validateCodeContent(obj.before, 'before'),
            after: this.validateCodeContent(obj.after, 'after'),
            description: this.validateCodeDescription(obj.description),
            warnings: this.validateWarnings(obj.warnings)
        };
    }
    validateFilePath(filePath) {
        if (typeof filePath !== 'string') {
            throw new Error('Invalid codeFix.filePath type');
        }
        if (filePath.length === 0 || filePath.length > 260) {
            throw new Error('Invalid codeFix.filePath length');
        }
        // Basic path validation - no directory traversal
        if (filePath.includes('..') || filePath.startsWith('/')) {
            throw new Error('Invalid codeFix.filePath format');
        }
        return filePath;
    }
    validateCodeContent(content, field) {
        if (typeof content !== 'string') {
            throw new Error(`Invalid codeFix.${field} type`);
        }
        if (content.length > 5000) {
            throw new Error(`Invalid codeFix.${field} length (too long)`);
        }
        return content;
    }
    validateCodeDescription(description) {
        if (typeof description !== 'string') {
            throw new Error('Invalid codeFix.description type');
        }
        if (description.length === 0 || description.length > 500) {
            throw new Error('Invalid codeFix.description length');
        }
        return description.trim();
    }
    validateWarnings(warnings) {
        if (!Array.isArray(warnings)) {
            throw new Error('Invalid codeFix.warnings type');
        }
        if (warnings.length > 10) {
            throw new Error('Too many codeFix.warnings');
        }
        return warnings.map((warning, index) => {
            if (typeof warning !== 'string') {
                throw new Error(`Invalid codeFix.warnings[${index}] type`);
            }
            if (warning.length > 200) {
                throw new Error(`Invalid codeFix.warnings[${index}] length`);
            }
            return warning.trim();
        });
    }
    filterSuspiciousContent(insight) {
        const filtered = { ...insight };
        // Filter potentially dangerous content
        filtered.title = this.filterText(filtered.title);
        filtered.humanExplanation = this.filterText(filtered.humanExplanation);
        filtered.impactOnUsers = this.filterText(filtered.impactOnUsers);
        filtered.priorityReason = this.filterText(filtered.priorityReason);
        filtered.devFacingSummary = this.filterText(filtered.devFacingSummary);
        filtered.recommendedActions = filtered.recommendedActions.map(action => this.filterText(action));
        if (filtered.codeFix) {
            filtered.codeFix = {
                ...filtered.codeFix,
                description: this.filterText(filtered.codeFix.description),
                warnings: filtered.codeFix.warnings.map(warning => this.filterText(warning))
            };
        }
        return filtered;
    }
    filterText(text) {
        // Remove potential script injection attempts
        let filtered = text
            .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '[REMOVED_SCRIPT]')
            .replace(/<iframe\b[^>]*>/gi, '[REMOVED_IFRAME]')
            .replace(/javascript:/gi, 'javascript-removed:')
            .replace(/data:text\/html/gi, 'data-html-removed')
            .replace(/on\w+\s*=/gi, 'event-removed=');
        // Remove potential command injection
        filtered = filtered
            .replace(/`[^`]*`/g, '[REMOVED_BACKTICKS]') // Template literals
            .replace(/\$\([^)]*\)/g, '[REMOVED_COMMAND_SUB]') // Command substitution
            .replace(/;\s*rm\s/gi, '; [REMOVED_RM]')
            .replace(/;\s*curl\s/gi, '; [REMOVED_CURL]')
            .replace(/;\s*wget\s/gi, '; [REMOVED_WGET]');
        // Remove potential path traversal in text
        filtered = filtered.replace(/\.\.\/\.\.\//g, '[REMOVED_TRAVERSAL]');
        return filtered.trim();
    }
}
exports.JsonSchemaValidator = JsonSchemaValidator;
/**
 * Factory function to create validator instance
 */
function createGooseValidator() {
    return new JsonSchemaValidator();
}
//# sourceMappingURL=validator.js.map