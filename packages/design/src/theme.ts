/**
 * Showcase vars → --kmd-* theme token emitter (KWEB-060, KWEB-068).
 *
 * The reader theme is a fixed projection of the design-mode showcase
 * variables (`buildShowcaseThemeVars` in ./showcase.ts) onto the `--kmd-*`
 * token set described in docs/adr/0001-designmd-theming.md. There is exactly
 * one token extractor: whatever design mode shows for a DESIGN.md is what the
 * reader is themed with. This module holds no heuristics of its own — it is a
 * mapping table plus value sanitization.
 *
 * Contract:
 * - DOM-free (runs in workers and Node).
 * - Deterministic: identical spec in → byte-identical output out.
 * - Unspecified tokens are simply not emitted, so default theme values
 *   cascade per token. An empty/undetectable spec emits nothing.
 * - Values are sanitized before emission — the design.md is untrusted
 *   Markdown and must not be able to break out of a CSS declaration.
 */

import type { DesignDocument, Diagnostic } from "./ir.js";
import { buildShowcaseThemeVars, isColorDark, normalizeTokenName } from "./showcase.js";

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface DesignThemeTokens {
  /** --kmd-* property → value, only for tokens the spec actually determines. */
  light: Record<string, string>;
  dark: Record<string, string>;
  /** Which mode the design.md authored; the other mode is derived. */
  authoredMode: "light" | "dark";
  /** True when no themeable token could be extracted (default themes intact). */
  empty: boolean;
  diagnostics: Diagnostic[];
}

// ---------------------------------------------------------------------------
// Value sanitization — design.md is untrusted; a value must not be able to
// terminate the declaration or block, pull external resources, or smuggle
// markup through the style element.
// ---------------------------------------------------------------------------

const UNSAFE_VALUE = /[;{}<>\\]|url\s*\(|expression\s*\(|@import|\/\*/i;

function isSafeCssValue(value: string): boolean {
  return value.length > 0 && value.length <= 256 && !UNSAFE_VALUE.test(value);
}

// ---------------------------------------------------------------------------
// Mapping table: showcase `--nyx-*` variable → `--kmd-*` tokens
// ---------------------------------------------------------------------------

/**
 * Per-mode color/typography/radius projection. Order is irrelevant (the CSS
 * serializer sorts), but the table is grouped by showcase variable for
 * readability. A showcase variable that is absent simply emits nothing.
 */
const MODE_MAP: ReadonlyArray<readonly [nyxVar: string, kmdTokens: readonly string[]]> = [
  // Surfaces
  ["--nyx-bg", ["--kmd-color-neutral"]],
  ["--nyx-surface", ["--kmd-color-surface"]],
  [
    "--nyx-surface-elevated",
    ["--kmd-color-surface-muted", "--kmd-color-code-bg", "--kmd-color-table-header-bg"],
  ],
  // Text
  ["--nyx-text-head", ["--kmd-color-primary", "--kmd-color-outline-depth-0"]],
  [
    "--nyx-text-body",
    ["--kmd-color-on-surface", "--kmd-color-code-text", "--kmd-color-outline-depth-1"],
  ],
  [
    "--nyx-text-muted",
    ["--kmd-color-secondary", "--kmd-color-blockquote-text", "--kmd-color-outline-depth-2"],
  ],
  ["--nyx-text-dim", ["--kmd-color-outline-depth-3"]],
  ["--nyx-btn-primary-text", ["--kmd-color-on-primary"]],
  // Dividers
  [
    "--nyx-sep",
    [
      "--kmd-color-border",
      "--kmd-color-table-border",
      "--kmd-color-blockquote-border",
      "--kmd-color-scrollbar-thumb",
    ],
  ],
  // Accent
  [
    "--nyx-accent",
    ["--kmd-color-tertiary", "--kmd-color-link", "--kmd-color-outline-active-border"],
  ],
  ["--nyx-accent-hover", ["--kmd-color-link-hover"]],
  ["--nyx-accent-bg", ["--kmd-color-selection-bg", "--kmd-color-outline-active-bg"]],
  // Semantic status
  ["--nyx-positive", ["--kmd-color-success"]],
  ["--nyx-warning", ["--kmd-color-warning"]],
  ["--nyx-error", ["--kmd-color-danger"]],
  ["--nyx-info", ["--kmd-color-info"]],
  // Typography
  ["--nyx-font-body", ["--kmd-font-body"]],
  ["--nyx-font-heading", ["--kmd-font-heading"]],
  ["--nyx-font-code", ["--kmd-font-mono"]],
  ["--nyx-body-size", ["--kmd-font-size-body-md"]],
  ["--nyx-body-line", ["--kmd-line-height-body-md"]],
  ["--nyx-heading-weight", ["--kmd-font-weight-headline-lg", "--kmd-font-weight-headline-md"]],
  ["--nyx-heading-line", ["--kmd-line-height-headline-lg", "--kmd-line-height-headline-md"]],
  ["--nyx-code-size", ["--kmd-font-size-code-md"]],
  ["--nyx-code-line", ["--kmd-line-height-code-md"]],
  ["--nyx-label-size", ["--kmd-font-size-label-caps"]],
  ["--nyx-label-weight", ["--kmd-font-weight-label-caps"]],
  ["--nyx-label-track", ["--kmd-letter-spacing-label-caps"]],
  // Radii — the showcase's size scale only. Its component radii
  // (btn/tag/badge/card) are deliberately NOT projected: a pill button radius
  // must never land on code blocks or alerts.
  ["--nyx-radius-sm", ["--kmd-radius-sm"]],
  ["--nyx-radius-md", ["--kmd-radius-md"]],
  ["--nyx-radius-lg", ["--kmd-radius-lg"]],
  ["--nyx-radius-xl", ["--kmd-radius-xl"]],
  ["--nyx-radius-full", ["--kmd-radius-full"]],
];

/**
 * Semantic aliases re-emitted as var() references on the scope element.
 *
 * The default themes declare these on the ancestor carrying the theme
 * selector, and custom properties inherit by COMPUTED value — an alias like
 * `--kmd-color-background: var(--kmd-color-neutral)` is baked to the default
 * neutral at that ancestor, so overriding the base token on the scoped
 * element alone never reaches it. Declaring the aliases on the scope makes
 * them resolve there, against the overridden bases.
 */
const ALIASES: Readonly<Record<string, string>> = {
  "--kmd-color-heading": "var(--kmd-color-primary)",
  "--kmd-color-body": "var(--kmd-color-on-surface)",
  "--kmd-color-muted": "var(--kmd-color-secondary)",
  "--kmd-color-accent": "var(--kmd-color-tertiary)",
  "--kmd-color-background": "var(--kmd-color-neutral)",
  "--kmd-color-card": "var(--kmd-color-surface)",
  "--kmd-focus-outline-color": "var(--kmd-color-tertiary)",
};

function projectMode(vars: ReadonlyMap<string, string>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [nyxVar, kmdTokens] of MODE_MAP) {
    const value = vars.get(nyxVar);
    if (value === undefined) continue;
    const trimmed = value.trim();
    if (!isSafeCssValue(trimmed)) continue;
    for (const token of kmdTokens) out[token] = trimmed;
  }
  if (Object.keys(out).length > 0) {
    for (const [alias, ref] of Object.entries(ALIASES)) out[alias] = ref;
  }
  return out;
}

// ---------------------------------------------------------------------------
// Authored-mode detection (informational — both modes are always emitted)
// ---------------------------------------------------------------------------

const AUTHORED_BG_NAME = /\b(?:background|bg|canvas|page)\b/;
const AUTHORED_SURFACE_NAME = /\bsurface\b/;
const AUTHORED_TEXT_NAME = /\b(?:text|ink|foreground|body|heading)\b/;

/**
 * The mode the design.md was written for: the polarity of its page
 * background, else its surface, else the inverse of its text color. Falls
 * back to "light" when nothing parseable is declared.
 */
function detectAuthoredMode(doc: DesignDocument): "light" | "dark" {
  const tokens = doc.spec.colorTokens ?? [];
  const pick = (pattern: RegExp): boolean | null => {
    for (const token of tokens) {
      if (!pattern.test(normalizeTokenName(token.name))) continue;
      const dark = isColorDark(token.value);
      if (dark !== null) return dark;
    }
    return null;
  };
  const bgDark = pick(AUTHORED_BG_NAME) ?? pick(AUTHORED_SURFACE_NAME);
  if (bgDark !== null) return bgDark ? "dark" : "light";
  const textDark = pick(AUTHORED_TEXT_NAME);
  if (textDark !== null) return textDark ? "light" : "dark";
  return "light";
}

// ---------------------------------------------------------------------------
// emitThemeTokens
// ---------------------------------------------------------------------------

/**
 * Map a pipeline result to `--kmd-*` overrides for both modes.
 *
 * The input document is not mutated. See the ADR for the mapping table and
 * fallback behavior.
 */
export function emitThemeTokens(doc: DesignDocument): DesignThemeTokens {
  const diagnostics: Diagnostic[] = [];
  const vars = buildShowcaseThemeVars(doc);
  const light = vars ? projectMode(vars.light) : {};
  const dark = vars ? projectMode(vars.dark) : {};
  const empty = Object.keys(light).length === 0 && Object.keys(dark).length === 0;

  if (empty) {
    diagnostics.push({
      severity: "info",
      token: "design-theme",
      message: "No themeable tokens could be extracted; default themes are unchanged.",
    });
  }

  return {
    light,
    dark,
    authoredMode: empty ? "dark" : detectAuthoredMode(doc),
    empty,
    diagnostics,
  };
}

// ---------------------------------------------------------------------------
// designThemeCss
// ---------------------------------------------------------------------------

const SCOPE_ID = /^[A-Za-z0-9_-]+$/;

/**
 * Serialize a DesignThemeTokens result to scoped CSS (see ADR §3).
 *
 * Structure: a dark (default) block on the design-scoped element, explicit
 * light selectors for all three activation methods (ancestor and self), and
 * a `prefers-color-scheme: light` fallback mirroring the generated tokens'
 * guard. Properties are sorted; output is deterministic.
 *
 * Returns "" for an empty result or an invalid scope id (scope ids come from
 * content hashes, so an invalid id indicates a caller bug — but this function
 * must never produce a selector-injectable string).
 */
export function designThemeCss(tokens: DesignThemeTokens, scopeId: string): string {
  if (tokens.empty || !SCOPE_ID.test(scopeId)) return "";

  const block = (map: Record<string, string>, indent: string): string =>
    Object.keys(map)
      .sort()
      .map((k) => `${indent}${k}: ${map[k]};`)
      .join("\n");

  const scope = `[data-kmd-design="${scopeId}"]`;
  const parts: string[] = [];

  if (Object.keys(tokens.dark).length > 0) {
    parts.push(`${scope} {\n${block(tokens.dark, "  ")}\n}`);
  }

  if (Object.keys(tokens.light).length > 0) {
    const lightSelectors = [
      `[data-theme="light"] ${scope}`,
      `[data-kmd-theme="light"] ${scope}`,
      `.kmd-theme-light ${scope}`,
      `${scope}[data-theme="light"]`,
      `${scope}[data-kmd-theme="light"]`,
      `${scope}.kmd-theme-light`,
    ].join(",\n");
    parts.push(`${lightSelectors} {\n${block(tokens.light, "  ")}\n}`);

    const guard =
      ":root:not([data-theme]):not([data-kmd-theme]):not(.kmd-theme-light):not(.kmd-theme-dark):not(.kmd-theme-sepia)";
    parts.push(
      `@media (prefers-color-scheme: light) {\n  ${guard} ${scope} {\n${block(tokens.light, "    ")}\n  }\n}`,
    );
  }

  return parts.length > 0 ? `${parts.join("\n\n")}\n` : "";
}
