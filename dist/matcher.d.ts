/**
 * Semantic and Heuristic Matcher for Broken Anchor Link Healing
 */
import type { AnchorLinkInfo, TargetElementInfo } from './scanner.js';
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
export declare function levenshteinDistance(a: string, b: string): number;
/**
 * Calculates normalized similarity (0.0 to 1.0) between two strings.
 */
export declare function calculateStringSimilarity(a: string, b: string): number;
/**
 * Tokenizes a string by splitting kebab-case, snake_case, camelCase, and spaces.
 */
export declare function tokenize(str: string): string[];
/**
 * Computes Jaccard token overlap between two strings.
 */
export declare function calculateTokenSimilarity(a: string, b: string): number;
/**
 * Performs heuristic search to find candidate matches for a broken anchor target ID.
 */
export declare function findHeuristicMatches(brokenTargetId: string, anchorText: string, availableTargets: TargetElementInfo[], limit?: number): MatchRecommendation[];
/**
 * Checks whether Chrome Built-in AI (window.ai.languageModel) is available on the current device.
 */
export declare function isChromeAIAvailable(): Promise<boolean>;
/**
 * Uses Gemini Nano (window.ai.languageModel) to semantically match a broken anchor link
 * against valid DOM targets.
 */
export declare function findAiSemanticMatch(brokenTargetId: string, anchorText: string, availableTargets: TargetElementInfo[]): Promise<MatchRecommendation | null>;
/**
 * Heals a single broken anchor link using Gemini Nano semantic analysis if available,
 * falling back to heuristic matching algorithms.
 */
export declare function healBrokenAnchor(brokenLink: AnchorLinkInfo, availableTargets: TargetElementInfo[], options?: {
    enableAI?: boolean;
}): Promise<HealedAnchorResult>;
/**
 * Heals all broken anchor links in batch.
 */
export declare function healAllBrokenAnchors(brokenLinks: AnchorLinkInfo[], availableTargets: TargetElementInfo[], options?: {
    enableAI?: boolean;
}): Promise<HealedAnchorResult[]>;
//# sourceMappingURL=matcher.d.ts.map