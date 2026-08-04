/**
 * Pre-render visual baseline fixtures to static HTML files.
 *
 * This script runs via `npx tsx` (or `npm run build:visual`) before
 * Playwright tests start. It renders each fixture × theme combination
 * through the core render() pipeline and writes a self-contained
 * HTML file to tests/visual/fixtures/. Playwright then loads these
 * files via file:// URLs for screenshot comparison.
 *
 * Why pre-rendering instead of browser-side rendering:
 * The built dist artifacts use extensionless internal imports (a known
 * contracts package issue, see pitfall #105 in the kmd-web skill).
 * Node ESM resolution requires .js extensions, so importing
 * @axis-love/core from Playwright's test process fails. Vitest handles
 * this via its own module resolution, but Playwright runs in plain
 * Node. Pre-rendering via tsx (which handles extensionless imports)
 * sidesteps the issue entirely.
 *
 * Usage:
 *   npx tsx tests/visual/prerender.ts
 */

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { render } from "@axis-love/core";

// Re-use the fixture definitions from the harness
const VISUAL_FIXTURES = {
  headings:
    "# H1 Heading\n\n## H2 Heading\n\n### H3 Heading\n\n#### H4 Heading\n\n##### H5 Heading\n\n###### H6 Heading",
  tables:
    "| Name | Value | Notes |\n|------|-------|-------|\n| Alpha | 1 | First entry |\n| Beta | 2 | Second entry |\n| Gamma | 3 | Third entry |",
  // biome-ignore lint/suspicious/noTemplateCurlyInString: Markdown fixture contains JS template syntax as text
  code: '```typescript\nconst x: number = 42;\nfunction greet(name: string): string {\n  return `Hello, ${name}!`;\n}\nconsole.log(greet("World"));\n```',
  alerts:
    "> [!NOTE]\n> This is a note with important information.\n\n> [!WARNING]\n> This is a warning about potential issues.\n\n> [!IMPORTANT]\n> This is critical information.",
  mixed:
    "# Document Title\n\n## Introduction\n\nParagraph with **bold** and *italic* text, plus an `inline code` snippet.\n\n```python\ndef fibonacci(n):\n    a, b = 0, 1\n    for _ in range(n):\n        a, b = b, a + b\n    return a\n```\n\n| Column 1 | Column 2 |\n|----------|----------|\n| Cell A | Cell B |\n\n> [!NOTE]\n> A note in the mixed document.\n\n[External link](https://example.com)",
  math: "The equation $E = mc^2$ is famous.\n\nDisplay math:\n\n$$\\int_0^\\infty e^{-x^2} dx = \\frac{\\sqrt{\\pi}}{2}$$\n\nInline math $a^2 + b^2 = c^2$ in a sentence.",
  mermaid:
    "```mermaid\ngraph TD\n    A[Start] --> B{Decision}\n    B -->|Yes| C[Action 1]\n    B -->|No| D[Action 2]\n    C --> E[End]\n    D --> E\n```",
} as const;

type VisualFixtureName = keyof typeof VISUAL_FIXTURES;
type Theme = "light" | "dark";
type Viewport = "desktop" | "narrow";

const FIXTURE_NAMES = Object.keys(VISUAL_FIXTURES) as VisualFixtureName[];
const THEMES: Theme[] = ["light", "dark"];
const VIEWPORTS: Viewport[] = ["desktop", "narrow"];

function getInlinedCss(): string {
  const repoRoot = process.cwd();
  const generatedTokens = readFileSync(
    join(repoRoot, "packages", "styles", "generated", "tokens.css"),
    "utf-8",
  );
  const stylesCss = readFileSync(
    join(repoRoot, "packages", "styles", "src", "styles.css"),
    "utf-8",
  );
  // Remove @import "./tokens.css" — we inline generated tokens directly
  const stylesWithoutImport = stylesCss.replace(/@import\s+["']\.\/tokens\.css["'];?\s*/g, "");
  // Remove @import "./generated/tokens.css" from tokens.css shim if present
  const generatedTokensClean = generatedTokens.replace(
    /@import\s+["']\.\/generated\/tokens\.css["'];?\s*/g,
    "",
  );
  return `${generatedTokensClean}\n${stylesWithoutImport}`;
}

function buildTestPage(renderedHtml: string, theme: Theme, viewport: Viewport): string {
  const css = getInlinedCss();
  const themeAttr = `data-kmd-theme="${theme}"`;
  const containerWidth = viewport === "narrow" ? "375px" : "100%";

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>kmd-web visual baseline — ${theme} — ${viewport}</title>
  <style>
    /* Reset + neutral page background */
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body {
      background: #1a1c1f;
      min-height: 100vh;
      font-family: "Inter", system-ui, -apple-system, sans-serif;
    }
    /* Inlined kmd-web styles (tokens + scoped reader CSS) */
    ${css}
  </style>
</head>
<body>
  <div class="kmd-reader" ${themeAttr} style="width: ${containerWidth}; padding: 24px; min-height: 100vh;">
    <div class="kmd-content">
      ${renderedHtml}
    </div>
  </div>
</body>
</html>`;
}

async function main(): Promise<void> {
  const outputDir = join(process.cwd(), "tests", "visual", "fixtures");
  mkdirSync(outputDir, { recursive: true });

  let count = 0;
  for (const fixtureName of FIXTURE_NAMES) {
    const source = VISUAL_FIXTURES[fixtureName];
    const result = await render(source);
    const html = result.html;

    for (const theme of THEMES) {
      for (const viewport of VIEWPORTS) {
        const page = buildTestPage(html, theme, viewport);
        const filename = `${fixtureName}-${theme}-${viewport}.html`;
        writeFileSync(join(outputDir, filename), page, "utf-8");
        count++;
      }
    }
  }

  console.log(`Pre-rendered ${count} fixture HTML files to ${outputDir}`);
}

main().catch((err) => {
  console.error("Pre-render failed:", err);
  process.exit(1);
});
