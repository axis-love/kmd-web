// @axis-love/contracts — render result types
//
// These types define the observable output of the kmd rendering core.
// They are consumed by both JavaScript (kmd-web) and native (Unity)
// implementations and must remain serializable (JSON-compatible).

import type { LinkTarget } from "./links.js";

// ---------------------------------------------------------------------------
// Outline
// ---------------------------------------------------------------------------

/**
 * A single heading entry extracted from the document outline.
 *
 * Invariants:
 * - `level` is 1–6, matching the heading rank (h1 through h6).
 * - `text` is the plain-text content of the heading with all inline
 *   formatting stripped. It is never empty for a real heading; a heading
 *   with no text content is omitted from the outline.
 * - `slug` is a URL-safe anchor identifier derived from `text`. It is
 *   unique within a single document; duplicate headings receive a
 *   numeric suffix (e.g. `section`, `section-2`).
 */
export interface OutlineEntry {
  readonly level: number;
  readonly text: string;
  readonly slug: string;
}

// ---------------------------------------------------------------------------
// Diagnostics
// ---------------------------------------------------------------------------

/**
 * Severity of a diagnostic message produced during rendering.
 *
 * - `info`    — non-blocking observation (e.g. a feature was detected).
 * - `warning` — a recoverable issue that may degrade output quality.
 * - `error`   — a blocking issue; the rendered HTML may be incomplete.
 */
export type DiagnosticSeverity = "info" | "warning" | "error";

/**
 * A diagnostic message about the rendering process.
 *
 * Invariants:
 * - `severity` determines the impact level.
 * - `message` is a human-readable description, never empty.
 * - `line` and `column`, when present, are 1-based offsets into the
 *   source Markdown. Both are optional because not all diagnostics
 *   originate from a specific source position (e.g. a global sanitizer
 *   warning).
 */
export interface Diagnostic {
  readonly severity: DiagnosticSeverity;
  readonly message: string;
  readonly line?: number;
  readonly column?: number;
  /**
   * Optional machine-readable code for programmatic filtering,
   * e.g. `unsafe-url`, `raw-html-blocked`, `mermaid-timeout`.
   */
  readonly code?: string;
}

// ---------------------------------------------------------------------------
// Asset references
// ---------------------------------------------------------------------------

/**
 * The kind of media asset referenced by the document.
 *
 * - `image` — raster or vector image (`<img>`, SVG).
 * - `video` — motion video (`<video>` / `<source>`).
 * - `audio` — audio content (`<audio>` / `<source>`).
 * - `other` — any other embeddable resource (iframe sandbox, etc.).
 */
export type AssetType = "image" | "video" | "audio" | "other";

/**
 * A reference to an asset (image, video, audio, or other) discovered in
 * the document.
 *
 * Invariants:
 * - `url` is the original URL exactly as it appeared in the Markdown
 *   source, before any host-side resolution. It may be relative.
 * - `type` classifies the asset kind.
 * - `resolved` is set when a host capability has resolved `url` to a
 *   safe, loadable URL (e.g. a blob: URL from a Rust backend). When
 *   absent, the asset has not yet been resolved and should not be
 *   loaded by the browser runtime.
 * - `alt`, when present, is the accessibility text for the asset.
 */
export interface AssetReference {
  readonly url: string;
  readonly type: AssetType;
  readonly resolved?: string;
  readonly alt?: string;
}

// ---------------------------------------------------------------------------
// Document metadata
// ---------------------------------------------------------------------------

/**
 * Metadata extracted from the document, typically from YAML front-matter
 * or the first heading.
 *
 * Invariants:
 * - All fields are optional; a document may have no metadata.
 * - `title`, when present, is plain text (no inline formatting).
 * - `lang`, when present, is a BCP 47 language tag (e.g. `en`, `ja`).
 * - `description`, when present, is plain text.
 */
export interface DocumentMetadata {
  readonly title?: string;
  readonly description?: string;
  readonly lang?: string;
}

// ---------------------------------------------------------------------------
// Detected features
// ---------------------------------------------------------------------------

/**
 * Feature detection flags produced during rendering.
 *
 * Each flag indicates whether a specific heavy or optional feature is
 * present in the document. Detection must not load the feature
 * implementation — it only records presence so the host can decide
 * whether to lazy-load.
 *
 * Invariants:
 * - All flags are booleans; absence is not permitted (use `false`).
 * - `hasMath` — one or more math expressions (inline or block) detected.
 * - `hasMermaid` — one or more Mermaid code fence blocks detected.
 * - `hasDesignDoc` — a DESIGN.md section or front-matter detected.
 * - `hasCodeHighlighting` — at least one fenced code block with a
 *   language tag that benefits from syntax highlighting.
 * - `hasTables` — one or more GFM table structures detected.
 * - `hasTaskLists` — one or more GFM task list items detected.
 * - `hasFootnotes` — one or more footnote definitions detected.
 * - `hasAlerts` — one or more GitHub-style alert blocks detected.
 */
export interface DetectedFeatures {
  readonly hasMath: boolean;
  readonly hasMermaid: boolean;
  readonly hasDesignDoc: boolean;
  readonly hasCodeHighlighting: boolean;
  readonly hasTables: boolean;
  readonly hasTaskLists: boolean;
  readonly hasFootnotes: boolean;
  readonly hasAlerts: boolean;
}

// ---------------------------------------------------------------------------
// Render result
// ---------------------------------------------------------------------------

/**
 * The complete, serializable result of rendering Markdown to safe HTML.
 *
 * This is the primary output of the kmd rendering core. It is designed to
 * be JSON-serializable so it can cross worker boundaries, be cached, and
 * be consumed by non-JavaScript implementations (e.g. Unity) through
 * shared contract fixtures.
 *
 * Invariants:
 * - `html` is sanitized, safe-to-render HTML. It has already passed
 *   through the sanitizer and URL policy. It must not contain
 *   `javascript:`, `vbscript:`, or unsafe `data:` URLs.
 * - `outline` is the heading tree in document order. May be empty.
 * - `diagnostics` lists all non-fatal observations from rendering. May
 *   be empty. Fatal errors that prevent rendering are thrown as
 *   `RenderError` instead of appearing here.
 * - `assets` lists every media asset reference found. May be empty.
 * - `links` lists every link classification found. May be empty.
 * - `metadata` is the extracted document metadata. May be an empty
 *   object if no metadata was found.
 * - `detectedFeatures` records which optional features the document
 *   contains. Never absent.
 * - `rendererVersion` is the semver version string of the renderer
 *   that produced this result. It is set by the core implementation,
 *   not by the caller.
 */
export interface RenderResult {
  readonly html: string;
  readonly outline: readonly OutlineEntry[];
  readonly diagnostics: readonly Diagnostic[];
  readonly assets: readonly AssetReference[];
  readonly links: readonly LinkTarget[];
  readonly metadata: DocumentMetadata;
  readonly detectedFeatures: DetectedFeatures;
  readonly rendererVersion: string;
}
