import * as vscode from 'vscode';
import { exec } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';
import { promisify } from 'util';

const execAsync = promisify(exec);

export function activate(context: vscode.ExtensionContext) {
    // Register the command for scanning
    const scanCommand = vscode.commands.registerCommand('vulnerability-scanner.scan', async () => {
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        if (!workspaceFolder) {
            vscode.window.showWarningMessage(
                'In order to use scanning features, you can open a Node project folder.'
            );
            return;
        }

        const projectRoot = workspaceFolder.uri.fsPath;
        const packageJsonPath = path.join(projectRoot, 'package.json');
        if (!fs.existsSync(packageJsonPath)) {
            vscode.window.showWarningMessage('No package.json found in the opened folder.');
            return;
        }

        const panel = vscode.window.createWebviewPanel(
            'vulnerabilityScanner',
            'Vulnerability Scanner',
            vscode.ViewColumn.One,
            {
                enableScripts: true,
                retainContextWhenHidden: true
            }
        );
        await runNpmAudit(panel, projectRoot);
    });

    // Register the view
    const treeViewProvider = new VulnerabilityTreeViewProvider();
    (globalThis as { __vulnTreeProvider?: VulnerabilityTreeViewProvider }).__vulnTreeProvider = treeViewProvider;
    vscode.window.registerTreeDataProvider('vulnerabilityView', treeViewProvider);

    // Register a command to open the webview from the view's context
    const openWebviewCommand = vscode.commands.registerCommand('vulnerabilityView.openWebview', () => {
        vscode.commands.executeCommand('vulnerability-scanner.scan');
    });

    // Register command to show logs
    const showLogsCommand = vscode.commands.registerCommand('vulnerability-scanner.showLogs', () => {
        treeViewProvider.showLogs();
    });

    context.subscriptions.push(scanCommand, openWebviewCommand, showLogsCommand);
}

let lastAuditPayload: unknown = null;

class VulnerabilityTreeViewProvider implements vscode.TreeDataProvider<VulnerabilityItem> {

    private _onDidChangeTreeData: vscode.EventEmitter<VulnerabilityItem | undefined | null | void> = new vscode.EventEmitter<VulnerabilityItem | undefined | null | void>();
    readonly onDidChangeTreeData: vscode.Event<VulnerabilityItem | undefined | null | void> = this._onDidChangeTreeData.event;

    setAuditPayload(payload: unknown) {
        lastAuditPayload = payload;
        this._onDidChangeTreeData.fire();
    }

    showLogs() {
        const payload = lastAuditPayload;
        const jsonStr = payload !== null
            ? JSON.stringify(payload, null, 2)
            : 'No scan data yet. Run a vulnerability scan first.';
        const panel = vscode.window.createWebviewPanel(
            'vulnerabilityLogs',
            'Audit Logs',
            vscode.ViewColumn.One,
            { enableScripts: false }
        );
        panel.webview.html = `<!DOCTYPE html>
<html><head><meta charset="UTF-8"><title>Audit Logs</title>
<style>body{font-family:'IBM Plex Mono',monospace;background:#1e1e1e;color:#F7F7F7;padding:20px;white-space:pre-wrap;word-break:break-all;}</style>
</head><body><code>${escapeHtml(jsonStr)}</code></body></html>`;
    }

    getTreeItem(element: VulnerabilityItem): vscode.TreeItem {
        return element;
    }

    getChildren(element?: VulnerabilityItem): Thenable<VulnerabilityItem[]> {
        if (element) {
            if (element.id === 'run-scanner') {
                return Promise.resolve([
                    new VulnerabilityItem("Logs", "vulnerability-scanner.showLogs", "logs")
                ]);
            }
            return Promise.resolve([]);
        } else {
            const runScanner = new VulnerabilityItem("Run Scanner", "vulnerabilityView.openWebview", "run-scanner");
            runScanner.collapsibleState = vscode.TreeItemCollapsibleState.Expanded;
            return Promise.resolve([runScanner]);
        }
    }
}

function escapeHtml(str: string): string {
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

class VulnerabilityItem extends vscode.TreeItem {
    id?: string;
    constructor(label: string, commandId?: string, id?: string) {
        super(label);
        this.id = id;
        this.command = commandId ? {
            command: commandId,
            title: label
        } : undefined;
    }
}

async function runNpmAudit(panel: vscode.WebviewPanel, projectRoot: string): Promise<void> {
    panel.webview.html = getWebviewContent();

    try {
        const auditResults = await runAuditWithLockfileFallback(projectRoot);
        const provider = (globalThis as { __vulnTreeProvider?: { setAuditPayload: (p: unknown) => void } }).__vulnTreeProvider;
        if (provider) provider.setAuditPayload(auditResults);
        panel.webview.postMessage({ command: 'loadData', data: auditResults });
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        vscode.window.showErrorMessage(`npm audit failed: ${message}`);
        panel.webview.postMessage({ command: 'loadError', error: message });
    }
}

async function runAuditWithLockfileFallback(projectRoot: string): Promise<unknown> {
    try {
        return await runAudit(projectRoot);
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        const lockfileMissing = /ENOLOCK|requires an existing lockfile|loadVirtual requires existing shrinkwrap file/i.test(
            message
        );

        if (!lockfileMissing) {
            throw error;
        }

        // If the project has no lockfile, create one and retry
        vscode.window.showInformationMessage(
            'No lockfile found. Creating package-lock.json...'
        );
        await execAsync('npm i --package-lock-only --ignore-scripts', { cwd: projectRoot });
        return await runAudit(projectRoot);
    }
}

async function runAudit(projectRoot: string): Promise<unknown> {
    try {
        const { stdout } = await execAsync('npm audit --json', { cwd: projectRoot });
        return JSON.parse(stdout);
    } catch (error: unknown) {
        const execError = error as { stdout?: string; stderr?: string; message?: string };
        if (execError.stdout) {
            return JSON.parse(execError.stdout);
        }
        const stderr = execError.stderr?.trim();
        throw new Error(stderr || execError.message);
    }
}

function getWebviewContent(): string {
    return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Vulnerability Visualizer</title>
      <link href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.1/font/bootstrap-icons.css" rel="stylesheet">
      <link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;700&display=swap" rel="stylesheet">
      <link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;700&display=swap" rel="stylesheet">
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: 'IBM Plex Mono', monospace; background: #1e1e1e; color: #F7F7F7; overflow: hidden; }
        #app { width: 100vw; height: 100vh; position: relative; }
        #graph-container { width: 100%; height: 100%; transition: width 0.2s; position: absolute; top: 0; left: 0; z-index: 0; }
        #app.inspector-open #graph-container { width: 50%; }
        #metadata-panel {
          position: absolute; top: 0; left: 0; z-index: 1;
          background: rgba(30,30,30,0.4); backdrop-filter: blur(10px);
          padding: 25px; border-radius: 0; font-size: 14px;
          line-height: 1.6; min-width: 180px;
        }
        #metadata-panel .section { margin-bottom: 12px; }
        #metadata-panel .section-title { font-size: 14px; margin-bottom: 6px; }
        #metadata-panel .item {
          font-size: 12px; color: #BBBBBB;
          cursor: pointer; padding: 2px 6px; margin: 0 -6px; border-radius: 4px;
          transition: background 0.2s, color 0.2s; display: block;
        }
        #metadata-panel .item[data-severity] { cursor: pointer; }
        #metadata-panel .item[data-severity]:hover { background: rgba(255,255,255,0.08); color: #F7F7F7; border-radius: 0; }
        #metadata-panel .item:not([data-severity]) { cursor: default; }
        #metadata-panel .item.severity-selected { color: #F7F7F7; }
        #metadata-panel .item.severity-selected.severity-high,
        #metadata-panel .item.severity-selected.severity-moderate { color: #000000; }
        #metadata-panel .item.severity-selected.severity-critical { background: #B40E0E !important; border-radius: 0; }
        #metadata-panel .item.severity-selected.severity-high { background: #F16621 !important; border-radius: 0; }
        #metadata-panel .item.severity-selected.severity-moderate { background: #F19E21 !important; border-radius: 0; }
        #metadata-panel .item.severity-selected.severity-low { background: #285AFF !important; border-radius: 0; }
        #metadata-panel .item.severity-selected.severity-info { background: #555555 !important; border-radius: 0; }
        #inspector-panel {
          position: absolute; top: 0; right: 0; width: 50%; height: 100%;
          background: #252526; display: none; overflow-y: auto;
          border-left: 5px solid #F19E21; font-size: 14px;
          font-family: 'IBM Plex Sans', sans-serif;
        }
        #inspector-panel.visible { display: block; }
        #inspector-panel .inspector-header {
          position: absolute; top: 0; left: 0; right: 0; height: 44px;
          display: flex; align-items: center; justify-content: space-between;
          padding: 0 12px; z-index: 5;
        }
        #inspector-panel .back-btn {
          display: none; align-items: center; gap: 6px; cursor: pointer;
          font-size: 15px; font-weight: 400; color: #FFFFFE; background: none; border: none;
          font-family: 'IBM Plex Sans', sans-serif;
        }
        #inspector-panel .back-btn.visible { display: flex; }
        #inspector-panel .back-btn:hover { text-decoration: underline; }
        #inspector-panel .close-btn {
          position: absolute; top: 12px; right: 12px; cursor: pointer;
          color: #F7F7F7; font-size: 20px; padding: 4px; z-index: 10;
        }
        #inspector-panel .package-name.severity-pkg-name {
          font-family: 'IBM Plex Sans', sans-serif; font-weight: bold; font-size: 20px;
        }
        #inspector-panel .content { padding: 20px; padding-top: 50px; }
        #inspector-panel .dep-type { color: #BBBBBB; font-size: 14px; margin-bottom: 8px; }
        #inspector-panel .package-name { font-family: 'IBM Plex Sans', sans-serif; font-size: 32px; font-weight: 400; margin-bottom: 16px; }
        #inspector-panel .vul-section { margin: 16px 0; padding-top: 12px; border-top: 1px solid rgba(247,247,247,0.5); }
        #inspector-panel .vul-title { font-weight: bold; font-size: 20px; margin-bottom: 8px; }
        #inspector-panel .vul-summary { font-size: 15px; color: #BBBBBB; margin: 8px 0; max-height: 4.5em; overflow: hidden; }
        #inspector-panel .severity-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin: 12px 0; }
        #inspector-panel .severity-item .label { font-size: 14px; color: #BBBBBB; }
        #inspector-panel .severity-item .value { font-size: 15px; color: #F7F7F7; }
        #inspector-panel .remediation { background: #1A1A1A; border: 1px solid rgba(247,247,247,0.2); padding: 12px; margin: 12px 0; border-radius: 4px; display: grid; grid-template-columns: 1fr 1fr auto; gap: 12px; align-items: start; }
        #inspector-panel .remediation-col { display: flex; flex-direction: column; gap: 4px; }
        #inspector-panel .remediation-line { font-size: 15px; color: #F7F7F7; }
        #inspector-panel .copy-cmd { font-family: 'IBM Plex Mono', monospace; background: #21252E; padding: 8px 12px; font-size: 12px; border-radius: 4px; display: flex; align-items: center; gap: 8px; cursor: pointer; }
        #inspector-panel .copy-cmd.view-details-cmd { font-family: 'IBM Plex Sans', sans-serif; }
        #inspector-panel .copy-cmd a { color: #0678CF; text-decoration: none; }
        #inspector-panel .copy-cmd a:hover { text-decoration: underline; }
        #inspector-panel .copy-cmd .copy-success-icon { color: #22c55e; }
        .view-details-link { font-size: 15px; color: #BBBBBB; cursor: pointer; text-decoration: none; }
        .severity-info-row { display: flex; align-items: flex-start; gap: 8px; margin: 12px 0; font-size: 15px; color: #BBBBBB; }
        .severity-info-row i { margin-top: 2px; flex-shrink: 0; }
        .severity-info-row a { color: #0678CF; text-decoration: none; }
        .severity-info-row a:hover { text-decoration: underline; }
        .severity-info-row .severity-info-link { color: inherit; text-decoration: underline; }
        .severity-info-row .severity-info-link:hover { color: inherit; }
        .zoom-controls {
          position: absolute; bottom: 20px; left: 20px;
          display: flex; flex-direction: column; gap: 4px;
          z-index: 10;
        }
        .zoom-btn { width: 36px; height: 36px; border: 1px solid #555; background: #252526; color: #F7F7F7; cursor: pointer; border-radius: 4px; font-size: 18px; display: flex; align-items: center; justify-content: center; }
        .zoom-btn:hover { background: #333; }
        .node { cursor: pointer; }
        .node circle { }
        .node .node-label { font-family: 'IBM Plex Mono', monospace; font-size: 14px; fill: #F7F7F7; text-anchor: middle; }
        .link { stroke: #555; stroke-opacity: 0.6; fill: none; }
        .link.selected { stroke: #0678CF; stroke-width: 2; }
        .link.blast-radius { stroke: #F16621; stroke-width: 2; stroke-opacity: 0.8; stroke-dasharray: 6,4; }
        .blast-zone { fill: rgba(241,102,33,0.08); stroke: rgba(241,102,33,0.35); stroke-width: 1; }
        .accordion-header { display: flex; align-items: center; justify-content: space-between; cursor: pointer; padding: 8px 0; user-select: none; }
        .accordion-header:hover { color: #0678CF; }
        .accordion-chevron { transition: transform 0.2s ease; font-size: 14px; color: #BBBBBB; }
        .accordion-chevron.open { transform: rotate(180deg); }
        .accordion-body { max-height: 0; overflow: hidden; transition: max-height 0.3s ease; }
        .accordion-body.open { max-height: 2000px; }
        .via-package-link { color: #0678CF; cursor: pointer; text-decoration: underline; }
      </style>
    </head>
    <body>
      <div id="app">
        <div id="graph-container"></div>
        <div id="metadata-panel"></div>
        <div id="inspector-panel">
          <div class="inspector-header">
            <button class="back-btn" id="back-to-severity" type="button"><i class="bi bi-arrow-left"></i><span id="back-btn-label"></span></button>
            <span class="close-btn" id="close-inspector">&times;</span>
          </div>
          <div class="content" id="inspector-content"></div>
        </div>
        <div class="zoom-controls">
          <button class="zoom-btn" id="zoom-in">+</button>
          <button class="zoom-btn" id="zoom-out">−</button>
        </div>
      </div>
      <script src="https://d3js.org/d3.v7.min.js"></script>
      <script>
        const SEVERITY_STYLES = {
          critical: { bg: '#B40E0E', text: '#FFFFFF', icon: 'bi-exclamation-octagon-fill' },
          high: { bg: '#F16621', text: '#000000', icon: 'bi-exclamation-triangle' },
          moderate: { bg: '#F19E21', text: '#000000', icon: 'bi-triangle-fill' },
          low: { bg: '#285AFF', text: '#FFFFFF', icon: 'bi-circle-fill' },
          info: { bg: '#555555', text: '#FFFFFF', icon: 'bi-info-circle' }
        };
        const CVSS_AV = { N: 'Network', A: 'Adjacent', L: 'Local', P: 'Physical' };
        const CVSS_AC = { L: 'Low', H: 'High' };
        const CVSS_PR = { N: 'None', L: 'Low', H: 'High' };
        const CVSS_UI = { N: 'None', R: 'Required' };
        const CVSS_AV_PHRASE = { N: 'exploitable over the network', A: 'exploitable by systems on the same network', L: 'exploitable by a local system user', P: 'exploitable with physical device access' };
        const CVSS_AC_PHRASE = { L: 'relatively easy to exploit', H: 'requiring specific conditions to exploit' };
        const CVSS_PR_PHRASE = { N: 'requiring no privileges', L: 'requiring a low-privilege account', H: 'requiring high privileges' };
        const CVSS_UI_PHRASE = { N: 'without user interaction', R: 'requiring user interaction' };

        let allNodes = [];
        let allNodeMap = {};
        let allFlatNodes = [];
        let zoomRef = null;
        let svgRef = null;
        let selectAndShowNodeFn = null;
        let blastZoneGrpRef = null;
        let nodeGrpRef = null;
        let lastSeverityInspector = null;

        window.addEventListener('message', event => {
          const msg = event.data;
          if (msg.command === 'loadData') renderVisualization(msg.data);
          else if (msg.command === 'loadError') {
            document.getElementById('app').innerHTML = '<p style="color:#F16621;padding:20px;">Scan failed: ' + (msg.error || 'Unknown') + '</p>';
          }
        });

        function copyWithFeedback(el) {
          const cmd = el.dataset.cmd;
          if (!cmd) return;
          navigator.clipboard.writeText(cmd);
          const icon = el.querySelector('i');
          if (icon) {
            const origClass = icon.className;
            icon.className = 'bi bi-check copy-success-icon';
            setTimeout(() => { icon.className = origClass; }, 1500);
          }
        }

        function renderVisualization(data) {
          const vulns = data.vulnerabilities || {};
          const meta = data.metadata || {};
          const vulCounts = meta.vulnerabilities || {};
          const depCounts = meta.dependencies || {};

          if (Object.keys(vulns).length === 0) {
            document.getElementById('app').innerHTML =
              '<div style="display:flex;align-items:center;justify-content:center;height:100%;font-size:18px;">No vulnerable packages detected</div>';
            return;
          }

          const nodes = [];
          const nodeMap = {};
          const links = [];

          function getAdvisories(via) {
            if (!Array.isArray(via)) return [];
            return via.filter(x => x && typeof x === 'object' && (x.severity || x.url || x.title));
          }

          for (const [name, v] of Object.entries(vulns)) {
            const vv = v;
            const advisories = getAdvisories(vv.via);
            const firstAdv = advisories[0];
            const severity = (firstAdv && firstAdv.severity) ? firstAdv.severity.toLowerCase() : (vv.severity || 'moderate').toLowerCase();
            const effects = vv.effects || [];
            const depCount = effects.length;
            const vulCount = advisories.length || 1;
            nodes.push({ id: name, name, severity, depCount, vulCount, isDirect: vv.isDirect, data: vv });
            nodeMap[name] = nodes[nodes.length - 1];
            effects.forEach(e => {
              const targetName = typeof e === 'string' ? e : (e && e.name) || e;
              if (!targetName) return;
              if (!nodeMap[targetName]) {
                nodes.push({ id: targetName, name: targetName, severity: 'moderate', depCount: 0, vulCount: 0, isDirect: false, data: {} });
                nodeMap[targetName] = nodes[nodes.length - 1];
              }
              links.push({ source: name, target: targetName });
            });
          }

          for (const l of links) {
            if (typeof l.source === 'string') l.source = nodeMap[l.source];
            if (typeof l.target === 'string') l.target = nodeMap[l.target];
          }

          allNodes = nodes;
          allNodeMap = nodeMap;
          renderMetadata(vulCounts, depCounts);
          renderGraph(nodes, links);
          setupZoom();
          document.getElementById('close-inspector').onclick = () => {
            document.getElementById('inspector-panel').classList.remove('visible');
            document.getElementById('app').classList.remove('inspector-open');
            lastSeverityInspector = null;
            document.getElementById('back-to-severity').classList.remove('visible');
            document.querySelectorAll('#metadata-panel .item.severity-selected').forEach(el => el.classList.remove('severity-selected'));
            d3.selectAll('.link').classed('selected', false).classed('blast-radius', false);
            if (nodeGrpRef) nodeGrpRef.selectAll('g').select('circle').attr('stroke', 'none').attr('stroke-width', 0);
            if (blastZoneGrpRef) blastZoneGrpRef.selectAll('path').remove();
          };
          document.getElementById('back-to-severity').onclick = () => {
            if (lastSeverityInspector) showSeverityInspector(lastSeverityInspector);
          };
        }

        function showSeverityInspector(severity) {
          const packages = allNodes.filter(n => n.severity === severity);
          if (packages.length === 0) return;
          const totalVuln = packages.reduce((s, p) => s + p.vulCount, 0);
          const totalDep = packages.reduce((s, p) => s + p.depCount, 0);
          let bestVector = null;
          let bestScore = -1;
          packages.forEach(p => {
            const viaItems = Array.isArray(p.data.via) ? p.data.via : [];
            viaItems.forEach(v => {
              if (v && typeof v === 'object' && v.cvss && v.cvss.vectorString) {
                const sc = (v.cvss.score || 0);
                if (sc > bestScore) { bestScore = sc; bestVector = v.cvss.vectorString; }
              }
            });
          });
          const cvssCopy = generateCVSSCopy(totalVuln, totalDep, bestVector);
          const sevCap = severity.charAt(0).toUpperCase() + severity.slice(1);
          const pkgWord = packages.length === 1 ? 'Package' : 'Packages';
          let html = '<div class="dep-type">Vulnerabilities</div>';
          html += '<div class="package-name">' + packages.length + ' ' + sevCap + ' Severity ' + pkgWord + '</div>';
          html += '<div style="font-size:15px;color:#F7F7F7;margin-bottom:12px;line-height:1.5;">' + escapeHtml(cvssCopy) + '</div>';
          html += '<hr style="border:none;border-top:1px solid #555;margin:12px 0;" />';
          html += '<div class="severity-info-row"><i class="bi bi-info-circle"></i><span>Order is based on highest <a href="https://www.first.org/cvss/" target="_blank" class="severity-info-link">CVSS score</a> and total number of vulnerabilities.</span></div>';
          html += '<div class="vul-section">';
          packages.sort((a, b) => {
            let scoreA = 0, scoreB = 0;
            (a.data.via || []).forEach(v => { if (v && v.cvss && v.cvss.score) scoreA = Math.max(scoreA, v.cvss.score); });
            (b.data.via || []).forEach(v => { if (v && v.cvss && v.cvss.score) scoreB = Math.max(scoreB, v.cvss.score); });
            if (scoreB !== scoreA) return scoreB - scoreA;
            return (b.vulCount || 0) - (a.vulCount || 0);
          });
          packages.forEach(p => {
            const v = p.data;
            const fix = v.fixAvailable;
            const upgradeTo = fix && typeof fix === 'object' && fix.version ? fix.version : (typeof fix === 'string' ? fix : fix === true ? 'latest' : null);
            const fixCmd = upgradeTo ? 'npm install ' + p.name + '@' + upgradeTo : '';
            const depCount = p.depCount || 0;
            html += '<div style="border:1px solid rgba(247,247,247,0.35);padding:12px;margin:8px 0;border-radius:4px;">';
            html += '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;">';
            html += '<span class="package-name severity-pkg-name" style="margin-bottom:0;">' + escapeHtml(p.name) + '</span>';
            html += '<span class="view-details-link" data-pkg="' + escapeHtml(p.name) + '" data-severity="' + severity + '" onclick="selectNodeFromSeverity(this.getAttribute(\\'data-pkg\\'), this.getAttribute(\\'data-severity\\'))">View details</span>';
            html += '</div>';
            html += '<div class="remediation"><div class="remediation-col"><div class="remediation-line">Dependencies: ' + depCount + '</div><div class="remediation-line">Upgrade To: ' + (upgradeTo || '-') + '</div></div>';
            html += '<div class="remediation-col"><div class="remediation-line">Type: ' + (fix && fix.isSemVerMajor ? 'SemVer Major' : 'SemVer') + '</div><div class="remediation-line">Resolves: ' + (fix && fix.resolves ? fix.resolves.length + ' vulnerabilities' : '-') + '</div></div>';
            if (fixCmd) {
              html += '<div class="copy-cmd" data-cmd="' + fixCmd.replace(/"/g, '&quot;') + '" onclick="copyWithFeedback(this)"><span>' + escapeHtml(fixCmd) + '</span><i class="bi bi-clipboard"></i></div>';
            } else {
              html += '<div class="copy-cmd view-details-cmd" data-pkg="' + escapeHtml(p.name) + '" data-severity="' + severity + '" onclick="selectNodeFromSeverity(this.getAttribute(\\'data-pkg\\'), this.getAttribute(\\'data-severity\\'))"><span>See advisory</span><i class="bi bi-box-arrow-up-right"></i></div>';
            }
            html += '</div></div>';
          });
          html += '</div>';
          document.getElementById('inspector-content').innerHTML = html;
          document.getElementById('inspector-panel').classList.add('visible');
          document.getElementById('app').classList.add('inspector-open');
          document.getElementById('back-to-severity').classList.remove('visible');
          const s = SEVERITY_STYLES[severity] || SEVERITY_STYLES.moderate;
          document.getElementById('inspector-panel').style.borderLeftColor = s.bg;
          document.querySelectorAll('#metadata-panel .item.severity-selected').forEach(el => el.classList.remove('severity-selected'));
          const selItem = document.querySelector('#metadata-panel .item[data-severity="' + severity + '"]');
          if (selItem) selItem.classList.add('severity-selected');
          d3.selectAll('.link').classed('selected', false).classed('blast-radius', false);
          if (nodeGrpRef) nodeGrpRef.selectAll('g').select('circle').attr('stroke', 'none').attr('stroke-width', 0);
          if (blastZoneGrpRef) blastZoneGrpRef.selectAll('path').remove();
          if (zoomRef && svgRef && packages.length > 0) {
            const topPkg = packages[0];
            const flat = allFlatNodes.find(n => n.id === topPkg.id);
            if (flat) {
              const container = document.getElementById('graph-container');
              const cw = container.clientWidth;
              const ch = container.clientHeight;
              const centerX = cw / 2;
              const centerY = ch / 2;
              const k = 1;
              const tx = centerX - flat.x * k;
              const ty = centerY - flat.y * k;
              d3.select(svgRef).call(zoomRef.transform, d3.zoomIdentity.translate(tx, ty).scale(k));
            }
          }
        }

        function renderMetadata(vulCounts, depCounts) {
          const totalVul = vulCounts.total || 0;
          const severities = ['info', 'low', 'moderate', 'high', 'critical'];
          let html = '<div class="section"><div class="section-title">' + totalVul + ' Vulnerabilities</div>';
          severities.forEach(sev => {
            const count = vulCounts[sev] || 0;
            const cls = 'item' + (count > 0 ? ' severity-' + sev : '');
            const attrs = count > 0 ? ' data-severity="' + sev + '" data-count="' + count + '"' : '';
            html += '<div class="' + cls + '"' + attrs + '>' + count + ' ' + (sev.charAt(0).toUpperCase() + sev.slice(1)) + '</div>';
          });
          html += '</div><div class="section"><div class="section-title">' + (depCounts.total||0) + ' Dependencies</div>' +
            '<div class="item">' + (depCounts.prod||0) + ' prod</div>' +
            '<div class="item">' + (depCounts.dev||0) + ' dev</div>' +
            '<div class="item">' + (depCounts.optional||0) + ' optional</div>' +
            '<div class="item">' + (depCounts.peer||0) + ' peer</div>' +
            '<div class="item">' + (depCounts.peerOptional||0) + ' peer optional</div></div>';
          document.getElementById('metadata-panel').innerHTML = html;
          document.getElementById('metadata-panel').style.pointerEvents = 'auto';
          document.querySelectorAll('#metadata-panel .item[data-severity]').forEach(el => {
            el.onclick = () => {
              const sev = el.getAttribute('data-severity');
              const count = parseInt(el.getAttribute('data-count') || '0', 10);
              if (count > 0) showSeverityInspector(sev);
            };
          });
        }

        function renderGraph(nodes, links) {
          const container = document.getElementById('graph-container');
          container.innerHTML = '';
          const width = container.clientWidth;
          const height = container.clientHeight;

          const svg = d3.select(container).append('svg').attr('width', width).attr('height', height);
          const zoomG = svg.append('g');
          const g = zoomG.append('g');

          const nodeIds = new Set(nodes.map(n => n.id));
          const hasIncoming = new Set(links.map(l => l.target.id));
          const roots = nodes.filter(n => !hasIncoming.has(n.id));
          const childMap = {};
          links.forEach(l => {
            const pid = l.source.id;
            if (!childMap[pid]) childMap[pid] = [];
            childMap[pid].push(l.target);
          });
          function buildHierarchy(n, depth) {
            const children = (childMap[n.id] || []).map(c => buildHierarchy(c, depth + 1));
            return { data: n, children: children.length ? children : null, depth };
          }
          const rootNodes = roots.map(r => buildHierarchy(r, 0));
          const virtualRoot = { data: { id: '__root__', x: 0, y: 0 }, children: rootNodes };
          const margin = 80;
          const nodeSizeX = 180;
          const nodeSizeY = 80;

          const treeLayout = d3.tree()
            .nodeSize([nodeSizeX, nodeSizeY])
            .separation((a, b) => (a.parent === b.parent ? 1.2 : 1.5));
          const treeData = d3.hierarchy(virtualRoot, d => d.children);
          treeLayout(treeData);

          const flatNodes = [];
          treeData.each(d => { if (d.data.data && d.data.data.id !== '__root__') flatNodes.push({ ...d.data.data, x: d.x + margin, y: d.y + margin }); });
          allFlatNodes = flatNodes;

          const treeLinks = [];
          treeData.links().forEach(l => {
            if (l.source.data.data && l.source.data.data.id !== '__root__' && l.target.data.data && l.target.data.data.id !== '__root__') {
              treeLinks.push({ source: l.source.data.data, target: l.target.data.data, x1: l.source.x + margin, y1: l.source.y + margin, x2: l.target.x + margin, y2: l.target.y + margin });
            }
          });

          const blastZoneGrp = g.append('g').attr('class', 'blast-zone-group');
          blastZoneGrpRef = blastZoneGrp;
          const linkGrp = g.append('g');
          const link = linkGrp.selectAll('line').data(treeLinks).join('line').attr('class', 'link')
            .attr('x1', d => d.x1).attr('y1', d => d.y1).attr('x2', d => d.x2).attr('y2', d => d.y2);

          const nodeGrp = g.append('g');

          const node = nodeGrp.selectAll('g').data(flatNodes).join('g')
            .attr('class', 'node')
            .attr('data-node-id', d => d.id)
            .attr('transform', d => 'translate(' + d.x + ',' + d.y + ')');

          const nodeRadius = 18;
          node.each(function(d) {
            const gEl = d3.select(this);
            const s = SEVERITY_STYLES[d.severity] || SEVERITY_STYLES.moderate;
            gEl.append('circle').attr('r', nodeRadius)
              .attr('fill', s.bg)
              .attr('stroke', 'none')
              .attr('stroke-width', 5);
            gEl.append('text').attr('class', 'node-label')
              .attr('y', -nodeRadius - 6)
              .attr('dy', '0.35em')
              .text(d.name)
              .style('font-size', '14px')
              .style('fill', '#F7F7F7')
              .style('paint-order', 'stroke fill')
              .style('stroke', '#1e1e1e')
              .style('stroke-width', '2px');
          });

          function getBlastRadiusNodes(nodeId) {
            const result = [nodeId];
            const queue = [nodeId];
            while (queue.length) {
              const id = queue.shift();
              (childMap[id] || []).forEach(c => { result.push(c.id); queue.push(c.id); });
            }
            return result;
          }

          nodeGrpRef = nodeGrp;
          selectAndShowNodeFn = function(d) {
            document.querySelectorAll('#metadata-panel .item.severity-selected').forEach(el => el.classList.remove('severity-selected'));
            const blastIds = new Set(getBlastRadiusNodes(d.id));
            d3.selectAll('.link').classed('selected', l => (l.source && l.source.id === d.id) || (l.target && l.target.id === d.id))
              .classed('blast-radius', l => l.source && l.source.id === d.id && blastIds.has(l.target.id));
            nodeGrpRef.selectAll('g').each(function(n) {
              const circle = d3.select(this).select('circle');
              const sel = n.id === d.id && n.isDirect;
              circle.attr('stroke', sel ? '#0678CF' : 'none').attr('stroke-width', sel ? 5 : 0);
            });
            blastZoneGrp.selectAll('path').remove();
            if (blastIds.size > 1) {
              const points = allFlatNodes.filter(n => blastIds.has(n.id)).map(n => [n.x, n.y]);
              const hull = d3.polygonHull(points);
              if (hull && hull.length >= 3) {
                const pathStr = 'M' + hull.map(p => p[0] + ',' + p[1]).join(' L') + ' Z';
                blastZoneGrp.append('path').attr('d', pathStr).attr('class', 'blast-zone');
              }
            }
            document.getElementById('inspector-panel').classList.add('visible');
            document.getElementById('app').classList.add('inspector-open');
            document.getElementById('inspector-panel').style.borderLeftColor = (SEVERITY_STYLES[d.severity] || SEVERITY_STYLES.moderate).bg;
            renderInspector(d);
            if (zoomRef && svgRef) {
              const flat = allFlatNodes.find(n => n.id === d.id);
              if (flat) {
                const container = document.getElementById('graph-container');
                const cw = container.clientWidth;
                const ch = container.clientHeight;
                const centerX = cw / 2;
                const centerY = ch / 2;
                const k = 1;
                const tx = centerX - flat.x * k;
                const ty = centerY - flat.y * k;
                d3.select(svgRef).call(zoomRef.transform, d3.zoomIdentity.translate(tx, ty).scale(k));
              }
            }
          };

          node.on('click', (ev, d) => {
            lastSeverityInspector = null;
            document.getElementById('back-to-severity').classList.remove('visible');
            selectAndShowNodeFn(d);
          });

          window.selectNodeByName = function(name) {
            const nd = allNodeMap[name] || allFlatNodes.find(n => n.id === name);
            if (nd && selectAndShowNodeFn) selectAndShowNodeFn(nd);
          };

          window.selectNodeFromSeverity = function(name, severity) {
            lastSeverityInspector = severity;
            const nd = allNodeMap[name] || allFlatNodes.find(n => n.id === name);
            if (nd && selectAndShowNodeFn) selectAndShowNodeFn(nd);
          };
        }

        function parseCVSS(vectorStr) {
          if (!vectorStr || typeof vectorStr !== 'string') return null;
          const m = vectorStr.match(/CVSS:3\\.1\\/([^\\s]+)/);
          if (!m) return null;
          const parts = {};
          m[1].split('/').forEach(p => { const [k,v] = p.split(':'); if (k && v) parts[k] = v; });
          return {
            av: CVSS_AV[parts.AV] || parts.AV,
            ac: CVSS_AC[parts.AC] || parts.AC,
            pr: CVSS_PR[parts.PR] || parts.PR,
            ui: CVSS_UI[parts.UI] || parts.UI,
            parts
          };
        }

        function generateCVSSCopy(vulnCount, depCount, vectorStr) {
          const parsed = vectorStr ? parseCVSS(vectorStr) : null;
          if (!parsed || !parsed.parts) {
            return 'Resolving ' + vulnCount + ' vulnerable package' + (vulnCount === 1 ? '' : 's') + ' protects ' + depCount + ' dependent package' + (depCount === 1 ? '' : 's') + '.';
          }
          const p = parsed.parts;
          const avPhrase = CVSS_AV_PHRASE[p.AV] || 'exploitable';
          const prPhrase = CVSS_PR_PHRASE[p.PR] || 'requiring privileges';
          const uiPhrase = CVSS_UI_PHRASE[p.UI] || 'with user interaction';
          const acPhrase = CVSS_AC_PHRASE[p.AC] || 'with varying complexity';
          return 'Resolving ' + vulnCount + ' vulnerable package' + (vulnCount === 1 ? '' : 's') + ' protects ' + depCount + ' dependent package' + (depCount === 1 ? '' : 's') + ' from attacks that are ' + avPhrase + ', ' + prPhrase + ', ' + uiPhrase + ', and ' + acPhrase + '.';
        }

        function renderInspector(d) {
          const v = d.data;
          const viaItems = Array.isArray(v.via) ? v.via : [];
          const viaPackageNames = viaItems.filter(x => typeof x === 'string');
          let advisories = viaItems.filter(x => x && typeof x === 'object' && (x.url || x.title || x.severity));
          if (advisories.length === 0 && viaPackageNames.length === 0) {
            advisories = [{ title: 'Vulnerability', severity: d.severity, url: '#', source: '-', overview: 'See npm audit for details.', range: v.range }];
          }
          const depType = d.isDirect ? 'Direct dependency' : 'Transitive dependency';
          let html = '<div class="dep-type">' + depType + '</div><div class="package-name">' + d.name + '</div>';
          if (viaPackageNames.length > 0) {
            html += '<div style="margin-bottom:12px;font-size:14px;color:#BBBBBB;">Vulnerability from: ';
            html += viaPackageNames.map(pkg => '<span class="via-package-link" data-pkg="' + escapeHtml(pkg) + '" onclick="event.preventDefault(); selectNodeByName(this.getAttribute(\\'data-pkg\\')); return false;">' + escapeHtml(pkg) + '</span>').join(', ');
            html += '</div>';
          }
          const totalAdv = advisories.length;
          const vulWord = totalAdv === 1 ? 'Vulnerability' : 'Vulnerabilities';
          html += '<div class="vul-section"><div class="vul-title">' + totalAdv + ' ' + vulWord + '</div>';

          const byTitle = {};
          advisories.forEach(adv => {
            const t = (adv.title || 'Unknown').trim();
            if (!byTitle[t]) byTitle[t] = [];
            byTitle[t].push(adv);
          });

          Object.keys(byTitle).forEach(title => {
            const group = byTitle[title];
            const count = group.length;
            const versions = group.map(a => a.range || v.range || '-').filter(Boolean);
            if (count > 1) {
              const accordionId = 'acc-' + Math.random().toString(36).slice(2);
              html += '<div class="accordion-item" style="margin:12px 0;">';
              html += '<div class="accordion-header" onclick="var b=document.getElementById(\\'' + accordionId + '\\');var c=this.querySelector(\\'.accordion-chevron\\');b.classList.toggle(\\'open\\');c.classList.toggle(\\'open\\');">';
              html += '<span>' + count + '-' + title + '</span>';
              html += '<span class="accordion-chevron"><i class="bi bi-chevron-down"></i></span></div>';
              html += '<div id="' + accordionId + '" class="accordion-body">';
              html += '<div style="font-size:14px;color:#BBBBBB;margin-bottom:12px;">Impact across ' + count + ' installed package versions: ' + versions.join(', ') + '</div>';
            }
            group.forEach(adv => {
              const cvss = adv.cvss ? parseCVSS(adv.cvss.vectorString) : null;
              const versionInfo = adv.range || v.range || '-';
              const scoreDisplay = adv.cvss && adv.cvss.score ? adv.cvss.score + ' (' + adv.severity + ')' : adv.severity;
              html += '<div style="border:1px solid rgba(247,247,247,0.35);padding:12px;margin:8px 0;border-radius:4px;">';
              html += '<div style="font-size:15px;color:#BBBBBB;">REFERENCE: <a href="' + (adv.url||'#') + '" style="color:#0678CF;">' + (adv.source||'') + '</a></div>';
              html += '<div style="font-size:15px;color:#BBBBBB;">Vulnerability reported for package version: ' + escapeHtml(versionInfo) + '</div>';
              if (count === 1) html += '<div class="vul-title">' + escapeHtml(adv.title||'') + '</div>';
              html += '<div class="vul-summary">' + escapeHtml((adv.overview||adv.summary||'').substring(0, 200)) + '</div>';
              html += '<div class="severity-grid">';
              html += '<div class="severity-item"><div class="label">Severity</div><div class="value">' + scoreDisplay + '</div></div>';
              html += '<div class="severity-item"><div class="label">Attack Vector</div><div class="value">' + (cvss ? cvss.av : '-') + '</div></div>';
              html += '<div class="severity-item"><div class="label">Privileges Required</div><div class="value">' + (cvss ? cvss.pr : '-') + '</div></div>';
              html += '<div class="severity-item"><div class="label">User Interaction</div><div class="value">' + (cvss ? cvss.ui : '-') + '</div></div></div>';
              const fix = v.fixAvailable;
              const upgradeTo = fix && typeof fix === 'object' && fix.version ? fix.version : (typeof fix === 'string' ? fix : fix === true ? 'latest' : null);
              const fixCmd = upgradeTo ? 'npm install ' + d.name + '@' + upgradeTo : '';
              const advUrl = adv.url || '#';
              html += '<div class="remediation"><div class="remediation-col"><div class="remediation-line">Fix Available: ' + (fix ? 'Yes' : 'No') + '</div><div class="remediation-line">Upgrade To: ' + (upgradeTo || '-') + '</div></div>';
              html += '<div class="remediation-col"><div class="remediation-line">Type: ' + (fix && fix.isSemVerMajor ? 'SemVer Major' : 'SemVer') + '</div><div class="remediation-line">Resolves: ' + (fix && fix.resolves ? fix.resolves.length + ' vulnerabilities' : '-') + '</div></div>';
              if (fixCmd) {
                html += '<div class="copy-cmd" data-cmd="' + fixCmd.replace(/"/g, '&quot;') + '" onclick="copyWithFeedback(this)"><span>' + escapeHtml(fixCmd) + '</span><i class="bi bi-clipboard"></i></div>';
              } else {
                html += '<div class="copy-cmd"><a href="' + escapeHtml(advUrl) + '" target="_blank" rel="noopener" style="color:#0678CF;text-decoration:none;">See advisory</a><i class="bi bi-box-arrow-up-right"></i></div>';
              }
              html += '</div>';
              if (adv.cwe && adv.cwe.length) {
                html += '<div style="margin-top:12px;"><div style="font-size:18px;">Weakness Classification (CWE)</div>';
                adv.cwe.forEach(cwe => {
                  const num = (cwe + '').replace(/^CWE-?/i, '');
                  const url = 'https://cwe.mitre.org/data/definitions/' + num + '.html';
                  html += '<div style="font-size:15px;color:#BBBBBB;margin:4px 0;"><a href="' + url + '" target="_blank" style="color:#0678CF;">' + cwe + '</a></div>';
                });
                html += '</div>';
              }
              html += '</div>';
            });
            if (count > 1) html += '</div></div>';
          });
          html += '</div>';
          document.getElementById('inspector-content').innerHTML = html;
          const backBtn = document.getElementById('back-to-severity');
          const label = document.getElementById('back-btn-label');
          if (lastSeverityInspector) {
            const sevCap = lastSeverityInspector.charAt(0).toUpperCase() + lastSeverityInspector.slice(1);
            label.textContent = 'All ' + sevCap + ' Severities';
            backBtn.classList.add('visible');
          } else {
            backBtn.classList.remove('visible');
          }
        }

        function escapeHtml(str) {
          return (str||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
        }

        function setupZoom() {
          const container = document.getElementById('graph-container');
          const svg = container.querySelector('svg');
          if (!svg) return;
          const zoomG = svg.querySelector('g');
          const zoom = d3.zoom().scaleExtent([0.2, 4]).on('zoom', ev => {
            zoomG.setAttribute('transform', ev.transform.toString());
          });
          d3.select(svg).call(zoom);
          zoomRef = zoom;
          svgRef = svg;
          document.getElementById('zoom-in').onclick = () => {
            d3.select(svg).transition().duration(200).call(zoom.scaleBy, 1.3);
          };
          document.getElementById('zoom-out').onclick = () => {
            d3.select(svg).transition().duration(200).call(zoom.scaleBy, 0.77);
          };
        }

      </script>
    </body>
    </html>
    `;
}

export function deactivate() {}

// import * as vscode from 'vscode';
// import { exec } from 'child_process';
// import * as fs from 'fs';
// import * as path from 'path';
// import { promisify } from 'util';

// const execAsync = promisify(exec);

// type AuditMetadata = {
//     dependencies?: {
//         prod?: number;
//         dev?: number;
//         optional?: number;
//         peer?: number;
//         peerOptional?: number;
//         total?: number;
//     };
// };

// type AuditResult = {
//     metadata?: AuditMetadata;
//     vulnerabilities?: Record<string, unknown>;
// };

// type ExecErrorWithOutput = Error & {
//     stdout?: string;
//     stderr?: string;
// };

// // This method is called when your extension is activated
// export function activate(context: vscode.ExtensionContext) {
//     // Register a command
//     const disposable = vscode.commands.registerCommand('vulnerability-scanner.scan', async () => {
//         vscode.window.showInformationMessage('Vulnerability Package Scanner activated!');
//         await runNpmAudit();
//     });

//     context.subscriptions.push(disposable);
// }

// // This function runs npm audit and handles the JSON output
// async function runNpmAudit() {
//     const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
//     if (!workspaceFolder) {
//         vscode.window.showWarningMessage(
//             'In order to use scanning features, you can open a Node project folder.'
//         );
//         return;
//     }

//     const projectRoot = workspaceFolder.uri.fsPath;
//     const packageJsonPath = path.join(projectRoot, 'package.json');
//     if (!fs.existsSync(packageJsonPath)) {
//         vscode.window.showWarningMessage('No package.json found in the opened folder.');
//         return;
//     }

//     try {
//         const auditResults = await runAuditWithLockfileFallback(projectRoot);
//         parseAuditResults(auditResults);
//     } catch (error) {
//         const message = error instanceof Error ? error.message : String(error);
//         vscode.window.showErrorMessage(`npm audit error: ${message}`);
//     }
// }

// // Function to process audit results
// function parseAuditResults(results: AuditResult) {
//     console.log('Vulnerability Scan Results:', results);

//     const dependencies = results.metadata?.dependencies;
//     if (dependencies) {
//         const depMessage = [
//             `Dependencies: ${dependencies.total ?? 0}`,
//             `prod ${dependencies.prod ?? 0}`,
//             `dev ${dependencies.dev ?? 0}`,
//             `optional ${dependencies.optional ?? 0}`,
//             `peer ${dependencies.peer ?? 0}`,
//             `peer optional ${dependencies.peerOptional ?? 0}`
//         ].join(' | ');

//         vscode.window.showInformationMessage(depMessage);
//     } else {
//         vscode.window.showWarningMessage(
//             'Scan completed, but dependency metadata was missing from npm audit output.'
//         );
//     }
// }

// // This method is called when your extension is deactivated
// export function deactivate() {}

// async function runAuditWithLockfileFallback(projectRoot: string): Promise<AuditResult> {
//     try {
//         return await runAudit(projectRoot);
//     } catch (error) {
//         const message = error instanceof Error ? error.message : String(error);
//         const lockfileMissing = /ENOLOCK|requires an existing lockfile|loadVirtual requires existing shrinkwrap file/i.test(
//             message
//         );

//         if (!lockfileMissing) {
//             throw error;
//         }

//         // If the selected project has no lockfile yet, create one and retry once.
//         await execAsync('npm i --package-lock-only --ignore-scripts', { cwd: projectRoot });
//         return await runAudit(projectRoot);
//     }
// }

// async function runAudit(projectRoot: string): Promise<AuditResult> {
//     try {
//         const { stdout } = await execAsync('npm audit --json', { cwd: projectRoot });
//         return JSON.parse(stdout) as AuditResult;
//     } catch (error) {
//         const execError = error as ExecErrorWithOutput;
//         if (execError.stdout) {
//             return JSON.parse(execError.stdout) as AuditResult;
//         }

//         const stderr = execError.stderr?.trim();
//         throw new Error(stderr || execError.message);
//     }
// }