# PRD: Goose Integration for Trident

## 1. Summary
Goose adds AI-assisted vulnerability explanations and fix guidance to Trident, a VS Code extension that visualizes `npm audit --json` results. Goose is **not** a scanner. It turns existing vulnerability metadata into human-readable insights and optional code suggestions.

## 2. Owners
Brie & Brandi

## 3. Background
Trident shows dependency graphs and vulnerability counts but does not explain impact, prioritization, or concrete remediation steps. Goose fills that gap with a structured, deterministic JSON output that the UI renders on-demand.

## 4. Goals
- ✅ Plain-language vulnerability explanation tied to project context.
- ✅ Impact description that references `usedInFiles` and environment.
- ✅ Priority score (1–5) with a short justification.
- ✅ Concrete remediation steps and tests to run.
- ✅ Optional code fix snippet when a relevant usage snippet is provided.
- ✅ Local-first scanning; Goose runs only when a user clicks a vulnerability.

## 5. Non-goals
- ✅ Running scanners inside Goose.
- ✅ Full codebase analysis or dataflow.
- ✅ Automated Git operations.
- ✅ Formal compliance or certification claims.

## 6. Users & Use Cases
### Users
- ✅ Node.js / TypeScript developers using VS Code.
- ⬜ Security-conscious teams at small orgs/NGOs without dedicated AppSec.

### Key Use Cases
1. ✅ Explain a vulnerability in plain language.
2. ✅ Describe likely impact on this project.
3. ✅ Provide a clear priority score and rationale.
4. ✅ Recommend remediation steps and tests.
5. ✅ Offer an optional minimal code change example.

## 7. Functional Requirements
### 7.1 Trigger & Flow
- ✅ Trigger: user clicks a vulnerable node and opens the vulnerability card.
- ✅ On first click for a vuln:
  - ✅ Build `vuln_context` JSON.
  - ✅ Call Goose CLI with the context.
  - ✅ Parse JSON output into `GooseVulnInsight` and cache by `vulnId`.
- ✅ Subsequent clicks use cached output.
- ✅ No AI calls on hover or during bulk scans.

### 7.2 Input: `vuln_context` JSON
```ts
export type CodeSnippet = {
  filePath: string;
  startLine: number;
  endLine: number;
  before: string;
};

export type VulnContext = {
  vulnId: string;
  packageName: string;
  version: string;
  npmSeverity: "low" | "moderate" | "high" | "critical";

  cvss: {
    score: number | null;
    vectorString: string | null;
    parsed?: {
      attackVector?: string;
      attackComplexity?: string;
      privilegesRequired?: string;
      userInteraction?: string;
      confidentiality?: string;
      integrity?: string;
      availability?: string;
    };
  };

  cwe?: {
    ids: string[];
    names: string[];
  };

  githubAdvisory?: {
    id?: string;
    summary?: string;
    url?: string;
  };

  paths: string[][];
  usedInFiles: string[];
  environment: "dev" | "staging" | "prod";
  projectType: string;

  fixAvailable: {
    type: "auto" | "manual" | "none";
    name?: string;
    version?: string;
    isSemVerMajor?: boolean;
    resolvesCount?: number;
  };

  codeSnippet?: CodeSnippet;
};
```
Constraints:
- ✅ Only send CWE IDs/names already present in advisories.
- ✅ Snippets must be small (10–20 lines). No full files.

### 7.3 Output: `GooseVulnInsight` JSON
```ts
export type CodeFix = {
  filePath: string;
  before: string;
  after: string;
  description: string;
  warnings: string[];
};

export type GooseVulnInsight = {
  title: string;
  humanExplanation: string;
  impactOnUsers: string;
  priorityScore: number;      // 1 (low) - 5 (high)
  priorityReason: string;
  recommendedActions: string[];
  fixStyle: string;           // "non-breaking-upgrade" | "major-upgrade" | "no-fix-yet" | ...
  devFacingSummary: string;
  codeFix?: CodeFix;
};
```
Requirements:
- ⬜ `humanExplanation`: 2–3 sentences, grade-8 reading level.
- ⬜ `impactOnUsers`: 1–2 sentences referencing environment and usage.
- ⬜ `priorityScore`: based on npm severity, CVSS, environment, and usage.
- ⬜ `recommendedActions`: 3–7 lines including upgrade guidance and tests.
- ⬜ `codeFix`: only when a snippet was provided; minimal, conservative edits.

## 8. Goose Recipe Requirements
Recipe: `recipes/trident_vuln_explainer.yaml`
- ✅ Single task of type `ai`.
- ⬜ Role: app security engineer assisting a small Node.js team.
- ✅ Input: full `vuln_context` JSON.
- ⬜ Output: **only** `GooseVulnInsight` JSON, no extra prose.
- ✅ Guardrails:
  - ✅ Do not claim the app is fully secure after fixing.
  - ✅ Do not invent new CVEs/CWEs or vulnerabilities.
  - ✅ Call out missing data (e.g., no CVSS).
  - ✅ Prefer minimal, conservative code changes.

## 9. Integration Points
### 9.1 Extension Backend
- ✅ Build `vuln_context`.
- ✅ Execute Goose:
  - ✅ `goose run --recipe recipes/trident_vuln_explainer.yaml --params vuln_context=<json> --quiet --no-session`
- ✅ Parse stdout as `GooseVulnInsight`.
- ✅ Cache by `vulnId`.

### 9.2 Webview UI
- ✅ Show `humanExplanation`, `impactOnUsers`, `priorityScore`, `priorityReason`.
- ✅ Render `recommendedActions` with copyable commands.
- ✅ Render `codeFix` diff if present (copy/apply actions).
- ✅ Label AI content clearly.

## 10. Non-functional Requirements
- ⬜ Performance target: < 3–5 seconds per vuln.
- ✅ Resilience: invalid JSON must fall back to raw metadata.
- ✅ Transparency: AI labels and disclaimers.
- ✅ Privacy: only metadata + small snippet sent to AI.

## 11. Security & Privacy Requirements
- ✅ Sanitize all inputs (paths, package names, snippet content).
- ⬜ Avoid command-line argument leaks by using params files or stdin where possible.
- ✅ Validate Goose output against schema before rendering.
- ✅ Prevent path traversal or access outside the workspace.

## 12. Accessibility Requirements
- ✅ Semantic headings and ARIA labels for AI sections.
- ✅ Keyboard navigation for all actions.
- ⬜ Announce completion/errors via live regions.
- ✅ Color-independent severity indicators.
- ⬜ WCAG 2.1 AA text contrast.

## 13. Success Criteria
- ✅ On node click, Inspector shows explanation, impact, priority, and actions.
- ⬜ At least one vuln shows a valid `codeFix` and can be applied safely.
- ⬜ Developers report they can decide what to fix first with confidence.

## 14. Implementation Status
### Completed
- ✅ Goose recipe exists and returns required JSON.
- ✅ Backend builds `VulnContext`, invokes Goose, and caches results.
- ✅ Inspector renders Goose insights.
- ✅ Basic error handling and fallback behavior.
- ✅ Setup UX for missing Goose.

### Open Gaps
- ⬜ Secure Goose execution via params files or stdin.
- ✅ Input sanitization and strict schema validation.
- ⬜ Recipe discovery and versioning.
- ⬜ Formal accessibility testing.
- ⬜ Security testing and threat modeling.

## 15. Next Steps (Suggested)
1. ⬜ Harden Goose execution and output validation.
2. ⬜ Add sanitization for snippets and paths.
3. ⬜ Finalize accessibility audit and fixes.
4. ⬜ Add recipe versioning to cache invalidation.
