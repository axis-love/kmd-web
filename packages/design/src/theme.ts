/**
 * Resolved-spec → --kmd-* theme token emitter (KWEB-060).
 *
 * Maps an enriched DesignDocument to scoped light + dark `--kmd-*`
 * custom-property sets per docs/adr/0001-designmd-theming.md. The mapping is
 * role-based (enrich stage roles), never name-based: a design.md's "primary"
 * is its brand color, not kmd's primary *text* color.
 *
 * Contract:
 * - DOM-free (runs in workers and Node).
 * - Deterministic: identical spec in → byte-identical output out.
 * - Unspecified tokens are simply not emitted, so default theme values
 *   cascade per token. An empty/undetectable spec emits nothing.
 * - Values are sanitized before emission — the design.md is untrusted
 *   Markdown and must not be able to break out of a CSS declaration.
 */

import { enrichSpec } from "./enrich.js";
import type { ColorRole, ColorToken, DesignDocument, Diagnostic } from "./ir.js";
import { emptyDesignDocument } from "./ir.js";

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

type Mode = "light" | "dark";

// ---------------------------------------------------------------------------
// Color parsing (hex / rgb / rgba only — anything else is passed through
// verbatim in the authored mode and dropped from the derived mode)
// ---------------------------------------------------------------------------

interface Rgba {
  r: number;
  g: number;
  b: number;
  a: number;
}

function parseColor(value: string): Rgba | null {
  const v = value.trim();

  let m = v.match(/^#([0-9a-f]{3})$/i);
  if (m) {
    const [r, g, b] = m[1]!.split("").map((c) => parseInt(c + c, 16));
    return { r: r!, g: g!, b: b!, a: 1 };
  }

  m = v.match(/^#([0-9a-f]{6})([0-9a-f]{2})?$/i);
  if (m) {
    const hex = m[1]!;
    return {
      r: parseInt(hex.slice(0, 2), 16),
      g: parseInt(hex.slice(2, 4), 16),
      b: parseInt(hex.slice(4, 6), 16),
      a: m[2] ? parseInt(m[2], 16) / 255 : 1,
    };
  }

  m = v.match(/^rgba?\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*(?:,\s*([\d.]+)\s*)?\)$/i);
  if (m) {
    const r = Number(m[1]);
    const g = Number(m[2]);
    const b = Number(m[3]);
    if (r > 255 || g > 255 || b > 255) return null;
    const a = m[4] !== undefined ? Number(m[4]) : 1;
    if (!Number.isFinite(a) || a < 0 || a > 1) return null;
    return { r, g, b, a };
  }

  return null;
}

interface Hsl {
  h: number;
  s: number;
  l: number;
}

function rgbToHsl({ r, g, b }: Rgba): Hsl {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;
  if (max === min) return { h: 0, s: 0, l };
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h: number;
  if (max === rn) h = ((gn - bn) / d + (gn < bn ? 6 : 0)) / 6;
  else if (max === gn) h = ((bn - rn) / d + 2) / 6;
  else h = ((rn - gn) / d + 4) / 6;
  return { h, s, l };
}

function hslToRgb({ h, s, l }: Hsl): Rgba {
  if (s === 0) {
    const v = Math.round(l * 255);
    return { r: v, g: v, b: v, a: 1 };
  }
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const hue = (t: number): number => {
    let tt = t;
    if (tt < 0) tt += 1;
    if (tt > 1) tt -= 1;
    if (tt < 1 / 6) return p + (q - p) * 6 * tt;
    if (tt < 1 / 2) return q;
    if (tt < 2 / 3) return p + (q - p) * (2 / 3 - tt) * 6;
    return p;
  };
  return {
    r: Math.round(hue(h + 1 / 3) * 255),
    g: Math.round(hue(h) * 255),
    b: Math.round(hue(h - 1 / 3) * 255),
    a: 1,
  };
}

function toHex({ r, g, b }: Rgba): string {
  const c = (n: number) => n.toString(16).padStart(2, "0");
  return `#${c(r)}${c(g)}${c(b)}`;
}

/** WCAG 2.x relative luminance of an sRGB color, 0–1. */
function luminance({ r, g, b }: Rgba): number {
  const lin = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

/** Shift HSL lightness by delta (clamped 0–1) and return hex. */
function shiftLightness(rgba: Rgba, delta: number): string {
  const hsl = rgbToHsl(rgba);
  return toHex(hslToRgb({ ...hsl, l: Math.min(1, Math.max(0, hsl.l + delta)) }));
}

/** Linear sRGB-channel mix of a toward b by t (0–1), returned as hex. */
function mix(a: Rgba, b: Rgba, t: number): string {
  const ch = (x: number, y: number) => Math.round(x + (y - x) * t);
  return toHex({ r: ch(a.r, b.r), g: ch(a.g, b.g), b: ch(a.b, b.b), a: 1 });
}

function rgbaString(c: Rgba, alpha: number): string {
  return `rgba(${c.r},${c.g},${c.b},${alpha})`;
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
// Role collection
// ---------------------------------------------------------------------------

/**
 * Gather color tokens from the spec: the enriched token array plus synthetic
 * tokens for flat-map-only entries. Enrichment runs on a scratch copy so the
 * input document is never mutated.
 */
function collectColorTokens(doc: DesignDocument): ColorToken[] {
  const tokens: ColorToken[] = (doc.spec.colorTokens ?? []).map((t) => ({ ...t }));
  const known = new Set(tokens.map((t) => t.name));
  for (const [name, value] of Object.entries(doc.spec.colors)) {
    if (!known.has(name)) {
      tokens.push({ name, value, provenance: { extractor: "theme-emitter" } });
    }
  }
  if (tokens.length === 0) return tokens;

  const scratch = emptyDesignDocument("");
  scratch.spec.colorTokens = tokens;
  enrichSpec(scratch);
  return tokens;
}

/** First token carrying the given role, in spec order. */
function firstWithRole(tokens: readonly ColorToken[], role: ColorRole): ColorToken | undefined {
  return tokens.find((t) => t.role === role);
}

interface RoleSlots {
  accent?: ColorToken;
  background?: ColorToken;
  surface?: ColorToken;
  text?: ColorToken;
  textMuted?: ColorToken;
  divider?: ColorToken;
  success?: ColorToken;
  warning?: ColorToken;
  error?: ColorToken;
  info?: ColorToken;
}

function collectRoles(tokens: readonly ColorToken[]): RoleSlots {
  return {
    accent: firstWithRole(tokens, "accent") ?? firstWithRole(tokens, "brand"),
    background: firstWithRole(tokens, "background"),
    surface: firstWithRole(tokens, "surface"),
    text: firstWithRole(tokens, "text"),
    textMuted: firstWithRole(tokens, "text-muted"),
    divider: firstWithRole(tokens, "divider"),
    success: firstWithRole(tokens, "success"),
    warning: firstWithRole(tokens, "warning"),
    error: firstWithRole(tokens, "error"),
    info: firstWithRole(tokens, "info"),
  };
}

// ---------------------------------------------------------------------------
// Dark/light derivation
// ---------------------------------------------------------------------------

const NEUTRAL_SATURATION = 0.15;

/**
 * Derive the opposing-mode counterpart of a color per the ADR rules:
 * near-neutrals invert lightness; chromatic colors keep hue/saturation with
 * lightness clamped into the readable band for the target mode.
 * Returns null when the value cannot be parsed.
 */
function deriveOpposing(value: string, targetMode: Mode): string | null {
  const rgba = parseColor(value);
  if (!rgba) return null;
  const hsl = rgbToHsl(rgba);
  let l: number;
  if (hsl.s < NEUTRAL_SATURATION) {
    l = 1 - hsl.l;
  } else {
    l = targetMode === "dark" ? Math.max(hsl.l, 0.6) : Math.min(hsl.l, 0.45);
  }
  const out = hslToRgb({ ...hsl, l });
  if (rgba.a < 1) return rgbaString(out, rgba.a);
  return toHex(out);
}

// ---------------------------------------------------------------------------
// Mode expansion — role values → --kmd-* token map
// ---------------------------------------------------------------------------

type RoleValues = Partial<
  Record<
    | "accent"
    | "background"
    | "surface"
    | "text"
    | "textMuted"
    | "divider"
    | "success"
    | "warning"
    | "error"
    | "info",
    string
  >
>;

function expandMode(roles: RoleValues, mode: Mode): Record<string, string> {
  const out: Record<string, string> = {};
  const set = (token: string, value: string | undefined | null) => {
    if (value && isSafeCssValue(value)) out[token] = value;
  };

  const accent = roles.accent;
  const accentRgba = accent ? parseColor(accent) : null;
  set("--kmd-color-tertiary", accent);
  set("--kmd-color-link", accent);
  set("--kmd-color-outline-active-border", accent);
  if (accentRgba) {
    set("--kmd-color-link-hover", shiftLightness(accentRgba, 0.08));
    set("--kmd-color-selection-bg", rgbaString(accentRgba, mode === "dark" ? 0.3 : 0.15));
    set("--kmd-color-outline-active-bg", rgbaString(accentRgba, mode === "dark" ? 0.12 : 0.1));
  }

  set("--kmd-color-neutral", roles.background);

  const text = roles.text;
  const textRgba = text ? parseColor(text) : null;
  set("--kmd-color-primary", text);
  set("--kmd-color-on-surface", text);
  set("--kmd-color-code-text", text);
  set("--kmd-color-outline-depth-0", text);
  set("--kmd-color-outline-depth-1", text);
  if (text) {
    // Text drawn on primary-colored fills: the mode's background (or surface).
    set("--kmd-color-on-primary", roles.background ?? roles.surface);
  }

  const surface = roles.surface;
  const surfaceRgba = surface ? parseColor(surface) : null;
  set("--kmd-color-surface", surface);
  if (surfaceRgba) {
    // Muted surface: nudge toward the text color (matches default themes'
    // slightly-lifted code/table backgrounds); without a parseable text
    // color, shift lightness toward the mode's opposite extreme.
    const muted = textRgba
      ? mix(surfaceRgba, textRgba, 0.07)
      : shiftLightness(surfaceRgba, mode === "dark" ? 0.05 : -0.05);
    set("--kmd-color-surface-muted", muted);
    set("--kmd-color-code-bg", muted);
    set("--kmd-color-table-header-bg", muted);
  }

  const textMuted = roles.textMuted;
  const textMutedRgba = textMuted ? parseColor(textMuted) : null;
  set("--kmd-color-secondary", textMuted);
  set("--kmd-color-blockquote-text", textMuted);
  set("--kmd-color-outline-depth-2", textMuted);
  if (textMutedRgba) {
    const bgRgba = roles.background ? parseColor(roles.background) : null;
    if (bgRgba) {
      set("--kmd-color-outline-depth-3", mix(textMutedRgba, bgRgba, 0.35));
    }
  }

  set("--kmd-color-border", roles.divider);
  set("--kmd-color-table-border", roles.divider);
  set("--kmd-color-blockquote-border", roles.divider);
  set("--kmd-color-scrollbar-thumb", roles.divider);

  set("--kmd-color-success", roles.success);
  set("--kmd-color-warning", roles.warning);
  set("--kmd-color-danger", roles.error);
  set("--kmd-color-info", roles.info);

  return out;
}

// ---------------------------------------------------------------------------
// Fonts and radii (mode-independent)
// ---------------------------------------------------------------------------

/** Extract a font-family string from a typography token value. */
function familyFromValue(value: string): string | null {
  if (value.startsWith("family:")) {
    return value.slice(7).trim() || null;
  }
  if (value.startsWith("{")) {
    try {
      const obj = JSON.parse(value) as Record<string, unknown>;
      const fam = obj["font-family"] ?? obj.fontFamily;
      if (typeof fam === "string" && fam.trim() !== "") return fam.trim();
    } catch {
      // not JSON
    }
    return null;
  }
  // Flat values: accept only strings that look like a family list, not a
  // size/weight ("17px", "600", "1.5").
  const v = value.trim();
  if (/^[\d.]+(px|rem|em|%)?$/.test(v)) return null;
  if (!/[a-zA-Z]{2}/.test(v)) return null;
  return v;
}

const MONO_HINT = /\bmono(space)?\b|\bcode\b/i;

function extractFonts(doc: DesignDocument): { body?: string; mono?: string } {
  const candidates: Array<{ name: string; family: string }> = [];

  for (const t of doc.spec.typographyTokens ?? []) {
    const family = familyFromValue(t.value);
    if (family) candidates.push({ name: t.name, family });
  }
  const known = new Set((doc.spec.typographyTokens ?? []).map((t) => t.name));
  for (const [name, value] of Object.entries(doc.spec.typography)) {
    if (known.has(name)) continue;
    if (!/font|family|body|text|mono|code|heading/i.test(name)) continue;
    const family = familyFromValue(value);
    if (family) candidates.push({ name, family });
  }

  let body: string | undefined;
  let mono: string | undefined;
  for (const c of candidates) {
    const isMono = MONO_HINT.test(c.name) || MONO_HINT.test(c.family);
    if (isMono) {
      if (!mono) mono = c.family;
    } else if (!body) {
      body = c.family;
    }
  }
  return { body, mono };
}

const RADIUS_NAMES = ["sm", "md", "lg", "xl", "full"] as const;
const RADIUS_VALUE = /^\d+(\.\d+)?(px|rem|em|%)$/;

function extractRadii(doc: DesignDocument): Record<string, string> {
  const entries: Array<{ name: string; value: string }> = [...(doc.spec.radiusTokens ?? [])];
  const known = new Set(entries.map((e) => e.name));
  for (const [name, value] of Object.entries(doc.spec.radii)) {
    if (!known.has(name)) entries.push({ name, value });
  }

  const out: Record<string, string> = {};
  for (const size of RADIUS_NAMES) {
    for (const e of entries) {
      const bare = e.name.toLowerCase().replace(/^(--)?(radius|rounded|radii)[-_]?/, "");
      if (bare === size && RADIUS_VALUE.test(e.value.trim())) {
        out[`--kmd-radius-${size}`] = e.value.trim();
        break;
      }
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// emitThemeTokens
// ---------------------------------------------------------------------------

/**
 * Map a pipeline result to `--kmd-*` overrides for both modes.
 *
 * The input document is not mutated. See the ADR for the mapping table,
 * derivation rules, and fallback behavior.
 */
export function emitThemeTokens(doc: DesignDocument): DesignThemeTokens {
  const diagnostics: Diagnostic[] = [];
  const tokens = collectColorTokens(doc);
  const slots = collectRoles(tokens);

  // --- Determine the authored mode -------------------------------------
  let authoredMode: Mode | null = null;
  const bgSignal = slots.background ?? slots.surface;
  const bgRgba = bgSignal ? parseColor(bgSignal.value) : null;
  if (bgRgba) {
    authoredMode = luminance(bgRgba) > 0.5 ? "light" : "dark";
  } else {
    const textRgba = slots.text ? parseColor(slots.text.value) : null;
    if (textRgba) {
      authoredMode = luminance(textRgba) > 0.5 ? "dark" : "light";
    }
  }

  const fonts = extractFonts(doc);
  const radii = extractRadii(doc);
  const modeless: Record<string, string> = { ...radii };
  if (fonts.body && isSafeCssValue(fonts.body)) modeless["--kmd-font-body"] = fonts.body;
  if (fonts.mono && isSafeCssValue(fonts.mono)) modeless["--kmd-font-mono"] = fonts.mono;

  if (!authoredMode) {
    const empty = Object.keys(modeless).length === 0;
    if (empty) {
      diagnostics.push({
        severity: "info",
        token: "design-theme",
        message: "No themeable tokens could be extracted; default themes are unchanged.",
      });
    } else {
      diagnostics.push({
        severity: "info",
        token: "design-theme",
        message:
          "No parseable background or text color; only mode-independent tokens (fonts, radii) are themed.",
      });
    }
    return {
      light: { ...modeless },
      dark: { ...modeless },
      authoredMode: "dark",
      empty,
      diagnostics,
    };
  }

  // --- Build role value maps for both modes -----------------------------
  const byName = new Map(tokens.map((t) => [t.name, t]));
  const authoredRoles: RoleValues = {};
  const derivedRoles: RoleValues = {};
  const derivedMode: Mode = authoredMode === "light" ? "dark" : "light";

  for (const [slot, token] of Object.entries(slots) as Array<
    [keyof RoleSlots, ColorToken | undefined]
  >) {
    if (!token) continue;
    authoredRoles[slot] = token.value;

    const paired = token.pair ? byName.get(token.pair) : undefined;
    if (paired) {
      derivedRoles[slot] = paired.value;
      continue;
    }
    const derived = deriveOpposing(token.value, derivedMode);
    if (derived) {
      derivedRoles[slot] = derived;
    } else {
      diagnostics.push({
        severity: "info",
        token: token.name,
        message: `Cannot derive a ${derivedMode} variant for "${token.name}" (unparseable color "${token.value}"); the default ${derivedMode} value is used.`,
      });
    }
  }

  const authored = { ...expandMode(authoredRoles, authoredMode), ...modeless };
  const derived = { ...expandMode(derivedRoles, derivedMode), ...modeless };

  const light = authoredMode === "light" ? authored : derived;
  const dark = authoredMode === "dark" ? authored : derived;
  const empty = Object.keys(light).length === 0 && Object.keys(dark).length === 0;
  if (empty) {
    diagnostics.push({
      severity: "info",
      token: "design-theme",
      message: "No themeable tokens could be extracted; default themes are unchanged.",
    });
  }

  return { light, dark, authoredMode, empty, diagnostics };
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
