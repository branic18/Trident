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
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: 'IBM Plex Mono', monospace; background: #1e1e1e; color: #F7F7F7; overflow: hidden; }
        #app { width: 100vw; height: 100vh; position: relative; }
        #graph-container { width: 100%; height: 100%; transition: width 0.2s; position: absolute; top: 0; left: 0; z-index: 0; }
        #app.inspector-open #graph-container { width: 50%; }
        #metadata-panel {
          position: absolute; top: 25px; left: 25px; z-index: 1;
          background: rgba(37,37,38,0.9); backdrop-filter: blur(10px);
          padding: 25px; border-radius: 8px; font-size: 14px;
          line-height: 1.6; min-width: 180px;
          pointer-events: none;
        }
        #metadata-panel .section { margin-bottom: 12px; }
        #metadata-panel .section-title { font-size: 14px; margin-bottom: 6px; }
        #metadata-panel .item { font-size: 12px; color: #BBBBBB; }
        #inspector-panel {
          position: absolute; top: 0; right: 0; width: 50%; height: 100%;
          background: #252526; display: none; overflow-y: auto;
          border-left: 5px solid #F19E21; font-size: 14px;
        }
        #inspector-panel.visible { display: block; }
        #inspector-panel .close-btn {
          position: absolute; top: 12px; right: 12px; cursor: pointer;
          color: #F7F7F7; font-size: 20px; padding: 4px;
        }
        #inspector-panel .content { padding: 20px; padding-top: 50px; }
        #inspector-panel .dep-type { color: #BBBBBB; font-size: 14px; margin-bottom: 8px; }
        #inspector-panel .package-name { font-size: 18px; font-weight: bold; margin-bottom: 16px; }
        #inspector-panel .vul-section { margin: 16px 0; padding-top: 12px; border-top: 1px solid rgba(247,247,247,0.5); }
        #inspector-panel .vul-title { font-weight: bold; font-size: 20px; margin-bottom: 8px; }
        #inspector-panel .vul-summary { font-size: 15px; color: #BBBBBB; margin: 8px 0; max-height: 4.5em; overflow: hidden; }
        #inspector-panel .severity-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin: 12px 0; }
        #inspector-panel .severity-item .label { font-size: 14px; color: #BBBBBB; }
        #inspector-panel .severity-item .value { font-size: 15px; color: #F7F7F7; }
        #inspector-panel .remediation { background: #1A1A1A; border: 1px solid rgba(247,247,247,0.2); padding: 12px; margin: 12px 0; border-radius: 4px; display: grid; grid-template-columns: 1fr 1fr auto; gap: 12px; }
        #inspector-panel .copy-cmd { background: #21252E; padding: 8px 12px; font-size: 12px; border-radius: 4px; display: flex; align-items: center; gap: 8px; cursor: pointer; }
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
          <span class="close-btn" id="close-inspector">&times;</span>
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
          low: { bg: '#285AFF', text: '#FFFFFF', icon: 'bi-circle-fill' }
        };
        const CVSS_AV = { N: 'Network', A: 'Adjacent', L: 'Local', P: 'Physical' };
        const CVSS_PR = { N: 'None', L: 'Low', H: 'High' };
        const CVSS_UI = { N: 'None', R: 'Required' };

        let allNodes = [];
        let allNodeMap = {};
        let allFlatNodes = [];
        let zoomRef = null;
        let svgRef = null;
        let selectAndShowNodeFn = null;
        let blastZoneGrpRef = null;

        window.addEventListener('message', event => {
          const msg = event.data;
          if (msg.command === 'loadData') renderVisualization(msg.data);
          else if (msg.command === 'loadError') {
            document.getElementById('app').innerHTML = '<p style="color:#F16621;padding:20px;">Scan failed: ' + (msg.error || 'Unknown') + '</p>';
          }
        });

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
            d3.selectAll('.link').classed('selected', false).classed('blast-radius', false);
            nodeGrp.selectAll('g').select('circle').attr('stroke', 'none').attr('stroke-width', 0);
            if (blastZoneGrpRef) blastZoneGrpRef.selectAll('path').remove();
          };
        }

        function renderMetadata(vulCounts, depCounts) {
          const totalVul = vulCounts.total || 0;
          const html = '<div class="section"><div class="section-title">' + totalVul + ' Vulnerabilities</div>' +
            '<div class="item">' + (vulCounts.info||0) + ' Info</div>' +
            '<div class="item">' + (vulCounts.low||0) + ' Low</div>' +
            '<div class="item">' + (vulCounts.moderate||0) + ' Moderate</div>' +
            '<div class="item">' + (vulCounts.high||0) + ' High</div>' +
            '<div class="item">' + (vulCounts.critical||0) + ' Critical</div></div>' +
            '<div class="section"><div class="section-title">' + (depCounts.total||0) + ' Dependencies</div>' +
            '<div class="item">' + (depCounts.prod||0) + ' prod</div>' +
            '<div class="item">' + (depCounts.dev||0) + ' dev</div>' +
            '<div class="item">' + (depCounts.optional||0) + ' optional</div>' +
            '<div class="item">' + (depCounts.peer||0) + ' peer</div>' +
            '<div class="item">' + (depCounts.peerOptional||0) + ' peer optional</div></div>';
          document.getElementById('metadata-panel').innerHTML = html;
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

          selectAndShowNodeFn = function(d) {
            const blastIds = new Set(getBlastRadiusNodes(d.id));
            d3.selectAll('.link').classed('selected', l => (l.source && l.source.id === d.id) || (l.target && l.target.id === d.id))
              .classed('blast-radius', l => l.source && l.source.id === d.id && blastIds.has(l.target.id));
            nodeGrp.selectAll('g').each(function(n) {
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

          node.on('click', (ev, d) => { selectAndShowNodeFn(d); });

          window.selectNodeByName = function(name) {
            const nd = allNodeMap[name] || allFlatNodes.find(n => n.id === name);
            if (nd && selectAndShowNodeFn) selectAndShowNodeFn(nd);
          };
        }

        function parseCVSS(vectorStr) {
          if (!vectorStr || typeof vectorStr !== 'string') return null;
          const m = vectorStr.match(/CVSS:3\\.1\\/([^\\s]+)/);
          if (!m) return null;
          const parts = {};
          m[1].split('/').forEach(p => { const [k,v] = p.split(':'); parts[k] = v; });
          return {
            av: CVSS_AV[parts.AV] || parts.AV,
            pr: CVSS_PR[parts.PR] || parts.PR,
            ui: CVSS_UI[parts.UI] || parts.UI
          };
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
              html += '<div class="remediation"><div><div class="label">Fix Available</div><div class="value">' + (fix ? 'Yes' : 'No') + '</div><div class="label">Upgrade To</div><div class="value">' + (upgradeTo || '-') + '</div></div>';
              html += '<div><div class="label">Type</div><div class="value">' + (fix && fix.isSemVerMajor ? 'SemVer Major' : 'SemVer') + '</div><div class="label">Resolves</div><div class="value">' + (fix && fix.resolves ? fix.resolves.length + ' vulnerabilities' : '-') + '</div></div>';
              html += '<div class="copy-cmd" data-cmd="' + (fixCmd || '').replace(/"/g, '&quot;') + '" onclick="this.dataset.cmd && navigator.clipboard.writeText(this.dataset.cmd)"><span>' + (fixCmd || 'See advisory') + '</span><i class="bi bi-clipboard"></i></div></div>';
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