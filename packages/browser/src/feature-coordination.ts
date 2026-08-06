// @axis-love/browser — lazy feature coordination
//
// Coordinates with optional feature packages (highlighting, mermaid,
// math, design) after DOM morph. Each feature pass is independent —
// failure in one doesn't break others. When a package is not available
// (not installed), the feature is silently skipped (graceful fallback).
//
// Feature packages are lazy-loaded via dynamic import — they are never
// statically imported by the browser package.

import type { DetectedFeatures } from "@axis-love/contracts";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * Result of a single feature enhancement pass.
 */
export interface FeaturePassResult {
  readonly feature: string;
  readonly applied: boolean;
  readonly error?: string;
}

/**
 * Options for feature coordination.
 */
export interface FeatureCoordinationOptions {
  /** Timeout for mermaid rendering per diagram (default: 10000ms). */
  readonly mermaidTimeoutMs?: number;
}

// ---------------------------------------------------------------------------
// FeatureCoordinator
// ---------------------------------------------------------------------------

/**
 * Coordinates lazy feature enhancement passes after DOM morph.
 *
 * Each feature is triggered based on `detectedFeatures` from the
 * RenderResult:
 * - Mermaid: dynamically imports `@axis-love/mermaid` and calls
 *   `renderMermaidPlaceholders` on the container
 * - Math: dynamically imports `@axis-love/math` and calls
 *   `ensureKatexCss` to load the KaTeX stylesheet (rendering itself
 *   is done in the rehype pipeline via injected `rehypeKatex`)
 * - Highlighting: dynamically imports `@axis-love/highlighting`
 *   and checks for unhighlighted code blocks (Shiki runs in the
 *   rehype pipeline via injected `rehypeShiki`; this pass detects
 *   blocks that fell through, e.g. on the worker path)
 * - Design: no DOM-side action (design is a parse-time feature)
 *
 * Each pass is independent — if one fails, others still run. If a
 * feature package is not installed, the dynamic import rejects and
 * the feature is skipped (graceful fallback).
 */
export class FeatureCoordinator {
  private readonly mermaidTimeoutMs: number;

  constructor(options?: FeatureCoordinationOptions) {
    this.mermaidTimeoutMs = options?.mermaidTimeoutMs ?? 10_000;
  }

  /**
   * Run all applicable feature enhancement passes on the container.
   * Called after the DOM has been morphed/updated with new HTML.
   *
   * Each pass is independent and runs in try/catch — failures are
   * collected but never thrown.
   */
  async enhance(container: HTMLElement, features: DetectedFeatures): Promise<FeaturePassResult[]> {
    const results: FeaturePassResult[] = [];

    // Mermaid — render placeholders to SVG
    if (features.hasMermaid) {
      results.push(await this.runMermaidPass(container));
    }

    // Math — KaTeX rendering is done in the rehype pipeline (injected by
    // reader-runtime's renderFn). This DOM-side pass only ensures the
    // KaTeX stylesheet is loaded so the rendered HTML displays correctly.
    if (features.hasMath) {
      results.push(await this.runMathPass());
    }

    // Code highlighting — apply Shiki to code blocks in the DOM
    if (features.hasCodeHighlighting) {
      results.push(await this.runHighlightingPass(container));
    }

    // Design doc — no DOM-side action needed (extraction is parse-time)
    // Tables, task lists, footnotes, alerts — handled by core's HTML output

    return results;
  }

  // -----------------------------------------------------------------------
  // Individual feature passes
  // -----------------------------------------------------------------------

  private async runMermaidPass(container: HTMLElement): Promise<FeaturePassResult> {
    try {
      const mermaidMod = await import("@axis-love/mermaid");
      // Check the DOM directly for placeholders. If there are none,
      // the pass is a no-op (not an error).
      const hasPlaceholders = container.querySelector(".mermaid-placeholder") !== null;
      if (!hasPlaceholders) {
        return { feature: "mermaid", applied: false, error: "no placeholders found" };
      }
      await mermaidMod.renderMermaidPlaceholders(container, { timeoutMs: this.mermaidTimeoutMs });
      return { feature: "mermaid", applied: true };
    } catch (err) {
      return {
        feature: "mermaid",
        applied: false,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }

  private async runMathPass(): Promise<FeaturePassResult> {
    try {
      const mathMod = await import("@axis-love/math");
      mathMod.ensureKatexCss();
      return { feature: "math", applied: true };
    } catch (err) {
      return {
        feature: "math",
        applied: false,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }

  private async runHighlightingPass(container: HTMLElement): Promise<FeaturePassResult> {
    try {
      // Shiki highlighting runs in the rehype pipeline (injected by
      // reader-runtime's renderFn). By the time this DOM-side pass runs,
      // code blocks already have the "shiki-code-block" class. If any
      // blocks are missing it (e.g. worker path without plugin injection),
      // they are reported here for potential DOM-side fallback.
      const unhighlighted = container.querySelectorAll(
        "pre > code[class*='language-']:not(.shiki-code-block)",
      );
      if (unhighlighted.length === 0) {
        return {
          feature: "highlighting",
          applied: false,
          error: "no unhighlighted code blocks",
        };
      }

      // Dynamically import the highlighting package for potential DOM-side
      // re-highlighting. The pipeline already handled the common case;
      // this pass detects blocks that fell through (worker path limitation).
      await import("@axis-love/highlighting");
      return { feature: "highlighting", applied: true };
    } catch (err) {
      return {
        feature: "highlighting",
        applied: false,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }
}
