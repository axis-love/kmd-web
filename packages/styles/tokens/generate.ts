/**
 * kmd-web token generator
 *
 * Reads the canonical token schema (tokens/schema.json) and token data
 * (tokens/tokens.json), validates the data against the schema, and produces:
 *
 * 1. generated/tokens.css       — CSS custom properties for web consumers
 * 2. generated/unity-tokens.json — Unity-consumable token data
 *
 * The generator is deterministic: running it twice with the same input
 * produces byte-identical output. Tests verify idempotence.
 *
 * Usage: npx tsx packages/styles/tokens/generate.ts
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

// ---------------------------------------------------------------------------
// Types — mirror the schema structure for type-safe access
// ---------------------------------------------------------------------------

interface ColorToken {
  readonly name: string;
  readonly description: string;
  readonly values: Record<string, string>;
}

interface SemanticColorToken {
  readonly name: string;
  readonly description: string;
  readonly reference: string;
}

interface FontFamily {
  readonly name: string;
  readonly value: string;
  readonly unityFallback: string;
}

interface FontSize {
  readonly name: string;
  readonly value: string;
}

interface FontWeight {
  readonly name: string;
  readonly value: number;
}

interface LineHeight {
  readonly name: string;
  readonly value: number;
}

interface LetterSpacing {
  readonly name: string;
  readonly value: string;
}

interface SpacingToken {
  readonly name: string;
  readonly value: string;
}

interface RadiusToken {
  readonly name: string;
  readonly value: string;
}

interface WidthToken {
  readonly name: string;
  readonly value: string;
}

interface DurationToken {
  readonly name: string;
  readonly value: string;
}

interface EasingToken {
  readonly name: string;
  readonly value: string;
}

interface PlatformException {
  readonly token: string;
  readonly platform: string;
  readonly reason: string;
  readonly webValue: string;
  readonly platformValue: string;
}

interface TokenSchema {
  readonly version: string;
  readonly themes: {
    readonly default: string;
    readonly variants: readonly string[];
  };
  readonly colors: readonly ColorToken[];
  readonly semanticColors?: readonly SemanticColorToken[];
  readonly typography: {
    readonly fontFamilies: readonly FontFamily[];
    readonly fontSizes: readonly FontSize[];
    readonly fontWeights: readonly FontWeight[];
    readonly lineHeights: readonly LineHeight[];
    readonly letterSpacings: readonly LetterSpacing[];
  };
  readonly spacing: readonly SpacingToken[];
  readonly radii: readonly RadiusToken[];
  readonly widths: readonly WidthToken[];
  readonly motion: {
    readonly durations: readonly DurationToken[];
    readonly easings: readonly EasingToken[];
  };
  readonly accessibility: {
    readonly reducedMotion: {
      readonly query: string;
      readonly durationOverride: string;
      readonly iterationOverride: string;
    };
    readonly focusOutline: {
      readonly width: string;
      readonly style: string;
      readonly colorToken: string;
    };
  };
  readonly platformExceptions: readonly PlatformException[];
}

// ---------------------------------------------------------------------------
// Schema validation
// ---------------------------------------------------------------------------

class SchemaValidationError extends Error {
  readonly errors: readonly string[];

  constructor(errors: readonly string[]) {
    super(`Token schema validation failed:\n${errors.map((e) => `  - ${e}`).join("\n")}`);
    this.name = "SchemaValidationError";
    this.errors = errors;
  }
}

/**
 * Validate the token data against the schema constraints.
 * This is a focused validator, not a full JSON Schema implementation —
 * it checks the structural invariants that matter for generation.
 */
function validateTokens(tokens: unknown): TokenSchema {
  const t = tokens as TokenSchema;
  const errors: string[] = [];

  if (typeof t.version !== "string" || !/^\d+\.\d+\.\d+$/.test(t.version)) {
    errors.push("version must be a semantic version string (e.g. 1.0.0)");
  }

  if (!t.themes || typeof t.themes.default !== "string" || !Array.isArray(t.themes.variants)) {
    errors.push("themes must have a default string and a variants array");
  } else {
    if (!t.themes.variants.includes(t.themes.default)) {
      errors.push(
        `themes.default "${t.themes.default}" is not in variants [${t.themes.variants.join(", ")}]`,
      );
    }
    if (t.themes.variants.length === 0) {
      errors.push("themes.variants must have at least one variant");
    }
  }

  if (!Array.isArray(t.colors)) {
    errors.push("colors must be an array");
  } else {
    for (let i = 0; i < t.colors.length; i++) {
      const c = t.colors[i];
      if (typeof c?.name !== "string" || !/^[a-z][a-z0-9-]*$/.test(c.name)) {
        errors.push(`colors[${i}].name must be kebab-case`);
      }
      if (typeof c?.description !== "string") {
        errors.push(`colors[${i}].description must be a string`);
      }
      if (!c?.values || typeof c.values !== "object") {
        errors.push(`colors[${i}].values must be an object`);
      } else {
        for (const theme of t.themes.variants) {
          if (!(theme in c.values)) {
            errors.push(`colors[${i}] ("${c.name}") missing value for theme "${theme}"`);
          } else {
            const v = c.values[theme];
            if (
              typeof v !== "string" ||
              (!/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(v) &&
                !v.startsWith("rgba(") &&
                v !== "transparent")
            ) {
              errors.push(
                `colors[${i}] ("${c.name}") value for theme "${theme}" is not a valid hex, rgba, or "transparent": "${v}"`,
              );
            }
          }
        }
      }
    }
  }

  if (t.semanticColors && Array.isArray(t.semanticColors)) {
    const colorNames = new Set(t.colors.map((c) => c.name));
    for (let i = 0; i < t.semanticColors.length; i++) {
      const s = t.semanticColors[i];
      if (typeof s?.name !== "string" || !/^[a-z][a-z0-9-]*$/.test(s.name)) {
        errors.push(`semanticColors[${i}].name must be kebab-case`);
      }
      if (typeof s?.reference !== "string" || !colorNames.has(s.reference)) {
        errors.push(
          `semanticColors[${i}] ("${s?.name}") references unknown color "${s?.reference}"`,
        );
      }
    }
  }

  if (!t.typography || typeof t.typography !== "object") {
    errors.push("typography must be an object");
  } else {
    const tk = t.typography;
    if (!Array.isArray(tk.fontFamilies)) {
      errors.push("typography.fontFamilies must be an array");
    } else {
      for (let i = 0; i < tk.fontFamilies.length; i++) {
        const f = tk.fontFamilies[i];
        if (typeof f?.name !== "string" || !/^[a-z][a-z0-9-]*$/.test(f.name)) {
          errors.push(`fontFamilies[${i}].name must be kebab-case`);
        }
        if (typeof f?.value !== "string") {
          errors.push(`fontFamilies[${i}].value must be a string`);
        }
        if (typeof f?.unityFallback !== "string") {
          errors.push(`fontFamilies[${i}].unityFallback must be a string`);
        }
      }
    }
    if (!Array.isArray(tk.fontSizes)) errors.push("typography.fontSizes must be an array");
    if (!Array.isArray(tk.fontWeights)) errors.push("typography.fontWeights must be an array");
    if (!Array.isArray(tk.lineHeights)) errors.push("typography.lineHeights must be an array");
    if (!Array.isArray(tk.letterSpacings))
      errors.push("typography.letterSpacings must be an array");
  }

  if (!Array.isArray(t.spacing)) errors.push("spacing must be an array");
  if (!Array.isArray(t.radii)) errors.push("radii must be an array");
  if (!Array.isArray(t.widths)) errors.push("widths must be an array");

  if (!t.motion || typeof t.motion !== "object") {
    errors.push("motion must be an object");
  } else {
    if (!Array.isArray(t.motion.durations)) errors.push("motion.durations must be an array");
    if (!Array.isArray(t.motion.easings)) errors.push("motion.easings must be an array");
  }

  if (!t.accessibility || typeof t.accessibility !== "object") {
    errors.push("accessibility must be an object");
  } else {
    if (!t.accessibility.reducedMotion || typeof t.accessibility.reducedMotion !== "object") {
      errors.push("accessibility.reducedMotion must be an object");
    }
    if (!t.accessibility.focusOutline || typeof t.accessibility.focusOutline !== "object") {
      errors.push("accessibility.focusOutline must be an object");
    }
  }

  if (!Array.isArray(t.platformExceptions)) {
    errors.push("platformExceptions must be an array");
  }

  if (errors.length > 0) {
    throw new SchemaValidationError(errors);
  }

  return t;
}

/**
 * Validate that semantic color references resolve to existing color tokens.
 */
function validateSemanticReferences(tokens: TokenSchema): void {
  if (!tokens.semanticColors) return;
  const colorNames = new Set(tokens.colors.map((c) => c.name));
  const errors: string[] = [];

  for (const s of tokens.semanticColors) {
    if (!colorNames.has(s.reference)) {
      errors.push(`Semantic color "${s.name}" references unknown color "${s.reference}"`);
    }
  }

  if (errors.length > 0) {
    throw new SchemaValidationError(errors);
  }
}

/**
 * Validate that focus outline color token reference resolves.
 */
function validateFocusOutlineReference(tokens: TokenSchema): void {
  const colorNames = new Set(tokens.colors.map((c) => c.name));
  const ref = tokens.accessibility.focusOutline.colorToken;
  if (!colorNames.has(ref)) {
    throw new SchemaValidationError([
      `accessibility.focusOutline.colorToken "${ref}" is not a known color token`,
    ]);
  }
}

// ---------------------------------------------------------------------------
// CSS generation
// ---------------------------------------------------------------------------

/**
 * Generate CSS custom properties for all themes.
 *
 * Output format:
 *   :root {
 *     --kmd-...: <value>;
 *   }
 *   [data-theme="dark"] { ... }
 *   [data-theme="light"] { ... }
 *   @media (prefers-reduced-motion: reduce) { ... }
 */
function generateCss(tokens: TokenSchema): string {
  const lines: string[] = [];

  // Header comment
  lines.push("/* @axis-love/styles — Generated design tokens");
  lines.push(" * Source: tokens/tokens.json (schema: tokens/schema.json)");
  lines.push(` * Token version: ${tokens.version}`);
  lines.push(" * DO NOT EDIT — regenerate with: npx tsx packages/styles/tokens/generate.ts");
  lines.push(" */");
  lines.push("");

  // :root — theme-independent tokens (typography, spacing, radii, widths, motion, accessibility)
  lines.push(":root {");

  // Font families
  for (const f of tokens.typography.fontFamilies) {
    lines.push(`  --kmd-font-${f.name}: ${f.value};`);
  }
  lines.push("");

  // Font sizes
  for (const s of tokens.typography.fontSizes) {
    lines.push(`  --kmd-font-size-${s.name}: ${s.value};`);
  }
  lines.push("");

  // Font weights
  for (const w of tokens.typography.fontWeights) {
    lines.push(`  --kmd-font-weight-${w.name}: ${w.value};`);
  }
  lines.push("");

  // Line heights
  for (const lh of tokens.typography.lineHeights) {
    lines.push(`  --kmd-line-height-${lh.name}: ${lh.value};`);
  }
  lines.push("");

  // Letter spacings
  for (const ls of tokens.typography.letterSpacings) {
    lines.push(`  --kmd-letter-spacing-${ls.name}: ${ls.value};`);
  }
  lines.push("");

  // Radii
  for (const r of tokens.radii) {
    lines.push(`  --kmd-radius-${r.name}: ${r.value};`);
  }
  lines.push("");

  // Spacing
  for (const s of tokens.spacing) {
    lines.push(`  --kmd-space-${s.name}: ${s.value};`);
  }
  lines.push("");

  // Widths
  for (const w of tokens.widths) {
    lines.push(`  --kmd-width-${w.name}: ${w.value};`);
  }
  lines.push("");

  // Motion durations
  for (const d of tokens.motion.durations) {
    lines.push(`  --kmd-duration-${d.name}: ${d.value};`);
  }
  lines.push("");

  // Motion easings
  for (const e of tokens.motion.easings) {
    lines.push(`  --kmd-easing-${e.name}: ${e.value};`);
  }
  lines.push("");

  // Focus outline
  const fo = tokens.accessibility.focusOutline;
  lines.push(`  --kmd-focus-outline-width: ${fo.width};`);
  lines.push(`  --kmd-focus-outline-style: ${fo.style};`);
  lines.push(`  --kmd-focus-outline-color: var(--kmd-color-${fo.colorToken});`);

  lines.push("}");

  // Theme-specific color tokens
  for (const theme of tokens.themes.variants) {
    lines.push("");
    lines.push(`[data-theme="${theme}"] {`);

    // Base colors
    for (const c of tokens.colors) {
      const value = c.values[theme];
      lines.push(`  --kmd-color-${c.name}: ${value};`);
    }

    // Semantic colors (resolved to var() references)
    if (tokens.semanticColors) {
      lines.push("");
      for (const s of tokens.semanticColors) {
        lines.push(`  --kmd-color-${s.name}: var(--kmd-color-${s.reference});`);
      }
    }

    lines.push("}");
  }

  // Reduced motion override
  const rm = tokens.accessibility.reducedMotion;
  lines.push("");
  lines.push(`@media ${rm.query} {`);
  lines.push("  *,");
  lines.push("  *::before,");
  lines.push("  *::after {");
  lines.push(`    animation-duration: ${rm.durationOverride} !important;`);
  lines.push(`    animation-iteration-count: ${rm.iterationOverride} !important;`);
  lines.push(`    transition-duration: ${rm.durationOverride} !important;`);
  lines.push("  }");
  lines.push("}");

  lines.push("");

  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// Unity token generation
// ---------------------------------------------------------------------------

/**
 * Generate Unity-consumable token data.
 *
 * Unity UIToolkit (USS) supports custom properties but has limitations:
 * - No var() references within USS custom property values
 * - No rgba() with alpha (must use solid colors)
 * - Font assets instead of CSS font-family stacks
 *
 * This output resolves all var() references, substitutes platform exceptions,
 * and provides flattened per-theme color values suitable for USS generation.
 */
function generateUnityTokens(tokens: TokenSchema): string {
  // Build a lookup of platform exceptions for Unity
  const exceptions = new Map<string, PlatformException>();
  for (const ex of tokens.platformExceptions) {
    if (ex.platform === "unity") {
      exceptions.set(ex.token, ex);
    }
  }

  // Build color maps per theme, resolving semantic colors
  const themes: Record<string, Record<string, string>> = {};
  for (const theme of tokens.themes.variants) {
    const colorMap: Record<string, string> = {};
    for (const c of tokens.colors) {
      let value = c.values[theme];
      // Apply platform exception if one exists
      const ex = exceptions.get(c.name);
      if (ex) {
        value = ex.platformValue;
      }
      colorMap[c.name] = value;
    }
    // Resolve semantic colors to concrete values
    if (tokens.semanticColors) {
      for (const s of tokens.semanticColors) {
        colorMap[s.name] = colorMap[s.reference] ?? "";
      }
    }
    themes[theme] = colorMap;
  }

  // Build font family map (use Unity fallbacks)
  const fontFamilies: Record<string, string> = {};
  for (const f of tokens.typography.fontFamilies) {
    fontFamilies[f.name] = f.unityFallback;
  }

  // Build focus outline, resolving color token reference
  const fo = tokens.accessibility.focusOutline;
  const focusOutline = {
    width: fo.width,
    style: fo.style,
    color: themes[tokens.themes.default]?.[fo.colorToken] ?? "",
  };

  // Build platform exceptions summary
  const platformExceptionsList = tokens.platformExceptions.map((ex) => ({
    token: ex.token,
    platform: ex.platform,
    reason: ex.reason,
    webValue: ex.webValue,
    platformValue: ex.platformValue,
  }));

  const output = {
    tokenVersion: tokens.version,
    defaultTheme: tokens.themes.default,
    themes,
    typography: {
      fontFamilies,
      fontSizes: Object.fromEntries(tokens.typography.fontSizes.map((s) => [s.name, s.value])),
      fontWeights: Object.fromEntries(tokens.typography.fontWeights.map((w) => [w.name, w.value])),
      lineHeights: Object.fromEntries(
        tokens.typography.lineHeights.map((lh) => [lh.name, lh.value]),
      ),
      letterSpacings: Object.fromEntries(
        tokens.typography.letterSpacings.map((ls) => [ls.name, ls.value]),
      ),
    },
    spacing: Object.fromEntries(tokens.spacing.map((s) => [s.name, s.value])),
    radii: Object.fromEntries(tokens.radii.map((r) => [r.name, r.value])),
    widths: Object.fromEntries(tokens.widths.map((w) => [w.name, w.value])),
    motion: {
      durations: Object.fromEntries(tokens.motion.durations.map((d) => [d.name, d.value])),
      easings: Object.fromEntries(tokens.motion.easings.map((e) => [e.name, e.value])),
    },
    accessibility: {
      reducedMotion: tokens.accessibility.reducedMotion,
      focusOutline,
    },
    platformExceptions: platformExceptionsList,
  };

  return `${JSON.stringify(output, null, 2)}\n`;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

const __dirname = dirname(fileURLToPath(import.meta.url));
const stylesDir = resolve(__dirname, "..");

function main(): void {
  const schemaPath = join(stylesDir, "tokens", "schema.json");
  const tokensPath = join(stylesDir, "tokens", "tokens.json");
  const generatedDir = join(stylesDir, "generated");

  if (!existsSync(schemaPath)) {
    throw new Error(`Schema file not found: ${schemaPath}`);
  }
  if (!existsSync(tokensPath)) {
    throw new Error(`Tokens file not found: ${tokensPath}`);
  }

  const tokensRaw = readFileSync(tokensPath, "utf-8");

  // Schema file existence is checked above; we don't parse it at runtime
  // because validateTokens() implements the structural checks directly.
  void schemaPath;
  const tokens = JSON.parse(tokensRaw);

  // Validate
  const validated = validateTokens(tokens);
  validateSemanticReferences(validated);
  validateFocusOutlineReference(validated);

  // Generate
  const css = generateCss(validated);
  const unity = generateUnityTokens(validated);

  // Write outputs
  mkdirSync(generatedDir, { recursive: true });
  writeFileSync(join(generatedDir, "tokens.css"), css, "utf-8");
  writeFileSync(join(generatedDir, "unity-tokens.json"), unity, "utf-8");

  console.log("Token generation complete:");
  console.log(`  Schema version: ${validated.version}`);
  console.log(`  Themes: ${validated.themes.variants.join(", ")}`);
  console.log(`  Colors: ${validated.colors.length}`);
  console.log(`  Semantic colors: ${validated.semanticColors?.length ?? 0}`);
  console.log(`  Font families: ${validated.typography.fontFamilies.length}`);
  console.log(`  Font sizes: ${validated.typography.fontSizes.length}`);
  console.log(`  Spacing: ${validated.spacing.length}`);
  console.log(`  Radii: ${validated.radii.length}`);
  console.log(`  Widths: ${validated.widths.length}`);
  console.log(`  Motion durations: ${validated.motion.durations.length}`);
  console.log(`  Motion easings: ${validated.motion.easings.length}`);
  console.log(`  Platform exceptions: ${validated.platformExceptions.length}`);
  console.log(`  Output: ${generatedDir}/tokens.css, ${generatedDir}/unity-tokens.json`);
}

main();
