# User Setup (Goose)

**Reminder: the extension only sees env vars from the shell that launches VS Code.**

Goose is **not** bundled with Trident. Users must install the Goose CLI and configure their AI provider locally. The extension shells out to Goose on your `PATH` (for example, `goose run ...`), so the `goose` executable must be available.

**Prereqs**
- A working Goose CLI install on your machine.
- An AI provider configured for Goose (for OpenAI, `OPENAI_API_KEY`).
  - Note: the extension only sees env vars from the shell that launched VS Code.

**Setup Steps**
1. Install Goose CLI and confirm it works:
   - `goose --version`
2. Configure your provider locally:
   - For OpenAI: set `OPENAI_API_KEY` in your environment.
3. Set your Goose recipe path in VS Code settings:
   - `trident.goose.recipePath`
   - Default recipe included in this repo: `recipes/trident_vuln_explainer.yaml`
4. (Optional) Tune Goose runtime settings:
   - `trident.goose.enabled`
   - `trident.goose.maxRetries`
   - `trident.goose.timeoutMs`
   - `trident.goose.maxConcurrency`
   - `trident.goose.cacheMaxEntries`
   - `trident.goose.cacheMaxAgeMs`

**VS Code Settings Example**
```json
{
  "trident.goose.enabled": true,
  "trident.goose.recipePath": "./recipes/trident_vuln_explainer.yaml",
  "trident.goose.maxRetries": 1,
  "trident.goose.timeoutMs": 30000,
  "trident.goose.maxConcurrency": 2
}
```

**How It Connects**
- When you click a vulnerability card, the extension spawns Goose:
  - `goose run --recipe <recipePath> --params vuln_context=<json> --quiet --no-session`
- The recipe path comes from `trident.goose.recipePath` (workspace-relative paths are supported).

**Verify It Works**
- Ensure `goose --version` succeeds in the same terminal/ENV that launches VS Code.
- Open the Trident panel, click a vulnerability, and confirm an AI explanation appears.

**Troubleshooting**
- Goose not found: verify Goose CLI installation and that `goose` is on your `PATH`.
- Missing API key: set the provider environment variable (for OpenAI, `OPENAI_API_KEY`).
- Invalid recipe path: update `trident.goose.recipePath` to a valid file location.
- No AI output: ensure `trident.goose.enabled` is `true` and the recipe file exists.
