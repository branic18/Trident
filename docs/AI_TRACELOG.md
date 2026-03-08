# 75HER Challenge: AI Trace Log
Project Name: Trident  Vulnerability Scanner + Goose Assistant
Team Name: TridentTeam

## 💡 Purpose
Document AI-assisted work to show we augmented (not abdicated) engineering responsibility: what was asked, what was produced, what was changed, and how it was verified.

## 🤖 AI Trace Entries

| Date (ET) | AI Tool | Where Used | Prompt / Input Summary | Raw Output Type | Human Changes | Verification |
|---|---|---|---|---|---|---|
| 2026-03-06 | Codex CLI (GPT-5.x) | Repo development | Implement Goose insight UI, caching, safe apply-fix workflow, and PRD updates based on `docs/Goose_ImplementationPlan.md` | Code patches + doc edits | Tuned UX copy, tightened error handling, updated defaults | `npm test`, `npm run build`, manual scan in VS Code |
| 2026-03-06 | Goose (OpenAI provider) | Runtime (extension) | Input: `VulnContext` JSON (npm audit metadata + optional snippet); Recipe: `recipes/trident_vuln_explainer.yaml` | `GooseVulnInsight` JSON | Validated/sanitized output before rendering; code fixes require explicit apply | Schema validation (`src/goose/validator.ts`), UI rendering checks, manual review |
| 2026-03-07 | Codex CLI (GPT-5.x) | Repo development | Add consent gate + metadata-only mode; add advisory/CVE links + explainability; add shared cache option | Code patches + config updates | Adjusted settings, expanded tests, improved setup UX | `npm test` |
| 2026-03-07 | Codex CLI (GPT-5.x) | Docs | Populate decision/risk/evidence logs for submission | Markdown edits | Ensured entries are short, include tradeoffs, and reference real artifacts | Manual review |

## 🧾 Prompts & Artifacts
- Goose recipe/prompt source: `recipes/trident_vuln_explainer.yaml`.
- Goose inputs: `VulnContext` built by `src/goose/buildVulnContext.ts`.
- Goose outputs: validated by `src/goose/validator.ts` and rendered in `src/extension.ts`.

## 🚦 Usage Rules & Ethics
- No secrets intentionally included in AI inputs; snippets are size-limited and sanitization is applied.
- AI output is treated as suggestions, not authoritative truth.
- Code changes are gated behind diff preview + confirmation and are undoable via VS Code `WorkspaceEdit`.

## ✅ Submission Checklist
- [x] At least 3 entries documented.
- [x] Every entry includes a verification method.
- [x] Clear distinction between AI output and human changes.
