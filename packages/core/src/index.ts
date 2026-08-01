// @axis-love/core
// DOM-free Markdown-to-safe-HTML rendering core.
// No DOM, React, Tauri, or Node I/O dependencies.
//
// Core imports from contracts and re-exports the public types.
// Policy decisions (URL classification, sanitization, feature detection)
// remain inside core.

// ---------------------------------------------------------------------------
// Package version
// ---------------------------------------------------------------------------

export { CORE_VERSION, render } from "./render.js";

// ---------------------------------------------------------------------------
// Policy decisions that remain inside core
//
// The following capabilities are intentionally NOT exposed as host
// capabilities — they are core security responsibilities:
// - URL scheme classification (isSafeUrl)
// - External vs. internal link detection
// - Raw HTML tag allowlist enforcement
// - Sanitization
// - Feature detection (DetectedFeatures)
// ---------------------------------------------------------------------------

export { classifyLink } from "./links.js";
export { isExternalUrl, isSafeUrl } from "./sanitize.js";

// ---------------------------------------------------------------------------
// Re-export public types from contracts
//
// Core is the primary consumer of contracts. It re-exports the render
// types so that consumers of @axis-love/core get a single import surface.
// The contracts package remains the canonical source for cross-platform
// consumers (e.g. Unity).
// ---------------------------------------------------------------------------

export type {
  AssetReference,
  AssetRequest,
  AssetType,
  CapabilityErrorCode,
  DetectedFeatures,
  Diagnostic,
  DiagnosticSeverity,
  DocumentMetadata,
  DocumentTarget,
  FeatureOptions,
  LinkTarget,
  LinkTargetKind,
  OutlineEntry,
  RenderErrorCode,
  RenderOptions,
  RenderResult,
  ResolvedAsset,
  SecurityOptions,
} from "@axis-love/contracts";
export { CapabilityError, defaultRenderOptions, RenderError } from "@axis-love/contracts";
