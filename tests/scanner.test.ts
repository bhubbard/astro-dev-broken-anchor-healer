import { describe, it, expect } from 'bun:test';
import { extractTargetId, scanDomTargets, scanAnchorLinks } from '../src/scanner.js';

describe('scanner - extractTargetId', () => {
  it('extracts clean target ID from standard anchor hrefs', () => {
    expect(extractTargetId('#installation-guide')).toBe('installation-guide');
    expect(extractTargetId('#features')).toBe('features');
    expect(extractTargetId('#')).toBe('');
    expect(extractTargetId('')).toBe('');
    expect(extractTargetId('/docs#quick-start')).toBe('quick-start');
  });

  it('decodes URI encoded anchor IDs', () => {
    expect(extractTargetId('#section%20one')).toBe('section one');
    expect(extractTargetId('#caf%C3%A9')).toBe('café');
  });
});

describe('scanner - scanDomTargets and scanAnchorLinks (DOM Mock)', () => {
  it('scans mock DOM elements and classifies valid and broken anchors', () => {
    const mockTargets = [
      { id: 'installation-guide', tagName: 'H2', textContent: 'Installation Guide', isHeading: true },
      { id: 'configuration', tagName: 'H2', textContent: 'Configuration', isHeading: true },
      { id: 'faq', tagName: 'SECTION', textContent: 'Frequently Asked Questions', isHeading: false },
    ];

    const mockRoot = {
      querySelectorAll(selector: string) {
        if (selector === '[id]') {
          return mockTargets.map((t) => ({
            getAttribute: (attr: string) => (attr === 'id' ? t.id : null),
            tagName: t.tagName,
            textContent: t.textContent,
          }));
        }
        if (selector === 'a[name]') {
          return [];
        }
        if (selector === 'a[href^="#"]') {
          return [
            {
              getAttribute: (attr: string) => (attr === 'href' ? '#installation-guide' : null),
              textContent: 'Install now',
              parentElement: { tagName: 'P', className: 'intro' },
            },
            {
              getAttribute: (attr: string) => (attr === 'href' ? '#install-cli' : null), // Broken
              textContent: 'Install CLI tool',
              parentElement: { tagName: 'LI', className: 'nav-item' },
            },
            {
              getAttribute: (attr: string) => (attr === 'href' ? '#config-options' : null), // Broken
              textContent: 'Config Options',
              parentElement: null,
            },
            {
              getAttribute: (attr: string) => (attr === 'href' ? '#' : null), // Ignored empty
              textContent: 'Back to top',
              parentElement: null,
            },
          ];
        }
        return [];
      },
    } as unknown as ParentNode;

    const targets = scanDomTargets(mockRoot);
    expect(targets.length).toBe(3);
    expect(targets[0].id).toBe('installation-guide');

    const summary = scanAnchorLinks(mockRoot, targets);
    expect(summary.totalLinks).toBe(3); // 1 valid + 2 broken (empty # ignored)
    expect(summary.validCount).toBe(1);
    expect(summary.brokenCount).toBe(2);

    expect(summary.validLinks[0].targetId).toBe('installation-guide');
    expect(summary.brokenLinks[0].targetId).toBe('install-cli');
    expect(summary.brokenLinks[1].targetId).toBe('config-options');
  });

  it('handles empty or invalid DOM gracefully', () => {
    const emptyRoot = {} as ParentNode;
    const targets = scanDomTargets(emptyRoot);
    expect(targets).toEqual([]);

    const summary = scanAnchorLinks(emptyRoot);
    expect(summary.totalLinks).toBe(0);
    expect(summary.brokenCount).toBe(0);
  });
});
