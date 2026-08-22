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
export {
  scanDomTargets,
  scanAnchorLinks,
  extractTargetId
};
