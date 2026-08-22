// @axis-love/element
// Optional <kmd-reader> Web Component.
// Wraps the browser engine — does not fork rendering logic.
//
// This package provides a framework-neutral custom element that reuses the
// same core/browser engine and public style contract as the React wrapper.
// It implements the same patterns (loading/error/empty states, outline,
// scroll tracking, cleanup) using custom element lifecycle callbacks
// instead of React hooks.
//
// Package boundaries (from AGENTS.md):
// - element may import: contracts, core, browser
// - element must NOT import: react
// - sideEffects: false
// - ESM-first

import type { DesignThemeInfo, HostCapabilities, LinkHandler } from "@axis-love/browser";
import { BrowserReader } from "@axis-love/browser";
import type {
  DocumentTarget,
  OutlineEntry,
  RenderOptions,
  RenderResult,
} from "@axis-love/contracts";

// ---------------------------------------------------------------------------
// Package version
// ---------------------------------------------------------------------------

export const ELEMENT_VERSION = "0.2.0";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Name of the custom element. */
const ELEMENT_NAME = "kmd-reader";

/** Attributes observed by attributeChangedCallback. */
const OBSERVED_ATTRIBUTES = ["source", "theme", "data-source-url", "design-source"] as const;

/** Valid theme values. */
const VALID_THEMES = new Set(["dark", "light", "sepia"]);

/** CSS class for the root scope. */
const ROOT_CLASS = "kmd-reader";

/** CSS class for the content container (where BrowserReader writes HTML). */
const CONTENT_CLASS = "kmd-reader-content";

/** CSS class for the loading indicator. */
const LOADING_CLASS = "mdr-loading";

/** CSS class for the error display. */
const ERROR_CLASS = "mdr-error";

/** CSS class for the empty state. */
const EMPTY_CLASS = "mdr-empty";

// ---------------------------------------------------------------------------
// Event detail types
// ---------------------------------------------------------------------------

/** Detail for kmd:outline-change events. */
export interface KmdOutlineChangeDetail {
  readonly outline: readonly OutlineEntry[];
}

/** Detail for kmd:active-heading-change events. */
export interface KmdActiveHeadingChangeDetail {
  readonly slug: string | undefined;
}

/** Detail for kmd:rendered events. */
export interface KmdRenderedDetail {
  readonly result: RenderResult;
}

/** Detail for kmd:error events. */
export interface KmdErrorDetail {
  readonly error: Error;
}

/** Detail for kmd:link-external events. */
export interface KmdLinkExternalDetail {
  readonly url: URL;
}

/** Detail for kmd:link-document events. */
export interface KmdLinkDocumentDetail {
  readonly target: DocumentTarget;
}

/** Detail for kmd:copy events. */
export interface KmdCopyDetail {
  readonly message: string;
}

/** Detail for kmd:design-theme events. */
export interface KmdDesignThemeDetail {
  readonly info: DesignThemeInfo;
}

// ---------------------------------------------------------------------------
// Custom element class
// ---------------------------------------------------------------------------

/**
 * The <kmd-reader> custom element.
 *
 * Renders Markdown source text as safe HTML using the same BrowserReader
 * engine as the React package. Uses light DOM (not shadow DOM) so that:
 * - Host page CSS custom properties can override reader styles.
 * - Screen readers have direct access to rendered content.
 * - Host CSS can style the reader without `::part()` wrappers.
 *
 * Shadow DOM would isolate styles, preventing CSS custom property overrides
 * from the host page, and complicate accessibility by hiding content
 * behind a shadow root. Light DOM is the correct strategy for a reader
 * component that must integrate with the host page's styling context.
 *
 * Lifecycle:
 * 1. connectedCallback — creates a BrowserReader, renders source if present.
 * 2. attributeChangedCallback — updates source/theme when attributes change.
 * 3. property setters — trigger re-render when relevant.
 * 4. disconnectedCallback — disposes BrowserReader, cleans up all resources.
 *
 * Properties (typed, set via JS):
 * - source (string) — markdown source text.
 * - renderOptions (RenderOptions) — render configuration.
 * - capabilities (HostCapabilities) — host capability bundle.
 * - theme (string) — "dark" | "light" | "sepia".
 *
 * Attributes (reflected, simple values):
 * - source (string) — same as property, for declarative use.
 * - theme (string) — "dark" | "light" | "sepia".
 * - data-source-url (string) — optional URL to fetch source from.
 *
 * Events (composed CustomEvents, bubbles: true, composed: true):
 * - kmd:outline-change — { detail: { outline: OutlineEntry[] } }
 * - kmd:active-heading-change — { detail: { slug: string | undefined } }
 * - kmd:rendered — { detail: { result: RenderResult } }
 * - kmd:error — { detail: { error: Error } }
 * - kmd:link-external — { detail: { url: URL } }
 * - kmd:link-document — { detail: { target: DocumentTarget } }
 * - kmd:copy — { detail: { message: string } }
 *
 * Event security: Events are dispatched programmatically from the element's
 * own dispatchEvent method. Rendered Markdown content lives in the light DOM
 * children but has no access to dispatchEvent on the host element — only
 * the element's internal code creates events. Rendered content cannot forge
 * kmd:link-external, kmd:link-document, or any other privileged event.
 */
export class KmdReaderElement extends HTMLElement {
  /** Observed attributes for attributeChangedCallback. */
  static get observedAttributes(): readonly string[] {
    return OBSERVED_ATTRIBUTES;
  }

  // --- Internal state ---

  private reader: BrowserReader | null = null;
  private contentContainer: HTMLElement | null = null;
  private loadingEl: HTMLElement | null = null;
  private errorEl: HTMLElement | null = null;
  private emptyEl: HTMLElement | null = null;

  private _source = "";
  private _renderOptions: RenderOptions | undefined;
  private _capabilities: HostCapabilities | undefined;
  private _theme = "dark";
  private _dataSourceUrl: string | undefined;
  private _designSource: string | undefined;

  private hasError = false;

  // --- Properties ---

  /**
   * Markdown source text. Setting this property triggers a re-render.
   * Invalid types (non-string) yield a diagnostic event, not an exception.
   */
  get source(): string {
    return this._source;
  }

  set source(value: unknown) {
    if (typeof value !== "string") {
      this.emitError(new Error(`source must be a string, got ${typeof value}`));
      return;
    }
    this._source = value;
    // Reflect to attribute (without re-triggering attributeChangedCallback).
    this.setAttributeInternal("source", value);
    if (this.isConnected) {
      void this.renderSource();
    }
  }

  /**
   * Render options. Setting this property triggers a re-render.
   */
  get renderOptions(): RenderOptions | undefined {
    return this._renderOptions;
  }

  set renderOptions(value: RenderOptions | undefined) {
    this._renderOptions = value;
    if (this.isConnected) {
      void this.renderSource();
    }
  }

  /**
   * Host capabilities bundle. Must be set before the element is connected
   * (or before source is set). Changing capabilities after connection
   * requires recreating the BrowserReader — disconnect and reconnect.
   */
  get capabilities(): HostCapabilities | undefined {
    return this._capabilities;
  }

  set capabilities(value: HostCapabilities | undefined) {
    this._capabilities = value;
    // If already connected, recreate the reader with new capabilities.
    if (this.isConnected && this.reader) {
      this.disposeReader();
      this.createReader();
      if (this._source) {
        void this.renderSource();
      }
    }
  }

  /**
   * Theme: "dark", "light", or "sepia". Invalid values yield a diagnostic
   * event, not an exception. Setting this updates the data-kmd-theme attribute.
   */
  get theme(): string {
    return this._theme;
  }

  set theme(value: unknown) {
    if (typeof value !== "string" || !VALID_THEMES.has(value)) {
      this.emitError(new Error(`theme must be one of: dark, light, sepia (got "${value}")`));
      return;
    }
    this._theme = value;
    this.setAttributeInternal("data-kmd-theme", value);
  }

  /**
   * Optional URL to fetch source from. The host must validate this URL —
   * the component does not fetch it automatically. It is exposed as a
   * property for host-side tooling to read.
   */
  get dataSourceUrl(): string | undefined {
    return this._dataSourceUrl;
  }

  set dataSourceUrl(value: string | undefined) {
    this._dataSourceUrl = value;
    if (value !== undefined) {
      this.setAttributeInternal("data-source-url", value);
    } else {
      this.removeAttribute("data-source-url");
    }
  }

  /**
   * Optional designMD source text (never a path). Extracts a custom theme
   * and applies its --kmd-* overrides scoped to this element (see
   * docs/adr/0001-designmd-theming.md). Requires the optional
   * `@axis-love/design` peer of @axis-love/browser. Setting `undefined`
   * removes the overrides. Outcomes are reported through the
   * kmd:design-theme event; failures never produce an error state.
   */
  get designSource(): string | undefined {
    return this._designSource;
  }

  set designSource(value: unknown) {
    if (value !== undefined && typeof value !== "string") {
      this.emitError(new Error(`design-source must be a string, got ${typeof value}`));
      return;
    }
    this._designSource = value;
    if (value !== undefined) {
      this.setAttributeInternal("design-source", value);
    } else {
      this.removeAttribute("design-source");
    }
    if (this.isConnected && this.reader) {
      void this.reader.setDesignSource(value);
    }
  }

  // --- Lifecycle ---

  /**
   * Called when the element is inserted into the DOM.
   * Creates the DOM structure (content container, loading/error/empty
   * indicators) and the BrowserReader. Renders source if present.
   */
  connectedCallback(): void {
    // Build the internal DOM structure (light DOM).
    this.setupDom();

    // Set the theme attribute if not already set.
    if (!this.hasAttribute("data-kmd-theme")) {
      this.setAttribute("data-kmd-theme", this._theme);
    }

    // Create the BrowserReader.
    this.createReader();

    // Render source if present.
    if (this._source) {
      void this.renderSource();
    } else {
      this.showEmptyState();
    }
  }

  /**
   * Called when the element is removed from the DOM.
   * Disposes the BrowserReader and cleans up all resources (workers,
   * listeners, object URLs, scroll trackers).
   */
  disconnectedCallback(): void {
    this.disposeReader();
    this.clearDom();
  }

  /**
   * Called when an observed attribute changes.
   * Updates source/theme/data-source-url when attributes change.
   */
  attributeChangedCallback(name: string, oldValue: string | null, newValue: string | null): void {
    // Skip if nothing changed (initial set handled by connectedCallback).
    if (oldValue === newValue) return;

    if (name === "source") {
      this._source = newValue ?? "";
      if (this.isConnected) {
        void this.renderSource();
      }
    } else if (name === "theme") {
      if (newValue !== null && VALID_THEMES.has(newValue)) {
        this._theme = newValue;
        this.setAttribute("data-kmd-theme", newValue);
      }
    } else if (name === "data-source-url") {
      this._dataSourceUrl = newValue ?? undefined;
    } else if (name === "design-source") {
      this._designSource = newValue ?? undefined;
      if (this.isConnected && this.reader) {
        void this.reader.setDesignSource(this._designSource);
      }
    }
  }

  // --- DOM setup ---

  /**
   * Build the light DOM structure:
   * <kmd-reader class="kmd-reader" data-kmd-theme="dark">
   *   <div class="mdr-loading" aria-busy="true" aria-live="polite" hidden>
   *     <p>Loading…</p>
   *   </div>
   *   <div class="mdr-error" hidden>
   *     <h2>Render Error</h2>
   *     <p>{message}</p>
   *   </div>
   *   <p class="mdr-empty" hidden>This document is empty.</p>
   *   <div class="kmd-reader-content"></div>
   * </kmd-reader>
   *
   * The content container is ALWAYS in the DOM (hidden when not active)
   * so BrowserReader has a stable container reference across state transitions.
   */
  private setupDom(): void {
    // Only build once — if already built (reattach), keep existing structure.
    if (this.contentContainer) return;

    // Add the root class.
    this.classList.add(ROOT_CLASS);

    // Loading indicator.
    this.loadingEl = document.createElement("div");
    this.loadingEl.className = LOADING_CLASS;
    this.loadingEl.setAttribute("aria-busy", "true");
    this.loadingEl.setAttribute("aria-live", "polite");
    this.loadingEl.hidden = true;
    const loadingP = document.createElement("p");
    loadingP.textContent = "Loading…";
    this.loadingEl.appendChild(loadingP);

    // Error display.
    this.errorEl = document.createElement("div");
    this.errorEl.className = ERROR_CLASS;
    this.errorEl.hidden = true;
    const errorH = document.createElement("h2");
    errorH.textContent = "Render Error";
    this.errorEl.appendChild(errorH);
    const errorP = document.createElement("p");
    this.errorEl.appendChild(errorP);

    // Empty state.
    this.emptyEl = document.createElement("p");
    this.emptyEl.className = EMPTY_CLASS;
    this.emptyEl.textContent = "This document is empty.";
    this.emptyEl.hidden = true;

    // Content container (always in DOM — BrowserReader writes here).
    this.contentContainer = document.createElement("div");
    this.contentContainer.className = CONTENT_CLASS;
    this.contentContainer.hidden = true;

    // Append in order: loading, error, empty, content.
    this.appendChild(this.loadingEl);
    this.appendChild(this.errorEl);
    this.appendChild(this.emptyEl);
    this.appendChild(this.contentContainer);
  }

  /**
   * Remove all child elements created by setupDom.
   * Called on disconnect.
   */
  private clearDom(): void {
    this.loadingEl?.remove();
    this.errorEl?.remove();
    this.emptyEl?.remove();
    this.contentContainer?.remove();
    this.loadingEl = null;
    this.errorEl = null;
    this.emptyEl = null;
    this.contentContainer = null;
    this.classList.remove(ROOT_CLASS);
  }

  // --- Reader management ---

  /**
   * Create a new BrowserReader instance with the current capabilities
   * and render options. The reader's callbacks dispatch CustomEvents.
   */
  private createReader(): void {
    if (!this.contentContainer) return;

    // Wrap the host's capabilities to intercept link clicks and emit
    // kmd:link-external / kmd:link-document events. If the host provides
    // its own LinkHandler, we wrap it — the host handler still runs, and
    // the event is emitted for observability. If the host does NOT provide
    // a LinkHandler, we create one that only emits the event (the
    // BrowserReader's LinkPolicy default behavior — window.open for
    // external, fragment scroll for document — already handles the
    // actual action when no LinkHandler is supplied, but our wrapper
    // emits the event before that default applies).
    const caps = this._capabilities ?? {};
    const wrappedCapabilities: HostCapabilities = {
      ...caps,
      linkHandler: this.createEventEmittingLinkHandler(caps.linkHandler),
    };

    this.reader = new BrowserReader({
      container: this.contentContainer,
      capabilities: wrappedCapabilities,
      renderOptions: this._renderOptions,
      onOutlineChange: (outline) => {
        this.emit("kmd:outline-change", { outline } satisfies KmdOutlineChangeDetail);
      },
      onActiveHeadingChange: (slug) => {
        this.emit("kmd:active-heading-change", { slug } satisfies KmdActiveHeadingChangeDetail);
      },
      onRendered: (result) => {
        this.emit("kmd:rendered", { result } satisfies KmdRenderedDetail);
      },
      onError: (error) => {
        this.hasError = true;
        this.showErrorState(error);
        this.emit("kmd:error", { error } satisfies KmdErrorDetail);
      },
      onCopy: (message) => {
        this.emit("kmd:copy", { message } satisfies KmdCopyDetail);
      },
      designSource: this._designSource,
      designThemeRoot: this,
      onDesignTheme: (info) => {
        this.emit("kmd:design-theme", { info } satisfies KmdDesignThemeDetail);
      },
    });
  }

  /**
   * Create a LinkHandler that emits kmd:link-external and kmd:link-document
   * events before delegating to the host's handler (if provided).
   *
   * If the host provides a LinkHandler, events are emitted and then the
   * host handler is called. If no host handler is provided, events are
   * emitted and the BrowserReader's default behavior applies (window.open
   * for external, fragment scroll for document links).
   *
   * Security: The event is emitted from the element's own dispatchEvent,
   * not from the rendered content. Rendered Markdown cannot invoke this
   * handler directly — it is only called by the BrowserReader's LinkPolicy
   * after core's classifyLink has validated the URL.
   */
  private createEventEmittingLinkHandler(hostHandler?: LinkHandler): LinkHandler {
    return {
      openExternal: (url: URL) => {
        this.emit("kmd:link-external", { url } satisfies KmdLinkExternalDetail);
        if (hostHandler) {
          return hostHandler.openExternal(url);
        }
        return Promise.resolve();
      },
      openDocument: (target: DocumentTarget) => {
        this.emit("kmd:link-document", { target } satisfies KmdLinkDocumentDetail);
        if (hostHandler) {
          return hostHandler.openDocument(target);
        }
        return Promise.resolve();
      },
    };
  }

  /**
   * Dispose the current BrowserReader and null out the reference.
   */
  private disposeReader(): void {
    this.reader?.dispose();
    this.reader = null;
  }

  // --- Rendering ---

  /**
   * Render (or re-render) the current source. Handles loading, error,
   * and empty states. Renders run asynchronously — stale results from
   * superseded renders are discarded by BrowserReader.
   */
  private async renderSource(): Promise<void> {
    if (!this.reader || !this.contentContainer) return;

    // Empty source — show empty state.
    if (this._source === "") {
      this.showEmptyState();
      return;
    }

    // Start loading.
    this.showLoadingState();

    try {
      await this.reader.update(this._source);
      // If the render succeeded and the element is still connected,
      // show the content.
      if (this.isConnected && !this.hasError) {
        this.showContentState();
      }
    } catch {
      // BrowserReader's onError callback already handles error state.
      // The catch here prevents unhandled rejection.
    }
  }

  // --- State management ---

  /**
   * Show the loading state: aria-busy on element, loading indicator
   * visible, content hidden, error/empty hidden.
   */
  private showLoadingState(): void {
    this.hasError = false;

    this.setAttribute("aria-busy", "true");

    if (this.loadingEl) this.loadingEl.hidden = false;
    if (this.errorEl) this.errorEl.hidden = true;
    if (this.emptyEl) this.emptyEl.hidden = true;
    if (this.contentContainer) this.contentContainer.hidden = true;

    // Update error message element to clear stale text.
    if (this.errorEl) {
      const p = this.errorEl.querySelector("p");
      if (p) p.textContent = "";
    }
  }

  /**
   * Show the content state: loading/error/empty hidden, content visible.
   */
  private showContentState(): void {
    this.removeAttribute("aria-busy");

    if (this.loadingEl) this.loadingEl.hidden = true;
    if (this.errorEl) this.errorEl.hidden = true;
    if (this.emptyEl) this.emptyEl.hidden = true;
    if (this.contentContainer) this.contentContainer.hidden = false;
  }

  /**
   * Show the error state: loading/empty hidden, error visible with message.
   */
  private showErrorState(error: Error): void {
    this.removeAttribute("aria-busy");

    if (this.loadingEl) this.loadingEl.hidden = true;
    if (this.emptyEl) this.emptyEl.hidden = true;
    if (this.contentContainer) this.contentContainer.hidden = true;

    if (this.errorEl) {
      this.errorEl.hidden = false;
      const p = this.errorEl.querySelector("p");
      if (p) p.textContent = error.message;
    }
  }

  /**
   * Show the empty state: loading/error hidden, empty visible, content hidden.
   * Clears the rendered content.
   */
  private showEmptyState(): void {
    this.hasError = false;

    this.removeAttribute("aria-busy");

    if (this.loadingEl) this.loadingEl.hidden = true;
    if (this.errorEl) this.errorEl.hidden = true;
    if (this.emptyEl) this.emptyEl.hidden = false;
    if (this.contentContainer) {
      this.contentContainer.hidden = true;
      this.contentContainer.innerHTML = "";
    }

    // Emit empty outline.
    this.emit("kmd:outline-change", { outline: [] } satisfies KmdOutlineChangeDetail);
  }

  // --- Event dispatch ---

  /**
   * Dispatch a composed CustomEvent with the given detail.
   * Events bubble and cross shadow boundaries (composed: true) so that
   * host page listeners can receive them.
   *
   * Security: This method is private and only called from the element's
   * internal lifecycle code and BrowserReader callbacks. Rendered Markdown
   * content has no access to this method — it lives in the light DOM as
   * child nodes but cannot invoke private methods or dispatchEvent on
   * the host element.
   */
  private emit(type: string, detail: unknown): void {
    this.dispatchEvent(
      new CustomEvent(type, {
        bubbles: true,
        composed: true,
        detail,
      }),
    );
  }

  /**
   * Emit a kmd:error event with the given error.
   */
  private emitError(error: Error): void {
    this.emit("kmd:error", { error } satisfies KmdErrorDetail);
  }

  // --- Attribute helpers ---

  /**
   * Set an attribute without triggering attributeChangedCallback side
   * effects. This is used when reflecting a property to its attribute —
   * the property setter already handles the side effect.
   */
  private setAttributeInternal(name: string, value: string): void {
    // Use setAttribute directly — attributeChangedCallback checks
    // oldValue === newValue and skips if unchanged.
    this.setAttribute(name, value);
  }
}

// ---------------------------------------------------------------------------
// Registration
// ---------------------------------------------------------------------------

/**
 * Registers the <kmd-reader> custom element.
 *
 * Safe to call multiple times — subsequent calls after the first
 * successful registration are a no-op (the browser throws if the
 * same name is registered twice, which we catch and ignore).
 *
 * @throws Never throws — duplicate registration is silently ignored.
 */
export function registerKmdReader(): void {
  if (typeof customElements === "undefined") return;
  if (customElements.get(ELEMENT_NAME) !== undefined) return;
  customElements.define(ELEMENT_NAME, KmdReaderElement);
}

// ---------------------------------------------------------------------------
// Re-exports for consumers
// ---------------------------------------------------------------------------

export type {
  DocumentTarget,
  HostCapabilities,
} from "@axis-love/browser";
export type {
  OutlineEntry,
  RenderOptions,
  RenderResult,
} from "@axis-love/contracts";
