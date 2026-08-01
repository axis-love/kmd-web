// @axis-love/contracts — link and document target classification
//
// Core classifies link targets into safe categories. The browser runtime
// and host capabilities consume these classifications — they do not
// re-classify. This keeps the security policy inside core and prevents
// host adapters from bypassing URL or path policy.

import type { AssetType } from "./render";

// ---------------------------------------------------------------------------
// Link target classification
// ---------------------------------------------------------------------------

/**
 * The classification of a link's destination.
 *
 * - `external`       — an absolute URL with an allowed scheme (https,
 *   http) that points outside the document. The host should open it
 *   through the native OS handler.
 * - `mailto`         — a `mailto:` URL. The host should open the mail
 *   compose action.
 * - `tel`            — a `tel:` URL. The host should initiate a call.
 * - `internal`       — a fragment-only reference (e.g. `#section`) or a
 *   relative link within the current document. The browser runtime
 *   handles in-page navigation.
 * - `document`       — a relative or absolute path to another local
 *   Markdown document that the host can open. The host resolves this
 *   through its document-open capability (e.g. a Rust file backend).
 * - `blocked`        — the URL was classified as unsafe (javascript:,
 *   vbscript:, unknown scheme, or disallowed by policy). The link is
 *   stripped from the rendered HTML.
 */
export type LinkTargetKind = "external" | "mailto" | "tel" | "internal" | "document" | "blocked";

/**
 * A classified link target.
 *
 * Invariants:
 * - `kind` is the security classification determined by core.
 * - `rawUrl` is the original URL string from the Markdown source.
 * - `resolvedUrl` is the normalized, validated URL. For `external`,
 *   `mailto`, and `tel` targets this is the absolute URL. For
 *   `internal` targets it is the fragment including `#`. For
 *   `document` targets it is the resolved path relative to the
 *   document root. For `blocked` targets it is `undefined`.
 * - `reason`, when present on a `blocked` target, explains why the
 *   URL was blocked.
 */
export interface LinkTarget {
  readonly kind: LinkTargetKind;
  readonly rawUrl: string;
  readonly resolvedUrl?: string;
  readonly reason?: string;
}

// ---------------------------------------------------------------------------
// Document target
// ---------------------------------------------------------------------------

/**
 * A target for opening another document.
 *
 * Used by `LinkHandler.openDocument` to carry a pre-classified document
 * reference from core to the host.
 *
 * Invariants:
 * - `href` is the resolved path or URL to the document, as determined
 *   by core's classification. It is never a `javascript:` or other
 *   unsafe scheme.
 * - `anchor`, when present, is a fragment identifier (without `#`)
 *   within the target document to scroll to.
 * - `title`, when present, is a human-readable label for the target.
 */
export interface DocumentTarget {
  readonly href: string;
  readonly anchor?: string;
  readonly title?: string;
}

// ---------------------------------------------------------------------------
// Asset request / resolved asset
// ---------------------------------------------------------------------------

/**
 * A request to resolve an asset URL through the host.
 *
 * Used by `AssetResolver.resolveAsset`. Core produces these requests
 * after classifying asset references; the host fulfills them within
 * its allowed document root or asset policy.
 *
 * Invariants:
 * - `url` is the original URL from the Markdown source, before
 *   resolution. It may be relative.
 * - `type` classifies the asset kind.
 * - `documentBase`, when present, is the base URL of the document
 *   containing the reference. The host uses this to resolve relative
 *   paths.
 */
export interface AssetRequest {
  readonly url: string;
  readonly type: AssetType;
  readonly documentBase?: string;
}

/**
 * A resolved asset ready for the browser runtime to load.
 *
 * Invariants:
 * - `url` is a safe, loadable URL. For local assets resolved through a
 *   Rust backend, this is typically a `blob:` or `data:` URL. For
 *   allowed remote assets, it is the original HTTPS URL.
 * - `url` must not be `javascript:`, `vbscript:`, `file:`, or any
 *   unknown scheme.
 * - `originalUrl` is the source URL before resolution.
 * - `cached`, when true, indicates the host served this from a cache
 *   without a network or filesystem round-trip.
 */
export interface ResolvedAsset {
  readonly url: string;
  readonly originalUrl: string;
  readonly cached?: boolean;
}
