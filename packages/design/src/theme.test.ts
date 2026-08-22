import { describe, expect, it } from "vitest";
import type { ColorToken, DesignDocument } from "./ir.js";
import { emptyDesignDocument } from "./ir.js";
import { runDesignPipeline } from "./pipeline.js";
import { buildShowcaseThemeVars } from "./showcase.js";
import { designThemeCss, emitThemeTokens } from "./theme.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function docWithColors(colors: Array<{ name: string; value: string }>): DesignDocument {
  const doc = emptyDesignDocument("");
  doc.spec.colorTokens = colors.map(
    (c): ColorToken => ({ name: c.name, value: c.value, provenance: { extractor: "test" } }),
  );
  return doc;
}

/** A light-authored palette using the naming the showcase keyword scorer keys on. */
function lightPalette(): DesignDocument {
  return docWithColors([
    { name: "Page Background", value: "#f5f0e8" },
    { name: "Surface", value: "#fffdf8" },
    { name: "Text heading", value: "#1f1a14" },
    { name: "Text body", value: "#2a241c" },
    { name: "Text muted", value: "#6f6656" },
    { name: "Separator", value: "#ddd2c0" },
    { name: "Accent", value: "#c05621" },
    { name: "Positive", value: "#2f855a" },
    { name: "Error", value: "#c53030" },
  ]);
}

const THOUGHTSTREAM = `# ThoughtStream

## Colors

### Surface Palette

| Token      | Hex       | Role                       |
|------------|-----------|----------------------------|
| Background | \`#FAFAF9\` | Warm white page background |
| Surface    | \`#F5F5F4\` | Card and section backgrounds |

### Content Palette

| Token          | Hex       | Role                |
|----------------|-----------|---------------------|
| Text Primary   | \`#1C1917\` | Body copy, headings |
| Text Secondary | \`#57534E\` | Bylines, captions   |

### Brand Palette

| Token   | Hex       | Role                     |
|---------|-----------|--------------------------|
| Primary | \`#78716C\` | Stone — links, icons     |

## Typography

### Font Stack

| Role             | Font                                              |
|------------------|---------------------------------------------------|
| Display/Headings | Libre Baskerville, Georgia, serif                 |
| UI/Body          | Inter, -apple-system, 'Segoe UI', sans-serif      |
| Mono/Code        | Source Code Pro, 'Fira Code', Consolas, monospace |

### Type Scale

| Level    | Font              | Size | Weight | Line Height | Letter Spacing | Usage           |
|----------|-------------------|------|--------|-------------|----------------|-----------------|
| Display  | Libre Baskerville | 40px | 700    | 1.2         | -0.02em        | Hero titles     |
| Headline | Libre Baskerville | 30px | 700    | 1.3         | -0.015em       | Post titles     |
| Body     | Inter             | 17px | 400    | 1.8         | 0              | Reading text    |
| Code     | Source Code Pro   | 15px | 400    | 1.6         | 0              | Inline and blocks |
`;

// ---------------------------------------------------------------------------
// Single extractor: the reader theme is a projection of the showcase vars
// ---------------------------------------------------------------------------

describe("emitThemeTokens — projection of the showcase extractor", () => {
  it("maps every showcase variable per the fixed table, in both modes", () => {
    const doc = lightPalette();
    const vars = buildShowcaseThemeVars(doc);
    expect(vars).not.toBeNull();
    const result = emitThemeTokens(doc);

    expect(result.empty).toBe(false);
    expect(result.authoredMode).toBe("light");

    for (const [mode, nyx] of [
      ["light", vars?.light],
      ["dark", vars?.dark],
    ] as const) {
      const kmd = result[mode];
      expect(kmd["--kmd-color-neutral"]).toBe(nyx?.get("--nyx-bg"));
      expect(kmd["--kmd-color-surface"]).toBe(nyx?.get("--nyx-surface"));
      expect(kmd["--kmd-color-surface-muted"]).toBe(nyx?.get("--nyx-surface-elevated"));
      expect(kmd["--kmd-color-code-bg"]).toBe(nyx?.get("--nyx-surface-elevated"));
      expect(kmd["--kmd-color-table-header-bg"]).toBe(nyx?.get("--nyx-surface-elevated"));
      expect(kmd["--kmd-color-primary"]).toBe(nyx?.get("--nyx-text-head"));
      expect(kmd["--kmd-color-on-surface"]).toBe(nyx?.get("--nyx-text-body"));
      expect(kmd["--kmd-color-code-text"]).toBe(nyx?.get("--nyx-text-body"));
      expect(kmd["--kmd-color-secondary"]).toBe(nyx?.get("--nyx-text-muted"));
      expect(kmd["--kmd-color-blockquote-text"]).toBe(nyx?.get("--nyx-text-muted"));
      expect(kmd["--kmd-color-border"]).toBe(nyx?.get("--nyx-sep"));
      expect(kmd["--kmd-color-table-border"]).toBe(nyx?.get("--nyx-sep"));
      expect(kmd["--kmd-color-blockquote-border"]).toBe(nyx?.get("--nyx-sep"));
      expect(kmd["--kmd-color-scrollbar-thumb"]).toBe(nyx?.get("--nyx-sep"));
      expect(kmd["--kmd-color-tertiary"]).toBe(nyx?.get("--nyx-accent"));
      expect(kmd["--kmd-color-link"]).toBe(nyx?.get("--nyx-accent"));
      expect(kmd["--kmd-color-link-hover"]).toBe(nyx?.get("--nyx-accent-hover"));
      expect(kmd["--kmd-color-selection-bg"]).toBe(nyx?.get("--nyx-accent-bg"));
      expect(kmd["--kmd-color-outline-active-bg"]).toBe(nyx?.get("--nyx-accent-bg"));
      expect(kmd["--kmd-color-on-primary"]).toBe(nyx?.get("--nyx-btn-primary-text"));
      expect(kmd["--kmd-color-success"]).toBe(nyx?.get("--nyx-positive"));
      expect(kmd["--kmd-color-danger"]).toBe(nyx?.get("--nyx-error"));
    }

    // Authored values come through verbatim.
    expect(result.light["--kmd-color-neutral"]).toBe("#f5f0e8");
    expect(result.light["--kmd-color-tertiary"]).toBe("#c05621");
    expect(result.light["--kmd-color-success"]).toBe("#2f855a");
  });

  it("keeps the accent identical across modes, as the showcase does", () => {
    const result = emitThemeTokens(lightPalette());
    expect(result.dark["--kmd-color-tertiary"]).toBe(result.light["--kmd-color-tertiary"]);
    expect(result.dark["--kmd-color-link"]).toBe("#c05621");
  });

  it("derives a readable dark mode for a light-authored design", () => {
    const result = emitThemeTokens(lightPalette());
    const vars = buildShowcaseThemeVars(lightPalette());
    expect(result.dark["--kmd-color-neutral"]).toBe(vars?.dark.get("--nyx-bg"));
    // Showcase polarity: dark background, light text.
    expect(result.dark["--kmd-color-neutral"]).toMatch(/^#[0-2]/);
    expect(result.dark["--kmd-color-on-surface"]).toMatch(/^#[c-f]/);
  });

  it("does not emit tokens the showcase did not determine (per-token fallback)", () => {
    const result = emitThemeTokens(
      docWithColors([
        { name: "Page Background", value: "#ffffff" },
        { name: "Accent", value: "#3355ff" },
      ]),
    );
    expect(result.light["--kmd-color-neutral"]).toBe("#ffffff");
    expect(result.light["--kmd-color-tertiary"]).toBe("#3355ff");
    expect(result.light["--kmd-color-success"]).toBeUndefined();
    expect(result.light["--kmd-color-warning"]).toBeUndefined();
    expect(result.light["--kmd-color-info"]).toBeUndefined();
    expect(result.light["--kmd-font-body"]).toBeUndefined();
    expect(result.light["--kmd-radius-lg"]).toBeUndefined();
  });

  it("re-emits the semantic aliases as var() references whenever anything is emitted", () => {
    const result = emitThemeTokens(lightPalette());
    for (const mode of ["light", "dark"] as const) {
      expect(result[mode]["--kmd-color-heading"]).toBe("var(--kmd-color-primary)");
      expect(result[mode]["--kmd-color-body"]).toBe("var(--kmd-color-on-surface)");
      expect(result[mode]["--kmd-color-muted"]).toBe("var(--kmd-color-secondary)");
      expect(result[mode]["--kmd-color-accent"]).toBe("var(--kmd-color-tertiary)");
      expect(result[mode]["--kmd-color-background"]).toBe("var(--kmd-color-neutral)");
      expect(result[mode]["--kmd-color-card"]).toBe("var(--kmd-color-surface)");
      expect(result[mode]["--kmd-focus-outline-color"]).toBe("var(--kmd-color-tertiary)");
    }
  });
});

// ---------------------------------------------------------------------------
// Authored mode
// ---------------------------------------------------------------------------

describe("emitThemeTokens — authored mode", () => {
  it("reports dark for a dark-authored design and keeps its values in the dark set", () => {
    const result = emitThemeTokens(
      docWithColors([
        { name: "Page Background", value: "#000000" },
        { name: "Surface", value: "#1d1d1f" },
        { name: "Accent", value: "#38bdf8" },
        { name: "Text heading", value: "#ffffff" },
        { name: "Text body", value: "rgba(255,255,255,0.85)" },
      ]),
    );
    expect(result.authoredMode).toBe("dark");
    expect(result.dark["--kmd-color-neutral"]).toBe("#000000");
    expect(result.dark["--kmd-color-surface"]).toBe("#1d1d1f");
    expect(result.dark["--kmd-color-primary"]).toBe("#ffffff");
    expect(result.dark["--kmd-color-on-surface"]).toBe("rgba(255,255,255,0.85)");
    // The showcase keeps the accent for the derived light mode too.
    expect(result.light["--kmd-color-tertiary"]).toBe("#38bdf8");
    // Derived light mode has light-mode polarity.
    expect(result.light["--kmd-color-neutral"]).toMatch(/^#[d-f]/);
  });

  it("falls back to the text polarity when no background is declared", () => {
    const result = emitThemeTokens(docWithColors([{ name: "Text body", value: "#f0f0f0" }]));
    expect(result.authoredMode).toBe("dark");
  });
});

// ---------------------------------------------------------------------------
// Typography and radii
// ---------------------------------------------------------------------------

describe("emitThemeTokens — typography and radii", () => {
  it("maps body, heading and mono stacks from a real pipeline run", () => {
    const result = emitThemeTokens(runDesignPipeline(THOUGHTSTREAM));
    expect(result.empty).toBe(false);
    expect(result.light["--kmd-font-body"]).toMatch(/^Inter\b/);
    expect(result.light["--kmd-font-heading"]).toMatch(/^Libre Baskerville\b/);
    expect(result.light["--kmd-font-mono"]).toMatch(/^Source Code Pro\b/);
    // Typography is mode-independent.
    expect(result.dark["--kmd-font-heading"]).toBe(result.light["--kmd-font-heading"]);
    // Colors from the same document.
    expect(result.light["--kmd-color-neutral"]).toBe("#FAFAF9");
    expect(result.light["--kmd-color-surface"]).toBe("#F5F5F4");
    expect(result.light["--kmd-color-on-surface"]).toBe("#1C1917");
    expect(result.light["--kmd-color-secondary"]).toBe("#57534E");
    expect(result.light["--kmd-color-tertiary"]).toBe("#78716C");
  });

  it("maps size-named radius tokens onto the reader scale and ignores component radii", () => {
    const doc = lightPalette();
    doc.spec.radiusTokens = [
      { name: "rounded-sm", value: "8px", provenance: { extractor: "test" } },
      { name: "radius-md", value: "11px", provenance: { extractor: "test" } },
      { name: "Large", value: "18px", provenance: { extractor: "test" } },
      { name: "pill", value: "9999px", provenance: { extractor: "test" } },
      { name: "none", value: "0px", provenance: { extractor: "test" } },
      { name: "button", value: "9999px", provenance: { extractor: "test" } },
    ];
    const result = emitThemeTokens(doc);
    expect(result.light["--kmd-radius-sm"]).toBe("8px");
    expect(result.light["--kmd-radius-md"]).toBe("11px");
    expect(result.light["--kmd-radius-lg"]).toBe("18px");
    expect(result.light["--kmd-radius-full"]).toBe("9999px");
    expect(result.light["--kmd-radius-xl"]).toBeUndefined();
    // A pill button radius never reaches the reader's size scale.
    expect(Object.values(result.light).filter((v) => v === "9999px")).toEqual(["9999px"]);
    expect(result.dark["--kmd-radius-md"]).toBe("11px");
  });

  it("fills the scale from a global zero radius", () => {
    const doc = lightPalette();
    doc.spec.radiusTokens = [
      { name: "all", value: "0px", provenance: { extractor: "test" } },
      { name: "full", value: "9999px", provenance: { extractor: "test" } },
    ];
    const result = emitThemeTokens(doc);
    for (const size of ["sm", "md", "lg", "xl"]) {
      expect(result.light[`--kmd-radius-${size}`]).toBe("0px");
    }
    expect(result.light["--kmd-radius-full"]).toBe("9999px");
  });
});

// ---------------------------------------------------------------------------
// Empty and malformed input
// ---------------------------------------------------------------------------

describe("emitThemeTokens — empty and malformed input", () => {
  it("returns an empty result with a diagnostic for an empty document", () => {
    const result = emitThemeTokens(emptyDesignDocument(""));
    expect(result.empty).toBe(true);
    expect(result.light).toEqual({});
    expect(result.dark).toEqual({});
    expect(result.diagnostics.some((d) => d.token === "design-theme")).toBe(true);
  });

  it("returns an empty result for a plain-markdown pipeline run", () => {
    const result = emitThemeTokens(runDesignPipeline("# Hello\n\nJust prose.\n"));
    expect(result.empty).toBe(true);
    expect(designThemeCss(result, "abc")).toBe("");
  });

  it("does not mutate the input document", () => {
    const doc = lightPalette();
    const before = JSON.stringify(doc);
    emitThemeTokens(doc);
    expect(JSON.stringify(doc)).toBe(before);
  });

  it("rejects values that could escape a CSS declaration", () => {
    const result = emitThemeTokens(
      docWithColors([
        { name: "Page Background", value: "#fff; } body { display: none" },
        { name: "Accent", value: "url(https://evil.example/x)" },
      ]),
    );
    for (const map of [result.light, result.dark]) {
      for (const value of Object.values(map)) {
        expect(value).not.toMatch(/[;{}]/);
        expect(value).not.toMatch(/url\(/i);
      }
    }
  });
});

// ---------------------------------------------------------------------------
// Determinism
// ---------------------------------------------------------------------------

describe("emitThemeTokens — determinism", () => {
  it("produces byte-identical output for identical input", () => {
    const a = emitThemeTokens(lightPalette());
    const b = emitThemeTokens(lightPalette());
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  it("emits from a real end-to-end pipeline run deterministically", () => {
    const a = designThemeCss(emitThemeTokens(runDesignPipeline(THOUGHTSTREAM)), "x1");
    const b = designThemeCss(emitThemeTokens(runDesignPipeline(THOUGHTSTREAM)), "x1");
    expect(a).toBe(b);
    expect(a).toContain("--kmd-color-neutral: #FAFAF9;");
  });
});

// ---------------------------------------------------------------------------
// designThemeCss
// ---------------------------------------------------------------------------

describe("designThemeCss", () => {
  it("emits dark as the default block and light behind explicit selectors", () => {
    const css = designThemeCss(emitThemeTokens(lightPalette()), "abc-123");
    expect(css.startsWith('[data-kmd-design="abc-123"] {')).toBe(true);
    expect(css).toContain('[data-theme="light"] [data-kmd-design="abc-123"]');
    expect(css).toContain('[data-kmd-theme="light"] [data-kmd-design="abc-123"]');
    expect(css).toContain('.kmd-theme-light [data-kmd-design="abc-123"]');
    expect(css).toContain('[data-kmd-design="abc-123"][data-theme="light"]');
    expect(css).toContain("@media (prefers-color-scheme: light)");
    expect(css).toContain(":root:not([data-theme]):not([data-kmd-theme])");
    // Property-sorted inside each block.
    const firstBlock = css.slice(0, css.indexOf("}"));
    const props = [...firstBlock.matchAll(/^\s+(--kmd-[a-z0-9-]+):/gm)].map((m) => m[1]);
    expect(props).toEqual([...props].sort());
  });

  it("returns empty string for empty results and invalid scope ids", () => {
    expect(designThemeCss(emitThemeTokens(emptyDesignDocument("")), "abc")).toBe("");
    expect(designThemeCss(emitThemeTokens(lightPalette()), 'x"] { } [y')).toBe("");
    expect(designThemeCss(emitThemeTokens(lightPalette()), "")).toBe("");
  });
});
