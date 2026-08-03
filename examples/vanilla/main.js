// Vanilla ESM example for @axis-love/kmd-web.
//
// Demonstrates:
// - Importing `render` and the styles from the convenience package.
// - Rendering a Markdown string to a container element.
// - Accessing outline, diagnostics, and detectedFeatures from RenderResult.
// - Handling external links with a simple click handler (no innerHTML).
//
// All dynamic text uses textContent — no innerHTML outside the library.

import { render } from "@axis-love/kmd-web";
import "@axis-love/kmd-web/styles.css";

// ---------------------------------------------------------------------------
// Sample Markdown source
// ---------------------------------------------------------------------------

const markdown = `# Hello from kmd-web

This is a **vanilla ESM** example using the \`@axis-love/kmd-web\` package.

## Features

- GFM tables, task lists, and alerts
- Math via KaTeX
- Mermaid diagrams
- Syntax-highlighted code

\`\`\`ts
function greet(name: string): string {
  return \`Hello, \${name}!\`;
}
\`\`\`

> [!NOTE]
> This is a GitHub-style alert block.

## Links

- [External link to example.com](https://example.com)
- [Internal heading link](#features)

## Table

| Feature | Supported |
|---------|-----------|
| Tables  | ✅        |
| Math    | ✅        |

## Math

Inline math: $E = mc^2$

Block math:

$$
\\int_0^1 x^2 \\, dx = \\frac{1}{3}
$$
`;

// ---------------------------------------------------------------------------
// Render
// ---------------------------------------------------------------------------

const container = document.getElementById("reader");
if (!container) {
  throw new Error("Reader container not found");
}

const diagnosticList = document.getElementById("diagnostic-list");
const outlineList = document.getElementById("outline-list");
const featureList = document.getElementById("feature-list");

try {
  const result = await render(markdown, {
    features: {
      codeHighlighting: true,
      mermaid: true,
      math: true,
      designDoc: true,
    },
    security: {
      allowRemoteImages: false,
    },
  });

  // The library produces sanitized HTML — safe to inject into the container.
  container.innerHTML = result.html;

  // --- Outline ---
  // Each entry has { level, text, slug }. We use textContent for all text.
  if (outlineList) {
    for (const entry of result.outline) {
      const li = document.createElement("li");
      const a = document.createElement("a");
      a.href = `#${entry.slug}`;
      a.textContent = `${"  ".repeat(entry.level - 1)}${entry.text}`;
      a.addEventListener("click", (e) => {
        e.preventDefault();
        const target = container.querySelector(`[id="${entry.slug}"]`);
        if (target) {
          target.scrollIntoView({ behavior: "smooth" });
        }
      });
      li.appendChild(a);
      outlineList.appendChild(li);
    }
  }

  // --- Diagnostics ---
  // Each diagnostic has { severity, message, line?, column?, code? }.
  if (diagnosticList) {
    if (result.diagnostics.length === 0) {
      const li = document.createElement("li");
      li.textContent = "No diagnostics.";
      diagnosticList.appendChild(li);
    } else {
      for (const diag of result.diagnostics) {
        const li = document.createElement("li");
        const location =
          diag.line !== undefined
            ? ` (line ${diag.line}${diag.column !== undefined ? `, col ${diag.column}` : ""})`
            : "";
        li.textContent = `[${diag.severity}] ${diag.message}${location}`;
        diagnosticList.appendChild(li);
      }
    }
  }

  // --- Detected Features ---
  // DetectedFeatures is an object with boolean flags.
  if (featureList) {
    const features = result.detectedFeatures;
    const featureMap = [
      ["hasMath", "Math"],
      ["hasMermaid", "Mermaid"],
      ["hasDesignDoc", "Design Doc"],
      ["hasCodeHighlighting", "Code Highlighting"],
      ["hasTables", "Tables"],
      ["hasTaskLists", "Task Lists"],
      ["hasFootnotes", "Footnotes"],
      ["hasAlerts", "Alerts"],
    ];
    for (const [key, label] of featureMap) {
      const li = document.createElement("li");
      li.textContent = `${label}: ${features[key] ? "yes" : "no"}`;
      featureList.appendChild(li);
    }
  }

  // Log the full result for inspection
  console.log("RenderResult:", {
    rendererVersion: result.rendererVersion,
    metadata: result.metadata,
    assetCount: result.assets.length,
    linkCount: result.links.length,
  });
} catch (error) {
  console.error("Render failed:", error);
  const li = document.createElement("li");
  li.textContent = `Error: ${error instanceof Error ? error.message : String(error)}`;
  if (diagnosticList) {
    diagnosticList.appendChild(li);
  }
}

// ---------------------------------------------------------------------------
// Link handler — intercept clicks on external links in the rendered content.
// Uses a single delegated event listener on the document. The library's
// LinkPolicy already handles classification, but this shows how a host
// can implement its own simple external link handler when using the
// low-level render() API (which does not attach link interception).
// ---------------------------------------------------------------------------

document.addEventListener("click", (event) => {
  const anchor = event.target instanceof Element ? event.target.closest("a") : null;
  if (!anchor) return;

  const href = anchor.getAttribute("href");
  if (!href) return;

  // Only handle external links (http/https/mailto/tel).
  if (
    href.startsWith("http://") ||
    href.startsWith("https://") ||
    href.startsWith("mailto:") ||
    href.startsWith("tel:")
  ) {
    event.preventDefault();
    // Open in a new window with noopener for security.
    window.open(href, "_blank", "noopener,noreferrer");
  }
});
