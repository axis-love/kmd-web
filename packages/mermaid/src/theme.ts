// @axis-love/mermaid — theme resolution
//
// Mermaid bakes colors into the SVG it generates, so CSS custom properties
// cannot recolor a diagram after the fact. The palette has to be handed to
// mermaid *before* it renders, and the diagram has to be rendered again when
// the reader's theme changes.
//
// This module answers one question: given a DOM scope, what palette should
// mermaid render with right now?
//
// Two paths:
// 1. Tokens — read the resolved --kmd-* custom properties off the scope and
//    map them onto mermaid's "base" theme variables. Diagrams then match the
//    surrounding document in every kmd theme, including sepia and any host
//    override, because the tokens are whatever CSS actually computed.
// 2. Fallback — when the tokens are absent (styles.css not loaded, SSR, a
//    bare test DOM), fall back to mermaid's built-in "dark"/"default" themes,
//    picking between them the same way styles.css does.
//
// Every resolved theme carries a short stable `id`. It is written to each
// placeholder as data-mermaid-theme, which is how the render path knows an
// existing SVG was drawn under a different theme and must be redrawn.

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Mermaid's only fully customizable built-in theme. */
const CUSTOMIZABLE_THEME = "base";

/** Built-in themes used when no --kmd-* tokens are available. */
const FALLBACK_DARK_THEME = "dark";
const FALLBACK_LIGHT_THEME = "default";

/**
 * Theme selectors understood by @axis-love/styles. All three are equivalent;
 * the attributes carry a theme name, the classes are boolean.
 */
const THEME_ATTRIBUTES = ["data-kmd-theme", "data-theme"] as const;
const DARK_THEME_CLASS = "kmd-theme-dark";
const NON_DARK_THEME_CLASSES = ["kmd-theme-light", "kmd-theme-sepia"] as const;

// ---------------------------------------------------------------------------
// Token bundle
// ---------------------------------------------------------------------------

/**
 * The --kmd-* custom properties the mermaid palette is built from, each with
 * an ordered fallback chain. The first property that resolves to a non-empty
 * value wins.
 */
const TOKEN_SOURCES = {
  background: ["--kmd-color-background", "--kmd-color-neutral"],
  surface: ["--kmd-color-surface"],
  surfaceMuted: ["--kmd-color-surface-muted", "--kmd-color-surface"],
  onSurface: ["--kmd-color-on-surface", "--kmd-color-body"],
  onPrimary: ["--kmd-color-on-primary"],
  muted: ["--kmd-color-secondary", "--kmd-color-muted"],
  heading: ["--kmd-color-heading", "--kmd-color-primary"],
  accent: ["--kmd-color-accent", "--kmd-color-tertiary"],
  info: ["--kmd-color-info"],
  success: ["--kmd-color-success"],
  warning: ["--kmd-color-warning"],
  danger: ["--kmd-color-danger"],
  fontBody: ["--kmd-font-body"],
} as const satisfies Record<string, readonly string[]>;

type TokenKey = keyof typeof TOKEN_SOURCES;

type TokenBundle = Partial<Record<TokenKey, string>>;

/**
 * Tokens without which the mapping cannot guarantee a legible diagram —
 * surfaces, text, and the two stroke strengths.
 *
 * --kmd-color-border is deliberately *not* required, and not used for any
 * diagram geometry: it is tuned for large quiet surfaces and lands around
 * 1.6:1 against the dark background, which is invisible at a 1px stroke.
 */
type RequiredTokenKey = "background" | "surface" | "surfaceMuted" | "onSurface" | "muted";

type ResolvedTokens = TokenBundle & Record<RequiredTokenKey, string>;

/**
 * Narrow a token bundle to one that carries every required token, or null
 * when the page has no --kmd-* tokens (styles.css absent, SSR, bare test DOM).
 * A null return means the built-in mermaid themes take over.
 */
function requireTokens(tokens: TokenBundle): ResolvedTokens | null {
  const { background, surface, surfaceMuted, onSurface, muted } = tokens;
  if (!background || !surface || !surfaceMuted || !onSurface || !muted) return null;
  return { ...tokens, background, surface, surfaceMuted, onSurface, muted };
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * A resolved mermaid palette, ready to be passed to `mermaid.initialize`.
 */
export interface MermaidThemeConfig {
  /**
   * Stable short identifier for this palette. Two configs with the same id
   * produce identical mermaid output; a change means every rendered diagram
   * is stale.
   */
  readonly id: string;
  /** Mermaid theme name — "base" on the token path, "dark"/"default" otherwise. */
  readonly theme: string;
  /** Whether the surrounding document is dark. Also fed to mermaid. */
  readonly darkMode: boolean;
  /** Where the palette came from — useful for diagnostics and tests. */
  readonly source: "tokens" | "fallback";
  /**
   * Mermaid theme variables. Empty on the fallback path. All colors are
   * strings; `darkMode` is a real boolean because mermaid's theme-base
   * branches on its truthiness, and the string "false" is truthy — passing a
   * string flips every derived variable in light mode onto the dark path.
   */
  readonly themeVariables: Readonly<Record<string, string | boolean>>;
}

// ---------------------------------------------------------------------------
// DOM access (all guarded — this module also runs in Node and SSR)
// ---------------------------------------------------------------------------

type ViewLike = {
  getComputedStyle?: (element: Element) => { getPropertyValue(name: string): string };
  matchMedia?: (query: string) => { matches: boolean };
  document?: { documentElement?: Element | null } | null;
};

function viewFor(scope?: Element | null): ViewLike | null {
  const fromScope = scope?.ownerDocument?.defaultView as ViewLike | null | undefined;
  if (fromScope) return fromScope;
  const globalWindow = (globalThis as { window?: ViewLike }).window;
  return globalWindow ?? null;
}

function elementFor(scope: Element | null | undefined, view: ViewLike | null): Element | null {
  return scope ?? view?.document?.documentElement ?? null;
}

/**
 * Read the --kmd-* token bundle off `element`. Custom properties inherit, so
 * reading the container picks up whichever theme selector is active on any
 * ancestor — attribute, class, or the prefers-color-scheme default.
 */
function readTokens(element: Element | null, view: ViewLike | null): TokenBundle {
  if (!element || typeof view?.getComputedStyle !== "function") return {};

  let computed: { getPropertyValue(name: string): string };
  try {
    computed = view.getComputedStyle(element);
  } catch {
    return {};
  }
  if (typeof computed?.getPropertyValue !== "function") return {};

  const bundle: TokenBundle = {};
  for (const key of Object.keys(TOKEN_SOURCES) as TokenKey[]) {
    for (const property of TOKEN_SOURCES[key]) {
      let value: string;
      try {
        value = computed.getPropertyValue(property);
      } catch {
        continue;
      }
      const trimmed = value?.trim();
      if (trimmed) {
        bundle[key] = trimmed;
        break;
      }
    }
  }
  return bundle;
}

// ---------------------------------------------------------------------------
// Light/dark detection
// ---------------------------------------------------------------------------

/**
 * Decide whether the document around `scope` is dark, mirroring the cascade
 * in styles.css: an explicit theme selector on any ancestor wins, otherwise
 * the OS preference decides, and dark is the default when nothing says
 * otherwise.
 */
export function detectDarkMode(scope?: Element | null): boolean {
  const view = viewFor(scope);
  let element = elementFor(scope, view);

  while (element) {
    for (const attribute of THEME_ATTRIBUTES) {
      const value = element.getAttribute?.(attribute)?.trim();
      if (value) return value === "dark";
    }
    const classList = element.classList;
    if (classList?.contains(DARK_THEME_CLASS)) return true;
    if (NON_DARK_THEME_CLASSES.some((name) => classList?.contains(name))) return false;
    element = element.parentElement;
  }

  if (typeof view?.matchMedia === "function") {
    try {
      if (view.matchMedia("(prefers-color-scheme: light)").matches) return false;
    } catch {
      // Unsupported matchMedia — fall through to the default.
    }
  }

  // styles.css treats dark as the theme when no selector matches.
  return true;
}

// ---------------------------------------------------------------------------
// Color parsing — used only to classify a background as light or dark
// ---------------------------------------------------------------------------

const HEX_PATTERN = /^#([0-9a-f]{3,8})$/i;
const RGB_PATTERN = /^rgba?\(([^)]+)\)$/i;

/** Parse a CSS color into 0-255 RGB. Returns null for anything unrecognized. */
export function parseCssColor(value: string): readonly [number, number, number] | null {
  const input = value.trim();

  const hex = HEX_PATTERN.exec(input);
  if (hex) {
    const digits = hex[1] ?? "";
    if (digits.length === 3 || digits.length === 4) {
      return [
        Number.parseInt(digits.slice(0, 1).repeat(2), 16),
        Number.parseInt(digits.slice(1, 2).repeat(2), 16),
        Number.parseInt(digits.slice(2, 3).repeat(2), 16),
      ];
    }
    if (digits.length === 6 || digits.length === 8) {
      return [
        Number.parseInt(digits.slice(0, 2), 16),
        Number.parseInt(digits.slice(2, 4), 16),
        Number.parseInt(digits.slice(4, 6), 16),
      ];
    }
    return null;
  }

  const rgb = RGB_PATTERN.exec(input);
  if (rgb) {
    const [r, g, b] = (rgb[1] ?? "")
      .split(/[\s,/]+/)
      .filter((part) => part.length > 0)
      .slice(0, 3)
      .map((part) => (part.endsWith("%") ? (Number.parseFloat(part) / 100) * 255 : Number(part)));
    if (r === undefined || g === undefined || b === undefined) return null;
    if (!Number.isFinite(r) || !Number.isFinite(g) || !Number.isFinite(b)) return null;
    return [r, g, b];
  }

  return null;
}

/** Convert an sRGB channel (0-255) to its linear-light value. */
function toLinearChannel(channel: number): number {
  const c = Math.min(Math.max(channel, 0), 255) / 255;
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

/** Relative luminance (WCAG) of an sRGB triplet, 0 (black) to 1 (white). */
export function relativeLuminance(rgb: readonly [number, number, number]): number {
  return (
    0.2126 * toLinearChannel(rgb[0]) +
    0.7152 * toLinearChannel(rgb[1]) +
    0.0722 * toLinearChannel(rgb[2])
  );
}

// ---------------------------------------------------------------------------
// Token to mermaid variable mapping
// ---------------------------------------------------------------------------

/**
 * Map the kmd tokens onto mermaid's "base" theme variables.
 *
 * Diagram strokes get exactly two strengths, because a diagram line is a 1px
 * hairline on a large canvas: a token that reads fine as the edge of a tall
 * surface disappears at that width.
 *
 * - `strong` = --kmd-color-on-surface, the body text color. Everything that
 *   carries meaning as a line — flowchart edges and their arrowheads, node
 *   outlines, sequence lifelines and signals — has to be as readable as text.
 *   That is ~14:1 on dark and ~17:1 on light against the page.
 * - `quiet` = --kmd-color-secondary. Only for containers whose fill already
 *   separates them from the page: clusters, notes, label boxes. ~6.5:1 on
 *   dark and ~5.2:1 on light — present without shouting.
 *
 * --kmd-color-border is deliberately unused. It sits near 1.6:1 against the
 * dark background, which is why cluster and note outlines were invisible.
 *
 * Node fills use the muted *surface* token, never --kmd-color-primary: in kmd
 * "primary" is a foreground color, and filling a node with it is what produced
 * the near-black-on-dark diagrams this mapping exists to fix.
 */
function buildThemeVariables(tokens: ResolvedTokens): Record<string, string> {
  const { background, surface, surfaceMuted, onSurface, muted } = tokens;
  const strong = onSurface;
  const quiet = muted;
  const heading = tokens.heading ?? onSurface;
  const accent = tokens.accent ?? muted;
  const onAccent = tokens.onPrimary ?? background;

  const variables: Record<string, string> = {
    // Canvas and generic palette
    background,
    primaryColor: surfaceMuted,
    primaryTextColor: onSurface,
    primaryBorderColor: strong,
    secondaryColor: surface,
    secondaryTextColor: onSurface,
    secondaryBorderColor: quiet,
    tertiaryColor: background,
    tertiaryTextColor: onSurface,
    tertiaryBorderColor: quiet,
    lineColor: strong,
    textColor: onSurface,
    titleColor: heading,
    fontFamily: tokens.fontBody ?? "inherit",

    // Flowchart
    mainBkg: surfaceMuted,
    nodeBorder: strong,
    nodeTextColor: onSurface,
    edgeLabelBackground: background,
    clusterBkg: surface,
    clusterBorder: quiet,
    defaultLinkColor: strong,

    // Sequence diagrams
    actorBkg: surfaceMuted,
    actorBorder: strong,
    actorTextColor: onSurface,
    actorLineColor: strong,
    signalColor: strong,
    signalTextColor: onSurface,
    labelBoxBkgColor: surface,
    labelBoxBorderColor: quiet,
    labelTextColor: onSurface,
    loopTextColor: onSurface,
    noteBkgColor: surface,
    noteBorderColor: quiet,
    noteTextColor: onSurface,
    activationBkgColor: surfaceMuted,
    activationBorderColor: strong,
    sequenceNumberColor: onAccent,

    // Class and state diagrams
    classText: onSurface,
    labelColor: onSurface,
    altBackground: surface,

    // Pie charts
    pieTitleTextColor: heading,
    pieSectionTextColor: onAccent,
    pieLegendTextColor: onSurface,
    pieStrokeColor: background,
    pieOuterStrokeColor: quiet,

    // Errors
    errorBkgColor: surface,
    errorTextColor: tokens.danger ?? onSurface,
  };

  // Categorical series colors, only where kmd defines a matching token.
  const series = [accent, tokens.info, tokens.success, tokens.warning, tokens.danger];
  series.forEach((color, index) => {
    if (color) variables[`pie${index + 1}`] = color;
  });
  if (tokens.accent) variables.cScale0 = tokens.accent;
  if (tokens.info) variables.cScale1 = tokens.info;
  if (tokens.success) variables.cScale2 = tokens.success;

  return variables;
}

// ---------------------------------------------------------------------------
// Identity hashing
// ---------------------------------------------------------------------------

/** FNV-1a, 32-bit. Short, stable, and dependency-free — not a security hash. */
function hash32(input: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, "0");
}

function themeId(
  source: MermaidThemeConfig["source"],
  theme: string,
  darkMode: boolean,
  variables: Record<string, string | boolean>,
): string {
  const serialized = Object.keys(variables)
    .sort()
    .map((key) => `${key}:${variables[key]}`)
    .join(";");
  return `${source}-${darkMode ? "dark" : "light"}-${hash32(`${theme}|${serialized}`)}`;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Resolve the mermaid palette for a DOM scope.
 *
 * @param scope - Element whose computed --kmd-* tokens define the palette.
 *   Defaults to `document.documentElement`. Pass the reader container so a
 *   host that themes a subtree rather than the whole page still works.
 */
export function resolveMermaidTheme(scope?: Element | null): MermaidThemeConfig {
  const view = viewFor(scope);
  const element = elementFor(scope, view);
  const tokens = requireTokens(readTokens(element, view));

  if (tokens) {
    // The background token is authoritative about light vs dark: it survives
    // themes the selector list doesn't know about, sepia included.
    const parsed = parseCssColor(tokens.background);
    const darkMode = parsed ? relativeLuminance(parsed) < 0.5 : detectDarkMode(scope);
    const themeVariables: Record<string, string | boolean> = buildThemeVariables(tokens);
    // Must stay a boolean: mermaid's theme-base branches on truthiness, and
    // the string "false" is truthy.
    themeVariables.darkMode = darkMode;
    return {
      id: themeId("tokens", CUSTOMIZABLE_THEME, darkMode, themeVariables),
      theme: CUSTOMIZABLE_THEME,
      darkMode,
      source: "tokens",
      themeVariables,
    };
  }

  const darkMode = detectDarkMode(scope);
  const theme = darkMode ? FALLBACK_DARK_THEME : FALLBACK_LIGHT_THEME;
  return {
    id: themeId("fallback", theme, darkMode, {}),
    theme,
    darkMode,
    source: "fallback",
    themeVariables: {},
  };
}
