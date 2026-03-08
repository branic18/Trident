# 75HER Challenge: Decision Log

**Project Name:** Trident Vulnerability Package Scanner  
**Team Name:** Trident

## 💡 Purpose & Instructions

**Purpose**  
Document key technical choices and reasoning for judges so they can understand the engineering thinking behind Trident.

**Instructions**

- For each major decision, record the choice made, the “Why,” and the “Tradeoff”.
- Keep it punchy: each entry should be 1–2 lines maximum.
- Focus on architecture, tech stack, project scope changes, or picking between multiple valid options.
- Target: at least 5–10 key decisions.

## 🛠 Decision Log

| Category | Decision → Why| Tradeoff|
-----------------------------------------------------------------------------------------------|
| Tech Stack   | VS Code extension + Webview UI → runs where devs already work and keeps scans/graphs local to their editor           | Webview/DOM code is harder to test and debug than a standalone web app                                       |
| Tech Stack   | TypeScript + Node.js → strong typing and first-class VS Code/extension tooling                                        | Slower to iterate than a quick JavaScript-only prototype                                                      |
| Architecture | Use `npm audit --json` as the scanner → reuse a standard, trusted source without building our own vuln database      | Requires Node/npm and a lockfile; output format can change between npm versions                               |
| AI Integration | Per-vulnerability, on-demand AI calls plus LRU cache → control cost and latency, avoid mass-calling the model       | First AI call per vulnerability can be slow; users might expect bulk analysis                                 |
| AI Integration | Goose via CLI recipes → on-machine agent with deterministic schema and reproducible prompts                         | Users must install and configure Goose and an LLM provider before AI works                                   |
| Security     | Strict JSON/schema validation and output sanitization → reduce risk of script or HTML injection in the webview       | May drop partially useful AI output and surface “AI unavailable” more often                                   |
| Privacy      | `dataMode = metadata` option (no snippets or file analysis) → let cautious users reduce what goes to the LLM         | With less context, AI explanations and fixes can be vaguer or less accurate                                   |
| Accessibility| Follow WCAG-friendly patterns in the webview (focus states, contrast, reduced motion) → keep the graph and AI panel usable for more developers | Requires extra UI work and testing; some “flashy” visual patterns are off-limits                              |
| Visualization| D3 for graph rendering → flexible, performant control over a custom vulnerability/dependency graph                   | More custom graph/layout code than using a prebuilt graph component                                           |

## 📝 Guidance for Success

### ✅ DO

- Be specific: use “VS Code extension” instead of “IDE plugin”.
- Quantify where possible: e.g., “per-vulnerability on-demand AI” instead of “fast AI”.
- Focus on engineering: constraints, tradeoffs, and reasoning.
- Acknowledge tradeoffs: every choice has a downside—be explicit about what you accepted.

### ❌ DON’T

- List every library: only include the “needle-movers”.
- Justify obvious choices: don’t explain why you used Git or a code editor.
- Write essays: keep entries short so judges can skim quickly.

## ✅ Submission Checklist

- [x] At least 5 decisions documented.  
- [x] Every decision has a clear, specific tradeoff.  
- [x] Decisions reflect choices made during the hackathon.  
- [x] Organized by category (Tech Stack, Architecture, etc.).  
- [x] File saved as `DECISION_LOG.md` in the `/docs/` folder.

_Part of the #75HER Challenge | CreateHER Fest 20_
