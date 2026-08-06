import { existsSync, readFileSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const __dirname = dirname(fileURLToPath(import.meta.url));
const stylesDir = join(__dirname, "..");

function readStyles(): string {
  return readFileSync(join(stylesDir, "src", "styles.css"), "utf-8");
}

function readGeneratedTokens(): string {
  return readFileSync(join(stylesDir, "generated", "tokens.css"), "utf-8");
}

// ---------------------------------------------------------------------------
// Scope test — all selectors in styles.css start with .kmd-reader or
// .kmd-document-shell (or are media query / at-rule blocks)
// ---------------------------------------------------------------------------

describe("scope isolation", () => {
  const css = readStyles();

  // Extract all selector blocks (text before { that is not inside @media/@import)
  function extractSelectors(cssText: string): string[] {
    // Remove comments
    const noComments = cssText.replace(/\/\*[\s\S]*?\*\//g, "");
    // Remove @import lines
    const noImports = noComments.replace(/@import[^;]+;/g, "");
    // Split into rule blocks
    const selectors: string[] = [];
    // Match selector groups (text before { that doesn't start with @)
    const ruleRegex = /([^{}@]+)\{/g;
    let match: RegExpExecArray | null = ruleRegex.exec(noImports);
    while (match !== null) {
      const selectorGroup = match[1].trim();
      if (selectorGroup) {
        for (const sel of selectorGroup.split(",")) {
          const trimmed = sel.trim();
          if (trimmed) selectors.push(trimmed);
        }
      }
      match = ruleRegex.exec(noImports);
    }
    return selectors;
  }

  it("all selectors should be scoped under .kmd-reader or .kmd-document-shell", () => {
    const selectors = extractSelectors(css);
    // Filter out :root, media query selectors, etc.
    const scopedRoots = [".kmd-reader", ".kmd-document-shell"];

    const unscoped: string[] = [];
    for (const sel of selectors) {
      // Allow :root (default theme tokens, system preference)
      if (sel.startsWith(":root")) continue;
      // Allow theme attribute/class selectors (data-theme, data-kmd-theme, .kmd-theme-*)
      if (sel.startsWith("[data-theme=") || sel.startsWith("[data-kmd-theme=")) continue;
      if (sel.startsWith(".kmd-theme-")) continue;
      // Allow at-rule keywords (media, supports) — these are not CSS selectors
      if (sel.startsWith("media ") || sel.startsWith("supports ")) continue;
      // Allow media query internal selectors
      if (sel.startsWith("@")) continue;

      const isScoped = scopedRoots.some((root) => sel.startsWith(root) || sel.includes(` ${root}`));
      if (!isScoped) {
        unscoped.push(sel);
      }
    }

    expect(unscoped, `Unscoped selectors found: ${unscoped.join(", ")}`).toEqual([]);
  });

  it("styles.css should not contain bare html/body/* selectors", () => {
    expect(css).not.toMatch(/^\s*html\s*{/m);
    expect(css).not.toMatch(/^\s*body\s*{/m);
    // The global * reset should only appear inside generated tokens, not styles.css
    // (styles.css may use .kmd-reader * but not bare *)
    expect(css).not.toMatch(/^\s*\*\s*{[^}]*}/m);
  });
});

// ---------------------------------------------------------------------------
// Token usage test — CSS values should reference --kmd-* tokens
// ---------------------------------------------------------------------------

describe("token usage", () => {
  const css = readStyles();

  it("should not hardcode hex colors (use --kmd-color-* tokens)", () => {
    // Extract property declarations and check for hex values
    // Allow hex only in print media (forced black/white for print)
    const lines = css.split("\n");
    let inPrintMedia = false;
    let inSystemPref = false;

    for (const line of lines) {
      if (line.includes("@media print")) inPrintMedia = true;
      if (line.includes("@media (prefers-color-scheme")) inSystemPref = true;
      if (line.trim() === "}") {
        // This is naive but works for our structure — closing a media block
      }

      // Skip lines inside print media (black/white is intentional there)
      if (inPrintMedia && line.match(/#[0-9a-fA-F]{3,6}/)) continue;
      // Skip sepia/system-preference theme blocks (these define token values as hex)
      if (inSystemPref && line.match(/#[0-9a-fA-F]{3,6}/)) continue;

      // Outside print/sepia/system-pref: check for hex colors in declarations
      // Skip :root blocks (default theme values are defined as hex)
      if (line.trim().startsWith(":root")) continue;
      // Skip [data-kmd-theme="sepia"] and .kmd-theme-sepia blocks
      if (line.includes("sepia")) continue;

      // In the actual reader styles, colors should use var(--kmd-color-*)
      // not hex values
      const hexMatch = line.match(/#[0-9a-fA-F]{3,6}/);
      if (hexMatch && !line.includes("var(")) {
        // Check if this is inside a color value definition (theme block)
        // vs an actual style rule
        const trimmed = line.trim();
        // Theme value definitions look like "--kmd-color-...: #..."
        if (trimmed.startsWith("--")) continue;
        // Skip the :root default theme block
        if (line.includes("--kmd-color-")) continue;

        // This is a hardcoded color in a style rule — fail
        expect.fail(`Hardcoded color "${hexMatch[0]}" in: ${line.trim()}`);
      }
    }
  });

  it("should not hardcode spacing values (use --kmd-space-* tokens)", () => {
    // Check that padding/margin values use var(--kmd-space-*) not bare px.
    // Sub-token pixel values (< 4px, i.e. below --kmd-space-xs) are allowed
    // for fine-grained cosmetic adjustments (e.g. inline code chip padding 2px)
    // that don't belong in the spacing token scale.
    const lines = css.split("\n");
    let inPrintMedia = false;

    for (const line of lines) {
      if (line.includes("@media print")) inPrintMedia = true;
      if (inPrintMedia) continue; // print overrides are allowed to use literal values

      const trimmed = line.trim();
      // Skip theme definition lines
      if (trimmed.startsWith("--")) continue;
      // Skip comments
      if (trimmed.startsWith("/*") || trimmed.startsWith("*")) continue;

      // Check for padding/margin with px values that are NOT inside var()
      if (
        (trimmed.includes("padding") || trimmed.includes("margin")) &&
        trimmed.includes("px") &&
        !trimmed.includes("var(")
      ) {
        // Some properties use calc() with var() — check if px is inside a var()
        const pxOnly = trimmed.replace(/var\([^)]+\)/g, "");
        // Allow sub-token values (1px, 2px, 3px) — these are cosmetic, not spacing
        const significantPx = pxOnly.replace(/\b[123]px/g, "");
        // If there are bare px values >= 4px outside of var(), fail
        if (/\d+px/.test(significantPx) && !pxOnly.includes("calc(")) {
          expect.fail(`Hardcoded spacing in: ${trimmed}`);
        }
      }
    }
  });

  it("should reference --kmd-* custom properties", () => {
    expect(css).toContain("var(--kmd-color-");
    expect(css).toContain("var(--kmd-space-");
    expect(css).toContain("var(--kmd-font-size-");
    expect(css).toContain("var(--kmd-radius-");
    expect(css).toContain("var(--kmd-font-mono)");
    expect(css).toContain("var(--kmd-font-body)");
  });
});

// ---------------------------------------------------------------------------
// Theme test — light/dark/sepia selectors present
// ---------------------------------------------------------------------------

describe("themes", () => {
  const css = readStyles();
  const tokens = readGeneratedTokens();

  it("should have dark theme selectors (data-theme, data-kmd-theme, class)", () => {
    expect(tokens).toContain('[data-theme="dark"]');
    expect(tokens).toContain('[data-kmd-theme="dark"]');
    expect(tokens).toContain(".kmd-theme-dark");
  });

  it("should have light theme selectors (data-theme, data-kmd-theme, class)", () => {
    expect(tokens).toContain('[data-theme="light"]');
    expect(tokens).toContain('[data-kmd-theme="light"]');
    expect(tokens).toContain(".kmd-theme-light");
  });

  it("should have sepia theme selectors in styles.css", () => {
    expect(css).toContain('[data-kmd-theme="sepia"]');
    expect(css).toContain(".kmd-theme-sepia");
  });

  it("should have system preference media query for light theme", () => {
    expect(css).toContain("prefers-color-scheme: light");
  });

  it("should define sepia-specific color values", () => {
    expect(css).toContain("--kmd-color-neutral: #f4ecd8");
    expect(css).toContain("--kmd-color-surface: #faf3e0");
    expect(css).toContain("--kmd-color-on-surface: #3b2f1f");
  });
});

// ---------------------------------------------------------------------------
// Accessibility — focus-visible, reduced-motion, high-contrast
// ---------------------------------------------------------------------------

describe("accessibility", () => {
  const css = readStyles();

  it("should have :focus-visible rules", () => {
    expect(css).toContain(":focus-visible");
    expect(css).toContain("outline-width");
    expect(css).toContain("outline-style");
    expect(css).toContain("outline-color");
  });

  it("should not suppress default focus outlines", () => {
    // Check that we don't have outline: none without a :focus-visible replacement
    expect(css).not.toMatch(/outline:\s*none/);
  });

  it("should have reduced-motion media query", () => {
    expect(css).toContain("prefers-reduced-motion");
    expect(css).toContain("animation-duration");
    expect(css).toContain("transition-duration");
  });

  it("should have high-contrast media query", () => {
    expect(css).toContain("prefers-contrast");
    expect(css).toContain("prefers-contrast: high");
  });
});

// ---------------------------------------------------------------------------
// Print — @media print rules present
// ---------------------------------------------------------------------------

describe("print", () => {
  const css = readStyles();

  it("should have @media print rules", () => {
    expect(css).toContain("@media print");
  });

  it("should hide outline sidebar in print", () => {
    expect(css).toContain("kmd-outline-sidebar");
    // Inside print block, should have display: none
    const printBlock = css.match(/@media print\s*\{([\s\S]*?)\n\}/);
    expect(printBlock).toBeTruthy();
    expect(printBlock?.[1]).toContain("display: none");
  });

  it("should hide copy buttons in print", () => {
    const printBlock = css.match(/@media print\s*\{([\s\S]*?)\n\}/);
    expect(printBlock?.[1]).toContain("code-copy-button");
  });

  it("should have page break avoidance rules", () => {
    expect(css).toContain("break-after: avoid");
    expect(css).toContain("break-inside: avoid");
  });

  it("should set black text on white for print", () => {
    const printBlock = css.match(/@media print\s*\{([\s\S]*?)\n\}/);
    expect(printBlock?.[1]).toContain("#000000");
    expect(printBlock?.[1]).toContain("#ffffff");
  });
});

// ---------------------------------------------------------------------------
// Responsive — tables, code, images
// ---------------------------------------------------------------------------

describe("responsive", () => {
  const css = readStyles();

  it("should have scrollable table wrapper", () => {
    expect(css).toContain(".table-wrapper");
    expect(css).toContain("overflow-x: auto");
    expect(css).toContain("max-width: 100%");
  });

  it("should have code block horizontal scroll", () => {
    expect(css).toContain("tab-size: 2");
    // pre has overflow-x: auto
    expect(css).toMatch(/\.kmd-reader pre[\s\S]*overflow-x:\s*auto/);
  });

  it("should have responsive images", () => {
    expect(css).toContain("max-width: 100%");
    expect(css).toContain("height: auto");
    expect(css).toContain("border-radius");
  });
});

// ---------------------------------------------------------------------------
// Package structure
// ---------------------------------------------------------------------------

describe("package structure", () => {
  it("styles.css should exist and be non-trivial", () => {
    const cssPath = join(stylesDir, "src", "styles.css");
    expect(existsSync(cssPath)).toBe(true);
    const stat = statSync(cssPath);
    // Should be at least 5KB (full reader styles, not a placeholder)
    expect(stat.size).toBeGreaterThan(5000);
  });

  it("styles.css should import tokens.css", () => {
    const css = readStyles();
    expect(css).toContain('@import "./tokens.css"');
  });

  it("exports map should include styles.css and tokens.css", () => {
    const pkg = JSON.parse(readFileSync(join(stylesDir, "package.json"), "utf-8"));
    expect(pkg.exports["./styles.css"]).toBe("./src/styles.css");
    expect(pkg.exports["./tokens.css"]).toBe("./src/tokens.css");
    expect(pkg.exports["./generated/tokens.css"]).toBe("./generated/tokens.css");
  });

  it("sideEffects should include CSS files", () => {
    const pkg = JSON.parse(readFileSync(join(stylesDir, "package.json"), "utf-8"));
    expect(pkg.sideEffects).toContain("**/*.css");
  });

  it("should have .kmd-reader as the root scope class", () => {
    const css = readStyles();
    expect(css).toContain(".kmd-reader {");
  });

  it("should have .kmd-document-shell for document layout", () => {
    const css = readStyles();
    expect(css).toContain(".kmd-document-shell");
  });
});

// ---------------------------------------------------------------------------
// Font fallback policy — documented, no @font-face
// ---------------------------------------------------------------------------

describe("font fallback policy", () => {
  const css = readStyles();

  it("should not have @font-face declarations", () => {
    // Strip comments first so the word "@font-face" in a comment doesn't match
    const noComments = css.replace(/\/\*[\s\S]*?\*\//g, "");
    expect(noComments).not.toContain("@font-face");
  });

  it("should document font stacks in comments", () => {
    expect(css).toContain("Inter");
    expect(css).toContain("system-ui");
    expect(css).toContain("-apple-system");
    expect(css).toContain("JetBrains Mono");
    expect(css).toContain("monospace");
  });
});

// ---------------------------------------------------------------------------
// Document shell — outline sidebar, content area
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// GitHub alert icons — ::before pseudo-elements with data-URI SVG masks
// ---------------------------------------------------------------------------

describe("github alert icons", () => {
  const css = readStyles();
  const types = ["note", "tip", "important", "warning", "caution"] as const;

  it("should define all 5 --kmd-alert-{type}-icon custom properties in :root", () => {
    for (const type of types) {
      expect(css, `missing --kmd-alert-${type}-icon custom property`).toContain(
        `--kmd-alert-${type}-icon:`,
      );
    }
  });

  it("each custom property should be a data-URI SVG", () => {
    for (const type of types) {
      expect(css).toContain(`--kmd-alert-${type}-icon: url("data:image/svg+xml`);
    }
  });

  it("should have ::before pseudo-element rules for all 5 alert types", () => {
    for (const type of types) {
      expect(css, `missing ::before rule for .markdown-alert-${type}`).toContain(
        `.markdown-alert-${type} .markdown-alert-title::before`,
      );
    }
  });

  it("each ::before rule should use mask-image: var(--kmd-alert-{type}-icon)", () => {
    for (const type of types) {
      expect(css).toContain(`mask-image: var(--kmd-alert-${type}-icon)`);
    }
  });

  it("each ::before rule should use -webkit-mask-image for compatibility", () => {
    for (const type of types) {
      expect(css).toContain(`-webkit-mask-image: var(--kmd-alert-${type}-icon)`);
    }
  });
});

// ---------------------------------------------------------------------------
// Document shell — outline sidebar, content area
// ---------------------------------------------------------------------------

describe("document shell layout", () => {
  const css = readStyles();

  it("should have outline sidebar styles", () => {
    expect(css).toContain(".kmd-outline-sidebar");
    expect(css).toContain("var(--kmd-width-sidebar-width)");
  });

  it("should have collapsed sidebar state", () => {
    expect(css).toContain(".collapsed");
  });

  it("should have outline items with depth indentation", () => {
    expect(css).toContain('[data-depth="0"]');
    expect(css).toContain('[data-depth="1"]');
    expect(css).toContain('[data-depth="2"]');
    expect(css).toContain('[data-depth="3"]');
  });

  it("should have active heading highlight", () => {
    expect(css).toContain(".kmd-outline-item.active");
    expect(css).toContain("--kmd-color-outline-active-border");
  });

  it("should have content max-width constraint", () => {
    expect(css).toContain("var(--kmd-width-content-max)");
  });

  it("should have outline toggle button", () => {
    expect(css).toContain(".kmd-outline-toggle");
    expect(css).toContain("var(--kmd-width-toggle-width)");
  });
});
