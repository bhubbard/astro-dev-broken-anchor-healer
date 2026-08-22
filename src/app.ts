/**
 * Astro Dev Toolbar App: Broken Anchor Healer
 */

import { defineToolbarApp } from 'astro/toolbar';
import { scanAnchorLinks, scanDomTargets, type ScanSummary, type TargetElementInfo } from './scanner.js';
import { healAllBrokenAnchors, isChromeAIAvailable, type HealedAnchorResult } from './matcher.js';

export default defineToolbarApp({
  init(canvas, app) {
    const container = document.createElement('div');
    container.className = 'anchor-healer-window';

    const style = document.createElement('style');
    style.textContent = `
      :host {
        --ah-bg: #13151a;
        --ah-card-bg: #1e222b;
        --ah-card-border: #2d3342;
        --ah-text-main: #f3f4f6;
        --ah-text-muted: #9ca3af;
        --ah-accent: #8b5cf6;
        --ah-accent-hover: #7c3aed;
        --ah-success: #10b981;
        --ah-warning: #f59e0b;
        --ah-danger: #ef4444;
        --ah-ai-glow: linear-gradient(135deg, #a855f7 0%, #3b82f6 100%);
      }

      .anchor-healer-window {
        position: fixed;
        bottom: 72px;
        right: 24px;
        width: 480px;
        max-width: calc(100vw - 48px);
        max-height: calc(100vh - 120px);
        background: var(--ah-bg);
        border: 1px solid var(--ah-card-border);
        border-radius: 16px;
        box-shadow: 0 20px 40px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(255, 255, 255, 0.05);
        color: var(--ah-text-main);
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
        display: flex;
        flex-direction: column;
        overflow: hidden;
        z-index: 9999999;
        backdrop-filter: blur(12px);
      }

      .header {
        padding: 16px 20px;
        background: #181b22;
        border-bottom: 1px solid var(--ah-card-border);
        display: flex;
        align-items: center;
        justify-content: space-between;
      }

      .header-title {
        display: flex;
        align-items: center;
        gap: 10px;
        font-size: 15px;
        font-weight: 700;
        letter-spacing: -0.01em;
      }

      .ai-badge {
        font-size: 11px;
        padding: 2px 8px;
        border-radius: 12px;
        font-weight: 600;
        display: inline-flex;
        align-items: center;
        gap: 4px;
      }

      .ai-badge.ready {
        background: rgba(139, 92, 246, 0.2);
        color: #c084fc;
        border: 1px solid rgba(168, 85, 247, 0.4);
      }

      .ai-badge.fallback {
        background: rgba(245, 158, 11, 0.15);
        color: #fcd34d;
        border: 1px solid rgba(245, 158, 11, 0.3);
      }

      .stats-bar {
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        gap: 8px;
        padding: 12px 20px;
        background: #15181f;
        border-bottom: 1px solid var(--ah-card-border);
      }

      .stat-item {
        background: var(--ah-card-bg);
        border: 1px solid var(--ah-card-border);
        border-radius: 8px;
        padding: 8px 12px;
        text-align: center;
      }

      .stat-value {
        font-size: 18px;
        font-weight: 700;
      }

      .stat-label {
        font-size: 11px;
        color: var(--ah-text-muted);
        text-transform: uppercase;
        letter-spacing: 0.05em;
        margin-top: 2px;
      }

      .stat-broken { color: var(--ah-danger); }
      .stat-valid { color: var(--ah-success); }
      .stat-total { color: var(--ah-text-main); }

      .content-body {
        padding: 16px 20px;
        overflow-y: auto;
        flex: 1;
        display: flex;
        flex-direction: column;
        gap: 14px;
      }

      .empty-state {
        text-align: center;
        padding: 36px 16px;
        color: var(--ah-text-muted);
        font-size: 14px;
      }

      .empty-icon {
        font-size: 32px;
        margin-bottom: 8px;
        color: var(--ah-success);
      }

      .card {
        background: var(--ah-card-bg);
        border: 1px solid var(--ah-card-border);
        border-radius: 12px;
        padding: 14px;
        display: flex;
        flex-direction: column;
        gap: 10px;
        transition: border-color 0.2s ease;
      }

      .card:hover {
        border-color: rgba(139, 92, 246, 0.5);
      }

      .card-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
      }

      .broken-anchor {
        font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
        font-size: 13px;
        color: var(--ah-danger);
        background: rgba(239, 68, 68, 0.1);
        padding: 2px 6px;
        border-radius: 4px;
        word-break: break-all;
      }

      .anchor-text {
        font-size: 12px;
        color: var(--ah-text-muted);
        font-style: italic;
      }

      .recommendation-box {
        background: #15181f;
        border-left: 3px solid var(--ah-accent);
        border-radius: 0 8px 8px 0;
        padding: 10px 12px;
        display: flex;
        flex-direction: column;
        gap: 6px;
      }

      .rec-target {
        display: flex;
        align-items: center;
        justify-content: space-between;
      }

      .rec-target-id {
        font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
        font-size: 13px;
        font-weight: 600;
        color: #38bdf8;
      }

      .confidence-badge {
        font-size: 11px;
        font-weight: 600;
        padding: 2px 6px;
        border-radius: 6px;
        background: rgba(56, 189, 248, 0.15);
        color: #38bdf8;
      }

      .rec-reason {
        font-size: 12px;
        color: var(--ah-text-muted);
        line-height: 1.4;
      }

      .actions {
        display: flex;
        gap: 8px;
        margin-top: 4px;
      }

      .btn {
        background: #2a303c;
        border: 1px solid var(--ah-card-border);
        color: var(--ah-text-main);
        padding: 6px 12px;
        font-size: 12px;
        font-weight: 600;
        border-radius: 6px;
        cursor: pointer;
        transition: all 0.2s ease;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 6px;
      }

      .btn:hover {
        background: #374151;
        color: #fff;
      }

      .btn-primary {
        background: var(--ah-accent);
        border-color: var(--ah-accent);
      }

      .btn-primary:hover {
        background: var(--ah-accent-hover);
      }

      .btn-applied {
        background: rgba(16, 185, 129, 0.2);
        border-color: rgba(16, 185, 129, 0.4);
        color: #34d399;
        cursor: default;
      }

      .footer {
        padding: 12px 20px;
        background: #181b22;
        border-top: 1px solid var(--ah-card-border);
        display: flex;
        align-items: center;
        justify-content: space-between;
      }
    `;

    let scanResult: ScanSummary = {
      totalLinks: 0,
      validCount: 0,
      brokenCount: 0,
      validLinks: [],
      brokenLinks: [],
      allTargets: [],
      timestamp: Date.now(),
    };

    let healedResults: HealedAnchorResult[] = [];
    let isAiReady = false;

    // Helper to render DOM
    const render = () => {
      container.innerHTML = `
        <div class="header">
          <div class="header-title">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path>
              <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path>
            </svg>
            Anchor Healer
          </div>
          <div class="ai-badge ${isAiReady ? 'ready' : 'fallback'}">
            ${isAiReady ? '✨ Gemini Nano Active' : '⚡ Heuristic Mode'}
          </div>
        </div>

        <div class="stats-bar">
          <div class="stat-item">
            <div class="stat-value stat-total">${scanResult.totalLinks}</div>
            <div class="stat-label">Total</div>
          </div>
          <div class="stat-item">
            <div class="stat-value stat-valid">${scanResult.validCount}</div>
            <div class="stat-label">Valid</div>
          </div>
          <div class="stat-item">
            <div class="stat-value stat-broken">${scanResult.brokenCount}</div>
            <div class="stat-label">Broken</div>
          </div>
        </div>

        <div class="content-body" id="cards-container">
          ${
            scanResult.brokenCount === 0
              ? `
              <div class="empty-state">
                <div class="empty-icon">✓</div>
                <strong>All anchor links are healthy!</strong>
                <p>No missing DOM targets or broken hash anchors found on this page.</p>
              </div>
            `
              : healedResults
                  .map((res, index) => {
                    const broken = res.brokenLink;
                    const topMatch = res.topMatch;
                    return `
                <div class="card" data-index="${index}">
                  <div class="card-header">
                    <span class="broken-anchor">#${broken.targetId}</span>
                    <span class="anchor-text">${broken.anchorText ? `"${broken.anchorText}"` : 'No text'}</span>
                  </div>
                  ${
                    topMatch
                      ? `
                    <div class="recommendation-box">
                      <div class="rec-target">
                        <span class="rec-target-id">↳ #${topMatch.targetId}</span>
                        <span class="confidence-badge">${Math.round(topMatch.confidence * 100)}% match</span>
                      </div>
                      <div class="rec-reason">${topMatch.reason}</div>
                    </div>
                    <div class="actions">
                      <button class="btn btn-primary action-apply" data-index="${index}">
                        Apply Fix
                      </button>
                      <button class="btn action-scroll" data-target="${topMatch.targetId}">
                        Inspect Heading
                      </button>
                    </div>
                  `
                      : `
                    <div class="recommendation-box" style="border-left-color: var(--ah-danger);">
                      <div class="rec-reason">No matching DOM headings or targets found. Consider adding an id to the target element.</div>
                    </div>
                  `
                  }
                </div>
              `;
                  })
                  .join('')
          }
        </div>

        <div class="footer">
          <button class="btn" id="btn-rescan">🔄 Rescan Page</button>
          ${
            scanResult.brokenCount > 0
              ? `<button class="btn btn-primary" id="btn-fix-all">⚡ Fix All (${scanResult.brokenCount})</button>`
              : ''
          }
        </div>
      `;

      // Attach event listeners
      const rescanBtn = container.querySelector('#btn-rescan');
      if (rescanBtn) {
        rescanBtn.addEventListener('click', () => performScan());
      }

      const fixAllBtn = container.querySelector('#btn-fix-all');
      if (fixAllBtn) {
        fixAllBtn.addEventListener('click', () => applyAllFixes());
      }

      const applyBtns = container.querySelectorAll('.action-apply');
      applyBtns.forEach((btn) => {
        btn.addEventListener('click', (e) => {
          const idx = parseInt((e.currentTarget as HTMLElement).getAttribute('data-index') || '0', 10);
          applySingleFix(idx, e.currentTarget as HTMLElement);
        });
      });

      const scrollBtns = container.querySelectorAll('.action-scroll');
      scrollBtns.forEach((btn) => {
        btn.addEventListener('click', (e) => {
          const targetId = (e.currentTarget as HTMLElement).getAttribute('data-target');
          if (targetId) {
            const targetEl = document.getElementById(targetId);
            if (targetEl) {
              targetEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
              targetEl.style.transition = 'outline 0.3s ease';
              targetEl.style.outline = '4px solid #8b5cf6';
              setTimeout(() => {
                targetEl.style.outline = '';
              }, 2000);
            }
          }
        });
      });
    };

    const applySingleFix = (index: number, btnElement?: HTMLElement) => {
      const item = healedResults[index];
      if (item && item.topMatch && item.brokenLink.element) {
        item.brokenLink.element.setAttribute('href', `#${item.topMatch.targetId}`);
        if (btnElement) {
          btnElement.textContent = '✓ Applied';
          btnElement.className = 'btn btn-applied';
          btnElement.setAttribute('disabled', 'true');
        }
      }
    };

    const applyAllFixes = () => {
      healedResults.forEach((item, idx) => {
        applySingleFix(idx);
      });
      // Rescan to confirm
      setTimeout(performScan, 300);
    };

    const performScan = async () => {
      isAiReady = await isChromeAIAvailable();
      const targets = scanDomTargets(document);
      scanResult = scanAnchorLinks(document, targets);

      if (scanResult.brokenCount > 0) {
        app.toggleNotification({
          state: true,
          level: 'warning',
        });
        healedResults = await healAllBrokenAnchors(scanResult.brokenLinks, targets);
      } else {
        app.toggleNotification({
          state: false,
        });
        healedResults = [];
      }

      render();
    };

    canvas.appendChild(style);
    canvas.appendChild(container);

    // Initial scan on load
    performScan();
  },
});
