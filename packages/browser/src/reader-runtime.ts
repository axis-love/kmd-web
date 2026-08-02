// @axis-love/browser — reader runtime orchestrator
//
// The BrowserReader ties together worker bridge, parse cache, DOM
// morphing, anchor navigation, scroll tracking, code copy, link policy,
// asset lifecycle, and feature coordination into a single lifecycle.
//
// Hosts create a BrowserReader, call `update(source)` when the document
// changes, and call `dispose()` on unmount. The reader manages all
// browser effects internally.
//
// Design constraints:
// - No Tauri imports or detection — consumes HostCapabilities only.
// - No React — pure DOM manipulation.
// - Graceful degradation for missing capabilities.

import type { OutlineEntry, RenderOptions, RenderResult } from "@axis-love/contracts";
import { render } from "@axis-love/core";
import { ScrollTracker } from "./anchor-navigation.js";
import { AssetLifecycle } from "./asset-lifecycle.js";
import { CodeCopyEnhancer } from "./code-copy.js";
import { morphMarkdownBody } from "./dom-morph.js";
import { FeatureCoordinator } from "./feature-coordination.js";
import type { HostCapabilities } from "./index.js";
import { LinkPolicy } from "./link-policy.js";
import { ParseCache } from "./parse-cache.js";
import { type RenderFn, WorkerBridge } from "./worker-bridge.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * Options for creating a BrowserReader.
 */
export interface BrowserReaderOptions {
  /** The container element where rendered HTML will be placed. */
  readonly container: HTMLElement;
  /** The scrollable container for scroll tracking. If absent, scroll tracking is disabled. */
  readonly scrollContainer?: HTMLElement;
  /** Host capabilities bundle. */
  readonly capabilities?: HostCapabilities;
  /** Render options passed to the render function. */
  readonly renderOptions?: RenderOptions;
  /** Optional parse cache. If absent, a default cache (size 8) is created. */
  readonly cache?: ParseCache;
  /** Callback for outline updates. */
  readonly onOutlineChange?: (outline: readonly OutlineEntry[]) => void;
  /** Callback for active heading changes. */
  readonly onActiveHeadingChange?: (slug: string | undefined) => void;
  /** Callback for copy notifications. */
  readonly onCopy?: (message: string) => void;
  /** Callback when rendering completes. */
  readonly onRendered?: (result: RenderResult) => void;
  /** Callback for render errors. */
  readonly onError?: (error: Error) => void;
}

// ---------------------------------------------------------------------------
// BrowserReader
// ---------------------------------------------------------------------------

/**
 * Orchestrates the full browser rendering lifecycle for a single
 * reader instance.
 *
 * Multiple readers on the same page operate independently — each has
 * its own cache, worker, asset URLs, and scroll tracker.
 *
 * Lifecycle:
 * 1. `new BrowserReader(options)` — initialize
 * 2. `update(source)` — render a new document (or update existing)
 * 3. `dispose()` — clean up all resources (worker, object URLs, listeners)
 */
export class BrowserReader {
  private readonly container: HTMLElement;
  private readonly scrollContainer: HTMLElement | undefined;
  private readonly renderOptions: RenderOptions | undefined;
  private readonly onOutlineChange: ((outline: readonly OutlineEntry[]) => void) | undefined;
  private readonly onActiveHeadingChange: ((slug: string | undefined) => void) | undefined;
  private readonly onRendered: ((result: RenderResult) => void) | undefined;
  private readonly onError: ((error: Error) => void) | undefined;

  private readonly cache: ParseCache;
  private readonly bridge: WorkerBridge;
  private readonly codeCopy: CodeCopyEnhancer;
  private readonly linkPolicy: LinkPolicy;
  private readonly assets: AssetLifecycle;
  private readonly features: FeatureCoordinator;

  private scrollTracker: ScrollTracker | null = null;
  private scrollTrackerCleanup: (() => void) | null = null;
  private detachLinkHandler: (() => void) | null = null;
  private currentResult: RenderResult | null = null;
  private disposed = false;

  constructor(options: BrowserReaderOptions) {
    this.container = options.container;
    this.scrollContainer = options.scrollContainer;
    this.renderOptions = options.renderOptions;
    this.onOutlineChange = options.onOutlineChange;
    this.onActiveHeadingChange = options.onActiveHeadingChange;
    this.onRendered = options.onRendered;
    this.onError = options.onError;

    const caps = options.capabilities ?? {};
    this.cache = options.cache ?? new ParseCache({ maxSize: 8 });

    const renderFn: RenderFn = (source, opts) => render(source, opts);

    this.bridge = new WorkerBridge({
      workerFactory: caps.workerFactory,
      renderFn,
      cache: this.cache,
    });

    this.codeCopy = new CodeCopyEnhancer({
      clipboardProvider: caps.clipboardProvider,
      onCopy: options.onCopy,
    });

    this.linkPolicy = new LinkPolicy({
      linkHandler: caps.linkHandler,
      scrollContainer: this.scrollContainer,
      contentContainer: this.container,
    });

    this.assets = new AssetLifecycle({
      assetResolver: caps.assetResolver,
    });

    this.features = new FeatureCoordinator();
  }

  /**
   * Render or update the document. The container is updated in place
   * via DOM morphing when possible (to avoid full re-decode of images).
   *
   * Stale results (from a superseded render request) are discarded.
   */
  async update(source: string): Promise<void> {
    if (this.disposed) throw new Error("BrowserReader is disposed");

    try {
      const result = await this.bridge.render(source, this.renderOptions);

      // Discard stale results — if a newer update was issued before
      // this one resolved, the bridge already rejected the older
      // promise. But if we're here, this is the latest result.
      this.currentResult = result;

      // Morph the DOM (or set innerHTML if first render)
      const hadContent = this.container.childNodes.length > 0;
      if (hadContent) {
        morphMarkdownBody(this.container, result.html);
      } else {
        this.container.innerHTML = result.html;
      }

      // Notify outline
      this.onOutlineChange?.(result.outline);

      // Update scroll tracker
      this.updateScrollTracker(result.outline);

      // Attach link policy (idempotent — removes old handler first)
      this.detachLinkHandler?.();
      this.detachLinkHandler = this.linkPolicy.attach(this.container);

      // Attach code copy enhancer
      this.codeCopy.attach(this.container);

      // Resolve assets
      await this.assets.resolveAssets(this.container, result.assets);

      // Run feature enhancement passes
      await this.features.enhance(this.container, result.detectedFeatures);

      this.onRendered?.(result);
    } catch (err) {
      if (err instanceof Error && err.message === "superseded") {
        // Stale result — silently discard
        return;
      }
      const error = err instanceof Error ? err : new Error(String(err));
      this.onError?.(error);
      throw error;
    }
  }

  /**
   * Scroll to a fragment (heading anchor) within the document.
   */
  scrollToFragment(fragmentId: string): void {
    if (!this.scrollContainer) return;
    const target = this.container.querySelector<HTMLElement>(`[id="${fragmentId}"]`);
    if (target) {
      this.scrollContainer.scrollTo({
        top:
          target.getBoundingClientRect().top -
          this.scrollContainer.getBoundingClientRect().top -
          12,
        behavior: "smooth",
      });
    }
  }

  /**
   * Dispose all resources: terminate worker, revoke object URLs,
   * remove listeners, detach handlers.
   */
  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;

    this.bridge.dispose();
    this.assets.revokeAll();
    this.detachLinkHandler?.();
    this.detachLinkHandler = null;
    this.codeCopy.detach(this.container);
    this.scrollTrackerCleanup?.();
    this.scrollTrackerCleanup = null;
    this.scrollTracker = null;
    this.cache.clear();
    this.currentResult = null;
  }

  /** The current render result, or null if nothing has been rendered. */
  get result(): RenderResult | null {
    return this.currentResult;
  }

  // -----------------------------------------------------------------------
  // Private
  // -----------------------------------------------------------------------

  private updateScrollTracker(outline: readonly OutlineEntry[]): void {
    // Dispose old tracker
    this.scrollTrackerCleanup?.();
    this.scrollTrackerCleanup = null;
    this.scrollTracker = null;

    if (!this.scrollContainer || outline.length === 0) return;

    const slugs = outline.map((e) => e.slug);
    this.scrollTracker = new ScrollTracker(this.scrollContainer, this.container, slugs, (slug) =>
      this.onActiveHeadingChange?.(slug),
    );
    this.scrollTrackerCleanup = this.scrollTracker.start();
  }
}
