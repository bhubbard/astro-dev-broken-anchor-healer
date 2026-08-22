import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import {
  levenshteinDistance,
  calculateStringSimilarity,
  tokenize,
  calculateTokenSimilarity,
  findHeuristicMatches,
  findAiSemanticMatch,
  healBrokenAnchor,
  healAllBrokenAnchors,
} from '../src/matcher.js';
import type { TargetElementInfo, AnchorLinkInfo } from '../src/scanner.js';

describe('matcher - string & distance utilities', () => {
  it('computes accurate Levenshtein distance', () => {
    expect(levenshteinDistance('kitten', 'sitting')).toBe(3);
    expect(levenshteinDistance('anchor', 'anchor')).toBe(0);
    expect(levenshteinDistance('install-cli', 'installation-guide')).toBe(9);
  });

  it('calculates string similarity normalized between 0 and 1', () => {
    expect(calculateStringSimilarity('install', 'install')).toBe(1.0);
    expect(calculateStringSimilarity('install', 'installation')).toBeGreaterThan(0.5);
    expect(calculateStringSimilarity('abc', 'xyz')).toBe(0);
  });

  it('tokenizes identifiers across camelCase, kebab-case, snake_case', () => {
    expect(tokenize('quickStartGuide')).toEqual(['quick', 'start', 'guide']);
    expect(tokenize('install-cli_tool.v2')).toEqual(['install', 'cli', 'tool', 'v2']);
  });

  it('calculates Jaccard token similarity', () => {
    const sim = calculateTokenSimilarity('install-cli-tools', 'how to install cli');
    expect(sim).toBeGreaterThanOrEqual(0.4);
  });
});

describe('matcher - heuristic recommendations', () => {
  const sampleTargets: TargetElementInfo[] = [
    { id: 'installation-guide', tagName: 'H2', textContent: 'Installation Guide', isHeading: true },
    { id: 'configuration-options', tagName: 'H2', textContent: 'Configuration Options & Settings', isHeading: true },
    { id: 'cli-commands', tagName: 'H3', textContent: 'CLI Commands Reference', isHeading: true },
    { id: 'troubleshooting', tagName: 'H2', textContent: 'Troubleshooting & FAQ', isHeading: true },
  ];

  it('finds best matching targets using slug and token heuristics', () => {
    const matches = findHeuristicMatches('installation', 'Get Started with Installation', sampleTargets);
    expect(matches.length).toBeGreaterThan(0);
    expect(matches[0].targetId).toBe('installation-guide');
  });

  it('suggests cli-commands when broken anchor references cli', () => {
    const matches = findHeuristicMatches('cli-commands-ref', 'CLI Commands', sampleTargets);
    expect(matches.length).toBeGreaterThan(0);
    expect(matches[0].targetId).toBe('cli-commands');
  });

  it('returns empty array when no suitable match is found', () => {
    const matches = findHeuristicMatches('completely-unrelated-random-id', 'Random', sampleTargets);
    expect(matches.length).toBe(0);
  });
});

describe('matcher - Gemini Nano AI Semantic Resolution & Fallbacks', () => {
  const sampleTargets: TargetElementInfo[] = [
    { id: 'installation-guide', tagName: 'H2', textContent: 'Installation Guide', isHeading: true },
    { id: 'api-reference', tagName: 'H2', textContent: 'Full API Reference', isHeading: true },
  ];

  const brokenLink: AnchorLinkInfo = {
    href: '#install-cli',
    targetId: 'install-cli',
    anchorText: 'Setup CLI and install package',
    isValid: false,
  };

  afterEach(() => {
    delete (globalThis as unknown as { window?: unknown }).window;
  });

  it('resolves semantic match using Gemini Nano window.ai if available', async () => {
    // Mock window.ai with Gemini Nano languageModel
    (globalThis as unknown as { window: unknown }).window = {
      ai: {
        languageModel: {
          capabilities: async () => ({ available: 'readily' }),
          create: async () => ({
            prompt: async () => JSON.stringify({
              targetId: 'installation-guide',
              confidence: 0.95,
              reason: 'Heading "Installation Guide" closely matches "Setup CLI and install package"',
            }),
            destroy: () => {},
          }),
        },
      },
    };

    const aiMatch = await findAiSemanticMatch(
      brokenLink.targetId,
      brokenLink.anchorText,
      sampleTargets
    );

    expect(aiMatch).not.toBeNull();
    expect(aiMatch?.targetId).toBe('installation-guide');
    expect(aiMatch?.strategy).toBe('ai:gemini-nano');
    expect(aiMatch?.confidence).toBe(0.95);

    const healed = await healBrokenAnchor(brokenLink, sampleTargets);
    expect(healed.aiUsed).toBe(true);
    expect(healed.topMatch?.targetId).toBe('installation-guide');
  });

  it('gracefully falls back to heuristic matching if window.ai is missing or throws', async () => {
    // Window exists but without ai
    (globalThis as unknown as { window: unknown }).window = {};

    const healed = await healBrokenAnchor(brokenLink, sampleTargets);
    expect(healed.aiUsed).toBe(false);
    expect(healed.topMatch).toBeDefined();
    expect(healed.topMatch?.strategy).toContain('heuristic');
  });

  it('heals multiple broken links in batch', async () => {
    const brokenLinks: AnchorLinkInfo[] = [
      { href: '#installation', targetId: 'installation', anchorText: 'Install', isValid: false },
      { href: '#api', targetId: 'api', anchorText: 'API Docs', isValid: false },
    ];

    const results = await healAllBrokenAnchors(brokenLinks, sampleTargets, { enableAI: false });
    expect(results.length).toBe(2);
    expect(results[0].topMatch?.targetId).toBe('installation-guide');
    expect(results[1].topMatch?.targetId).toBe('api-reference');
  });
});
