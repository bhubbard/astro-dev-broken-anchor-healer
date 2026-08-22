/**
 * Semantic and Heuristic Matcher for Broken Anchor Link Healing
 */

import type { AnchorLinkInfo, TargetElementInfo } from './scanner.js';
import type { AILanguageModel } from './chrome-ai.d.ts';

export interface MatchRecommendation {
  targetId: string;
  confidence: number;
  strategy: 'exact' | 'heuristic:slug' | 'heuristic:levenshtein' | 'heuristic:token' | 'ai:gemini-nano';
  reason: string;
  targetElement?: TargetElementInfo;
}

export interface HealedAnchorResult {
  brokenLink: AnchorLinkInfo;
  topMatch?: MatchRecommendation;
  allMatches: MatchRecommendation[];
  aiUsed: boolean;
  aiAvailable: boolean;
}

/**
 * Calculates Levenshtein edit distance between two strings.
 */
export function levenshteinDistance(a: string, b: string): number {
  const strA = a.toLowerCase();
  const strB = b.toLowerCase();
  const m = strA.length;
  const n = strB.length;

  if (m === 0) return n;
  if (n === 0) return m;

  const dp: number[][] = Array.from({ length: m + 1 }, () =>
    new Array(n + 1).fill(0)
  );

  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = strA[i - 1] === strB[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1, // deletion
        dp[i][j - 1] + 1, // insertion
        dp[i - 1][j - 1] + cost // substitution
      );
    }
  }

  return dp[m][n];
}

/**
 * Calculates normalized similarity (0.0 to 1.0) between two strings.
 */
export function calculateStringSimilarity(a: string, b: string): number {
  const normA = a.toLowerCase().trim();
  const normB = b.toLowerCase().trim();
  if (normA === normB) return 1.0;
  if (!normA || !normB) return 0.0;

  const maxLen = Math.max(normA.length, normB.length);
  const distance = levenshteinDistance(normA, normB);
  return Math.max(0, 1 - distance / maxLen);
}

/**
 * Tokenizes a string by splitting kebab-case, snake_case, camelCase, and spaces.
 */
export function tokenize(str: string): string[] {
  return str
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/[-_.:/]/g, ' ')
    .toLowerCase()
    .split(/\s+/)
    .filter((token) => token.length > 0);
}

/**
 * Computes Jaccard token overlap between two strings.
 */
export function calculateTokenSimilarity(a: string, b: string): number {
  const tokensA = new Set(tokenize(a));
  const tokensB = new Set(tokenize(b));

  if (tokensA.size === 0 || tokensB.size === 0) return 0;

  let intersectionCount = 0;
  tokensA.forEach((token) => {
    if (tokensB.has(token)) {
      intersectionCount++;
    }
  });

  const unionCount = new Set([...tokensA, ...tokensB]).size;
  return unionCount === 0 ? 0 : intersectionCount / unionCount;
}

/**
 * Performs heuristic search to find candidate matches for a broken anchor target ID.
 */
export function findHeuristicMatches(
  brokenTargetId: string,
  anchorText: string,
  availableTargets: TargetElementInfo[],
  limit = 3
): MatchRecommendation[] {
  if (!brokenTargetId || availableTargets.length === 0) {
    return [];
  }

  const results: MatchRecommendation[] = [];
  const normalizedBroken = brokenTargetId.toLowerCase().trim();

  for (const target of availableTargets) {
    const normTargetId = target.id.toLowerCase().trim();
    const normHeadingText = target.textContent.toLowerCase().trim();

    // 1. Direct Slug Substring or Containment
    if (normTargetId.includes(normalizedBroken) || normalizedBroken.includes(normTargetId)) {
      const confidence = 0.85 * (Math.min(normTargetId.length, normalizedBroken.length) / Math.max(normTargetId.length, normalizedBroken.length));
      results.push({
        targetId: target.id,
        confidence: Math.round(confidence * 100) / 100,
        strategy: 'heuristic:slug',
        reason: `Target ID contains matching slug components`,
        targetElement: target,
      });
      continue;
    }

    // 2. Token overlap with target ID or heading text
    const idTokenSim = calculateTokenSimilarity(brokenTargetId, target.id);
    const textTokenSim = anchorText ? calculateTokenSimilarity(anchorText, target.textContent) : 0;
    const combinedTokenSim = Math.max(idTokenSim, textTokenSim);

    if (combinedTokenSim >= 0.5) {
      results.push({
        targetId: target.id,
        confidence: Math.round(combinedTokenSim * 0.8 * 100) / 100,
        strategy: 'heuristic:token',
        reason: `High word/token overlap with heading content "${target.textContent}"`,
        targetElement: target,
      });
      continue;
    }

    // 3. Levenshtein edit distance similarity
    const idLevSim = calculateStringSimilarity(brokenTargetId, target.id);
    const headingLevSim = anchorText ? calculateStringSimilarity(anchorText, target.textContent) : 0;
    const bestLevSim = Math.max(idLevSim, headingLevSim);

    if (bestLevSim >= 0.45) {
      results.push({
        targetId: target.id,
        confidence: Math.round(bestLevSim * 0.75 * 100) / 100,
        strategy: 'heuristic:levenshtein',
        reason: `Fuzzy character similarity (${Math.round(bestLevSim * 100)}%) with #${target.id}`,
        targetElement: target,
      });
    }
  }

  // Sort descending by confidence
  results.sort((a, b) => b.confidence - a.confidence);

  return results.slice(0, limit);
}

/**
 * Checks whether Chrome Built-in AI (window.ai.languageModel) is available on the current device.
 */
export async function isChromeAIAvailable(): Promise<boolean> {
  if (typeof window === 'undefined') return false;
  const ai = (window as unknown as { ai?: { languageModel?: { capabilities: () => Promise<{ available: string }> } } }).ai;
  if (!ai?.languageModel?.capabilities) return false;

  try {
    const caps = await ai.languageModel.capabilities();
    return caps.available === 'readily' || caps.available === 'after-download';
  } catch {
    return false;
  }
}

/**
 * Uses Gemini Nano (window.ai.languageModel) to semantically match a broken anchor link
 * against valid DOM targets.
 */
export async function findAiSemanticMatch(
  brokenTargetId: string,
  anchorText: string,
  availableTargets: TargetElementInfo[]
): Promise<MatchRecommendation | null> {
  if (typeof window === 'undefined') return null;
  const ai = (window as unknown as { ai?: { languageModel?: { create: (opts: unknown) => Promise<AILanguageModel> } } }).ai;
  if (!ai?.languageModel?.create || availableTargets.length === 0) {
    return null;
  }

  try {
    const targetCandidates = availableTargets.map((t) => ({
      id: t.id,
      text: t.textContent || t.id,
      tag: t.tagName,
    }));

    const systemPrompt = `You are a web document semantic link resolver. Given a broken internal anchor link ID and its link text, your job is to find the single best matching destination element ID from a provided list of valid DOM targets.
Return ONLY valid JSON matching this schema:
{"targetId": "<matching-id>", "confidence": <0.0-1.0>, "reason": "<brief explanation>"}
If no targets match with reasonable confidence, set targetId to "" and confidence to 0.`;

    const prompt = `Broken Anchor Target: "#${brokenTargetId}"
Link Text: "${anchorText || 'N/A'}"

Available DOM Targets:
${JSON.stringify(targetCandidates, null, 2)}

Respond with JSON only:`;

    const session = await ai.languageModel.create({
      systemPrompt,
      temperature: 0.1,
      topK: 1,
    });

    const responseText = await session.prompt(prompt);
    session.destroy();

    // Clean markdown code fence if present
    const cleanJson = responseText
      .replace(/```json/gi, '')
      .replace(/```/g, '')
      .trim();

    const parsed = JSON.parse(cleanJson) as { targetId?: string; confidence?: number; reason?: string };

    if (parsed.targetId && availableTargets.some((t) => t.id === parsed.targetId)) {
      const targetElement = availableTargets.find((t) => t.id === parsed.targetId);
      return {
        targetId: parsed.targetId,
        confidence: typeof parsed.confidence === 'number' ? Math.min(1.0, Math.max(0, parsed.confidence)) : 0.9,
        strategy: 'ai:gemini-nano',
        reason: parsed.reason || `Gemini Nano semantically matched #${brokenTargetId} to #${parsed.targetId}`,
        targetElement,
      };
    }
  } catch (err) {
    console.warn('[astro-dev-broken-anchor-healer] Gemini Nano inference failed or timed out:', err);
  }

  return null;
}

/**
 * Heals a single broken anchor link using Gemini Nano semantic analysis if available,
 * falling back to heuristic matching algorithms.
 */
export async function healBrokenAnchor(
  brokenLink: AnchorLinkInfo,
  availableTargets: TargetElementInfo[],
  options: { enableAI?: boolean } = { enableAI: true }
): Promise<HealedAnchorResult> {
  const heuristicMatches = findHeuristicMatches(
    brokenLink.targetId,
    brokenLink.anchorText,
    availableTargets,
    3
  );

  let aiMatch: MatchRecommendation | null = null;
  let aiAvailable = false;
  let aiUsed = false;

  if (options.enableAI !== false) {
    aiAvailable = await isChromeAIAvailable();
    if (aiAvailable) {
      aiMatch = await findAiSemanticMatch(
        brokenLink.targetId,
        brokenLink.anchorText,
        availableTargets
      );
      if (aiMatch) {
        aiUsed = true;
      }
    }
  }

  const allMatches: MatchRecommendation[] = [];

  if (aiMatch) {
    allMatches.push(aiMatch);
  }

  for (const hMatch of heuristicMatches) {
    if (!allMatches.some((m) => m.targetId === hMatch.targetId)) {
      allMatches.push(hMatch);
    }
  }

  // Sort by confidence
  allMatches.sort((a, b) => b.confidence - a.confidence);

  return {
    brokenLink,
    topMatch: allMatches[0],
    allMatches,
    aiUsed,
    aiAvailable,
  };
}

/**
 * Heals all broken anchor links in batch.
 */
export async function healAllBrokenAnchors(
  brokenLinks: AnchorLinkInfo[],
  availableTargets: TargetElementInfo[],
  options: { enableAI?: boolean } = { enableAI: true }
): Promise<HealedAnchorResult[]> {
  const results: HealedAnchorResult[] = [];
  for (const link of brokenLinks) {
    const healed = await healBrokenAnchor(link, availableTargets, options);
    results.push(healed);
  }
  return results;
}
