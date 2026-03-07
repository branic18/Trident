/**
 * Accessibility configuration and CSS for WCAG 2.1 AA compliant Goose integration UI
 * This module provides templates and styles to be injected into the webview
 */

export interface AccessibilityConfig {
  highContrastMode: boolean;
  reduceMotion: boolean;
  screenReaderOptimized: boolean;
  keyboardOnlyNavigation: boolean;
  fontSize: 'small' | 'medium' | 'large' | 'x-large';
  colorBlindSupport: 'none' | 'deuteranopia' | 'protanopia' | 'tritanopia';
}

/**
 * Color-blind friendly severity styles with patterns
 */
export const ACCESSIBLE_SEVERITY_STYLES = {
  critical: { 
    bg: '#B40E0E', 
    text: '#F7F7F7', 
    icon: 'bi-exclamation-octagon-fill',
    pattern: 'diagonal-stripes',
    ariaLabel: 'Critical severity with diagonal stripe pattern'
  },
  high: { 
    bg: '#F16621', 
    text: '#000000', 
    icon: 'bi-exclamation-triangle',
    pattern: 'dots',
    ariaLabel: 'High severity with dot pattern'
  },
  moderate: { 
    bg: '#F19E21', 
    text: '#000000', 
    icon: 'bi-triangle-fill',
    pattern: 'vertical-lines',
    ariaLabel: 'Moderate severity with vertical line pattern'
  },
  low: { 
    bg: '#285AFF', 
    text: '#F7F7F7', 
    icon: 'bi-circle-fill',
    pattern: 'solid',
    ariaLabel: 'Low severity with solid fill'
  }
};

/**
 * Accessible CSS styles for injection into webview
 */
export const ACCESSIBILITY_CSS = `
  /* Screen reader only content */
  .sr-only {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    white-space: nowrap;
    border: 0;
  }
  
  /* Focus indicators */
  .focusable:focus {
    outline: 3px solid #0678CF;
    outline-offset: 2px;
    border-radius: 2px;
  }
  
  /* High contrast mode support */
  @media (prefers-contrast: high) {
    .priority-badge { 
      border: 2px solid currentColor; 
      background: Canvas;
      color: CanvasText;
    }
    .ai-insight-section { 
      outline: 2px solid currentColor; 
      background: Canvas;
      color: CanvasText;
    }
    .code-block {
      border: 1px solid currentColor;
      background: Canvas;
      color: CanvasText;
    }
  }
  
  /* Reduced motion support */
  @media (prefers-reduced-motion: reduce) {
    .accordion-body { transition: none; }
    .zoom-controls button { transition: none; }
    .priority-badge { animation: none; }
    * { animation-duration: 0.01ms !important; }
  }
  
  /* Color-blind support patterns */
  .priority-pattern.diagonal-stripes::after {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background-image: repeating-linear-gradient(
      45deg,
      transparent,
      transparent 2px,
      currentColor 2px,
      currentColor 4px
    );
    opacity: 0.3;
    pointer-events: none;
  }
  
  .priority-pattern.dots::after {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background-image: radial-gradient(
      circle at 25% 25%,
      currentColor 2px,
      transparent 2px
    );
    background-size: 8px 8px;
    opacity: 0.4;
    pointer-events: none;
  }
  
  .priority-pattern.vertical-lines::after {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background-image: repeating-linear-gradient(
      90deg,
      transparent,
      transparent 2px,
      currentColor 2px,
      currentColor 3px
    );
    opacity: 0.3;
    pointer-events: none;
  }
  
  /* Font size support */
  .font-size-small { font-size: 12px; }
  .font-size-medium { font-size: 14px; }
  .font-size-large { font-size: 16px; }
  .font-size-x-large { font-size: 18px; }
  
  /* Button accessibility */
  button.focusable {
    min-width: 44px;
    min-height: 44px;
    padding: 8px 12px;
    border: 1px solid #555;
    background: #252526;
    color: #F7F7F7;
    border-radius: 4px;
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    gap: 8px;
    font-family: inherit;
  }
  
  button.focusable:hover {
    background: #333;
    border-color: #0678CF;
  }
  
  button.focusable:focus {
    outline: 3px solid #0678CF;
    outline-offset: 2px;
  }
  
  button.focusable:active {
    transform: translateY(1px);
  }
  
  /* Code block accessibility */
  .code-block {
    background: #1A1A1A;
    border: 1px solid rgba(247,247,247,0.2);
    padding: 12px;
    border-radius: 4px;
    font-family: 'IBM Plex Mono', monospace;
    font-size: 13px;
    line-height: 1.4;
    overflow-x: auto;
    max-width: 100%;
  }
  
  .code-block:focus {
    outline: 2px solid #0678CF;
    outline-offset: 1px;
  }
  
  /* Priority badge accessibility */
  .priority-badge {
    position: relative;
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 6px 12px;
    border-radius: 16px;
    font-weight: bold;
    font-size: 14px;
    margin: 8px 0;
  }
  
  .priority-tooltip {
    position: absolute;
    bottom: 100%;
    left: 50%;
    transform: translateX(-50%);
    background: #333;
    color: #F7F7F7;
    padding: 8px 12px;
    border-radius: 4px;
    font-size: 12px;
    white-space: nowrap;
    opacity: 0;
    pointer-events: none;
    transition: opacity 0.2s;
    z-index: 10;
  }
  
  .priority-badge:hover .priority-tooltip,
  .priority-badge:focus .priority-tooltip {
    opacity: 1;
  }
  
  /* AI transparency styling */
  .ai-badge {
    background: #0678CF;
    color: white;
    font-size: 10px;
    padding: 2px 6px;
    border-radius: 10px;
    margin-left: 8px;
    font-weight: normal;
  }
  
  .ai-section-header {
    display: flex;
    align-items: center;
    margin-bottom: 16px;
    padding-bottom: 8px;
    border-bottom: 1px solid rgba(247,247,247,0.2);
  }
  
  .ai-disclaimer {
    background: rgba(241, 158, 33, 0.1);
    border-left: 4px solid #F19E21;
    padding: 12px;
    margin-top: 16px;
    font-size: 12px;
    border-radius: 0 4px 4px 0;
    display: flex;
    align-items: flex-start;
    gap: 8px;
  }
  
  /* AI insight section styling */
  .ai-insight-section {
    background: rgba(37, 37, 38, 0.8);
    border: 1px solid rgba(247, 247, 247, 0.2);
    border-radius: 8px;
    padding: 16px;
    margin: 16px 0;
  }
  
  .explanation-content {
    margin: 12px 0;
  }
  
  .explanation-content h4 {
    color: #0678CF;
    font-size: 14px;
    margin: 12px 0 6px 0;
  }
  
  .recommended-actions {
    margin: 16px 0;
  }
  
  .action-item {
    margin: 8px 0;
    border: 1px solid rgba(247, 247, 247, 0.2);
    border-radius: 4px;
    padding: 8px;
  }
  
  .action-description {
    margin-top: 4px;
    font-size: 12px;
    color: #BBBBBB;
  }
  
  .code-fix-section {
    margin: 16px 0;
    border: 1px solid rgba(6, 120, 207, 0.3);
    border-radius: 8px;
    padding: 16px;
  }
  
  .code-diff-container {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 16px;
    margin: 12px 0;
  }
  
  .code-before, .code-after {
    border: 1px solid rgba(247, 247, 247, 0.2);
    border-radius: 4px;
    padding: 8px;
  }
  
  .code-actions {
    display: flex;
    gap: 12px;
    margin: 16px 0;
    flex-wrap: wrap;
  }
  
  .code-warnings {
    background: rgba(241, 158, 33, 0.1);
    border-left: 4px solid #F19E21;
    padding: 12px;
    margin: 12px 0;
    border-radius: 0 4px 4px 0;
  }
  
  .warning-item {
    margin: 4px 0;
    font-size: 12px;
  }
`;

/**
 * JavaScript functions for webview accessibility (as string templates)
 */
export const ACCESSIBILITY_JS = `
  // Screen reader announcement utility
  function announceToScreenReader(message, priority = 'polite') {
    const announcement = document.createElement('div');
    announcement.setAttribute('aria-live', priority);
    announcement.setAttribute('aria-atomic', 'true');
    announcement.className = 'sr-only';
    announcement.textContent = message;
    document.body.appendChild(announcement);
    
    setTimeout(() => {
      if (document.body.contains(announcement)) {
        document.body.removeChild(announcement);
      }
    }, 1000);
  }

  // Keyboard navigation setup
  function setupAccessibleNavigation() {
    document.addEventListener('keydown', (event) => {
      // Inspector panel navigation
      if (event.key === 'Escape' && isInspectorOpen()) {
        closeInspectorAndRestoreFocus();
        event.preventDefault();
        return;
      }
      
      // Quick actions with keyboard shortcuts
      if (event.ctrlKey || event.metaKey) {
        switch (event.key) {
          case 'c':
            if (isCodeFixFocused()) {
              copyCodeFixAndAnnounce();
              event.preventDefault();
            }
            break;
          case 'Enter':
            if (event.target?.closest('.action-button')) {
              executeRecommendedAction(event.target);
              event.preventDefault();
            }
            break;
          case 'i':
            // Toggle inspector panel
            if (isInspectorOpen()) {
              closeInspectorAndRestoreFocus();
            }
            event.preventDefault();
            break;
        }
      }
    });
  }

  // Utility functions
  function isInspectorOpen() {
    return document.getElementById('inspector-panel')?.classList.contains('visible') || false;
  }

  function isCodeFixFocused() {
    return document.activeElement?.closest('.code-fix-section') !== null;
  }

  function closeInspectorAndRestoreFocus() {
    const inspector = document.getElementById('inspector-panel');
    const app = document.getElementById('app');
    
    if (inspector && app) {
      inspector.classList.remove('visible');
      app.classList.remove('inspector-open');
      
      // Clear selected links
      document.querySelectorAll('.link.selected').forEach(link => {
        link.classList.remove('selected');
      });
      
      // Restore focus to the previously selected node or graph container
      const graphContainer = document.getElementById('graph-container');
      if (graphContainer) {
        graphContainer.focus();
      }
      
      // Announce to screen reader
      announceToScreenReader('Inspector panel closed', 'polite');
    }
  }

  function copyCodeFixAndAnnounce() {
    const activeCodeBlock = document.activeElement?.closest('.code-after')?.querySelector('code');
    if (activeCodeBlock) {
      navigator.clipboard.writeText(activeCodeBlock.textContent || '').then(() => {
        announceToScreenReader('Code fix copied to clipboard', 'polite');
      }).catch(() => {
        announceToScreenReader('Failed to copy code fix', 'assertive');
      });
    }
  }

  function executeRecommendedAction(target) {
    const actionButton = target?.closest('.action-button');
    if (actionButton) {
      const actionIndex = actionButton.getAttribute('data-action');
      const description = document.getElementById('action-' + actionIndex + '-desc')?.textContent;
      
      if (description) {
        // Copy action text to clipboard for user to execute
        navigator.clipboard.writeText(description).then(() => {
          announceToScreenReader('Action ' + actionIndex + ' copied to clipboard: ' + description, 'polite');
        }).catch(() => {
          announceToScreenReader('Failed to copy action', 'assertive');
        });
      }
    }
  }
`;

/**
 * Creates accessible priority badge HTML
 */
export function createAccessiblePriorityBadge(
  score: number, 
  reason: string, 
  severity: string
): string {
  const patterns = {
    'critical': 'diagonal-stripes',
    'high': 'dots',
    'moderate': 'vertical-lines', 
    'low': 'solid'
  };
  
  const pattern = patterns[severity as keyof typeof patterns] || 'solid';
  const ariaLabel = `Security Priority: ${score} out of 5. ${reason}`;
  
  return `
    <div class="priority-badge ${severity}" 
         role="img" 
         aria-label="${ariaLabel}"
         tabindex="0">
      <span class="sr-only">Security Priority: </span>
      <span class="priority-score" aria-hidden="true">${score}</span>
      <span class="priority-pattern ${pattern}" aria-hidden="true"></span>
      <div class="priority-tooltip" role="tooltip">
        ${reason}
      </div>
    </div>
  `;
}

/**
 * Creates accessible AI insight section HTML template
 */
export function createAccessibleInsightHTML(insight: {
  title: string;
  humanExplanation: string;
  impactOnUsers: string;
  priorityScore: number;
  priorityReason: string;
  recommendedActions: string[];
  devFacingSummary: string;
  codeFix?: {
    filePath: string;
    before: string;
    after: string;
    description: string;
    warnings: string[];
  };
}): string {
  return `
    <div class="ai-insight-section" role="region" aria-labelledby="ai-insight-title">
      <h3 id="ai-insight-title" class="ai-section-header">
        <i class="bi bi-robot" aria-hidden="true"></i>
        AI-Generated Security Analysis
        <span class="ai-badge" aria-label="Artificial Intelligence generated content">AI</span>
      </h3>
      
      ${createAccessiblePriorityBadge(insight.priorityScore, insight.priorityReason, 'moderate')}
      
      <div class="explanation-content" aria-describedby="ai-disclaimer">
        <h4 id="vuln-explanation-heading">Vulnerability Explanation</h4>
        <div class="explanation-text" role="text" aria-labelledby="vuln-explanation-heading">
          ${insight.humanExplanation}
        </div>
        
        <h4 id="impact-heading">Impact Assessment</h4>
        <div class="impact-text" role="text" aria-labelledby="impact-heading">
          ${insight.impactOnUsers}
        </div>
      </div>
      
      <div class="recommended-actions" role="list" aria-label="Recommended Security Actions">
        <h4 id="actions-heading">Recommended Actions</h4>
        ${insight.recommendedActions.map((action, index) => `
          <div role="listitem" class="action-item">
            <button class="action-button focusable" 
                    aria-describedby="action-${index}-desc"
                    data-action="${index}">
              <i class="bi bi-play-circle" aria-hidden="true"></i>
              Execute Action ${index + 1}
            </button>
            <div id="action-${index}-desc" class="action-description">
              ${action}
            </div>
          </div>
        `).join('')}
      </div>
      
      ${insight.codeFix ? createAccessibleCodeFixHTML(insight.codeFix) : ''}
      
      <p id="ai-disclaimer" class="ai-disclaimer" role="note">
        <i class="bi bi-exclamation-triangle" aria-hidden="true"></i>
        This analysis is AI-generated. Please review with security experts before implementation.
      </p>
    </div>
  `;
}

/**
 * Creates accessible code diff HTML
 */
export function createAccessibleCodeFixHTML(codeFix: {
  filePath: string;
  before: string;
  after: string;
  description: string;
  warnings: string[];
}): string {
  return `
    <div class="code-fix-section" role="region" aria-labelledby="code-fix-heading">
      <h4 id="code-fix-heading">Suggested Code Fix</h4>
      <p class="code-fix-description">${codeFix.description}</p>
      
      <div class="code-diff-container">
        <div class="code-before" role="group" aria-labelledby="before-heading">
          <h5 id="before-heading">Current Code</h5>
          <pre class="code-block focusable" 
               role="text" 
               aria-label="Current vulnerable code in ${codeFix.filePath}"
               tabindex="0"><code>${escapeHtml(codeFix.before)}</code></pre>
        </div>
        
        <div class="code-after" role="group" aria-labelledby="after-heading">
          <h5 id="after-heading">Suggested Fix</h5>
          <pre class="code-block focusable" 
               role="text" 
               aria-label="Suggested secure code fix for ${codeFix.filePath}"
               tabindex="0"><code>${escapeHtml(codeFix.after)}</code></pre>
        </div>
      </div>
      
      <div class="code-actions" role="toolbar" aria-label="Code fix actions">
        <button class="copy-code-btn focusable" 
                aria-describedby="copy-desc"
                data-code="${encodeURIComponent(codeFix.after)}">
          <i class="bi bi-clipboard" aria-hidden="true"></i>
          Copy Fixed Code
        </button>
        <span id="copy-desc" class="sr-only">Copy the suggested code fix to clipboard</span>
        
        <button class="apply-fix-btn focusable" 
                aria-describedby="apply-desc"
                data-filepath="${codeFix.filePath}">
          <i class="bi bi-check-circle" aria-hidden="true"></i>
          Apply Code Fix
        </button>
        <span id="apply-desc" class="sr-only">Apply the suggested code fix to your project file</span>
      </div>
      
      ${codeFix.warnings && codeFix.warnings.length > 0 ? `
        <div class="code-warnings" role="alert" aria-labelledby="warnings-heading">
          <h5 id="warnings-heading">
            <i class="bi bi-exclamation-triangle" aria-hidden="true"></i>
            Important Warnings
          </h5>
          <ul role="list">
            ${codeFix.warnings.map((warning: string) => `
              <li role="listitem" class="warning-item">${warning}</li>
            `).join('')}
          </ul>
        </div>
      ` : ''}
    </div>
  `;
}

/**
 * HTML escape utility for secure rendering
 */
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
