// @axis-love/highlighting
// Optional Shiki syntax highlighting integration.
// Lazy-loaded — baseline core must not statically import this.
//
// Design:
// - Per-language lazy loading: Shiki core engine is loaded once, but each
//   language grammar is loaded only when first encountered.
// - Plain-code fallback: if Shiki fails to load or a language is unknown,
//   the code block is left as-is (plain <pre><code> with escaped text).
// - Mermaid code blocks are never highlighted (they have their own renderer).
// - The rehype plugin is async and returns a Promise<HastRoot>.
//
// The rehype plugin transforms <pre><code class="language-X"> elements
// in-place, replacing their content with Shiki's highlighted HTML.

import type { Element, ElementContent, Root as HastRoot } from "hast";
import type { Plugin } from "unified";
import { visit } from "unist-util-visit";

// ---------------------------------------------------------------------------
// Types — lazy to avoid importing Shiki at module load time
// ---------------------------------------------------------------------------

type LanguageRegistration = {
  name: string;
  scopeName?: string;
  patterns?: unknown[];
  repository?: Record<string, unknown>;
};

type HighlighterCore = {
  codeToTokens(
    code: string,
    options: { lang: string; themes: { dark: string; light: string } },
  ): CodeTokensResult;
  loadLanguage(lang: LanguageRegistration | LanguageRegistration[]): Promise<void>;
  getLoadedLanguages(): string[];
  dispose(): void;
};

/**
 * Shape of Shiki's `codeToTokens` result (subset we consume).
 *
 * With dual themes each token carries an `htmlStyle` record holding the
 * light-theme `color` plus a `--shiki-dark` variable for the dark theme.
 */
type CodeToken = {
  content: string;
  color?: string;
  htmlStyle?: Record<string, string>;
};

type CodeTokensResult = {
  tokens: CodeToken[][];
};

// ---------------------------------------------------------------------------
// Version
// ---------------------------------------------------------------------------

export const HIGHLIGHTING_VERSION = "0.1.0";

// ---------------------------------------------------------------------------
// Language aliases — maps common shorthand to Shiki canonical names
// ---------------------------------------------------------------------------

const LANGUAGE_ALIASES: Record<string, string> = {
  csharp: "csharp",
  cs: "csharp",
  docker: "dockerfile",
  dockerfile: "dockerfile",
  htm: "html",
  html: "html",
  js: "javascript",
  javascript: "javascript",
  jsx: "jsx",
  md: "markdown",
  markdown: "markdown",
  ps: "powershell",
  ps1: "powershell",
  py: "python",
  python: "python",
  rs: "rust",
  rust: "rust",
  sh: "shellscript",
  shell: "shellscript",
  bash: "shellscript",
  shellscript: "shellscript",
  ts: "typescript",
  typescript: "typescript",
  tsx: "tsx",
  xml: "xml",
  yml: "yaml",
  yaml: "yaml",
};

// Languages that Shiki supports — excluded ones fall back to plain text
const SHIKI_LANG_ALIASES = Object.fromEntries(
  Object.entries(LANGUAGE_ALIASES).filter(([alias, lang]) => alias !== lang),
);

// Per-language lazy loaders. Each is a dynamic import that returns the
// grammar registration. Only loaded when first encountered.
const LANGUAGE_LOADERS: Record<
  string,
  () => Promise<LanguageRegistration | LanguageRegistration[]>
> = {
  c: () => import("@shikijs/langs/c").then((m) => m.default as unknown as LanguageRegistration),
  cpp: () => import("@shikijs/langs/cpp").then((m) => m.default as unknown as LanguageRegistration),
  csharp: () =>
    import("@shikijs/langs/csharp").then((m) => m.default as unknown as LanguageRegistration),
  css: () => import("@shikijs/langs/css").then((m) => m.default as unknown as LanguageRegistration),
  diff: () =>
    import("@shikijs/langs/diff").then((m) => m.default as unknown as LanguageRegistration),
  dockerfile: () =>
    import("@shikijs/langs/dockerfile").then((m) => m.default as unknown as LanguageRegistration),
  go: () => import("@shikijs/langs/go").then((m) => m.default as unknown as LanguageRegistration),
  html: () =>
    import("@shikijs/langs/html").then((m) => m.default as unknown as LanguageRegistration),
  java: () =>
    import("@shikijs/langs/java").then((m) => m.default as unknown as LanguageRegistration),
  javascript: () =>
    import("@shikijs/langs/javascript").then((m) => m.default as unknown as LanguageRegistration),
  json: () =>
    import("@shikijs/langs/json").then((m) => m.default as unknown as LanguageRegistration),
  jsx: () => import("@shikijs/langs/jsx").then((m) => m.default as unknown as LanguageRegistration),
  markdown: () =>
    import("@shikijs/langs/markdown").then((m) => m.default as unknown as LanguageRegistration),
  php: () => import("@shikijs/langs/php").then((m) => m.default as unknown as LanguageRegistration),
  powershell: () =>
    import("@shikijs/langs/powershell").then((m) => m.default as unknown as LanguageRegistration),
  python: () =>
    import("@shikijs/langs/python").then((m) => m.default as unknown as LanguageRegistration),
  ruby: () =>
    import("@shikijs/langs/ruby").then((m) => m.default as unknown as LanguageRegistration),
  rust: () =>
    import("@shikijs/langs/rust").then((m) => m.default as unknown as LanguageRegistration),
  shellscript: () =>
    import("@shikijs/langs/shellscript").then((m) => m.default as unknown as LanguageRegistration),
  sql: () => import("@shikijs/langs/sql").then((m) => m.default as unknown as LanguageRegistration),
  swift: () =>
    import("@shikijs/langs/swift").then((m) => m.default as unknown as LanguageRegistration),
  toml: () =>
    import("@shikijs/langs/toml").then((m) => m.default as unknown as LanguageRegistration),
  tsx: () => import("@shikijs/langs/tsx").then((m) => m.default as unknown as LanguageRegistration),
  typescript: () =>
    import("@shikijs/langs/typescript").then((m) => m.default as unknown as LanguageRegistration),
  xml: () => import("@shikijs/langs/xml").then((m) => m.default as unknown as LanguageRegistration),
  yaml: () =>
    import("@shikijs/langs/yaml").then((m) => m.default as unknown as LanguageRegistration),
};

// Languages that are excluded from highlighting (they have their own renderers
// or don't benefit from syntax highlighting)
const EXCLUDED_LANGS = new Set(["text", "plain", "plaintext", "mermaid"]);

// ---------------------------------------------------------------------------
// Module-level state — highlighter singleton
// ---------------------------------------------------------------------------

let highlighterCache: Promise<HighlighterCore> | null = null;
const loadedLangs = new Set<string>(["plaintext"]);

// ---------------------------------------------------------------------------
// Internal utilities
// ---------------------------------------------------------------------------

function normalizeLanguage(lang: string): string {
  const normalized = lang.trim().toLowerCase();
  return LANGUAGE_ALIASES[normalized] ?? normalized;
}

/**
 * Extract plain text content from a HAST element node.
 */
function extractText(node: Element): string {
  if ("value" in node && typeof node.value === "string") return node.value;
  if ("children" in node && Array.isArray(node.children)) {
    return node.children
      .map((child: ElementContent) => {
        if (child.type === "text") return child.value;
        if (child.type === "element") return extractText(child);
        return "";
      })
      .join("");
  }
  return "";
}

// ---------------------------------------------------------------------------
// Class-based token colors
// ---------------------------------------------------------------------------
//
// Shiki's dual-theme output normally carries inline styles
// (`color:#light;--shiki-dark:#dark`). Core's sanitizer strips inline styles
// (and must — untrusted raw HTML could otherwise inject arbitrary CSS), so
// highlighting must not depend on them. Instead each token gets a class
// derived from its (light, dark) color pair, and the matching color rules are
// generated as CSS and delivered to the host via RenderResult.codeHighlightCss
// (the host injects it into a <style> element). Class names are derived only
// from trusted theme colors — never from document content.

/** Class prefix for token color classes. */
export const TOKEN_CLASS_PREFIX = "shiki-c";

/** Class applied to every highlighted token span (stable selector for hosts). */
export const TOKEN_CLASS = "shiki-token";

interface TokenColor {
  readonly light: string;
  readonly dark: string;
}

/**
 * Module-level registry of token color classes seen so far. Bounded by the
 * size of the theme palette (themes define a small, fixed set of colors), so
 * it does not grow with document content.
 */
const colorRegistry = new Map<string, TokenColor>();

function shortHash(input: string): string {
  let hash = 5381;
  for (let i = 0; i < input.length; i++) {
    hash = ((hash << 5) + hash + input.charCodeAt(i)) >>> 0;
  }
  return hash.toString(36);
}

/**
 * Map a (light, dark) color pair to a deterministic class name, registering
 * the pair so the generated stylesheet can resolve it.
 */
function registerTokenColor(light: string, dark: string): string {
  const lightNorm = light.toLowerCase();
  const darkNorm = dark.toLowerCase();
  const className = `${TOKEN_CLASS_PREFIX}${shortHash(`${lightNorm}|${darkNorm}`)}`;
  if (!colorRegistry.has(className)) {
    colorRegistry.set(className, { light: lightNorm, dark: darkNorm });
  }
  return className;
}

/**
 * Build the stylesheet for all registered token color classes.
 *
 * Base rules use the light color; dark-theme selectors override with the dark
 * color. Selectors mirror the theme attribute conventions used by
 * `@axis-love/styles` tokens.
 */
export function buildHighlightCss(): string {
  const rules: string[] = [];
  for (const [className, { light, dark }] of colorRegistry) {
    rules.push(`.${className}{color:${light}}`);
    rules.push(
      `[data-theme="dark"] .${className},` +
        `[data-kmd-theme="dark"] .${className},` +
        `.kmd-theme-dark .${className}{color:${dark}}`,
    );
  }
  return rules.join("\n");
}

/**
 * Reset the token color registry (used when the highlighter is disposed).
 */
function clearColorRegistry(): void {
  colorRegistry.clear();
}

// ---------------------------------------------------------------------------
// HAST construction from tokens
// ---------------------------------------------------------------------------

/** Extract the light color from a Shiki token. */
function tokenLightColor(token: CodeToken): string {
  return token.htmlStyle?.color ?? token.color ?? "inherit";
}

/** Extract the dark color from a Shiki token's htmlStyle variables. */
function tokenDarkColor(token: CodeToken): string {
  return token.htmlStyle?.["--shiki-dark"] ?? tokenLightColor(token);
}

function tokenToElement(token: CodeToken): Element {
  const light = tokenLightColor(token);
  const dark = tokenDarkColor(token);
  const colorClass = registerTokenColor(light, dark);
  return {
    type: "element",
    tagName: "span",
    properties: { className: [TOKEN_CLASS, colorClass] },
    children: [{ type: "text", value: token.content }],
  };
}

/**
 * Build a `<code>` HAST element from Shiki tokens (class-based, no inline
 * styles). Lines are wrapped in `<span class="line">` to mirror Shiki's own
 * structure.
 */
function tokensToCodeElement(tokens: readonly CodeToken[][], langClass: string): Element {
  const lineElements: ElementContent[] = [];
  for (let lineIdx = 0; lineIdx < tokens.length; lineIdx++) {
    const line = tokens[lineIdx] ?? [];
    const lineChildren: ElementContent[] = line.map((token) => tokenToElement(token));
    lineElements.push({
      type: "element",
      tagName: "span",
      properties: { className: ["line"] },
      children: lineChildren,
    });
    // Newline between lines (not after the last) so copied text keeps breaks.
    if (lineIdx < tokens.length - 1) {
      lineElements.push({ type: "text", value: "\n" });
    }
  }

  return {
    type: "element",
    tagName: "code",
    properties: { className: [langClass] },
    children: lineElements,
  };
}

// ---------------------------------------------------------------------------
// Lazy highlighter initialization
// ---------------------------------------------------------------------------

async function getHighlighter(): Promise<HighlighterCore> {
  if (!highlighterCache) {
    highlighterCache = Promise.all([
      import("shiki/core"),
      import("shiki/engine/javascript"),
      import("@shikijs/themes/github-dark-default"),
      import("@shikijs/themes/github-light-default"),
    ]).then(async ([core, engine, githubDark, githubLight]) => {
      const createHighlighterCore = (
        core as unknown as {
          createHighlighterCore: (opts: Record<string, unknown>) => Promise<HighlighterCore>;
        }
      ).createHighlighterCore;
      const createJavaScriptRegexEngine = (engine as { createJavaScriptRegexEngine: () => unknown })
        .createJavaScriptRegexEngine;

      return createHighlighterCore({
        engine: createJavaScriptRegexEngine(),
        themes: [
          (githubDark as { default: unknown }).default,
          (githubLight as { default: unknown }).default,
        ],
        langs: [],
        langAlias: SHIKI_LANG_ALIASES,
      });
    });
  }
  return highlighterCache;
}

async function ensureLanguage(lang: string): Promise<boolean> {
  const resolvedLang = normalizeLanguage(lang);
  if (loadedLangs.has(resolvedLang)) return true;
  if (EXCLUDED_LANGS.has(resolvedLang)) return true;

  const loader = LANGUAGE_LOADERS[resolvedLang];
  if (!loader) return false;

  try {
    const highlighter = await getHighlighter();
    await highlighter.loadLanguage(await loader());
    loadedLangs.add(resolvedLang);
    return true;
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Public API — lifecycle management
// ---------------------------------------------------------------------------

/**
 * Dispose the Shiki highlighter and clear all cached state.
 * Call this when highlighting is no longer needed (e.g. on component unmount).
 */
export function disposeHighlighter(): void {
  if (highlighterCache) {
    highlighterCache.then((h) => h.dispose()).catch(() => {});
    highlighterCache = null;
  }
  loadedLangs.clear();
  loadedLangs.add("plaintext");
  clearColorRegistry();
}

/**
 * Get the set of languages that have been loaded into the highlighter.
 */
export function getLoadedLanguages(): ReadonlySet<string> {
  return loadedLangs;
}

// ---------------------------------------------------------------------------
// Rehype plugin
// ---------------------------------------------------------------------------

/**
 * Mutable sink for the generated token-color stylesheet.
 *
 * The plugin writes the CSS for all registered token color classes here after
 * transforming the tree. Hosts read it and inject it into a `<style>` element
 * (the rendered HTML itself carries only classes — never inline styles — so
 * the sanitizer's style handling is not involved).
 */
export interface HighlightCssSink {
  current: string;
}

export interface HighlightOptions {
  /** Dark theme name (default: "github-dark-default"). */
  readonly darkTheme?: string;
  /** Light theme name (default: "github-light-default"). */
  readonly lightTheme?: string;
  /**
   * Optional sink receiving the generated token-color CSS after the tree is
   * transformed. Hosts should inject this CSS so token classes resolve to
   * colors. When omitted, the CSS is still registered but not surfaced.
   */
  readonly cssSink?: HighlightCssSink;
}

const DEFAULT_DARK_THEME = "github-dark-default";
const DEFAULT_LIGHT_THEME = "github-light-default";

/**
 * Rehype plugin that syntax-highlights <pre><code class="language-X"> blocks
 * using Shiki with per-language lazy loading.
 *
 * - Mermaid blocks are skipped (handled by the mermaid package).
 * - Unknown/unloadable languages fall back to plain code.
 * - If Shiki fails to load entirely, all code blocks are left unhighlighted.
 *
 * This plugin is async — it must be used in an async pipeline.
 */
export const rehypeShiki: Plugin<[HighlightOptions?], HastRoot, HastRoot> = (options) => {
  const darkTheme = options?.darkTheme ?? DEFAULT_DARK_THEME;
  const lightTheme = options?.lightTheme ?? DEFAULT_LIGHT_THEME;
  const cssSink = options?.cssSink;

  return async (tree: HastRoot): Promise<HastRoot> => {
    const codeBlocks: { pre: Element; lang: string; langClass: string; code: string }[] = [];

    visit(tree, "element", (node: Element, _index, parent) => {
      if (
        node.tagName !== "code" ||
        !parent ||
        parent.type !== "element" ||
        parent.tagName !== "pre"
      ) {
        return;
      }

      const classes = (node.properties?.className as string[]) ?? [];
      const langClass = classes.find((c) => c.startsWith("language-"));
      if (!langClass) return;

      const lang = langClass.replace("language-", "");
      if (EXCLUDED_LANGS.has(lang.toLowerCase())) return;

      const code = extractText(node);
      if (!code) return;

      codeBlocks.push({ pre: parent as Element, lang, langClass, code });
    });

    if (codeBlocks.length === 0) return tree;

    try {
      const highlighter = await getHighlighter();

      // Pre-load all unique languages in parallel
      const uniqueLangs = [...new Set(codeBlocks.map((b) => normalizeLanguage(b.lang)))];
      await Promise.all(uniqueLangs.map((lang) => ensureLanguage(lang)));

      for (const { pre, lang, langClass, code } of codeBlocks) {
        try {
          const loaded = highlighter.getLoadedLanguages();
          const normalizedLang = normalizeLanguage(lang);
          const resolvedLang = loaded.includes(lang)
            ? lang
            : loaded.includes(normalizedLang)
              ? normalizedLang
              : "plaintext";

          // Tokenize and build class-based HAST (no inline styles).
          const { tokens } = highlighter.codeToTokens(code, {
            lang: resolvedLang,
            themes: { dark: darkTheme, light: lightTheme },
          });
          const codeElement = tokensToCodeElement(tokens, langClass);

          pre.tagName = "pre";
          pre.properties = {
            ...pre.properties,
            className: ["shiki-code-block"],
            dataLanguage: resolvedLang,
          };
          pre.children = [codeElement];
        } catch {
          // Leave unhighlighted — plain code fallback
        }
      }

      // Surface the generated token-color stylesheet (full registry so the
      // host can replace its highlight <style> content on each render).
      if (cssSink) {
        cssSink.current = buildHighlightCss();
      }
    } catch {
      // Shiki failed to load entirely — leave all code blocks unhighlighted
    }

    return tree;
  };
};
