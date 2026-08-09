// @axis-love/contracts
// Versioned schemas, fixtures, expected results, and feature matrix.
// These types are consumed by both JavaScript (kmd-web) and native (Unity)
// implementations.
//
// This package imports nothing — it is the foundational contract layer.

// ---------------------------------------------------------------------------
// Package version
// ---------------------------------------------------------------------------

export const CONTRACTS_VERSION = "0.1.0-rc.1";

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
} from "./render.js";

// ---------------------------------------------------------------------------
// Render options
// ---------------------------------------------------------------------------

export type { FeatureOptions, RenderOptions, SecurityOptions } from "./options.js";
export { defaultRenderOptions } from "./options.js";

// ---------------------------------------------------------------------------
// Link / document target classification
// ---------------------------------------------------------------------------

export type {
  AssetRequest,
  DocumentTarget,
  LinkTarget,
  LinkTargetKind,
  ResolvedAsset,
} from "./links.js";

// ---------------------------------------------------------------------------
// Structured errors
// ---------------------------------------------------------------------------

export type { CapabilityErrorCode, RenderErrorCode } from "./errors.js";
export { CapabilityError, RenderError } from "./errors.js";

// ---------------------------------------------------------------------------
// Conformance contracts (fixtures, observations, runner)
// ---------------------------------------------------------------------------

export type {
  AssertionApplicability,
  AssertionGroup,
  AssertionResult,
  AssetObservation,
  AttributeValueCheck,
  ConformanceManifest,
  ContractRenderer,
  ContractRunResult,
  DiagnosticObservation,
  ExpectedOutlineEntry,
  FeaturesObservation,
  FixtureAssertionResult,
  FixtureCategory,
  FixtureObservation,
  HtmlObservation,
  LinkClassificationObservation,
  LinkObservation,
  ManifestFixtureEntry,
  MetadataObservation,
  OutlineObservation,
} from "./conformance.js";
export { MANIFEST_SCHEMA_VERSION } from "./conformance.js";
