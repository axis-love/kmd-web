// @axis-love/browser — optional feature plugin injection
//
// Core never statically imports the optional feature packages; the host
// injects them as rehype plugin entries (the `RehypePluginEntry` seam).
// Both render paths need the same injection:
//
// - the main thread, via BrowserReader's render function
// - the render worker, via the host's worker entry module
//
// Plugin functions are not structured-cloneable, so they cannot be posted
// to a worker — the worker has to build its own list. Sharing one
// implementation is what keeps the two paths identical: a document renders
// the same whether it crossed the worker threshold or not.
//
// Feature packages are lazy-loaded via dynamic import — they are never
// statically imported by the browser package. A package that is not
// installed is skipped (graceful fallback to unhighlighted code / raw math).

import type { RenderOptions, RenderResult } from "@axis-love/contracts";
import { type RehypePluginEntry, render } from "@axis-love/core";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * Mutable sink that `rehypeShiki` fills with the generated token-color
 * stylesheet. Highlighting emits classes rather than inline styles (the
 * sanitizer strips inline styles), so the host must inject this CSS for the
 * token classes to resolve to colors.
 */
export interface HighlightCssSink {
  current: string;
}

/**
 * The rehype plugins to inject for a render, plus the sink that receives the
 * generated highlight stylesheet once the pipeline has run.
 */
export interface FeatureRehypePlugins {
  readonly plugins: readonly RehypePluginEntry[];
  readonly highlightCssSink: HighlightCssSink;
}

// ---------------------------------------------------------------------------
// Plugin collection
// ---------------------------------------------------------------------------

/**
 * Load the optional feature packages enabled by `options.features` and return
 * their rehype plugin entries.
 *
 * Both features default to enabled — they are skipped only when explicitly
 * disabled (`features.math === false` / `features.codeHighlighting === false`)
 * or when the package is not installed.
 *
 * Plugin order matters: KaTeX runs before Shiki so that `language-math` blocks
 * are already replaced by rendered math and never reach the highlighter.
 */
export async function loadFeatureRehypePlugins(
  options?: RenderOptions,
): Promise<FeatureRehypePlugins> {
  const plugins: RehypePluginEntry[] = [];
  const highlightCssSink: HighlightCssSink = { current: "" };

  if (options?.features?.math !== false) {
    try {
      const math = await import("@axis-love/math");
      plugins.push([math.rehypeKatex]);
    } catch {
      // Math package not available — skip
    }
  }

  if (options?.features?.codeHighlighting !== false) {
    try {
      const highlighting = await import("@axis-love/highlighting");
      plugins.push([highlighting.rehypeShiki, { cssSink: highlightCssSink }]);
    } catch {
      // Highlighting package not available — skip
    }
  }

  return { plugins, highlightCssSink };
}

// ---------------------------------------------------------------------------
// Render
// ---------------------------------------------------------------------------

/**
 * Render Markdown with the optional feature plugins injected.
 *
 * This is the render function used by `BrowserReader` on the main thread, and
 * the one a host's render worker should call in place of core's bare
 * `render()`. Calling core's `render()` directly in a worker produces HTML
 * without syntax highlighting and with unrendered math.
 *
 * The generated token-color stylesheet is attached to the result as
 * `codeHighlightCss`, which is a plain string and therefore survives the
 * worker's structured-clone boundary.
 */
export async function renderWithFeaturePlugins(
  source: string,
  options?: RenderOptions,
): Promise<RenderResult> {
  const { plugins, highlightCssSink } = await loadFeatureRehypePlugins(options);

  const result = await render(source, options, plugins.length > 0 ? plugins : undefined);

  if (highlightCssSink.current) {
    return { ...result, codeHighlightCss: highlightCssSink.current };
  }
  return result;
}
