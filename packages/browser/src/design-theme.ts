// @axis-love/browser — designMD theme application (KWEB-061)
//
// Applies a design.md-derived custom theme to a reader subtree, per
// docs/adr/0001-designmd-theming.md:
//
// - `@axis-love/design` is an OPTIONAL peer dependency, loaded via dynamic
//   import exactly like mermaid/math/highlighting. Readers that never pass a
//   design source never load it.
// - The emitted CSS is scoped to the reader root via a `data-kmd-design`
//   attribute; custom properties set on the root itself win over ancestor
//   theme selectors by inheritance proximity and never leak to the host page.
// - One shared `<style data-kmd-design-theme>` element per design source
//   (content-hashed scope id), refcounted across reader instances.
// - Failures are non-fatal by contract: a bad design.md never blanks the
//   document — the outcome is reported through the onDesignTheme callback.

// ---------------------------------------------------------------------------
// Types (structural — deliberately NOT imported from @axis-love/design, so
// this package's declaration files stay resolvable when the optional peer is
// not installed)
// ---------------------------------------------------------------------------

/** Diagnostic reported by the design pipeline / theme emitter. */
export interface DesignThemeDiagnostic {
  readonly severity: "error" | "warning" | "info";
  readonly token?: string;
  readonly message: string;
}

/** Outcome of a design-theme apply attempt. */
export interface DesignThemeInfo {
  /** True when token overrides are now active on the reader. */
  readonly applied: boolean;
  readonly diagnostics: readonly DesignThemeDiagnostic[];
}

/** The subset of @axis-love/design this module uses (structural). */
interface DesignModule {
  runDesignPipelineCached(content: string): unknown;
  emitThemeTokens(doc: unknown): {
    empty: boolean;
    diagnostics: DesignThemeDiagnostic[];
  };
  designThemeCss(tokens: unknown, scopeId: string): string;
}

// ---------------------------------------------------------------------------
// Shared style registry — one <style> per design source, refcounted
// ---------------------------------------------------------------------------

const STYLE_ATTR = "data-kmd-design-theme";
const SCOPE_ATTR = "data-kmd-design";

interface StyleEntry {
  element: HTMLStyleElement;
  refs: number;
}

const styleRegistry = new Map<string, StyleEntry>();

function acquireStyle(doc: Document, scopeId: string, css: string): void {
  const existing = styleRegistry.get(scopeId);
  if (existing) {
    existing.refs++;
    return;
  }
  const element = doc.createElement("style");
  element.setAttribute(STYLE_ATTR, scopeId);
  element.textContent = css;
  doc.head.appendChild(element);
  styleRegistry.set(scopeId, { element, refs: 1 });
}

function releaseStyle(scopeId: string): void {
  const entry = styleRegistry.get(scopeId);
  if (!entry) return;
  entry.refs--;
  if (entry.refs <= 0) {
    entry.element.remove();
    styleRegistry.delete(scopeId);
  }
}

/**
 * Same DJB2 content hash as the design pipeline cache, formatted to satisfy
 * the emitter's scope-id charset ([A-Za-z0-9_-]).
 */
function hashSource(content: string): string {
  let hash = 5381;
  for (let index = 0; index < content.length; index++) {
    hash = ((hash << 5) + hash + content.charCodeAt(index)) >>> 0;
  }
  return `${content.length}-${hash.toString(16)}`;
}

// ---------------------------------------------------------------------------
// DesignThemeController
// ---------------------------------------------------------------------------

/**
 * Owns the design-theme lifecycle for one reader instance: pipeline runs,
 * scope attribute on the reader root, and the shared style element reference.
 *
 * `apply` never throws and never touches the rendered document — the worst
 * outcome of any input is "default themes, with diagnostics".
 */
export class DesignThemeController {
  private readonly root: HTMLElement;
  private readonly onInfo: ((info: DesignThemeInfo) => void) | undefined;

  private currentScopeId: string | null = null;
  private currentSource: string | null = null;
  /** Monotonic sequence — a stale async apply must not clobber a newer one. */
  private seq = 0;

  constructor(root: HTMLElement, onInfo?: (info: DesignThemeInfo) => void) {
    this.root = root;
    this.onInfo = onInfo;
  }

  /**
   * Apply (or remove, when `source` is undefined/blank) the design theme.
   * Setting the same source again is a no-op.
   */
  async apply(source: string | undefined): Promise<void> {
    const normalized = source?.trim() ? source : undefined;
    const seq = ++this.seq;

    if (normalized === undefined) {
      this.remove();
      if (source !== undefined) {
        // Provided but blank — per the ADR, treated as removal with a note.
        this.report({
          applied: false,
          diagnostics: [
            {
              severity: "info",
              token: "design-theme",
              message: "Design source is empty; default themes are unchanged.",
            },
          ],
        });
      }
      return;
    }

    if (normalized === this.currentSource) return;

    if (typeof document === "undefined") return;

    let design: DesignModule;
    try {
      design = (await import("@axis-love/design")) as unknown as DesignModule;
    } catch {
      if (seq !== this.seq) return;
      this.remove();
      this.report({
        applied: false,
        diagnostics: [
          {
            severity: "warning",
            token: "design-theme",
            message:
              "@axis-love/design is not installed; design theming is unavailable and default themes are used.",
          },
        ],
      });
      return;
    }

    if (seq !== this.seq) return; // superseded while loading

    let info: DesignThemeInfo;
    try {
      const doc = design.runDesignPipelineCached(normalized);
      const tokens = design.emitThemeTokens(doc);
      const scopeId = hashSource(normalized);
      const css = tokens.empty ? "" : design.designThemeCss(tokens, scopeId);

      if (css === "") {
        this.remove();
        info = { applied: false, diagnostics: tokens.diagnostics };
      } else {
        const previousScopeId = this.currentScopeId;
        acquireStyle(this.root.ownerDocument, scopeId, css);
        this.root.setAttribute(SCOPE_ATTR, scopeId);
        this.currentScopeId = scopeId;
        this.currentSource = normalized;
        if (previousScopeId && previousScopeId !== scopeId) {
          releaseStyle(previousScopeId);
        }
        info = { applied: true, diagnostics: tokens.diagnostics };
      }
    } catch (err) {
      // The pipeline captures its own failures as diagnostics; this guards
      // against anything that still escapes. Never fatal.
      this.remove();
      info = {
        applied: false,
        diagnostics: [
          {
            severity: "error",
            token: "design-theme",
            message: `Design theme could not be applied: ${
              err instanceof Error ? err.message : String(err)
            }`,
          },
        ],
      };
    }
    if (seq !== this.seq) return;
    this.report(info);
  }

  /** Remove any active overrides. Synchronous; safe to call repeatedly. */
  remove(): void {
    this.currentSource = null;
    if (this.currentScopeId === null) return;
    this.root.removeAttribute(SCOPE_ATTR);
    releaseStyle(this.currentScopeId);
    this.currentScopeId = null;
  }

  /** Dispose: drop overrides and the style reference. */
  dispose(): void {
    this.seq++;
    this.remove();
  }

  private report(info: DesignThemeInfo): void {
    this.onInfo?.(info);
  }
}
