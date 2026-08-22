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
export {
  tokenize,
  levenshteinDistance,
  isChromeAIAvailable,
  healBrokenAnchor,
  healAllBrokenAnchors,
  findHeuristicMatches,
  findAiSemanticMatch,
  calculateTokenSimilarity,
  calculateStringSimilarity
};
