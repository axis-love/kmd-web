// @vitest-environment happy-dom
//
// Theme resolution for mermaid diagrams (KWEB-055).
//
// Note on the DOM: happy-dom's getComputedStyle does not inherit custom
// properties down the tree the way a browser does, so these tests set the
// --kmd-* tokens on the scope element itself. That is the same value a real
// browser computes on the scope — inheritance is the browser's job, not this
// module's.

import { afterEach, describe, expect, it } from "vitest";

import { detectDarkMode, parseCssColor, relativeLuminance, resolveMermaidTheme } from "./theme";

// ---------------------------------------------------------------------------
// Token fixtures — the real values from @axis-love/styles
// ---------------------------------------------------------------------------

const DARK_TOKENS: Record<string, string> = {
  "--kmd-color-background": "#1a1c1f",
  "--kmd-color-surface": "#222428",
  "--kmd-color-surface-muted": "#2c2f35",
  "--kmd-color-on-surface": "#e8eaed",
  "--kmd-color-on-primary": "#1a1c1f",
  "--kmd-color-secondary": "#9aa0ab",
  "--kmd-color-border": "#3a3f48",
  "--kmd-color-heading": "#e8eaed",
  "--kmd-color-accent": "#9b6dff",
  "--kmd-color-info": "#5b9cf5",
  "--kmd-color-success": "#3ebd82",
  "--kmd-color-warning": "#d4a735",
  "--kmd-color-danger": "#e8594e",
  "--kmd-font-body": '"Inter", system-ui, sans-serif',
};

const LIGHT_TOKENS: Record<string, string> = {
  ...DARK_TOKENS,
  "--kmd-color-background": "#f5f7f8",
  "--kmd-color-surface": "#ffffff",
  "--kmd-color-surface-muted": "#eceff3",
  "--kmd-color-on-surface": "#15171a",
  "--kmd-color-on-primary": "#ffffff",
  "--kmd-color-secondary": "#626872",
  "--kmd-color-border": "#d8dee6",
  "--kmd-color-heading": "#15171a",
};

function mount(tokens?: Record<string, string>): HTMLElement {
  const element = document.createElement("div");
  if (tokens) {
    for (const [name, value] of Object.entries(tokens)) {
      element.style.setProperty(name, value);
    }
  }
  document.body.appendChild(element);
  return element;
}

/**
 * Pin the OS color-scheme preference. happy-dom reports "light" by default,
 * which would otherwise decide every test that has no explicit theme.
 */
function stubColorScheme(scheme: "dark" | "light"): void {
  const stub = (query: string) => ({
    matches: query.includes(scheme),
    addEventListener: () => {},
    removeEventListener: () => {},
  });
  window.matchMedia = stub as unknown as typeof window.matchMedia;
  restoreMatchMedia = () => {
    window.matchMedia = originalMatchMedia;
  };
}

const originalMatchMedia = window.matchMedia;
let restoreMatchMedia: (() => void) | null = null;

afterEach(() => {
  document.body.innerHTML = "";
  document.documentElement.removeAttribute("data-theme");
  document.documentElement.removeAttribute("data-kmd-theme");
  document.documentElement.className = "";
  restoreMatchMedia?.();
  restoreMatchMedia = null;
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("resolveMermaidTheme — token path", () => {
  it("derives the palette from --kmd-* tokens rather than a built-in theme", () => {
    const theme = resolveMermaidTheme(mount(DARK_TOKENS));

    expect(theme.source).toBe("tokens");
    // "base" is mermaid's only fully customizable theme — "default" is the
    // hardcoded light theme this task exists to remove.
    expect(theme.theme).toBe("base");
    expect(theme.theme).not.toBe("default");
  });

  it("maps kmd tokens onto the mermaid variables that color nodes, edges, and labels", () => {
    const { themeVariables } = resolveMermaidTheme(mount(DARK_TOKENS));

    // Nodes: filled with the muted surface, never with --kmd-color-primary
    // (which is a foreground color in kmd).
    expect(themeVariables.mainBkg).toBe("#2c2f35");
    expect(themeVariables.primaryColor).toBe("#2c2f35");
    // Strong tier — everything that carries meaning as a 1px line.
    expect(themeVariables.lineColor).toBe("#e8eaed");
    expect(themeVariables.defaultLinkColor).toBe("#e8eaed");
    expect(themeVariables.nodeBorder).toBe("#e8eaed");
    expect(themeVariables.signalColor).toBe("#e8eaed");
    expect(themeVariables.actorLineColor).toBe("#e8eaed");
    // Quiet tier — containers whose fill already separates them.
    expect(themeVariables.clusterBorder).toBe("#9aa0ab");
    expect(themeVariables.noteBorderColor).toBe("#9aa0ab");
    // Text.
    expect(themeVariables.textColor).toBe("#e8eaed");
    expect(themeVariables.nodeTextColor).toBe("#e8eaed");
    expect(themeVariables.primaryTextColor).toBe("#e8eaed");
    // Canvas and typography.
    expect(themeVariables.background).toBe("#1a1c1f");
    expect(themeVariables.edgeLabelBackground).toBe("#1a1c1f");
    expect(themeVariables.fontFamily).toBe('"Inter", system-ui, sans-serif');
  });

  it("never colors diagram geometry with --kmd-color-border", () => {
    // At #3a3f48 on #1a1c1f the border token is ~1.6:1 — invisible at a 1px
    // stroke. Using it is what made cluster and note outlines disappear.
    const { themeVariables } = resolveMermaidTheme(mount(DARK_TOKENS));
    const borderToken = DARK_TOKENS["--kmd-color-border"];

    expect(Object.values(themeVariables)).not.toContain(borderToken);
  });

  it("classifies dark and light themes from the resolved background token", () => {
    expect(resolveMermaidTheme(mount(DARK_TOKENS)).darkMode).toBe(true);
    expect(resolveMermaidTheme(mount(LIGHT_TOKENS)).darkMode).toBe(false);
  });

  it("passes darkMode through to mermaid as a real boolean", () => {
    // Mermaid's theme-base branches on truthiness, and the string "false" is
    // truthy — a stringified flag would push every derived variable in light
    // mode (gantt, git graph, edgeLabelBackground fallbacks, ...) onto the
    // dark-mode code paths.
    expect(resolveMermaidTheme(mount(DARK_TOKENS)).themeVariables.darkMode).toBe(true);
    expect(resolveMermaidTheme(mount(LIGHT_TOKENS)).themeVariables.darkMode).toBe(false);
  });

  it("gives light and dark distinct ids, and repeats the same id for the same tokens", () => {
    const dark = resolveMermaidTheme(mount(DARK_TOKENS));
    const light = resolveMermaidTheme(mount(LIGHT_TOKENS));

    expect(dark.id).not.toBe(light.id);
    expect(resolveMermaidTheme(mount(DARK_TOKENS)).id).toBe(dark.id);
  });

  it("changes id when a single token changes, so rendered diagrams go stale", () => {
    const before = resolveMermaidTheme(mount(DARK_TOKENS)).id;
    const after = resolveMermaidTheme(
      mount({ ...DARK_TOKENS, "--kmd-color-secondary": "#ff00ff" }),
    ).id;

    expect(after).not.toBe(before);
  });
});

// ---------------------------------------------------------------------------
// Contrast table — the guardrail on token choice
//
// These thresholds are what "legible" means for this mapping, checked against
// the real kmd token values in both themes. The original bug passed every
// functional test and still shipped invisible diagrams; only these numbers
// would have caught it.
// ---------------------------------------------------------------------------

function contrastRatio(a: string, b: string): number {
  const left = parseCssColor(a);
  const right = parseCssColor(b);
  if (!left || !right) throw new Error(`unparseable color pair: ${a} / ${b}`);
  const [hi, lo] = [relativeLuminance(left), relativeLuminance(right)].sort((x, y) => y - x);
  return ((hi ?? 0) + 0.05) / ((lo ?? 0) + 0.05);
}

/**
 * Each row: which variable, what it is drawn against, and the floor it must
 * clear. Text and 1px strokes get the 4.5:1 text threshold rather than the
 * 3:1 graphical-object one — a hairline is harder to read than a glyph, not
 * easier. Quiet-tier container outlines get 3:1 because their fill is doing
 * most of the separating.
 */
const CONTRAST_RULES: readonly (readonly [string, string, number])[] = [
  // Strong tier — meaning-carrying lines, against the page they sit on.
  ["lineColor", "background", 7],
  ["defaultLinkColor", "background", 7],
  ["nodeBorder", "background", 7],
  ["signalColor", "background", 7],
  ["actorLineColor", "background", 7],
  ["actorBorder", "background", 7],
  ["activationBorderColor", "background", 7],
  // Node outlines also have to read against the node they enclose.
  ["nodeBorder", "mainBkg", 4.5],
  ["actorBorder", "actorBkg", 4.5],
  // Quiet tier — container outlines.
  ["clusterBorder", "background", 3],
  ["noteBorderColor", "background", 3],
  ["labelBoxBorderColor", "background", 3],
  ["pieOuterStrokeColor", "background", 3],
  // Text.
  ["textColor", "background", 4.5],
  ["nodeTextColor", "mainBkg", 4.5],
  ["noteTextColor", "noteBkgColor", 4.5],
  ["labelTextColor", "labelBoxBkgColor", 4.5],
  ["titleColor", "background", 4.5],
  ["classText", "mainBkg", 4.5],
  ["signalTextColor", "background", 4.5],
];

describe("contrast in both themes", () => {
  for (const [themeName, tokens] of [
    ["dark", DARK_TOKENS],
    ["light", LIGHT_TOKENS],
  ] as const) {
    describe(themeName, () => {
      for (const [foreground, backdrop, floor] of CONTRAST_RULES) {
        it(`${foreground} on ${backdrop} clears ${floor}:1`, () => {
          const { themeVariables } = resolveMermaidTheme(mount(tokens));
          const fg = themeVariables[foreground];
          const bg = themeVariables[backdrop];
          expect(fg, `${foreground} is unset`).toBeDefined();
          expect(bg, `${backdrop} is unset`).toBeDefined();
          if (!fg || !bg) return;

          expect(contrastRatio(fg, bg)).toBeGreaterThanOrEqual(floor);
        });
      }
    });
  }

  it("draws edges at least twice as strongly as the quiet container tier", () => {
    for (const tokens of [DARK_TOKENS, LIGHT_TOKENS]) {
      const { themeVariables } = resolveMermaidTheme(mount(tokens));
      const edge = contrastRatio(themeVariables.lineColor ?? "", themeVariables.background ?? "");
      const quiet = contrastRatio(
        themeVariables.clusterBorder ?? "",
        themeVariables.background ?? "",
      );
      expect(edge).toBeGreaterThan(quiet * 2);
    }
  });
});

describe("resolveMermaidTheme — fallback path", () => {
  it("falls back to mermaid's dark theme when no tokens are present", () => {
    stubColorScheme("dark");
    const theme = resolveMermaidTheme(mount());

    expect(theme.source).toBe("fallback");
    expect(theme.theme).toBe("dark");
    expect(theme.darkMode).toBe(true);
    expect(theme.themeVariables).toEqual({});
  });

  it("falls back to the light built-in when a light theme is declared", () => {
    const element = mount();
    element.setAttribute("data-kmd-theme", "light");

    const theme = resolveMermaidTheme(element);
    expect(theme.source).toBe("fallback");
    expect(theme.theme).toBe("default");
    expect(theme.darkMode).toBe(false);
  });

  it("falls back when the token set is incomplete", () => {
    const partial = {
      "--kmd-color-background": "#1a1c1f",
      "--kmd-color-surface": "#222428",
    };

    expect(resolveMermaidTheme(mount(partial)).source).toBe("fallback");
  });

  it("gives the two built-in fallbacks distinct ids", () => {
    const dark = mount();
    dark.setAttribute("data-theme", "dark");
    const light = mount();
    light.setAttribute("data-theme", "light");

    expect(resolveMermaidTheme(dark).id).not.toBe(resolveMermaidTheme(light).id);
  });
});

describe("detectDarkMode", () => {
  it("follows the OS preference when no theme is declared", () => {
    stubColorScheme("light");
    expect(detectDarkMode(mount())).toBe(false);
  });

  it("defaults to dark, matching the styles.css default theme", () => {
    stubColorScheme("dark");
    expect(detectDarkMode(mount())).toBe(true);
  });

  it("reads data-kmd-theme, data-theme, and the theme classes", () => {
    const cases: readonly [string, () => HTMLElement, boolean][] = [
      [
        "data-kmd-theme=light",
        () => {
          const el = mount();
          el.setAttribute("data-kmd-theme", "light");
          return el;
        },
        false,
      ],
      [
        "data-theme=dark",
        () => {
          const el = mount();
          el.setAttribute("data-theme", "dark");
          return el;
        },
        true,
      ],
      [
        ".kmd-theme-light",
        () => {
          const el = mount();
          el.classList.add("kmd-theme-light");
          return el;
        },
        false,
      ],
      [
        ".kmd-theme-sepia",
        () => {
          const el = mount();
          el.classList.add("kmd-theme-sepia");
          return el;
        },
        false,
      ],
      [
        ".kmd-theme-dark",
        () => {
          const el = mount();
          el.classList.add("kmd-theme-dark");
          return el;
        },
        true,
      ],
    ];

    for (const [label, build, expected] of cases) {
      expect(detectDarkMode(build()), label).toBe(expected);
    }
  });

  it("inherits the theme from an ancestor", () => {
    const host = mount();
    host.setAttribute("data-kmd-theme", "light");
    const child = document.createElement("div");
    host.appendChild(child);

    expect(detectDarkMode(child)).toBe(false);
  });

  it("lets the nearest theme selector win over an outer one", () => {
    const outer = mount();
    outer.setAttribute("data-kmd-theme", "light");
    const inner = document.createElement("div");
    inner.setAttribute("data-kmd-theme", "dark");
    outer.appendChild(inner);

    expect(detectDarkMode(inner)).toBe(true);
  });
});

describe("parseCssColor", () => {
  it("parses hex in every length", () => {
    expect(parseCssColor("#fff")).toEqual([255, 255, 255]);
    expect(parseCssColor("#1a1c1f")).toEqual([26, 28, 31]);
    expect(parseCssColor("#1a1c1fcc")).toEqual([26, 28, 31]);
    expect(parseCssColor("  #ABC  ")).toEqual([170, 187, 204]);
  });

  it("parses rgb() and rgba() in comma and space syntax", () => {
    expect(parseCssColor("rgb(26, 28, 31)")).toEqual([26, 28, 31]);
    expect(parseCssColor("rgba(26, 28, 31, 0.5)")).toEqual([26, 28, 31]);
    expect(parseCssColor("rgb(26 28 31 / 50%)")).toEqual([26, 28, 31]);
  });

  it("returns null for anything it cannot read", () => {
    expect(parseCssColor("rebeccapurple")).toBeNull();
    expect(parseCssColor("var(--kmd-color-surface)")).toBeNull();
    expect(parseCssColor("#12")).toBeNull();
    expect(parseCssColor("")).toBeNull();
  });
});

describe("relativeLuminance", () => {
  it("spans black to white", () => {
    expect(relativeLuminance([0, 0, 0])).toBe(0);
    expect(relativeLuminance([255, 255, 255])).toBeCloseTo(1, 5);
  });

  it("puts the kmd surfaces on the expected side of the midpoint", () => {
    expect(relativeLuminance([26, 28, 31])).toBeLessThan(0.5);
    expect(relativeLuminance([245, 247, 248])).toBeGreaterThan(0.5);
  });
});
