# User Setup (Goose)

**Reminder: the extension only sees env vars from the shell that launches VS Code.**

Goose is **not** bundled with Trident. Users must install the Goose CLI and configure their AI provider locally. The extension shells out to Goose on your `PATH` (for example, `goose run ...`), so the `goose` executable must be available.

## Requirements (all required for AI insights)

1. **Goose CLI** – Must be installed and on your `PATH`. Run `goose --version` in a terminal to verify.
2. **API key** – Stored via the "Trident API Key" command (Command Palette → "Trident API Key") or "API Key Settings" in the Vulnerable Packages view. Uses OpenRouter by default.
3. **Recipe file** – The YAML recipe at `trident.goose.recipePath` (default: `./recipes/trident_vuln_explainer.yaml`). The extension looks for it in the extension folder first, then the workspace root.

## Installing Goose CLI

```bash
# macOS/Linux
curl -fsSL https://github.com/block/goose/releases/download/stable/download_cli.sh | bash

# macOS (Homebrew)
brew install --cask block-goose
```

**Prereqs**
- A working Goose CLI install on your machine.
- An API key stored via Trident (OpenRouter) or an AI provider env var (e.g. `OPENAI_API_KEY` for OpenAI).
  - Note: the extension only sees env vars from the shell that launched VS Code.

**Setup Steps**
1. Install Goose CLI and confirm it works:
   - `goose --version`
2. Store your API key in Trident:
   - Command Palette → "Trident API Key" (for OpenRouter), or
   - Set `OPENAI_API_KEY` in your environment if using OpenAI.
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
- **AI insights stuck loading**: Open **View → Output**, select **"Trident Goose"** from the dropdown. This shows where the flow stops (Goose CLI check, context build, execution, or errors).
- **Goose not found**: verify Goose CLI installation and that `goose` is on your `PATH`. Launch VS Code from a terminal where `goose --version` works.
- **Missing API key**: use Command Palette → "Trident API Key" to store your OpenRouter key, or set the provider env var (e.g. `OPENAI_API_KEY`).
- **Invalid recipe path**: update `trident.goose.recipePath` to a valid file. The extension resolves `./recipes/...` relative to the extension folder or workspace root.
- **No AI output**: ensure `trident.goose.enabled` is `true` and the recipe file exists.
