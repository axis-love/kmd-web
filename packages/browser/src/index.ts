// @axis-love/browser
// Browser runtime: DOM enhancement, worker bridge, cache, asset URL lifecycle.
// Consumes host capabilities instead of detecting Tauri.

import type { AssetRequest, DocumentTarget, ResolvedAsset } from "@axis-love/contracts";

export const BROWSER_VERSION = "0.1.0";

// ---------------------------------------------------------------------------
// Host capabilities
//
// The browser runtime consumes narrow capabilities supplied by a host
// (desktop, iOS, web) instead of detecting a specific platform. This
// keeps platform-specific behavior outside the browser package and
// prevents host adapters from bypassing core security policy.
//
// Core classifies and validates actions. A capability only carries out
// an already-classified action.
// ---------------------------------------------------------------------------

/**
 * Resolves asset URLs through the host.
 *
 * The host fulfills requests within its allowed document root or asset
 * policy. Core classifies asset references first; the resolver only
 * carries out the resolution.
 *
 * Default behavior when absent: the browser runtime does not load
 * unresolved assets. Local relative assets remain unresolved (no
 * `src`), and remote assets follow the `allowRemoteImages` policy.
 */
export interface AssetResolver {
  resolveAsset(request: AssetRequest): Promise<ResolvedAsset>;
}

/**
 * Handles link navigation through the host.
 *
 * Core classifies link targets into safe categories. The handler only
 * receives already-classified targets — it does not re-validate the
 * URL scheme or decide whether a link is safe.
 *
 * Default behavior when absent:
 * - `openExternal`: external links are rendered with
 *   `rel="noopener noreferrer"` and `target="_blank"` but the browser
 *   runtime does not intercept clicks. The host page's default
 *   navigation applies.
 * - `openDocument`: document links fall back to in-page navigation
 *   (treated as `internal`).
 */
export interface LinkHandler {
  openExternal(url: URL): Promise<void>;
  openDocument(target: DocumentTarget): Promise<void>;
}

/**
 * Provides clipboard write access through the host.
 *
 * Default behavior when absent: the browser runtime uses
 * `navigator.clipboard.writeText` if available. If the Web Clipboard
 * API is unavailable, copy controls are hidden.
 */
export interface ClipboardProvider {
  writeText(value: string): Promise<void>;
}

// ---------------------------------------------------------------------------
// Worker factory
// ---------------------------------------------------------------------------

/**
 * A message that the worker bridge sends to a render worker.
 *
 * Invariants:
 * - `id` is a monotonically increasing request identifier.
 * - `source` is the Markdown source text.
 * - `options` is the serializable render options (without `signal`).
 */
export interface WorkerRenderRequest {
  readonly id: number;
  readonly source: string;
  readonly options?: import("@axis-love/contracts").RenderOptions;
}

/**
 * A message the render worker sends back to the worker bridge.
 *
 * Invariants:
 * - `id` matches the request that triggered it.
 * - On success (`type: "result"`), `result` is the render output.
 * - On failure (`type: "error"`), `error` is a structured error
 *   description.
 */
export type WorkerRenderResponse =
  | {
      readonly type: "result";
      readonly id: number;
      readonly result: import("@axis-love/contracts").RenderResult;
    }
  | { readonly type: "error"; readonly id: number; readonly error: string };

/**
 * Factory for creating render workers.
 *
 * The browser runtime uses this to offload rendering to a Web Worker
 * when the document is large enough to warrant it. When no factory is
 * supplied, the browser runtime falls back to main-thread rendering.
 *
 * Default behavior when absent: all rendering runs on the main thread.
 * Small documents never use a worker regardless.
 */
export interface WorkerFactory {
  createWorker(): {
    postMessage(message: WorkerRenderRequest): void;
    addEventListener(
      type: "message",
      listener: (event: MessageEvent<WorkerRenderResponse>) => void,
    ): void;
    addEventListener(type: "error", listener: (event: ErrorEvent) => void): void;
    terminate(): void;
  };
}

// ---------------------------------------------------------------------------
// Browser host capabilities bundle
// ---------------------------------------------------------------------------

/**
 * Optional bundle of host capabilities supplied to the browser runtime.
 *
 * Every field is optional. When a capability is absent, the browser
 * runtime applies its documented default behavior (see each interface
 * above).
 *
 * This object is intentionally narrow — each capability is a separate
 * interface to prevent a single growing adapter object. Hosts
 * implement only the capabilities they need.
 */
export interface HostCapabilities {
  readonly assetResolver?: AssetResolver;
  readonly linkHandler?: LinkHandler;
  readonly clipboardProvider?: ClipboardProvider;
  readonly workerFactory?: WorkerFactory;
}

// ---------------------------------------------------------------------------
// Re-export shared types for browser consumers
// ---------------------------------------------------------------------------

export type { DocumentTarget, LinkTarget } from "@axis-love/contracts";

// ---------------------------------------------------------------------------
// Runtime modules (KWEB-011)
// ---------------------------------------------------------------------------

export {
  findAnchorTarget,
  getReaderScrollTopForTarget,
  ScrollTracker,
  type ScrollTrackerOptions,
  scrollContainerToTarget,
} from "./anchor-navigation.js";
export { AssetLifecycle, type AssetLifecycleOptions } from "./asset-lifecycle.js";
export { CodeCopyEnhancer, type CodeCopyOptions, type CopyNotifier } from "./code-copy.js";
export { morphMarkdownBody, RAW_IMAGE_SRC_ATTR } from "./dom-morph.js";
export {
  type FeatureCoordinationOptions,
  FeatureCoordinator,
  type FeaturePassResult,
} from "./feature-coordination.js";
export { LinkPolicy, type LinkPolicyOptions } from "./link-policy.js";
export { ParseCache, type ParseCacheOptions } from "./parse-cache.js";
export { BrowserReader, type BrowserReaderOptions } from "./reader-runtime.js";
export { type RenderFn, WorkerBridge, type WorkerBridgeOptions } from "./worker-bridge.js";
