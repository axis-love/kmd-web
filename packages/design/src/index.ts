// @axis-love/design
// Optional DESIGN.md extraction and presentation feature.
//
// Ordinary Markdown consumers must not load this pipeline.
// Core detects design docs via feature-detection.ts (regex-based, cheap).
// This package provides the full extraction, merge, resolve, enrich, and
// IR pipeline for hosts that need DESIGN.md presentation.
//
// Architecture:
//   core (feature detection) → design package (pipeline + IR + validation)
//   design imports contracts + core, never browser/react
//   HTML export is an explicit host integration, not automatic

// Package version
export const DESIGN_VERSION = "0.1.0";

export { clearDesignPipelineCache, runDesignPipelineCached } from "./cache.js";
// Design mode helpers
export {
  type DesignModeDocumentSummary,
  type DesignModeSection,
  hasDesignTokens,
  type ProseDesignSpec,
  parseProseDesignSpec,
  summarizeMarkdownForDesignMode,
} from "./designMode.js";
export { detectDesignDocument, stageDetectInPipeline } from "./detect.js";
// Detection
export { type DetectionOutput, detectDesignDocumentCheap, type Signal } from "./detectCheap.js";
// Enrich stage
export { enrichSpec } from "./enrich.js";
// HTML export host integration (explicit, not automatic)
export {
  type DesignCatalogHtmlOptions,
  type DesignHtmlExportBuilder,
  ensureHtmlFilename,
  escapeHtml,
  suggestDesignExportFilename,
} from "./export.js";
export { extractComponents } from "./extract/components.js";
export { extractCss } from "./extract/css.js";
export { extractGradient } from "./extract/gradient.js";
export { extractLayout } from "./extract/layout.js";
export { extractProse } from "./extract/prose.js";
export { extractShadow } from "./extract/shadow.js";
export { extractSurface } from "./extract/surface.js";
export { extractTables } from "./extract/tables.js";
// Front-matter splitting (design-specific, with bodyLineOffset)
// Extractors (for advanced/testing use)
export { extractYaml, type FrontMatterResult, splitYamlFrontMatter } from "./extract/yaml.js";
export { EXTRACTORS } from "./extractors.js";
// IR types
export type {
  BreakpointToken,
  ColorGroup,
  ColorRole,
  ColorToken,
  ComponentRecipe,
  DesignDocument,
  DesignSpec,
  DetectionResult,
  Diagnostic as DesignDiagnostic,
  ElevationToken,
  GradientToken,
  IconSetHint,
  LayoutToken,
  MotionToken,
  Provenance,
  RadiusToken,
  SpacingToken,
  SurfaceToken,
  TypographyToken,
} from "./ir.js";
export {
  emptyDesignDocument,
  emptyDesignSpec,
  emptyProvenance,
} from "./ir.js";
// Merge stage
export { EXTRACTOR_PRECEDENCE, mergeSpecs, stageMerge } from "./merge.js";
// Pipeline
export { runDesignPipeline, type StageFn } from "./pipeline.js";
// Resolve stage
export { resolveSpec } from "./resolve.js";
// Design-doc validation (moved from core)
export { scanDesignDoc } from "./validate.js";
