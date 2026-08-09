// kmd-web convenience entry point
// Re-exports the supported public API surface.
// Individual packages can also be imported directly via @axis-love/<pkg>.

// ---------------------------------------------------------------------------
// Contracts — versioned types, fixtures, feature matrix
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
  FeatureMatrixEntry,
  FeatureOptions,
  FeatureState,
  LinkTarget,
  LinkTargetKind,
  OutlineEntry,
  RenderErrorCode,
  RenderOptions,
  RenderResult,
  ResolvedAsset,
  SecurityOptions,
} from "@axis-love/contracts";
export {
  CapabilityError,
  CONTRACTS_VERSION,
  defaultRenderOptions,
  RenderError,
} from "@axis-love/contracts";

// ---------------------------------------------------------------------------
// Core — render types re-exported from contracts
// ---------------------------------------------------------------------------

export { CORE_VERSION } from "@axis-love/core";

// ---------------------------------------------------------------------------
// Browser — host capabilities
// ---------------------------------------------------------------------------

export type {
  AssetResolver,
  ClipboardProvider,
  HostCapabilities,
  LinkHandler,
  WorkerFactory,
  WorkerRenderRequest,
  WorkerRenderResponse,
} from "@axis-love/browser";
export { BROWSER_VERSION } from "@axis-love/browser";

// ---------------------------------------------------------------------------
// Convenience version
// ---------------------------------------------------------------------------

export const VERSION = "0.1.0-rc.0";
