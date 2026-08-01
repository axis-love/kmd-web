// @axis-love/contracts
// Versioned schemas, fixtures, expected results, and feature matrix.
// These types are consumed by both JavaScript (kmd-web) and native (Unity)
// implementations.
//
// This package imports nothing — it is the foundational contract layer.

// ---------------------------------------------------------------------------
// Package version
// ---------------------------------------------------------------------------

export const CONTRACTS_VERSION = "0.1.0";

// ---------------------------------------------------------------------------
// Feature matrix (cross-platform)
// ---------------------------------------------------------------------------

/**
 * Feature support states used in the cross-platform feature matrix.
 */
export type FeatureState = "full" | "fallback" | "planned" | "unsupported" | "not-applicable";

/**
 * A single entry in the cross-platform feature matrix.
 */
export interface FeatureMatrixEntry {
  readonly feature: string;
  readonly state: FeatureState;
  readonly notes?: string;
}

// ---------------------------------------------------------------------------
// Render result types
// ---------------------------------------------------------------------------

export type {
  AssetReference,
  AssetType,
  DetectedFeatures,
  Diagnostic,
  DiagnosticSeverity,
  DocumentMetadata,
  OutlineEntry,
  RenderResult,
} from "./render";

// ---------------------------------------------------------------------------
// Render options
// ---------------------------------------------------------------------------

export type { FeatureOptions, RenderOptions, SecurityOptions } from "./options";
export { defaultRenderOptions } from "./options";

// ---------------------------------------------------------------------------
// Link / document target classification
// ---------------------------------------------------------------------------

export type {
  AssetRequest,
  DocumentTarget,
  LinkTarget,
  LinkTargetKind,
  ResolvedAsset,
} from "./links";

// ---------------------------------------------------------------------------
// Structured errors
// ---------------------------------------------------------------------------

export type { CapabilityErrorCode, RenderErrorCode } from "./errors";
export { CapabilityError, RenderError } from "./errors";
