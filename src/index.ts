/**
 * Astro Integration: Broken Anchor Healer
 */

import type { AstroIntegration } from 'astro';
import { fileURLToPath } from 'node:url';

export interface BrokenAnchorHealerOptions {
  /**
   * Whether to automatically run semantic link healing on toolbar open.
   * @default true
   */
  autoHeal?: boolean;
}

export * from './scanner.js';
export * from './matcher.js';

export function brokenAnchorHealer(options: BrokenAnchorHealerOptions = {}): AstroIntegration {
  return {
    name: 'astro-dev-broken-anchor-healer',
    hooks: {
      'astro:config:setup': ({ addDevToolbarApp }) => {
        const isTypeScript = import.meta.url.endsWith('.ts');
        const appFile = isTypeScript ? './app.ts' : './app.js';
        const entrypoint = fileURLToPath(new URL(appFile, import.meta.url));

        addDevToolbarApp({
          id: 'astro-dev-broken-anchor-healer',
          name: 'Anchor Healer',
          icon: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path></svg>`,
          entrypoint,
        });
      },
    },
  };
}

export default brokenAnchorHealer;
