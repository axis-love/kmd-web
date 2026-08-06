// @axis-love/contracts — render options
//
// Serializable options that control rendering behavior.
// These types are consumed by both JavaScript (kmd-web) and native
// (Unity) implementations.

// ---------------------------------------------------------------------------
// Render options
// ---------------------------------------------------------------------------

/**
 * Options for heavy feature handling during rendering.
 *
 * Each flag controls whether a heavy feature's *implementation* is
 * invoked. Feature *detection* always runs regardless of these
 * options — only the rendering/presentation is skipped.
 *
 * When a feature is skipped, the renderer produces a readable fallback
 * (e.g. raw code block instead of highlighted code, plain text instead
 * of a Mermaid diagram). The `DetectedFeatures` flags in `RenderResult`
 * still report what the document contains.
 *
 * Invariants:
 * - All fields are optional. When omitted, the renderer applies its
 *   documented defaults (see `defaultRenderOptions`).
 * - Setting a flag to `true` means "include this feature if detected."
 * - Setting a flag to `false` means "skip this feature even if detected."
 * - The default for every flag is `true` (include if detected).
 */
export interface FeatureOptions {
  /** Syntax-highlight fenced code blocks via Shiki. Default: true. */
  readonly codeHighlighting?: boolean;
  /** Render Mermaid diagrams. Default: true. */
  readonly mermaid?: boolean;
  /** Render math expressions via KaTeX. Default: true. */
  readonly math?: boolean;
  /** Extract and present DESIGN.md sections. Default: true. */
  readonly designDoc?: boolean;
}

/**
 * Options for the URL/sanitization policy applied during rendering.
 *
 * These options allow a host to relax or tighten the default security
 * posture. The core policy decides whether an action is allowed; a host
 * capability only carries out an already-classified action.
 *
 * Invariants:
 * - All fields are optional.
 * - `allowRemoteImages` defaults to `false`. When `false`, remote image
 *   URLs are stripped from the output and a diagnostic is emitted.
 *   When `true`, remote images are allowed but still pass through URL
 *   scheme validation.
 * - `allowedLinkSchemes` defaults to `["https", "http", "mailto",
 *   "tel"]`. Relative links and fragment-only refs are always allowed.
 *   Any scheme not in this set is blocked.
 * - `allowedRawHtmlTags` defaults to the strict allowlist from the
 *   security spec: `["br", "kbd", "sub", "sup", "mark", "abbr",
 *   "details", "summary"]`. Tags not in this set are stripped.
 */
export interface SecurityOptions {
  readonly allowRemoteImages?: boolean;
  readonly allowedLinkSchemes?: readonly string[];
  readonly allowedRawHtmlTags?: readonly string[];
}

/**
 * Serializable options that control the rendering pipeline.
 *
 * Invariants:
 * - All fields are optional. When omitted, defaults apply.
 * - The object is JSON-serializable so it can cross worker boundaries.
 * - No field grants access to DOM, Tauri, or Node I/O — those are host
 *   capabilities, not render options.
 * - `signal`, when provided, allows the caller to abort a long-running
 *   render. The renderer checks the signal at cooperative checkpoints.
 *   This is the only non-serializable field; it is stripped before
 *   caching or cross-boundary transfer.
 *
 * Note: rehype plugin injection (for KaTeX, Shiki, etc.) is NOT part of
 * RenderOptions because plugin functions are not serializable and cannot
 * cross worker boundaries. Plugin injection is handled via a separate
 * parameter to core's `render()` function — this is a direct-call-only
 * feature. See `RehypePluginEntry` in `@axis-love/core`.
 */
export interface RenderOptions {
  /** Control which heavy features are rendered. */
  readonly features?: FeatureOptions;
  /** Adjust the security policy for this render. */
  readonly security?: SecurityOptions;
  /**
   * Maximum source size in bytes before the renderer rejects the input.
   * Default: 10_485_760 (10 MB). Set to `0` for no limit (not
   * recommended in production).
   */
  readonly maxSourceSize?: number;
  /**
   * Timeout in milliseconds for the entire render. When exceeded, the
   * renderer returns a partial result with a timeout diagnostic.
   * Default: 30_000. Set to `0` for no timeout.
   */
  readonly timeoutMs?: number;
  /**
   * Base URL for resolving relative links and assets. Must be a valid
   * URL or omitted. When omitted, relative URLs are resolved against
   * the document root.
   */
  readonly baseUrl?: string;
}

/**
 * The default render options applied when a field is omitted.
 *
 * These values encode the security-first defaults from the North Star
 * and security specification. Hosts that need to relax these must do so
 * explicitly.
 */
export const defaultRenderOptions: Required<Omit<RenderOptions, "baseUrl">> & {
  readonly baseUrl: string | undefined;
} = {
  features: {
    codeHighlighting: true,
    mermaid: true,
    math: true,
    designDoc: true,
  },
  security: {
    allowRemoteImages: false,
    allowedLinkSchemes: ["https", "http", "mailto", "tel"],
    allowedRawHtmlTags: ["br", "kbd", "sub", "sup", "mark", "abbr", "details", "summary"],
  },
  maxSourceSize: 10_485_760,
  timeoutMs: 30_000,
  baseUrl: undefined,
} as const;
