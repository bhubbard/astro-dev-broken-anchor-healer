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
export function extractTargetId(href: string): string {
  if (!href) return '';
  const hashIndex = href.indexOf('#');
  if (hashIndex === -1) return '';
  const rawTarget = href.substring(hashIndex + 1);
  try {
    return decodeURIComponent(rawTarget.trim());
  } catch {
    return rawTarget.trim();
  }
}

/**
 * Scans a given document or root element for all registered ID targets.
 */
export function scanDomTargets(root: ParentNode = document): TargetElementInfo[] {
  if (!root || typeof root.querySelectorAll !== 'function') {
    return [];
  }

  const elementsWithId = root.querySelectorAll('[id]');
  const targets: TargetElementInfo[] = [];
  const seenIds = new Set<string>();

  elementsWithId.forEach((el) => {
    const id = el.getAttribute('id')?.trim();
    if (id && !seenIds.has(id)) {
      seenIds.add(id);
      const tagName = el.tagName ? el.tagName.toUpperCase() : '';
      const isHeading = /^H[1-6]$/.test(tagName);
      const textContent = (el.textContent || '').replace(/\s+/g, ' ').trim();
      targets.push({
        id,
        tagName,
        textContent,
        isHeading,
      });
    }
  });

  // Also support older named anchors <a name="...">
  const elementsWithName = root.querySelectorAll('a[name]');
  elementsWithName.forEach((el) => {
    const name = el.getAttribute('name')?.trim();
    if (name && !seenIds.has(name)) {
      seenIds.add(name);
      targets.push({
        id: name,
        tagName: 'A',
        textContent: (el.textContent || '').replace(/\s+/g, ' ').trim(),
        isHeading: false,
      });
    }
  });

  return targets;
}

/**
 * Scans a given document or root element for all internal anchor links (href starting with #).
 */
export function scanAnchorLinks(
  root: ParentNode = document,
  availableTargets?: TargetElementInfo[]
): ScanSummary {
  const targets = availableTargets || scanDomTargets(root);
  const targetIdSet = new Set(targets.map((t) => t.id));

  // Also include standard browser anchors like top if needed
  targetIdSet.add('top');

  const validLinks: AnchorLinkInfo[] = [];
  const brokenLinks: AnchorLinkInfo[] = [];

  if (!root || typeof root.querySelectorAll !== 'function') {
    return {
      totalLinks: 0,
      validCount: 0,
      brokenCount: 0,
      validLinks: [],
      brokenLinks: [],
      allTargets: targets,
      timestamp: Date.now(),
    };
  }

  const anchorElements = root.querySelectorAll('a[href^="#"]');

  anchorElements.forEach((anchor) => {
    const href = anchor.getAttribute('href') || '';
    const targetId = extractTargetId(href);

    // Ignore placeholder links like href="#"
    if (!targetId) {
      return;
    }

    const anchorText = (anchor.textContent || '').replace(/\s+/g, ' ').trim();
    const isValid = targetIdSet.has(targetId);

    // Generate brief breadcrumb or parent info
    let locationInfo = '';
    if (anchor.parentElement) {
      const parentTag = anchor.parentElement.tagName.toLowerCase();
      const parentClass = anchor.parentElement.className
        ? `.${String(anchor.parentElement.className).trim().split(/\s+/)[0]}`
        : '';
      locationInfo = `<${parentTag}${parentClass}>`;
    }

    const linkInfo: AnchorLinkInfo = {
      href,
      targetId,
      anchorText,
      locationInfo,
      isValid,
      element: anchor,
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
    timestamp: Date.now(),
  };
}
