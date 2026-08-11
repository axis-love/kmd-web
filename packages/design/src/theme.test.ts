import { describe, expect, it } from "vitest";
import type { ColorToken, DesignDocument } from "./ir.js";
import { emptyDesignDocument } from "./ir.js";
import { runDesignPipeline } from "./pipeline.js";
import { designThemeCss, emitThemeTokens } from "./theme.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function docWithColors(
  colors: Array<{ name: string; value: string; pair?: string }>,
): DesignDocument {
  const doc = emptyDesignDocument("");
  doc.spec.colorTokens = colors.map(
    (c): ColorToken => ({
      name: c.name,
      value: c.value,
      provenance: { extractor: "test" },
      ...(c.pair ? { pair: c.pair } : {}),
    }),
  );
  return doc;
}

/** A light-authored palette with unambiguous role names. */
function lightPalette(): DesignDocument {
  return docWithColors([
    { name: "color-background", value: "#f5f0e8" },
    { name: "color-surface", value: "#fffdf8" },
    { name: "color-text", value: "#1f1a14" },
    { name: "color-muted", value: "#6f6656" },
    { name: "color-border", value: "#ddd2c0" },
    { name: "color-secondary", value: "#c05621" },
    { name: "color-success", value: "#2f855a" },
    { name: "color-error", value: "#c53030" },
  ]);
}

// ---------------------------------------------------------------------------
// Mapping table
// ---------------------------------------------------------------------------

describe("emitThemeTokens — mapping", () => {
  it("maps roles to the ADR token set for the authored mode", () => {
    const result = emitThemeTokens(lightPalette());

    expect(result.authoredMode).toBe("light");
    expect(result.empty).toBe(false);

    const light = result.light;
    // background role
    expect(light["--kmd-color-neutral"]).toBe("#f5f0e8");
    // surface role + derived muted surface
    expect(light["--kmd-color-surface"]).toBe("#fffdf8");
    expect(light["--kmd-color-surface-muted"]).toBeDefined();
    expect(light["--kmd-color-code-bg"]).toBe(light["--kmd-color-surface-muted"]);
    expect(light["--kmd-color-table-header-bg"]).toBe(light["--kmd-color-surface-muted"]);
    // text role
    expect(light["--kmd-color-primary"]).toBe("#1f1a14");
    expect(light["--kmd-color-on-surface"]).toBe("#1f1a14");
    expect(light["--kmd-color-code-text"]).toBe("#1f1a14");
    expect(light["--kmd-color-on-primary"]).toBe("#f5f0e8");
    // muted text role
    expect(light["--kmd-color-secondary"]).toBe("#6f6656");
    expect(light["--kmd-color-blockquote-text"]).toBe("#6f6656");
    // divider role
    expect(light["--kmd-color-border"]).toBe("#ddd2c0");
    expect(light["--kmd-color-table-border"]).toBe("#ddd2c0");
    // accent role ("secondary" name → accent role) + derived accent tokens
    expect(light["--kmd-color-tertiary"]).toBe("#c05621");
    expect(light["--kmd-color-link"]).toBe("#c05621");
    expect(light["--kmd-color-link-hover"]).toBeDefined();
    expect(light["--kmd-color-selection-bg"]).toMatch(/^rgba\(192,86,33,0\.15\)$/);
    expect(light["--kmd-color-outline-active-bg"]).toMatch(/^rgba\(192,86,33,0\.1\)$/);
    // semantic roles
    expect(light["--kmd-color-success"]).toBe("#2f855a");
    expect(light["--kmd-color-danger"]).toBe("#c53030");
  });

  it("does not emit tokens for roles absent from the spec (per-token fallback)", () => {
    const result = emitThemeTokens(
      docWithColors([
        { name: "color-background", value: "#101418" },
        { name: "color-text", value: "#e6e9ec" },
      ]),
    );

    expect(result.authoredMode).toBe("dark");
    // No accent, divider, semantic roles → not emitted, defaults cascade.
    expect(result.dark["--kmd-color-tertiary"]).toBeUndefined();
    expect(result.dark["--kmd-color-border"]).toBeUndefined();
    expect(result.dark["--kmd-color-success"]).toBeUndefined();
    // But provided roles are.
    expect(result.dark["--kmd-color-neutral"]).toBe("#101418");
    expect(result.dark["--kmd-color-primary"]).toBe("#e6e9ec");
  });
});

// ---------------------------------------------------------------------------
// Dark derivation
// ---------------------------------------------------------------------------

describe("emitThemeTokens — dark derivation", () => {
  it("derives the opposing mode by lightness inversion for neutrals", () => {
    const result = emitThemeTokens(
      docWithColors([
        { name: "color-background", value: "#f0f0f0" }, // near-white neutral
        { name: "color-text", value: "#202020" },
      ]),
    );

    expect(result.authoredMode).toBe("light");
    // Dark background should be the lightness-inverted near-black.
    const darkBg = result.dark["--kmd-color-neutral"]!;
    expect(darkBg).toMatch(/^#[0-9a-f]{6}$/);
    const lum = parseInt(darkBg.slice(1, 3), 16);
    expect(lum).toBeLessThan(0x40);
    // Dark text should be light.
    const darkText = result.dark["--kmd-color-primary"]!;
    expect(parseInt(darkText.slice(1, 3), 16)).toBeGreaterThan(0xc0);
  });

  it("clamps chromatic accents into the readable band for the target mode", () => {
    const result = emitThemeTokens(
      docWithColors([
        { name: "color-background", value: "#ffffff" },
        { name: "color-accent-primary", value: "#5a1ca8" }, // dark saturated purple (brand role)
      ]),
    );

    expect(result.authoredMode).toBe("light");
    // Authored (light) keeps the value verbatim.
    expect(result.light["--kmd-color-tertiary"]).toBe("#5a1ca8");
    // Derived dark variant is lightened to at least L 0.6 — much lighter.
    const derived = result.dark["--kmd-color-tertiary"]!;
    expect(derived).not.toBe("#5a1ca8");
    const r = parseInt(derived.slice(1, 3), 16);
    expect(r).toBeGreaterThan(0x5a);
  });

  it("prefers an enriched pair over derivation", () => {
    const result = emitThemeTokens(
      docWithColors([
        { name: "color-background", value: "#ffffff", pair: "color-background-dark" },
        { name: "color-background-dark", value: "#123456", pair: "color-background" },
        { name: "color-text", value: "#111111" },
      ]),
    );

    expect(result.authoredMode).toBe("light");
    expect(result.dark["--kmd-color-neutral"]).toBe("#123456");
  });

  it("drops unparseable colors from the derived mode only, with a diagnostic", () => {
    const result = emitThemeTokens(
      docWithColors([
        { name: "color-background", value: "#ffffff" },
        { name: "color-success", value: "seagreen" }, // named color — not parsed
      ]),
    );

    expect(result.light["--kmd-color-success"]).toBe("seagreen");
    expect(result.dark["--kmd-color-success"]).toBeUndefined();
    expect(result.diagnostics.some((d) => d.token === "color-success")).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Fonts and radii
// ---------------------------------------------------------------------------

describe("emitThemeTokens — fonts and radii", () => {
  it("maps body and mono font families in both modes", () => {
    const doc = lightPalette();
    doc.spec.typographyTokens = [
      {
        name: "typography-body",
        value: 'family: "IBM Plex Sans", sans-serif',
        provenance: { extractor: "test" },
      },
      {
        name: "typography-code",
        value: 'family: "IBM Plex Mono", monospace',
        provenance: { extractor: "test" },
      },
    ];

    const result = emitThemeTokens(doc);
    expect(result.light["--kmd-font-body"]).toBe('"IBM Plex Sans", sans-serif');
    expect(result.light["--kmd-font-mono"]).toBe('"IBM Plex Mono", monospace');
    expect(result.dark["--kmd-font-body"]).toBe('"IBM Plex Sans", sans-serif');
  });

  it("reads font-family from composite JSON typography values", () => {
    const doc = lightPalette();
    doc.spec.typographyTokens = [
      {
        name: "typography-heading",
        value: '{"font-family":"DM Sans, sans-serif","font-size":"24px"}',
        provenance: { extractor: "test" },
      },
    ];

    const result = emitThemeTokens(doc);
    expect(result.light["--kmd-font-body"]).toBe("DM Sans, sans-serif");
  });

  it("maps size-suffixed radius tokens and ignores non-length values", () => {
    const doc = lightPalette();
    doc.spec.radiusTokens = [
      { name: "radius-sm", value: "4px", provenance: { extractor: "test" } },
      { name: "radius-lg", value: "20px", provenance: { extractor: "test" } },
      { name: "radius-full", value: "circle", provenance: { extractor: "test" } },
    ];

    const result = emitThemeTokens(doc);
    expect(result.light["--kmd-radius-sm"]).toBe("4px");
    expect(result.light["--kmd-radius-lg"]).toBe("20px");
    expect(result.light["--kmd-radius-md"]).toBeUndefined();
    expect(result.light["--kmd-radius-full"]).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// Empty / malformed specs
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
    const doc = runDesignPipeline("# Just a heading\n\nSome ordinary prose.\n");
    const result = emitThemeTokens(doc);

    expect(result.empty).toBe(true);
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
        { name: "color-background", value: "#ffffff" },
        { name: "color-success", value: "green;} body { display:none " },
      ]),
    );

    expect(result.light["--kmd-color-success"]).toBeUndefined();
    expect(result.dark["--kmd-color-success"]).toBeUndefined();
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
    expect(designThemeCss(a, "abc123")).toBe(designThemeCss(b, "abc123"));
  });

  it("emits from a real end-to-end pipeline run deterministically", () => {
    const source = [
      "# My Design System",
      "",
      "## Colors",
      "",
      "| Token | Value |",
      "|---|---|",
      "| color-background | #10141a |",
      "| color-text | #e8ecf1 |",
      "| color-accent | #ff6b35 |",
      "",
    ].join("\n");
    const first = emitThemeTokens(runDesignPipeline(source));
    const second = emitThemeTokens(runDesignPipeline(source));
    expect(JSON.stringify(first)).toBe(JSON.stringify(second));
    expect(first.empty).toBe(false);
    expect(first.authoredMode).toBe("dark");
  });
});

// ---------------------------------------------------------------------------
// designThemeCss
// ---------------------------------------------------------------------------

describe("designThemeCss", () => {
  it("emits dark as the default block and light behind explicit selectors", () => {
    const css = designThemeCss(emitThemeTokens(lightPalette()), "h1a2b3");

    expect(css).toContain('[data-kmd-design="h1a2b3"] {');
    expect(css).toContain('[data-theme="light"] [data-kmd-design="h1a2b3"]');
    expect(css).toContain('[data-kmd-theme="light"] [data-kmd-design="h1a2b3"]');
    expect(css).toContain('.kmd-theme-light [data-kmd-design="h1a2b3"]');
    // Self-activation variants (theme set on the reader root itself).
    expect(css).toContain('[data-kmd-design="h1a2b3"][data-kmd-theme="light"]');
    expect(css).toContain("@media (prefers-color-scheme: light)");
    // The dark block comes first (default), and properties are sorted.
    const darkBlock = css.slice(0, css.indexOf("}"));
    const props = [...darkBlock.matchAll(/--kmd-[a-z-]+(?=:)/g)].map((m) => m[0]);
    expect(props.length).toBeGreaterThan(5);
    expect([...props].sort()).toEqual(props);
  });

  it("returns empty string for empty results and invalid scope ids", () => {
    expect(designThemeCss(emitThemeTokens(emptyDesignDocument("")), "abc")).toBe("");
    const tokens = emitThemeTokens(lightPalette());
    expect(designThemeCss(tokens, 'x"] * { color: red } [x="')).toBe("");
    expect(designThemeCss(tokens, "")).toBe("");
  });
});
