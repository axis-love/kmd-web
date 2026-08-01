import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const __dirname = dirname(fileURLToPath(import.meta.url));
const stylesDir = join(__dirname, "..");

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

interface TokenData {
  version: string;
  themes: {
    default: string;
    variants: string[];
  };
  colors: Array<{
    name: string;
    description: string;
    values: Record<string, string>;
  }>;
  semanticColors?: Array<{
    name: string;
    description: string;
    reference: string;
  }>;
  typography: {
    fontFamilies: Array<{ name: string; value: string; unityFallback: string }>;
    fontSizes: Array<{ name: string; value: string }>;
    fontWeights: Array<{ name: string; value: number }>;
    lineHeights: Array<{ name: string; value: number }>;
    letterSpacings: Array<{ name: string; value: string }>;
  };
  spacing: Array<{ name: string; value: string }>;
  radii: Array<{ name: string; value: string }>;
  widths: Array<{ name: string; value: string }>;
  motion: {
    durations: Array<{ name: string; value: string }>;
    easings: Array<{ name: string; value: string }>;
  };
  accessibility: {
    reducedMotion: { query: string; durationOverride: string; iterationOverride: string };
    focusOutline: { width: string; style: string; colorToken: string };
  };
  platformExceptions: Array<{
    token: string;
    platform: string;
    reason: string;
    webValue: string;
    platformValue: string;
  }>;
}

function loadTokens(): TokenData {
  return JSON.parse(readFileSync(join(stylesDir, "tokens", "tokens.json"), "utf-8"));
}

function colorMap(tokens: TokenData, theme: string): Record<string, string> {
  return Object.fromEntries(tokens.colors.map((c) => [c.name, c.values[theme]]));
}

// ---------------------------------------------------------------------------
// Schema validation tests
// ---------------------------------------------------------------------------

describe("token schema validation", () => {
  it("should load and parse tokens.json without error", () => {
    const tokens = loadTokens();

    expect(tokens.version).toMatch(/^\d+\.\d+\.\d+$/);
    expect(tokens.themes.variants).toContain(tokens.themes.default);
    expect(tokens.colors).toBeInstanceOf(Array);
    expect(tokens.colors.length).toBeGreaterThan(0);
    expect(tokens.typography).toBeDefined();
    expect(tokens.spacing).toBeInstanceOf(Array);
    expect(tokens.radii).toBeInstanceOf(Array);
    expect(tokens.widths).toBeInstanceOf(Array);
    expect(tokens.motion).toBeDefined();
    expect(tokens.accessibility).toBeDefined();
    expect(tokens.platformExceptions).toBeInstanceOf(Array);
  });

  it("should load and parse schema.json without error", () => {
    const schemaPath = join(stylesDir, "tokens", "schema.json");
    const raw = readFileSync(schemaPath, "utf-8");
    const schema = JSON.parse(raw) as { title: string; type: string; required: string[] };

    expect(schema.title).toContain("kmd-web");
    expect(schema.type).toBe("object");
    expect(schema.required).toContain("version");
    expect(schema.required).toContain("colors");
    expect(schema.required).toContain("platformExceptions");
  });

  it("should have every color token defined for every theme variant", () => {
    const tokens = loadTokens();

    for (const color of tokens.colors) {
      for (const theme of tokens.themes.variants) {
        expect(
          color.values[theme],
          `color "${color.name}" missing for theme "${theme}"`,
        ).toBeDefined();
      }
    }
  });

  it("should have valid hex or rgba color values", () => {
    const tokens = loadTokens();
    const colorPattern = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$|^rgba\(|^transparent$/;

    for (const color of tokens.colors) {
      for (const [theme, value] of Object.entries(color.values)) {
        expect(value, `color "${color.name}" theme "${theme}" has invalid value`).toMatch(
          colorPattern,
        );
      }
    }
  });

  it("should have all semantic color references resolve to existing colors", () => {
    const tokens = loadTokens();
    const colorNames = new Set(tokens.colors.map((c) => c.name));

    if (tokens.semanticColors) {
      for (const sem of tokens.semanticColors) {
        expect(
          colorNames.has(sem.reference),
          `semantic color "${sem.name}" references unknown "${sem.reference}"`,
        ).toBe(true);
      }
    }
  });

  it("should have focus outline colorToken reference resolve", () => {
    const tokens = loadTokens();
    const colorNames = new Set(tokens.colors.map((c) => c.name));

    expect(
      colorNames.has(tokens.accessibility.focusOutline.colorToken),
      `focusOutline.colorToken "${tokens.accessibility.focusOutline.colorToken}" is not a known color`,
    ).toBe(true);
  });

  it("should have all platform exceptions reference known tokens", () => {
    const tokens = loadTokens();
    const colorNames = new Set(tokens.colors.map((c) => c.name));
    const fontNames = new Set(tokens.typography.fontFamilies.map((f) => `font-${f.name}`));
    const allNames = new Set([...colorNames, ...fontNames]);

    for (const ex of tokens.platformExceptions) {
      expect(
        allNames.has(ex.token),
        `platform exception references unknown token "${ex.token}"`,
      ).toBe(true);
      expect(ex.platform).toBe("unity");
      expect(ex.reason).toBeTruthy();
      expect(ex.webValue).toBeTruthy();
      expect(ex.platformValue).toBeTruthy();
    }
  });
});

// ---------------------------------------------------------------------------
// Generated output tests
// ---------------------------------------------------------------------------

describe("generated outputs", () => {
  it("should have generated/tokens.css", () => {
    const cssPath = join(stylesDir, "generated", "tokens.css");
    expect(existsSync(cssPath)).toBe(true);
    const css = readFileSync(cssPath, "utf-8");

    expect(css).toContain("DO NOT EDIT");
    expect(css).toContain(":root {");
    expect(css).toContain('[data-theme="dark"]');
    expect(css).toContain('[data-theme="light"]');
    expect(css).toContain("--kmd-color-primary");
    expect(css).toContain("--kmd-font-body");
    expect(css).toContain("--kmd-space-md");
    expect(css).toContain("--kmd-radius-md");
    expect(css).toContain("prefers-reduced-motion");
  });

  it("should have generated/unity-tokens.json", () => {
    const jsonPath = join(stylesDir, "generated", "unity-tokens.json");
    expect(existsSync(jsonPath)).toBe(true);
    const data = JSON.parse(readFileSync(jsonPath, "utf-8")) as Record<string, unknown>;

    expect(data.tokenVersion).toMatch(/^\d+\.\d+\.\d+$/);
    expect(data.defaultTheme).toBeTruthy();
    expect(data.themes).toBeDefined();
    expect(data.typography).toBeDefined();
    expect(data.platformExceptions).toBeInstanceOf(Array);
  });

  it("should have Unity tokens resolve all var() references to concrete values", () => {
    const jsonPath = join(stylesDir, "generated", "unity-tokens.json");
    const data = JSON.parse(readFileSync(jsonPath, "utf-8")) as {
      themes: Record<string, Record<string, string>>;
    };

    for (const [themeName, colors] of Object.entries(data.themes)) {
      for (const [colorName, value] of Object.entries(colors)) {
        expect(
          value,
          `Unity token "${colorName}" in theme "${themeName}" contains unresolved var()`,
        ).not.toContain("var(");
      }
    }
  });

  it("should have Unity tokens with no rgba() values (use platform exceptions)", () => {
    const jsonPath = join(stylesDir, "generated", "unity-tokens.json");
    const data = JSON.parse(readFileSync(jsonPath, "utf-8")) as {
      themes: Record<string, Record<string, string>>;
    };

    for (const [themeName, colors] of Object.entries(data.themes)) {
      for (const [colorName, value] of Object.entries(colors)) {
        expect(
          value,
          `Unity token "${colorName}" in theme "${themeName}" contains rgba() which UIToolkit does not support`,
        ).not.toContain("rgba(");
      }
    }
  });
});

// ---------------------------------------------------------------------------
// Token coverage — ensure all original kmd tokens are represented
// ---------------------------------------------------------------------------

describe("token coverage (kmd source parity)", () => {
  it("should cover all color tokens from kmd/src/tokens.css", () => {
    const tokens = loadTokens();
    const colorNames = new Set(tokens.colors.map((c) => c.name));

    const expected = [
      "primary",
      "secondary",
      "tertiary",
      "neutral",
      "surface",
      "surface-muted",
      "on-primary",
      "on-surface",
      "border",
      "info",
      "success",
      "warning",
      "danger",
      "code-bg",
      "code-text",
      "blockquote-border",
      "blockquote-text",
      "table-border",
      "table-header-bg",
      "link",
      "link-hover",
      "selection-bg",
      "scrollbar-thumb",
      "scrollbar-track",
      "outline-depth-0",
      "outline-depth-1",
      "outline-depth-2",
      "outline-depth-3",
      "outline-active-bg",
      "outline-active-border",
    ];

    for (const name of expected) {
      expect(colorNames.has(name), `missing color token "${name}"`).toBe(true);
    }
  });

  it("should cover all typography tokens from kmd/src/tokens.css", () => {
    const tokens = loadTokens();

    const fontNames = new Set(tokens.typography.fontFamilies.map((f) => f.name));
    expect(fontNames.has("body")).toBe(true);
    expect(fontNames.has("mono")).toBe(true);

    const sizeNames = new Set(tokens.typography.fontSizes.map((s) => s.name));
    const expectedSizes = [
      "headline-lg",
      "headline-md",
      "body-md",
      "body-sm",
      "code-md",
      "label-caps",
      "h3",
      "h4",
      "h5",
      "h6",
    ];
    for (const name of expectedSizes) {
      expect(sizeNames.has(name), `missing font-size token "${name}"`).toBe(true);
    }

    const weightNames = new Set(tokens.typography.fontWeights.map((w) => w.name));
    expect(weightNames.has("headline-lg")).toBe(true);
    expect(weightNames.has("headline-md")).toBe(true);
    expect(weightNames.has("label-caps")).toBe(true);

    const lhNames = new Set(tokens.typography.lineHeights.map((l) => l.name));
    expect(lhNames.has("headline-lg")).toBe(true);
    expect(lhNames.has("headline-md")).toBe(true);
    expect(lhNames.has("body-md")).toBe(true);
    expect(lhNames.has("body-sm")).toBe(true);
    expect(lhNames.has("code-md")).toBe(true);

    const lsNames = new Set(tokens.typography.letterSpacings.map((l) => l.name));
    expect(lsNames.has("label-caps")).toBe(true);
  });

  it("should cover all spacing tokens from kmd/src/tokens.css", () => {
    const tokens = loadTokens();
    const names = new Set(tokens.spacing.map((s) => s.name));
    for (const name of ["xs", "sm", "md", "lg", "xl", "xxl"]) {
      expect(names.has(name), `missing spacing token "${name}"`).toBe(true);
    }
  });

  it("should cover all radius tokens from kmd/src/tokens.css", () => {
    const tokens = loadTokens();
    const names = new Set(tokens.radii.map((r) => r.name));
    for (const name of ["sm", "md", "lg", "xl", "full"]) {
      expect(names.has(name), `missing radius token "${name}"`).toBe(true);
    }
  });

  it("should cover all width tokens from kmd/src/tokens.css", () => {
    const tokens = loadTokens();
    const names = new Set(tokens.widths.map((w) => w.name));
    for (const name of ["content-max", "toolbar-height", "sidebar-width", "toggle-width"]) {
      expect(names.has(name), `missing width token "${name}"`).toBe(true);
    }
  });

  it("should match kmd color values exactly", () => {
    const tokens = loadTokens();

    const dark = colorMap(tokens, "dark");
    expect(dark.primary).toBe("#e8eaed");
    expect(dark.tertiary).toBe("#9b6dff");
    expect(dark.surface).toBe("#222428");
    expect(dark.danger).toBe("#e8594e");

    const light = colorMap(tokens, "light");
    expect(light.primary).toBe("#15171a");
    expect(light.tertiary).toBe("#7c4dff");
    expect(light.surface).toBe("#ffffff");
    expect(light.danger).toBe("#b42318");
  });
});

// ---------------------------------------------------------------------------
// Idempotence test — generator produces same output on consecutive runs
// ---------------------------------------------------------------------------

describe("generator idempotence", () => {
  it("should produce identical output on consecutive runs", async () => {
    const { execFileSync } = await import("node:child_process");

    const cssPath = join(stylesDir, "generated", "tokens.css");
    const jsonPath = join(stylesDir, "generated", "unity-tokens.json");

    const cssBefore = readFileSync(cssPath, "utf-8");
    const jsonBefore = readFileSync(jsonPath, "utf-8");

    execFileSync("npx", ["tsx", join(stylesDir, "tokens", "generate.ts")], {
      cwd: join(stylesDir, "..", ".."),
      stdio: "pipe",
    });

    const cssAfter = readFileSync(cssPath, "utf-8");
    const jsonAfter = readFileSync(jsonPath, "utf-8");

    expect(cssAfter).toBe(cssBefore);
    expect(jsonAfter).toBe(jsonBefore);
  }, 30000);
});
