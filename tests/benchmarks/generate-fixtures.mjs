#!/usr/bin/env node
/**
 * Generate deterministic benchmark fixtures under tests/benchmarks/fixtures/.
 *
 * All fixtures are generated from seeded, repeatable logic so that
 * every run produces byte-identical output.  Run this script before
 * running benchmarks:
 *
 *   node tests/benchmarks/generate-fixtures.mjs
 *
 * The generated files are committed to the repository so CI does not
 * need to run the generator.  Re-run only when fixture shapes change.
 */

import { mkdirSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const fixturesDir = join(__dirname, "fixtures");

mkdirSync(fixturesDir, { recursive: true });

// ---------------------------------------------------------------------------
// Deterministic PRNG (mulberry32) for reproducible fixtures
// ---------------------------------------------------------------------------

/**
 * @param {number} seed
 * @returns {() => number}
 */
function mulberry32(seed) {
  let a = seed;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const rand = mulberry32(42);

/**
 * @param {string[]} arr
 * @returns {string}
 */
function pick(arr) {
  return arr[Math.floor(rand() * arr.length)];
}

// ---------------------------------------------------------------------------
// 1. small.md (~1 KB) — typical blog post
// ---------------------------------------------------------------------------

const small = `# Getting Started with kmd

kmd is a calm, typography-led Markdown reader designed for focus.

## Why kmd?

- Lightweight and fast
- No telemetry, no tracking
- Works offline by default
- Dark, light, and sepia themes

## Installation

Install the desktop app or use the web component:

\`\`\`bash
npm install @axis-love/kmd-web
\`\`\`

## Quick Start

Drop a Markdown file onto the window or use the command palette (\`Cmd+K\`).

> **Note:** kmd treats all Markdown as untrusted, even local files.

## Links

Here is an [external link](https://example.com) and a [relative one](./guide.md).

That is all you need to know to get started.
`;

// ---------------------------------------------------------------------------
// 2. medium.md (~50 KB) — documentation page
// ---------------------------------------------------------------------------

{
  const sections = [
    "Architecture Overview",
    "Package Boundaries",
    "Core Renderer Pipeline",
    "Browser Runtime",
    "React Integration",
    "Web Component",
    "Design Tokens",
    "Security Model",
    "Conformance Testing",
    "Release Process",
    "CI/CD Pipeline",
    "Bundle Budgets",
    "Performance Benchmarks",
    "Import Graph Rules",
    "Worker Bridge Pattern",
    "DOM Morphing Strategy",
    "Asset Lifecycle",
    "Link Policy",
    "Feature Coordination",
    "Scroll Tracking",
  ];

  const paragraphs = [
    "The kmd-web monorepo contains eleven packages organized in a layered architecture. Contracts define the shared types and schemas, core provides the DOM-free rendering engine, browser adds DOM enhancement, and the remaining packages provide React bindings, a web component, scoped styles, and optional feature integrations.",
    "Each package has explicit import boundaries enforced by the import graph tests. Core may only import contracts. Browser may import contracts and core. Feature packages may import contracts and core but never browser or react. This separation ensures that the baseline bundle never includes heavy optional dependencies.",
    "The rendering pipeline uses a unified processor with remark and rehype plugins. Source text is parsed into mdast, transformed to hast, sanitized, and stringified to HTML. Feature detection runs on the raw source before the pipeline to determine which optional enhancements to apply lazily.",
    "Security is a first-class concern. All Markdown is treated as untrusted. The sanitize step strips dangerous elements and attributes. A URL policy blocks javascript, vbscript, and other unsafe schemes. Raw HTML is limited to a small allowlist of inline elements.",
    "The browser runtime orchestrates DOM morphing, anchor navigation, scroll tracking, code copy enhancement, link policy, asset lifecycle, and feature coordination into a single BrowserReader lifecycle. Hosts create a reader, call update when the document changes, and dispose on unmount.",
  ];

  let md = "# kmd-web Documentation\n\n";
  md += "Comprehensive guide to the canonical JavaScript rendering engine.\n\n";

  for (let i = 0; i < sections.length; i++) {
    md += `## ${sections[i]}\n\n`;
    md += `${paragraphs[i % paragraphs.length]}\n\n`;
    md += `${paragraphs[(i + 2) % paragraphs.length]}\n\n`;

    // Add a code block to some sections
    if (i % 3 === 0) {
      md += "```ts\n";
      md += `// Example from ${sections[i]}\n`;
      md += "import { render } from \"@axis-love/core\";\n\n";
      md += "const result = await render(source);\n";
      md += "console.log(result.html);\n";
      md += "```\n\n";
    }

    // Add a list
    if (i % 2 === 0) {
      md += "Key points:\n\n";
      for (let j = 0; j < 4; j++) {
        md += `- Item ${j + 1}: ${pick(paragraphs).slice(0, 60)}...\n`;
      }
      md += "\n";
    }

    // Add a blockquote
    if (i % 4 === 0) {
      md += `> ${pick(paragraphs).slice(0, 80)}\n\n`;
    }
  }

  writeFileSync(join(fixturesDir, "medium.md"), md, "utf-8");
}

// ---------------------------------------------------------------------------
// 3. large.md (~1 MB) — generated large document
// ---------------------------------------------------------------------------

{
  const headingWords = [
    "Introduction", "Overview", "Details", "Analysis", "Summary",
    "Background", "Context", "Method", "Results", "Discussion",
    "Conclusion", "References", "Appendix", "Notes", "Remarks",
    "Configuration", "Setup", "Deployment", "Testing", "Optimization",
  ];

  const bodyWords = [
    "the", "system", "design", "implementation", "test", "build",
    "package", "module", "import", "export", "function", "class",
    "interface", "type", "schema", "config", "token", "render",
    "parse", "sanitize", "transform", "pipeline", "worker", "cache",
    "bridge", "reader", "browser", "react", "element", "core",
  ];

  let md = "# Large Document — Performance Benchmark Fixture\n\n";
  md += "This file is deterministically generated to be approximately 1 MB.\n\n";
  md += "[TOC]\n\n";

  // Target ~1MB: each section is ~5KB, need ~200 sections
  for (let s = 0; s < 1100; s++) {
    const h = headingWords[s % headingWords.length];
    md += `## ${h} ${s + 1}\n\n`;

    // 3 paragraphs per section, each ~10 sentences
    for (let p = 0; p < 3; p++) {
      let sentence = "";
      for (let w = 0; w < 40; w++) {
        sentence += pick(bodyWords) + " ";
      }
      md += sentence.trim() + ".\n\n";
    }

    // Code block every 5th section
    if (s % 5 === 0) {
      md += "```ts\n";
      md += `// Section ${s + 1} example\n`;
      md += `export function process_${s}(input: string): string {\n`;
      md += `  return input.trim().toLowerCase();\n`;
      md += "}\n";
      md += "```\n\n";
    }

    // Table every 7th section
    if (s % 7 === 0) {
      md += "| Field | Type | Description |\n";
      md += "|---|---|---|\n";
      for (let r = 0; r < 5; r++) {
        md += `| ${pick(bodyWords)} | ${pick(["string", "number", "boolean", "object"])} | ${pick(bodyWords)} |\n`;
      }
      md += "\n";
    }

    // List every 3rd section
    if (s % 3 === 0) {
      for (let l = 0; l < 5; l++) {
        md += `- ${pick(bodyWords)}: ${pick(bodyWords)} ${pick(bodyWords)}\n`;
      }
      md += "\n";
    }
  }

  writeFileSync(join(fixturesDir, "large.md"), md, "utf-8");
}

// ---------------------------------------------------------------------------
// 4. code-heavy.md — many fenced code blocks with various languages
// ---------------------------------------------------------------------------

{
  const languages = [
    "ts", "js", "py", "rs", "go", "java", "c", "cpp", "ruby", "sql",
    "bash", "yaml", "json", "html", "css", "swift", "kotlin", "scala",
  ];

  const snippets = {
    ts: `export function greet(name: string): string {\n  return \`Hello, \${name}!\`;\n}`,
    js: `function greet(name) {\n  return \`Hello, \${name}!\`;\n}`,
    py: `def greet(name):\n    return f"Hello, {name}!"`,
    rs: `fn greet(name: &str) -> String {\n    format!("Hello, {}!", name)\n}`,
    go: `func greet(name string) string {\n    return fmt.Sprintf("Hello, %s!", name)\n}`,
    java: `public String greet(String name) {\n    return "Hello, " + name + "!";\n}`,
    c: `char* greet(char* name) {\n    return name;\n}`,
    cpp: `std::string greet(std::string name) {\n    return "Hello, " + name;\n}`,
    ruby: `def greet(name)\n  "Hello, #{name}!"\nend`,
    sql: "SELECT * FROM users WHERE active = 1;",
    bash: "echo 'Hello, World!'",
    yaml: "name: kmd\nversion: 1.0",
    json: '{"name": "kmd", "version": 1}',
    html: "<p>Hello, World!</p>",
    css: ".kmd-reader { color: #333; }",
    swift: `func greet(_ name: String) -> String {\n    return "Hello, \\(name)!"\n}`,
    kotlin: `fun greet(name: String): String {\n    return "Hello, $name!"\n}`,
    scala: `def greet(name: String): String = {\n  s"Hello, $name!"\n}`,
  };

  let md = "# Code-Heavy Document\n\n";
  md += "This fixture contains many fenced code blocks in various languages.\n\n";

  for (let i = 0; i < 60; i++) {
    const lang = languages[i % languages.length];
    md += `## Code Example ${i + 1} (${lang})\n\n`;
    md += `This section demonstrates ${lang} syntax highlighting.\n\n`;
    md += `\`\`\`${lang}\n`;
    md += snippets[lang] + "\n";
    md += "```\n\n";
  }

  writeFileSync(join(fixturesDir, "code-heavy.md"), md, "utf-8");
}

// ---------------------------------------------------------------------------
// 5. diagram-heavy.md — many Mermaid diagrams
// ---------------------------------------------------------------------------

{
  const diagramTypes = [
    "graph TD",
    "graph LR",
    "sequenceDiagram",
    "stateDiagram-v2",
    "classDiagram",
    "flowchart TD",
    "flowchart LR",
    "erDiagram",
  ];

  let md = "# Diagram-Heavy Document\n\n";
  md += "This fixture contains many Mermaid diagrams.\n\n";

  for (let i = 0; i < 40; i++) {
    const type = diagramTypes[i % diagramTypes.length];
    md += `## Diagram ${i + 1}\n\n`;
    md += "```mermaid\n";
    md += `${type}\n`;

    if (type.startsWith("graph") || type.startsWith("flowchart")) {
      md += `  A[Start] --> B[Process ${i}]\n`;
      md += `  B --> C{Decision}\n`;
      md += `  C -->|Yes| D[Result 1]\n`;
      md += `  C -->|No| E[Result 2]\n`;
      md += `  D --> F[End]\n`;
      md += `  E --> F\n`;
    } else if (type === "sequenceDiagram") {
      md += `  participant Alice\n`;
      md += `  participant Bob\n`;
      md += `  Alice->>Bob: Hello\n`;
      md += `  Bob-->>Alice: Hi\n`;
      md += `  Alice->>Bob: How are you?\n`;
      md += `  Bob-->>Alice: Good!\n`;
    } else if (type === "stateDiagram-v2") {
      md += `  [*] --> Idle\n`;
      md += `  Idle --> Loading: Start\n`;
      md += `  Loading --> Ready: Done\n`;
      md += `  Loading --> Error: Fail\n`;
      md += `  Ready --> Idle: Reset\n`;
      md += `  Error --> Idle: Retry\n`;
      md += `  [*] --> Idle\n`;
    } else if (type === "classDiagram") {
      md += `  class Reader {\n    +render(): string\n    +dispose(): void\n  }\n`;
      md += `  class BrowserReader {\n    +update(source: string)\n  }\n`;
      md += `  Reader <|-- BrowserReader\n`;
    } else if (type === "erDiagram") {
      md += `  USER ||--o{ POST : writes\n`;
      md += `  POST ||--o{ COMMENT : has\n`;
      md += `  USER ||--o{ COMMENT : writes\n`;
    }

    md += "```\n\n";
    md += `Diagram ${i + 1} description text.\n\n`;
  }

  writeFileSync(join(fixturesDir, "diagram-heavy.md"), md, "utf-8");
}

// ---------------------------------------------------------------------------
// 6. design-heavy.md — DESIGN.md with many tokens
// ---------------------------------------------------------------------------

{
  let md = "---\n";
  md += "title: Design System\n";
  md += "type: design\n";
  md += "---\n\n";

  md += "# Design System\n\n";
  md += "A comprehensive design token specification.\n\n";

  md += "## Color\n\n";
  md += "| Token | Light | Dark |\n";
  md += "|---|---|---|\n";
  const colorNames = [
    "primary", "secondary", "tertiary", "surface", "background",
    "on-surface", "on-primary", "on-secondary", "outline", "error",
    "warning", "success", "info", "disabled", "hover",
  ];
  for (const name of colorNames) {
    md += `| ${name} | #${(Math.floor(rand() * 0xffffff)).toString(16).padStart(6, "0")} | #${(Math.floor(rand() * 0xffffff)).toString(16).padStart(6, "0")} |\n`;
  }

  md += "\n## Typography\n\n";
  md += "| Token | Value |\n";
  md += "|---|---|\n";
  md += "| font-family-body | Inter, system-ui, sans-serif |\n";
  md += "| font-family-mono | SF Mono, Fira Code, monospace |\n";
  md += "| font-size-xs | 12px |\n";
  md += "| font-size-sm | 14px |\n";
  md += "| font-size-md | 16px |\n";
  md += "| font-size-lg | 18px |\n";
  md += "| font-size-xl | 20px |\n";
  md += "| font-size-2xl | 24px |\n";
  md += "| font-size-3xl | 30px |\n";
  md += "| font-weight-normal | 400 |\n";
  md += "| font-weight-medium | 500 |\n";
  md += "| font-weight-bold | 700 |\n";
  md += "| line-height-tight | 1.25 |\n";
  md += "| line-height-normal | 1.5 |\n";
  md += "| line-height-relaxed | 1.75 |\n";

  md += "\n## Spacing\n\n";
  md += "| Token | Value |\n";
  md += "|---|---|\n";
  const spacing = ["xs", "sm", "md", "lg", "xl", "2xl", "3xl", "4xl"];
  for (const s of spacing) {
    md += `| space-${s} | ${4 * (spacing.indexOf(s) + 1)}px |\n`;
  }

  md += "\n## Radius\n\n";
  md += "| Token | Value |\n";
  md += "|---|---|\n";
  for (const r of ["sm", "md", "lg", "xl", "full"]) {
    md += `| radius-${r} | ${pick(["4px", "8px", "12px", "16px", "9999px"])} |\n`;
  }

  md += "\n## Shadow\n\n";
  md += "| Token | Value |\n";
  md += "|---|---|\n";
  for (let i = 0; i < 5; i++) {
    md += `| shadow-${i + 1} | 0 ${i + 1}px ${2 * (i + 1)}px rgba(0,0,0,0.${i + 1}) |\n`;
  }

  md += "\n## Components\n\n";
  md += "### Button\n\n";
  md += "```design\n";
  md += "component: Button\n";
  md += "padding: 8px 16px\n";
  md += "radius: 4px\n";
  md += "bg: var(--primary)\n";
  md += "color: var(--on-primary)\n";
  md += "```\n\n";

  md += "### Card\n\n";
  md += "```design\n";
  md += "component: Card\n";
  md += "padding: 16px\n";
  md += "radius: 8px\n";
  md += "shadow: var(--shadow-2)\n";
  md += "bg: var(--surface)\n";
  md += "```\n\n";

  // Add CSS section
  md += "## CSS\n\n";
  md += "```css\n";
  md += ".kmd-reader {\n";
  md += "  font-family: var(--font-family-body);\n";
  md += "  font-size: var(--font-size-md);\n";
  md += "  line-height: var(--line-height-normal);\n";
  md += "  color: var(--on-surface);\n";
  md += "  background: var(--surface);\n";
  md += "}\n";
  md += "```\n\n";

  writeFileSync(join(fixturesDir, "design-heavy.md"), md, "utf-8");
}

// ---------------------------------------------------------------------------
// 7. pathological.md — edge cases: deeply nested, many headings, huge tables
// ---------------------------------------------------------------------------

{
  let md = "# Pathological Document — Edge Cases\n\n";
  md += "This fixture stresses the parser with adversarial input.\n\n";

  // Deeply nested lists (50 levels)
  md += "## Deeply Nested Lists\n\n";
  for (let i = 0; i < 50; i++) {
    md += `${"  ".repeat(i)}- Level ${i + 1}\n`;
  }
  md += "\n";

  // Many headings (200)
  md += "## Many Headings\n\n";
  for (let i = 0; i < 200; i++) {
    md += `### Heading ${i + 1}\n\n`;
    md += `Paragraph under heading ${i + 1}.\n\n`;
  }

  // Huge table (100 rows, 10 columns)
  md += "## Huge Table\n\n";
  md += "| Col1 | Col2 | Col3 | Col4 | Col5 | Col6 | Col7 | Col8 | Col9 | Col10 |\n";
  md += "|---|---|---|---|---|---|---|---|---|---|\n";
  for (let r = 0; r < 100; r++) {
    let row = "";
    for (let c = 0; c < 10; c++) {
      row += `| cell-${r}-${c} `;
    }
    md += row + "|\n";
  }
  md += "\n";

  // Many links
  md += "## Many Links\n\n";
  for (let i = 0; i < 100; i++) {
    md += `[link ${i + 1}](https://example.com/page/${i + 1}) `;
  }
  md += "\n\n";

  // Many images
  md += "## Many Images\n\n";
  for (let i = 0; i < 50; i++) {
    md += `![image ${i + 1}](./image-${i + 1}.png) `;
  }
  md += "\n\n";

  // Mixed inline formatting
  md += "## Mixed Inline Formatting\n\n";
  for (let i = 0; i < 50; i++) {
    md += `**bold** *italic* ~~strike~~ \`code\` [link](https://example.com) plain text ${i + 1}.\n\n`;
  }

  // Blockquotes
  md += "## Nested Blockquotes\n\n";
  for (let i = 0; i < 20; i++) {
    md += `${"> ".repeat(i + 1)}Level ${i + 1} quote\n`;
  }
  md += "\n";

  // Task lists
  md += "## Task Lists\n\n";
  for (let i = 0; i < 50; i++) {
    md += `- [${i % 2 === 0 ? "x" : " "}] Task ${i + 1}\n`;
  }
  md += "\n";

  writeFileSync(join(fixturesDir, "pathological.md"), md, "utf-8");
}

// ---------------------------------------------------------------------------
// Write small.md (already composed above)
// ---------------------------------------------------------------------------

writeFileSync(join(fixturesDir, "small.md"), small, "utf-8");

// ---------------------------------------------------------------------------
// Summary
// ---------------------------------------------------------------------------

const files = ["small.md", "medium.md", "large.md", "code-heavy.md",
  "diagram-heavy.md", "design-heavy.md", "pathological.md"];

console.log("Generated benchmark fixtures:");
for (const f of files) {
  const path = join(fixturesDir, f);
  const { statSync } = await import("node:fs");
  const size = statSync(path).size;
  console.log(`  ${f.padEnd(20)} ${(size / 1024).toFixed(1).padStart(8)} KB`);
}