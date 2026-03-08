# 75HER Project: Trident 
One-line Value Proposition: Designed to be accessible to everyone, this extension brings enterprise-grade npm vulnerability insights to solo devs, students, and small teams without requiring a security budget or complex setup.

## 🎯 Problem Statement
**Who**  
JavaScript and TypeScript developers in small teams, startups, and learning environments who use npm but don’t have a dedicated security team backing them.

**Problem**  
`npm audit` dumps a wall of text that’s noisy, confusing, and hard to connect back to the actual code and dependencies you work in every day.

**Impact**  
People waste time chasing low‑impact alerts, feel overwhelmed by security warnings, and still risk shipping vulnerable code because it’s not obvious what really matters or what to fix first.


## ✨ Solution Overview
**What we built**  
Trident Vulnerability Package Scanner is a VS Code extension that runs `npm audit --json` on your Node.js project and turns the results into an interactive, D3‑powered dependency graph you can explore without leaving your editor. It helps you quickly see which packages are vulnerable, how they’re connected, and what you can do about them, with optional AI assistance for explanations and fix suggestions.

**Key Features**

- **Visual dependency graph**  
  Renders your vulnerable npm dependencies as an interactive graph in a VS Code webview, so you can see how issues flow through your dependency tree instead of scrolling a wall of text. This makes it much easier to understand blast radius and prioritize what to tackle first.

- **AI‑assisted vulnerability insights (Goose)**  
  When enabled, the extension sends a sanitized vulnerability context to the Goose CLI to generate plain‑language explanations, risk breakdowns, and suggested remediations. This saves you from manually deciphering CVEs and helps non‑security experts take confident action.

- **In‑editor fix workflow**  
  Provides an inspector panel with recommended `npm install` commands and, when available from Goose, code‑fix suggestions you can preview and apply via VS Code’s edit APIs. This keeps the full loop—scan, understand, and fix—inside your existing workflow, without extra tools or dashboards.

- **Accessibility‑first, human‑centered design**  
  The UI, AI flows, and copy are built to be readable, keyboard‑friendly, and low‑jargon, so developers of all backgrounds can understand risks and suggested fixes without needing to be security experts or AI specialists.



## 🚀 Quick Start & Demo Path

Development
1. npm install
2. npm run build
3. npm run watch
4. Open Command Palette
5. Select 'Debug: Select and Start Debugging'
6. Select 'Run Extenstion'- this should open anotheer VSCode window
7. Make sure the new window has a Node.js project
8. Select 'Start Scanner' under the 'Vulnerable Packages' view under 'Explorer'
9. This should open the canvas!

## 🤖 Goose Setup (User-Configured)
🤖 Goose Setup (User-Configured)
This extension does not include Goose. You install and configure Goose yourself, and the extension simply runs goose from your PATH.

Important: VS Code only sees environment variables from the shell you use to launch it.

Prerequisites
Goose CLI installed and on PATH (goose --version should work).

An AI provider configured for Goose (for OpenAI: OPENAI_API_KEY set in your environment).

Quick Setup
Install Goose and verify it works

bash
goose --version
Set your AI provider key

OpenAI examples:

macOS / Linux (bash/zsh):

bash
export OPENAI_API_KEY="your-key-here"
 **Optional**:
export GOOSE_PROVIDER="openai"
export GOOSE_MODEL="gpt-4.1-mini"
Windows PowerShell:

powershell
$env:OPENAI_API_KEY="your-key-here"
**Optional**:
$env:GOOSE_PROVIDER="openai"
$env:GOOSE_MODEL="gpt-4.1-mini"
Launch VS Code from that same shell

bash
code .
If code is not found:

In VS Code, open Command Palette → Shell Command: Install 'code' command in PATH

Restart your terminal, then run code . again

If you open VS Code from the Dock/Start menu, it will not see the env vars you just set in your terminal.

Configure Trident Goose settings (optional)

In VS Code settings (settings.json or GUI):

json
{
  "trident.goose.enabled": true,
  "trident.goose.recipePath": "./recipes/trident_vuln_explainer.yaml",
  "trident.goose.maxRetries": 1,
  "trident.goose.timeoutMs": 30000,
  "trident.goose.maxConcurrency": 2,
  "trident.goose.cacheMaxEntries": 200,
  "trident.goose.cacheMaxAgeMs": 604800000
}
trident.goose.recipePath defaults to ./recipes/trident_vuln_explainer.yaml inside this repo.

You can also set an absolute path if you keep recipes elsewhere.

How Trident Uses Goose
When you click a vulnerability card, the extension runs Goose like:

bash
goose run \
  --recipe <recipePath> \
  --params vuln_context=<json> \
  --quiet \
  --no-session
<recipePath> comes from trident.goose.recipePath.

The extension passes a sanitized vuln_context JSON, and only consumes the validated JSON output.

Verify It Works
goose --version works in the same terminal where you run code .

In VS Code, open the Trident panel, click a vulnerability, and you should see an AI explanation appear.

Troubleshooting
“Goose CLI not found”
Goose is not installed or not on PATH. Fix your Goose install and make sure goose --version works.

“Missing API key” or no AI output
Check that OPENAI_API_KEY (and optional GOOSE_PROVIDER / GOOSE_MODEL) are set in the shell that launched VS Code, and that "trident.goose.enabled": true.

“Invalid recipe path”
Update trident.goose.recipePath to a real file.

Relative paths resolve from the extension bundle first, then your workspace.

If in doubt, use an absolute path, for example:

json
"trident.goose.recipePath": "/Users/you/path/to/repo/recipes/trident_vuln_explainer.yaml"

## Creating a PR and publishing to VSCode Extension

| Part      | Meaning          | When it changes                             |
| --------- | ---------------- | ------------------------------------------- |
| **MAJOR** | Breaking changes | Incompatible API/behavior changes           |
| **MINOR** | New features     | Backwards-compatible feature additions      |
| **PATCH** | Bug fixes        | Small fixes that don’t change functionality |

Which commit message triggers each bump
Release Please reads Conventional Commit prefixes.

| Commit message                 | Version bump | Example         |
| ------------------------------ | ------------ | --------------- |
| `fix:`                         | PATCH        | `1.0.0 → 1.0.1` |
| `feat:`                        | MINOR        | `1.0.0 → 1.1.0` |
| `feat!:` or `BREAKING CHANGE:` | MAJOR        | `1.0.0 → 2.0.0` |
| `docs:`                        | none         | changelog only  |
| `chore:`                       | none         | ignored         |

Example commit message (not the description): "fix: correct vulnerability panel rendering" ==> 1.0.0 → 1.0.1

### Typical workflow 

git commit -m "feat: add vulnerability visualization"
git push
↓
Release Please updates the release PR
↓
Merge the release PR
↓
GitHub release created
↓
Your publish workflow runs
↓
Extension published to
Visual Studio Code Marketplace


Installation (1 Command)
Requirements: [e.g., Node 18+, Python 3.9+, API keys].
Bash
# Clone and run
```bash
git clone https://github.com/branic18/Trident.git && cd Trident && npm install && npm run build
Access: Open the Trident panel inside VS Code (no browser or localhost port required).

⏱️ 60-Second Demo Path
Step 1
Open any JavaScript/TypeScript project with a package.json in VS Code and run the “Vulnerability Package Scanner” command from the Command Palette.
→ Trident runs npm audit --json (creating a lockfile if needed) and opens a webview with a dependency graph.

Step 2
Hover and click on a red or orange node in the graph.
→ The Inspector panel shows which package is vulnerable, its severity, CVSS details, and suggested npm install commands or upgrade paths.

Step 3
If Goose is set up, click “Generate AI insight” on one of the vulnerabilities.
→ You get a plain‑language explanation of the issue and optional code‑fix suggestions you can preview and apply without leaving VS Code.
📹 Demo Video: [Insert Link] | 🔗 Live Demo: [Insert Link].

## 🏗️ Technical Architecture
Components:
**Frontend:**  VS Code webview using HTML, CSS, and D3.js to render an interactive SVG dependency graph, metadata panel, and inspector UI entirely inside the editor.
**Backend**: Backend: VS Code extension host running Node.js/TypeScript that executes npm audit --json, parses results, manages Goose calls, applies code fixes, and streams data to the webview over postMessage..
**Database**: Database: No external database; the extension uses in-memory structures plus small JSON/JSONL files in VS Code’s global storage (or an optional .trident/ folder) for caching AI insights and logging scan metrics.
**AI Integration**: The extension shells out to the Goose CLI, which then calls the configured models to turn each vulnerability’s sanitized context into plain‑language explanations and practical fix suggestions, all triggered from inside the VS Code webview.
🤖 goose Integration (AI/ML Track)
Model: Claude Sonnet 4.5 and OpenAi Codex 5.3 via goose].
Implementation: When you click a vulnerable package in the Trident extension. The extension builds a tightly scoped JSON context (package, version, CVSS, snippets, usage files), then invokes Goose from your machine to process that context through the configured models and return a structured JSON insight back into VS Code.
Impact: This turns raw npm audit output into clear, project-aware vulnerability explanations and fix guidance in seconds, so small teams can understand and act on issues far faster than reading CVEs and docs by hand.

## 📋 Project Logs & Documentation
Log Type
Purpose
Link to Documentation
Decision Log
Technical choices & tradeoffs.
[Link to DECISION_LOG.md](https://docs.google.com/document/d/17cgNH-SKyaXy0CCviD1J5wXR3tXMuXZORyjeFMLUF9k/edit?usp=sharing).
Risk Log
Issues identified & fixed.
[Link to RISK_LOG.md](https://docs.google.com/document/d/1_Cr4G-yxXoc2r3TxWeUxrLESKw9FmJbyzX0_ns4pNJw/edit?usp=sharing).
Evidence Log
Sources, assets, & attributions.
[Link to EVIDENCE_LOG.md].


## 🧪 Testing & Known Issues

**Test Results**  
All core flows are covered by Node-based tests (7 passing / 7 total).

### Known Issues

- **Workspace‑shared cache requires an open workspace folder**  
  - Symptom: `.trident/trident-cache.json` never appears.  
  - Workaround: Open a folder (not a single file) in VS Code before running the scanner.

- **Goose requires local CLI + provider configuration**  
  - Symptom: AI analysis fails with “Goose CLI not found” or a missing provider/API key.  
  - Workaround: Install Goose CLI and configure your provider (for example, set `OPENAI_API_KEY` and `GOOSE_MODEL`).

### Next Step

- **Planned:** Persistent, team‑shared “org cache” + backend mode to let teams share AI insights across machines via an optional server‑backed cache and Goose execution service, while still respecting privacy controls.


## 👥 Team & Acknowledgments

**Team Name:** TridentTeam

- Brandi — Product/AI Engineer  
  - [GitHub](https://github.com/branic18) · [LinkedIn](https://www.linkedin.com/in/brandi-nichols-dev/)

- Brie — Product/AI Engineer  
  - [GitHub](https://github.com/digitalfl0wer) · [LinkedIn](https://www.linkedin.com/in/bsspann/)

Special thanks to: CreateHER Fest, and goose/Block.

## 📄 License & Attributions
Project License: MIT.

D3.js: BSD-3-Clause | https://github.com/d3/d3/blob/main/LICENSE
Bootstrap Icons: MIT | https://github.com/twbs/icons/blob/main/LICENSE
IBM Plex Mono (Google Fonts): SIL Open Font License 1.1 | https://scripts.sil.org/cms/scripts/page.php?site_id=nrsi&id=OFL

Built with ❤️ for #75HER Challenge | CreateHER Fest 2026.
