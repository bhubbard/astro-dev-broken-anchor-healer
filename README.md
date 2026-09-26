# astro-dev-broken-anchor-healer

[![npm version](https://img.shields.io/npm/v/astro-dev-broken-anchor-healer.svg?style=flat-square)](https://www.npmjs.com/package/astro-dev-broken-anchor-healer)
[![Astro](https://img.shields.io/badge/Astro-5.x%20%7C%206.x%20%7C%207.x-FF5D01?style=flat-square&logo=astro)](https://astro.build)
[![Chrome AI](https://img.shields.io/badge/Chrome%20Built--in%20AI-Gemini%20Nano-4285F4?style=flat-square&logo=googlechrome)](https://developer.chrome.com/docs/ai/built-in)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](https://opensource.org/licenses/MIT)
[![Live Demo](https://img.shields.io/badge/Live%20Demo-code.brandonhubbard.com-brightgreen?logo=github)](https://code.brandonhubbard.com/astro-dev-broken-anchor-healer/)

**astro-dev-broken-anchor-healer** is an intelligent Astro Dev Toolbar integration that audits all internal anchor links (`<a href="#...">`) on your active pages against registered DOM `id` targets. When broken or renamed anchor targets are detected, it prompts **Gemini Nano** (`window.ai.languageModel`) on-device to semantically match the intended heading and offers one-click DOM healing right from your browser toolbar.

> 🎮 **Live Interactive Visualizer & Demo:** [astro-dev-broken-anchor-healer on code.brandonhubbard.com](https://code.brandonhubbard.com/astro-dev-broken-anchor-healer/)

---

## ✨ Key Features

- 🔍 **Real-Time Anchor Link Audit**: Scans active page DOM for all `a[href^="#"]` links and verifies them against DOM `id` targets and headings.
- 🧠 **On-Device Gemini Nano AI**: Leverages Chrome Built-in AI (`window.ai.languageModel`) to understand contextual intent (e.g. mapping `#install-cli` to `#installation-guide`).
- ⚡ **Multi-Tiered Fallback Engine**: If Chrome AI is unavailable, seamlessly uses slug containment, token overlap (Jaccard), and Levenshtein edit distance algorithms.
- 🛠️ **Interactive Dev Toolbar Dashboard**:
  - Live count of total, healthy, and broken anchor links.
  - Recommendation cards with confidence scores and reasoning.
  - **Apply Fix**: Instantly heals the anchor `href` in the live DOM.
  - **Inspect Heading**: Smoothly scrolls and highlights the target element on the page.
  - **Batch Fix All**: Repair all broken anchors in one click.
- 🚀 **Zero Cloud Dependency**: 100% private, on-device AI execution with 0ms network latency.

---

## 🏗️ Architecture

```mermaid
flowchart TD
    A[Page Loaded in Astro Dev Mode] --> B[Astro Dev Toolbar: Anchor Healer App]
    B --> C[DOM Scanner: Find a[href^='#'] & DOM elements with id]
    C --> D{Are target IDs present in DOM?}
    D -- Yes --> E[Mark Anchor as Valid ✅]
    D -- No --> F[Broken Anchor Detected ❌]
    F --> G{Chrome Built-in AI Available?}
    G -- Yes (Gemini Nano) --> H[Prompt window.ai.languageModel with Target Headings]
    G -- No (Fallback) --> I[Run Token & Levenshtein Heuristic Matcher]
    H --> J[Generate Semantic Recommendation & Confidence]
    I --> J
    J --> K[Display Interactive Healer Card in Toolbar UI]
    K --> L[Developer clicks 'Apply Fix' or 'Inspect Heading']
    L --> M[Update DOM href in real-time]
```

---

## 📦 Installation

```bash
# Using bun
bun add -d astro-dev-broken-anchor-healer

# Using pnpm
pnpm add -D astro-dev-broken-anchor-healer

# Using npm
npm install --save-dev astro-dev-broken-anchor-healer
```

---

## ⚙️ Quick Start

Add the integration into your `astro.config.mjs`:

```typescript
import { defineConfig } from 'astro/config';
import brokenAnchorHealer from 'astro-dev-broken-anchor-healer';

export default defineConfig({
  integrations: [
    brokenAnchorHealer(),
  ],
});
```

Start your dev server:
```bash
bun astro dev
```

Open your browser and look for the **Anchor Healer** icon in the Astro Dev Toolbar at the bottom of the page.

---

## 🧩 Enabling Chrome Built-in AI (Gemini Nano)

To utilize on-device Gemini Nano semantic matching in Google Chrome:

1. Use **Google Chrome Canary / Dev** (or Chrome 128+ with Prompt API).
2. Open `chrome://flags/#prompt-api-for-gemini-nano` and set to **Enabled**.
3. Open `chrome://flags/#optimization-guide-on-device-model` and set to **Enabled (BypassPerfRequirement)**.
4. Restart Chrome.
5. Visit `chrome://components` and ensure **Optimization Guide On Device Model** is updated to the latest version.

> **Note**: When running in standard browsers without Chrome AI enabled, **astro-dev-broken-anchor-healer** automatically falls back to its heuristic slug & edit-distance matching engine.

---

## 💻 Programmatic Usage

You can also use the scanner and matcher programmatically in custom scripts or tests:

```typescript
import { scanAnchorLinks, scanDomTargets } from 'astro-dev-broken-anchor-healer/scanner';
import { healAllBrokenAnchors, healBrokenAnchor } from 'astro-dev-broken-anchor-healer/matcher';

// 1. Scan DOM targets and anchors
const targets = scanDomTargets(document);
const scan = scanAnchorLinks(document, targets);

console.log(`Found ${scan.brokenCount} broken anchor links.`);

// 2. Heal broken anchors
const healed = await healAllBrokenAnchors(scan.brokenLinks, targets);

for (const item of healed) {
  if (item.topMatch) {
    console.log(
      `Broken #${item.brokenLink.targetId} -> Suggested #${item.topMatch.targetId} (${Math.round(item.topMatch.confidence * 100)}% confidence)`
    );
  }
}
```

---

## 🧪 Running Tests

```bash
bun test
bun run typecheck
```

---

## 📄 License

[MIT](LICENSE) © [bhubbard](https://github.com/bhubbard)
