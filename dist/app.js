// src/scanner.ts
function extractTargetId(href) {
  if (!href)
    return "";
  const hashIndex = href.indexOf("#");
  if (hashIndex === -1)
    return "";
  const rawTarget = href.substring(hashIndex + 1);
  try {
    return decodeURIComponent(rawTarget.trim());
  } catch {
    return rawTarget.trim();
  }
}
function scanDomTargets(root = document) {
  if (!root || typeof root.querySelectorAll !== "function") {
    return [];
  }
  const elementsWithId = root.querySelectorAll("[id]");
  const targets = [];
  const seenIds = new Set;
  elementsWithId.forEach((el) => {
    const id = el.getAttribute("id")?.trim();
    if (id && !seenIds.has(id)) {
      seenIds.add(id);
      const tagName = el.tagName ? el.tagName.toUpperCase() : "";
      const isHeading = /^H[1-6]$/.test(tagName);
      const textContent = (el.textContent || "").replace(/\s+/g, " ").trim();
      targets.push({
        id,
        tagName,
        textContent,
        isHeading
      });
    }
  });
  const elementsWithName = root.querySelectorAll("a[name]");
  elementsWithName.forEach((el) => {
    const name = el.getAttribute("name")?.trim();
    if (name && !seenIds.has(name)) {
      seenIds.add(name);
      targets.push({
        id: name,
        tagName: "A",
        textContent: (el.textContent || "").replace(/\s+/g, " ").trim(),
        isHeading: false
      });
    }
  });
  return targets;
}
function scanAnchorLinks(root = document, availableTargets) {
  const targets = availableTargets || scanDomTargets(root);
  const targetIdSet = new Set(targets.map((t) => t.id));
  targetIdSet.add("top");
  const validLinks = [];
  const brokenLinks = [];
  if (!root || typeof root.querySelectorAll !== "function") {
    return {
      totalLinks: 0,
      validCount: 0,
      brokenCount: 0,
      validLinks: [],
      brokenLinks: [],
      allTargets: targets,
      timestamp: Date.now()
    };
  }
  const anchorElements = root.querySelectorAll('a[href^="#"]');
  anchorElements.forEach((anchor) => {
    const href = anchor.getAttribute("href") || "";
    const targetId = extractTargetId(href);
    if (!targetId) {
      return;
    }
    const anchorText = (anchor.textContent || "").replace(/\s+/g, " ").trim();
    const isValid = targetIdSet.has(targetId);
    let locationInfo = "";
    if (anchor.parentElement) {
      const parentTag = anchor.parentElement.tagName.toLowerCase();
      const parentClass = anchor.parentElement.className ? `.${String(anchor.parentElement.className).trim().split(/\s+/)[0]}` : "";
      locationInfo = `<${parentTag}${parentClass}>`;
    }
    const linkInfo = {
      href,
      targetId,
      anchorText,
      locationInfo,
      isValid,
      element: anchor
    };
    if (isValid) {
      validLinks.push(linkInfo);
    } else {
      brokenLinks.push(linkInfo);
    }
  });
  return {
    totalLinks: validLinks.length + brokenLinks.length,
    validCount: validLinks.length,
    brokenCount: brokenLinks.length,
    validLinks,
    brokenLinks,
    allTargets: targets,
    timestamp: Date.now()
  };
}

// src/matcher.ts
function levenshteinDistance(a, b) {
  const strA = a.toLowerCase();
  const strB = b.toLowerCase();
  const m = strA.length;
  const n = strB.length;
  if (m === 0)
    return n;
  if (n === 0)
    return m;
  const dp = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = 0;i <= m; i++)
    dp[i][0] = i;
  for (let j = 0;j <= n; j++)
    dp[0][j] = j;
  for (let i = 1;i <= m; i++) {
    for (let j = 1;j <= n; j++) {
      const cost = strA[i - 1] === strB[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + cost);
    }
  }
  return dp[m][n];
}
function calculateStringSimilarity(a, b) {
  const normA = a.toLowerCase().trim();
  const normB = b.toLowerCase().trim();
  if (normA === normB)
    return 1;
  if (!normA || !normB)
    return 0;
  const maxLen = Math.max(normA.length, normB.length);
  const distance = levenshteinDistance(normA, normB);
  return Math.max(0, 1 - distance / maxLen);
}
function tokenize(str) {
  return str.replace(/([a-z])([A-Z])/g, "$1 $2").replace(/[-_.:/]/g, " ").toLowerCase().split(/\s+/).filter((token) => token.length > 0);
}
function calculateTokenSimilarity(a, b) {
  const tokensA = new Set(tokenize(a));
  const tokensB = new Set(tokenize(b));
  if (tokensA.size === 0 || tokensB.size === 0)
    return 0;
  let intersectionCount = 0;
  tokensA.forEach((token) => {
    if (tokensB.has(token)) {
      intersectionCount++;
    }
  });
  const unionCount = new Set([...tokensA, ...tokensB]).size;
  return unionCount === 0 ? 0 : intersectionCount / unionCount;
}
function findHeuristicMatches(brokenTargetId, anchorText, availableTargets, limit = 3) {
  if (!brokenTargetId || availableTargets.length === 0) {
    return [];
  }
  const results = [];
  const normalizedBroken = brokenTargetId.toLowerCase().trim();
  for (const target of availableTargets) {
    const normTargetId = target.id.toLowerCase().trim();
    const normHeadingText = target.textContent.toLowerCase().trim();
    if (normTargetId.includes(normalizedBroken) || normalizedBroken.includes(normTargetId)) {
      const confidence = 0.85 * (Math.min(normTargetId.length, normalizedBroken.length) / Math.max(normTargetId.length, normalizedBroken.length));
      results.push({
        targetId: target.id,
        confidence: Math.round(confidence * 100) / 100,
        strategy: "heuristic:slug",
        reason: `Target ID contains matching slug components`,
        targetElement: target
      });
      continue;
    }
    const idTokenSim = calculateTokenSimilarity(brokenTargetId, target.id);
    const textTokenSim = anchorText ? calculateTokenSimilarity(anchorText, target.textContent) : 0;
    const combinedTokenSim = Math.max(idTokenSim, textTokenSim);
    if (combinedTokenSim >= 0.5) {
      results.push({
        targetId: target.id,
        confidence: Math.round(combinedTokenSim * 0.8 * 100) / 100,
        strategy: "heuristic:token",
        reason: `High word/token overlap with heading content "${target.textContent}"`,
        targetElement: target
      });
      continue;
    }
    const idLevSim = calculateStringSimilarity(brokenTargetId, target.id);
    const headingLevSim = anchorText ? calculateStringSimilarity(anchorText, target.textContent) : 0;
    const bestLevSim = Math.max(idLevSim, headingLevSim);
    if (bestLevSim >= 0.45) {
      results.push({
        targetId: target.id,
        confidence: Math.round(bestLevSim * 0.75 * 100) / 100,
        strategy: "heuristic:levenshtein",
        reason: `Fuzzy character similarity (${Math.round(bestLevSim * 100)}%) with #${target.id}`,
        targetElement: target
      });
    }
  }
  results.sort((a, b) => b.confidence - a.confidence);
  return results.slice(0, limit);
}
async function isChromeAIAvailable() {
  if (typeof window === "undefined")
    return false;
  const ai = window.ai;
  if (!ai?.languageModel?.capabilities)
    return false;
  try {
    const caps = await ai.languageModel.capabilities();
    return caps.available === "readily" || caps.available === "after-download";
  } catch {
    return false;
  }
}
async function findAiSemanticMatch(brokenTargetId, anchorText, availableTargets) {
  if (typeof window === "undefined")
    return null;
  const ai = window.ai;
  if (!ai?.languageModel?.create || availableTargets.length === 0) {
    return null;
  }
  try {
    const targetCandidates = availableTargets.map((t) => ({
      id: t.id,
      text: t.textContent || t.id,
      tag: t.tagName
    }));
    const systemPrompt = `You are a web document semantic link resolver. Given a broken internal anchor link ID and its link text, your job is to find the single best matching destination element ID from a provided list of valid DOM targets.
Return ONLY valid JSON matching this schema:
{"targetId": "<matching-id>", "confidence": <0.0-1.0>, "reason": "<brief explanation>"}
If no targets match with reasonable confidence, set targetId to "" and confidence to 0.`;
    const prompt = `Broken Anchor Target: "#${brokenTargetId}"
Link Text: "${anchorText || "N/A"}"

Available DOM Targets:
${JSON.stringify(targetCandidates, null, 2)}

Respond with JSON only:`;
    const session = await ai.languageModel.create({
      systemPrompt,
      temperature: 0.1,
      topK: 1
    });
    const responseText = await session.prompt(prompt);
    session.destroy();
    const cleanJson = responseText.replace(/```json/gi, "").replace(/```/g, "").trim();
    const parsed = JSON.parse(cleanJson);
    if (parsed.targetId && availableTargets.some((t) => t.id === parsed.targetId)) {
      const targetElement = availableTargets.find((t) => t.id === parsed.targetId);
      return {
        targetId: parsed.targetId,
        confidence: typeof parsed.confidence === "number" ? Math.min(1, Math.max(0, parsed.confidence)) : 0.9,
        strategy: "ai:gemini-nano",
        reason: parsed.reason || `Gemini Nano semantically matched #${brokenTargetId} to #${parsed.targetId}`,
        targetElement
      };
    }
  } catch (err) {
    console.warn("[astro-dev-broken-anchor-healer] Gemini Nano inference failed or timed out:", err);
  }
  return null;
}
async function healBrokenAnchor(brokenLink, availableTargets, options = { enableAI: true }) {
  const heuristicMatches = findHeuristicMatches(brokenLink.targetId, brokenLink.anchorText, availableTargets, 3);
  let aiMatch = null;
  let aiAvailable = false;
  let aiUsed = false;
  if (options.enableAI !== false) {
    aiAvailable = await isChromeAIAvailable();
    if (aiAvailable) {
      aiMatch = await findAiSemanticMatch(brokenLink.targetId, brokenLink.anchorText, availableTargets);
      if (aiMatch) {
        aiUsed = true;
      }
    }
  }
  const allMatches = [];
  if (aiMatch) {
    allMatches.push(aiMatch);
  }
  for (const hMatch of heuristicMatches) {
    if (!allMatches.some((m) => m.targetId === hMatch.targetId)) {
      allMatches.push(hMatch);
    }
  }
  allMatches.sort((a, b) => b.confidence - a.confidence);
  return {
    brokenLink,
    topMatch: allMatches[0],
    allMatches,
    aiUsed,
    aiAvailable
  };
}
async function healAllBrokenAnchors(brokenLinks, availableTargets, options = { enableAI: true }) {
  const results = [];
  for (const link of brokenLinks) {
    const healed = await healBrokenAnchor(link, availableTargets, options);
    results.push(healed);
  }
  return results;
}

// node_modules/astro/dist/toolbar/index.js
function defineToolbarApp(app) {
  return app;
}

// src/app.ts
var app_default = defineToolbarApp({
  init(canvas, app) {
    const container = document.createElement("div");
    container.className = "anchor-healer-window";
    const style = document.createElement("style");
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
    let scanResult = {
      totalLinks: 0,
      validCount: 0,
      brokenCount: 0,
      validLinks: [],
      brokenLinks: [],
      allTargets: [],
      timestamp: Date.now()
    };
    let healedResults = [];
    let isAiReady = false;
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
          <div class="ai-badge ${isAiReady ? "ready" : "fallback"}">
            ${isAiReady ? "✨ Gemini Nano Active" : "⚡ Heuristic Mode"}
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
          ${scanResult.brokenCount === 0 ? `
              <div class="empty-state">
                <div class="empty-icon">✓</div>
                <strong>All anchor links are healthy!</strong>
                <p>No missing DOM targets or broken hash anchors found on this page.</p>
              </div>
            ` : healedResults.map((res, index) => {
        const broken = res.brokenLink;
        const topMatch = res.topMatch;
        return `
                <div class="card" data-index="${index}">
                  <div class="card-header">
                    <span class="broken-anchor">#${broken.targetId}</span>
                    <span class="anchor-text">${broken.anchorText ? `"${broken.anchorText}"` : "No text"}</span>
                  </div>
                  ${topMatch ? `
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
                  ` : `
                    <div class="recommendation-box" style="border-left-color: var(--ah-danger);">
                      <div class="rec-reason">No matching DOM headings or targets found. Consider adding an id to the target element.</div>
                    </div>
                  `}
                </div>
              `;
      }).join("")}
        </div>

        <div class="footer">
          <button class="btn" id="btn-rescan">\uD83D\uDD04 Rescan Page</button>
          ${scanResult.brokenCount > 0 ? `<button class="btn btn-primary" id="btn-fix-all">⚡ Fix All (${scanResult.brokenCount})</button>` : ""}
        </div>
      `;
      const rescanBtn = container.querySelector("#btn-rescan");
      if (rescanBtn) {
        rescanBtn.addEventListener("click", () => performScan());
      }
      const fixAllBtn = container.querySelector("#btn-fix-all");
      if (fixAllBtn) {
        fixAllBtn.addEventListener("click", () => applyAllFixes());
      }
      const applyBtns = container.querySelectorAll(".action-apply");
      applyBtns.forEach((btn) => {
        btn.addEventListener("click", (e) => {
          const idx = parseInt(e.currentTarget.getAttribute("data-index") || "0", 10);
          applySingleFix(idx, e.currentTarget);
        });
      });
      const scrollBtns = container.querySelectorAll(".action-scroll");
      scrollBtns.forEach((btn) => {
        btn.addEventListener("click", (e) => {
          const targetId = e.currentTarget.getAttribute("data-target");
          if (targetId) {
            const targetEl = document.getElementById(targetId);
            if (targetEl) {
              targetEl.scrollIntoView({ behavior: "smooth", block: "center" });
              targetEl.style.transition = "outline 0.3s ease";
              targetEl.style.outline = "4px solid #8b5cf6";
              setTimeout(() => {
                targetEl.style.outline = "";
              }, 2000);
            }
          }
        });
      });
    };
    const applySingleFix = (index, btnElement) => {
      const item = healedResults[index];
      if (item && item.topMatch && item.brokenLink.element) {
        item.brokenLink.element.setAttribute("href", `#${item.topMatch.targetId}`);
        if (btnElement) {
          btnElement.textContent = "✓ Applied";
          btnElement.className = "btn btn-applied";
          btnElement.setAttribute("disabled", "true");
        }
      }
    };
    const applyAllFixes = () => {
      healedResults.forEach((item, idx) => {
        applySingleFix(idx);
      });
      setTimeout(performScan, 300);
    };
    const performScan = async () => {
      isAiReady = await isChromeAIAvailable();
      const targets = scanDomTargets(document);
      scanResult = scanAnchorLinks(document, targets);
      if (scanResult.brokenCount > 0) {
        app.toggleNotification({
          state: true,
          level: "warning"
        });
        healedResults = await healAllBrokenAnchors(scanResult.brokenLinks, targets);
      } else {
        app.toggleNotification({
          state: false
        });
        healedResults = [];
      }
      render();
    };
    canvas.appendChild(style);
    canvas.appendChild(container);
    performScan();
  }
});
export {
  app_default as default
};
