// @axis-love/contracts — structured errors
//
// Structured error types for the rendering pipeline. These are thrown
// or returned to signal failure modes that callers can handle
// programmatically. They do not expose unified/HAST or Tauri types.

// ---------------------------------------------------------------------------
// Error codes
// ---------------------------------------------------------------------------

/**
 * Machine-readable error codes for structured errors.
 *
 * - `source-too-large`   — the input exceeded `maxSourceSize`.
 * - `render-timeout`     — the render exceeded `timeoutMs`.
 * - `parse-error`        — the Markdown could not be parsed.
 * - `sanitize-error`     — sanitization failed unexpectedly.
 * - `invalid-options`    — the render options were invalid.
 * - `feature-unavailable` — a required feature implementation is missing.
 */
export type RenderErrorCode =
  | "source-too-large"
  | "render-timeout"
  | "parse-error"
  | "sanitize-error"
  | "invalid-options"
  | "feature-unavailable";

// ---------------------------------------------------------------------------
// Render error
// ---------------------------------------------------------------------------

/**
 * A structured error thrown when rendering fails.
 *
 * Unlike `Diagnostic` entries (which are non-fatal and included in
 * `RenderResult`), a `RenderError` means the render did not complete
 * successfully and no `RenderResult` is available.
 *
 * Invariants:
 * - `code` is a stable, machine-readable error code. It never changes
 *   for a given failure mode, making it safe for programmatic
 *   handling.
 * - `message` is a human-readable description.
 * - `cause`, when present, is the underlying error that triggered this
 *   one. It is not structured and should not be relied upon for
 *   programmatic handling.
 */
export class RenderError extends Error {
  readonly code: RenderErrorCode;
  readonly cause?: unknown;

  constructor(code: RenderErrorCode, message: string, cause?: unknown) {
    super(message);
    this.name = "RenderError";
    this.code = code;
    this.cause = cause;
  }
}

// ---------------------------------------------------------------------------
// Capability errors
// ---------------------------------------------------------------------------

/**
 * Error codes for host capability failures.
 *
 * - `asset-not-found`    — the requested asset could not be resolved.
 * - `asset-blocked`      — the asset URL was blocked by policy.
 * - `link-blocked`       — the link was blocked by policy.
 * - `clipboard-denied`   — the host denied clipboard write access.
 * - `capability-unsupported` — the host does not implement this capability.
 */
export type CapabilityErrorCode =
  | "asset-not-found"
  | "asset-blocked"
  | "link-blocked"
  | "clipboard-denied"
  | "capability-unsupported";

/**
 * A structured error thrown when a host capability fails.
 *
 * Invariants:
 * - `code` is a stable, machine-readable error code.
 * - `message` is a human-readable description.
 * - `capability` names the capability that produced the error
 *   (e.g. `"AssetResolver"`, `"LinkHandler"`, `"ClipboardProvider"`).
 */
export class CapabilityError extends Error {
  readonly code: CapabilityErrorCode;
  readonly capability: string;
  readonly cause?: unknown;

  constructor(code: CapabilityErrorCode, capability: string, message: string, cause?: unknown) {
    super(message);
    this.name = "CapabilityError";
    this.code = code;
    this.capability = capability;
    this.cause = cause;
  }
}
