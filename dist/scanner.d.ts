/**
 * DOM Scanner for Internal Anchor Links and ID Targets
 */
export interface TargetElementInfo {
    id: string;
    tagName: string;
    textContent: string;
    isHeading: boolean;
}
export interface AnchorLinkInfo {
    href: string;
    targetId: string;
    anchorText: string;
    locationInfo?: string;
    isValid: boolean;
    element?: Element;
}
export interface ScanSummary {
    totalLinks: number;
    validCount: number;
    brokenCount: number;
    validLinks: AnchorLinkInfo[];
    brokenLinks: AnchorLinkInfo[];
    allTargets: TargetElementInfo[];
    timestamp: number;
}
/**
 * Normalizes an anchor target ID from an href string.
 * Example: "#installation-guide" -> "installation-guide"
 * Example: "#" -> ""
 */
export declare function extractTargetId(href: string): string;
/**
 * Scans a given document or root element for all registered ID targets.
 */
export declare function scanDomTargets(root?: ParentNode): TargetElementInfo[];
/**
 * Scans a given document or root element for all internal anchor links (href starting with #).
 */
export declare function scanAnchorLinks(root?: ParentNode, availableTargets?: TargetElementInfo[]): ScanSummary;
//# sourceMappingURL=scanner.d.ts.map