// @axis-love/math
// Optional KaTeX math rendering integration.
// Lazy-loaded — no network, disabled unsafe macros.
//
// Design:
// - Core's remark-math plugin produces <code class="language-math math-inline">
//   and <pre><code class="language-math math-display"> elements with the raw
//   math source as text content.
// - This package provides a rehype plugin (rehypeKatex) that transforms those
//   elements into KaTeX-rendered HTML.
// - KaTeX is loaded lazily only when math is detected.
// - Safe config: trust=false (no \input, \includegraphics, \url, \href with
//   unsafe protocols), throwOnError=false (readable error instead of crash),
//   maxExpand limit (prevents macro expansion DoS).
// - KaTeX CSS is loaded only when math is detected (ensureKatexCss).
// - Readable fallback: if KaTeX fails, the original math source is shown
//   in a <code> element with an error class.
//
// The rehype plugin is designed to run in the post-core enhancement phase.
// Core produces the math placeholders; this plugin replaces them with
// rendered KaTeX HTML. This keeps KaTeX out of the baseline bundle.

import type { Element, ElementContent, Root as HastRoot } from "hast";
import type { Plugin } from "unified";
import { visit } from "unist-util-visit";

// ---------------------------------------------------------------------------
// Version
// ---------------------------------------------------------------------------

export const MATH_VERSION = "0.1.0-rc.0";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MATH_DISPLAY_CLASS = "math-display";
const LANGUAGE_MATH_CLASS = "language-math";

// Maximum macro expansion depth to prevent DoS via deeply nested macros
const SAFE_MAX_EXPAND = 1000;

// ---------------------------------------------------------------------------
// Types (lazy — KaTeX types are loaded at runtime)
// ---------------------------------------------------------------------------

type KatexOptions = {
  displayMode?: boolean;
  throwOnError?: boolean;
  errorColor?: string;
  strict?: boolean | string;
  trust?: boolean;
  macros?: Record<string, string>;
  maxExpand?: number;
  output?: string;
};

type KatexModule = {
  renderToString: (tex: string, options: KatexOptions) => string;
};

// ---------------------------------------------------------------------------
// Utilities
// ---------------------------------------------------------------------------

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

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

// ---------------------------------------------------------------------------
// Safe KaTeX configuration
// ---------------------------------------------------------------------------

/**
 * Safe KaTeX options for untrusted input.
 *
 * - trust=false: blocks \input, \includegraphics, \url, \href with
 *   unsafe protocols, \htmlClass, \htmlId, \htmlStyle, \htmlData
 * - throwOnError=false: renders unsupported commands in errorColor
 *   instead of throwing (provides readable fallback)
 * - strict="error": enforces LaTeX faithfulness mode
 * - maxExpand: limits macro expansion to prevent DoS
 * - output="htmlAndMathml": HTML for visual, MathML for accessibility
 * - macros: empty object — no custom macros (prevents injection)
 */
const SAFE_KATEX_OPTIONS: KatexOptions = {
  displayMode: false,
  throwOnError: false,
  errorColor: "#cc0000",
  strict: "error",
  trust: false,
  macros: {},
  maxExpand: SAFE_MAX_EXPAND,
  output: "htmlAndMathml",
};

// ---------------------------------------------------------------------------
// Lazy KaTeX loader
// ---------------------------------------------------------------------------

let katexCache: Promise<KatexModule> | null = null;

async function loadKatex(): Promise<KatexModule> {
  if (!katexCache) {
    katexCache = import("katex").then((m) => m.default as unknown as KatexModule);
  }
  return katexCache;
}

// ---------------------------------------------------------------------------
// CSS loading (lazy, only when math detected)
// ---------------------------------------------------------------------------

let katexCssLoaded = false;

/**
 * Ensure the KaTeX stylesheet is loaded. Called only when math is detected.
 * In a browser environment, this dynamically injects a <link> element.
 * In Node/SSR, this is a no-op (CSS is handled by the host).
 */
export function ensureKatexCss(): void {
  if (katexCssLoaded) return;
  katexCssLoaded = true;
  // Dynamic import of CSS — bundler picks this up as a separate chunk
  // In Node/SSR this is a no-op
  try {
    // @ts-expect-error — CSS import has no type declaration
    import("katex/dist/katex.min.css");
  } catch {
    // CSS import may fail in non-browser environments — that's fine,
    // the host is responsible for loading CSS in those cases.
  }
}

/**
 * Reset the KaTeX state. Clears cached module and CSS flag.
 * Useful for testing.
 */
export function resetMathState(): void {
  katexCache = null;
  katexCssLoaded = false;
}

// ---------------------------------------------------------------------------
// RenderResult detection
// ---------------------------------------------------------------------------

/**
 * Check if a RenderResult's HTML contains math elements that need KaTeX rendering.
 * Looks for the `language-math` class that remark-math produces.
 */
export function hasMathElements(html: string): boolean {
  return html.includes(LANGUAGE_MATH_CLASS);
}

// ---------------------------------------------------------------------------
// Fallback HTML generation
// ---------------------------------------------------------------------------

/**
 * Generate a readable fallback for a failed math render.
 * Shows the original math source in a <code> block with an error class.
 */
export function createMathFallback(source: string, error?: string): string {
  const errorHtml = error ? ` <span class="katex-error-msg">${escapeHtml(error)}</span>` : "";
  return `<code class="katex-error">${escapeHtml(source)}</code>${errorHtml}`;
}

// ---------------------------------------------------------------------------
// Single expression rendering
// ---------------------------------------------------------------------------

export interface MathRenderOptions {
  /** Render in display (block) mode. Default: false (inline). */
  readonly displayMode?: boolean;
}

/**
 * Render a single math expression to KaTeX HTML.
 * Loads KaTeX lazily on first call.
 *
 * @param tex - The LaTeX math source text
 * @param options - Optional render options
 * @returns The rendered KaTeX HTML string
 * @throws Error if rendering fails catastrophically (not for parse errors)
 */
export async function renderMath(tex: string, options?: MathRenderOptions): Promise<string> {
  if (!tex) return "";

  const katex = await loadKatex();

  const opts: KatexOptions = {
    ...SAFE_KATEX_OPTIONS,
    displayMode: options?.displayMode ?? false,
  };

  // KaTeX with throwOnError=false returns error-colored HTML for
  // unsupported commands rather than throwing. This is the readable fallback.
  return katex.renderToString(tex, opts);
}

// ---------------------------------------------------------------------------
// Rehype plugin
// ---------------------------------------------------------------------------

/**
 * Rehype plugin that renders math elements using KaTeX.
 *
 * Transforms:
 * - <code class="language-math math-inline">tex</code> → KaTeX inline HTML
 * - <pre><code class="language-math math-display">tex</code></pre> → KaTeX display HTML
 *
 * This plugin is async — it must be used in an async pipeline.
 * KaTeX is loaded lazily on first use.
 */
export const rehypeKatex: Plugin<[], HastRoot, HastRoot> =
  () =>
  async (tree: HastRoot): Promise<HastRoot> => {
    // Find all math elements first
    const mathElements: {
      node: Element;
      parent: Element | HastRoot | null | undefined;
      source: string;
      isDisplay: boolean;
    }[] = [];

    visit(tree, "element", (node: Element, _index, parent) => {
      const classes = (node.properties?.className as string[]) ?? [];
      if (!classes.includes(LANGUAGE_MATH_CLASS)) return;

      const isDisplay = classes.includes(MATH_DISPLAY_CLASS);
      const source = extractText(node);

      mathElements.push({ node, parent, source, isDisplay });
    });

    if (mathElements.length === 0) return tree;

    // Ensure CSS is loaded
    ensureKatexCss();

    let katex: KatexModule;
    try {
      katex = await loadKatex();
    } catch {
      // KaTeX failed to load — provide readable fallback for all math
      for (const { node, source } of mathElements) {
        node.tagName = "code";
        node.properties = { className: ["katex-error"] };
        node.children = [{ type: "text", value: source } as unknown as ElementContent];
      }
      return tree;
    }

    for (const { node, parent, source, isDisplay } of mathElements) {
      try {
        const opts: KatexOptions = {
          ...SAFE_KATEX_OPTIONS,
          displayMode: isDisplay,
        };

        const html = katex.renderToString(source, opts);

        // Replace the node content with KaTeX HTML
        if (isDisplay && parent && parent.type === "element" && parent.tagName === "pre") {
          // Display math: replace the <pre> entirely with a KaTeX display div
          const displayDiv: Element = {
            type: "element",
            tagName: "div",
            properties: { className: ["katex-display"] },
            children: [{ type: "raw", value: html } as unknown as ElementContent],
          };
          // Copy properties from parent <pre> to the new div
          Object.assign(parent, displayDiv);
        } else {
          // Inline math: replace the <code> content with KaTeX HTML
          node.tagName = "span";
          node.properties = { className: ["katex-inline"] };
          node.children = [{ type: "raw", value: html } as unknown as ElementContent];
        }
      } catch {
        // KaTeX render failed — provide readable fallback
        node.tagName = "code";
        node.properties = { className: ["katex-error"] };
        node.children = [{ type: "text", value: source } as unknown as ElementContent];
      }
    }

    return tree;
  };
