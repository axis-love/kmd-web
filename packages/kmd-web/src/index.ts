// kmd-web convenience entry point
// Re-exports the supported public API surface.
// Individual packages can also be imported directly via @axis-love/<pkg>.
//
// Root-entry surface (KWEB-045)
// -----------------------------
// The root entry is renderable, not contract-only. `npm install
// @axis-love/kmd-web` is the documented single-install path, so the one thing a
// consumer arrives wanting — turning Markdown into HTML — has to be reachable
// from the bare specifier. Until KWEB-045 it was not: the root exported types
// and version constants only, and `examples/vanilla/main.js` imported a
// `render` that did not exist. The framework surfaces stay on their subpaths
// (`./react`, `./element`) so React and the custom element are never pulled
// into a bundle that does not ask for them.

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
// Core — the DOM-free renderer
//
// `render` is the baseline pipeline: no DOM, no optional feature packages. It
// produces sanitized HTML with math left as source and code left unhighlighted.
// ---------------------------------------------------------------------------

export type { RehypePluginEntry } from "@axis-love/core";
export { CORE_VERSION, render } from "@axis-love/core";

// ---------------------------------------------------------------------------
// Browser — host capabilities and the browser-side renderer
//
// `renderWithFeaturePlugins` is the render entry a browser host should reach
// for: same output as `render`, plus KaTeX and Shiki when those optional peers
// of @axis-love/browser are installed. `BrowserReader` wraps it with the full
// reader lifecycle (worker bridge, DOM morphing, links, assets, copy).
// ---------------------------------------------------------------------------

export type {
  AssetResolver,
  BrowserReaderOptions,
  ClipboardProvider,
  FeatureRehypePlugins,
  HostCapabilities,
  LinkHandler,
  WorkerFactory,
  WorkerRenderRequest,
  WorkerRenderResponse,
} from "@axis-love/browser";
export {
  BROWSER_VERSION,
  BrowserReader,
  loadFeatureRehypePlugins,
  renderWithFeaturePlugins,
} from "@axis-love/browser";

// ---------------------------------------------------------------------------
// Convenience version
// ---------------------------------------------------------------------------

export const VERSION = "0.2.0";
