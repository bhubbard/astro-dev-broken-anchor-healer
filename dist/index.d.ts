/**
 * Astro Integration: Broken Anchor Healer
 */
import type { AstroIntegration } from 'astro';
export interface BrokenAnchorHealerOptions {
    /**
     * Whether to automatically run semantic link healing on toolbar open.
     * @default true
     */
    autoHeal?: boolean;
}
export * from './scanner.js';
export * from './matcher.js';
export declare function brokenAnchorHealer(options?: BrokenAnchorHealerOptions): AstroIntegration;
export default brokenAnchorHealer;
//# sourceMappingURL=index.d.ts.map