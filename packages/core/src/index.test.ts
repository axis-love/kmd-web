// Compile-time public API tests for @axis-love/core.
//
// Core re-exports the public types from contracts. These tests verify
// that the re-exports are present and that the types are accessible from
// @axis-love/core.

import type {
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
} from "@axis-love/core";
import { CapabilityError, CORE_VERSION, defaultRenderOptions, RenderError } from "@axis-love/core";
import { describe, expect, it } from "vitest";

// ---------------------------------------------------------------------------
// Compile-time type checks
// ---------------------------------------------------------------------------

const _checkOutlineEntry: OutlineEntry = { level: 1, text: "a", slug: "a" };
const _checkDiagnosticSeverity: DiagnosticSeverity = "warning";
const _checkDiagnostic: Diagnostic = { severity: "warning", message: "x" };
const _checkAssetType: AssetType = "video";
const _checkAssetReference: AssetReference = { url: "x", type: "video" };
const _checkDocumentMetadata: DocumentMetadata = {};
const _checkDetectedFeatures: DetectedFeatures = {
  hasMath: false,
  hasMermaid: false,
  hasDesignDoc: false,
  hasCodeHighlighting: false,
  hasTables: false,
  hasTaskLists: false,
  hasFootnotes: false,
  hasAlerts: false,
};
const _checkRenderResult: RenderResult = {
  html: "",
  outline: [],
  diagnostics: [],
  assets: [],
  metadata: {},
  detectedFeatures: _checkDetectedFeatures,
  rendererVersion: "0.1.0",
};
const _checkFeatureOptions: FeatureOptions = {};
const _checkSecurityOptions: SecurityOptions = {};
const _checkRenderOptions: RenderOptions = {};
const _checkLinkTargetKind: LinkTargetKind = "internal";
const _checkLinkTarget: LinkTarget = { kind: "internal", rawUrl: "#x" };
const _checkDocumentTarget: DocumentTarget = { href: "doc.md" };
const _checkAssetRequest: AssetRequest = { url: "x", type: "image" };
const _checkResolvedAsset: ResolvedAsset = { url: "blob:x", originalUrl: "x" };
const _checkRenderErrorCode: RenderErrorCode = "render-timeout";
const _checkCapabilityErrorCode: CapabilityErrorCode = "clipboard-denied";

void [
  _checkOutlineEntry,
  _checkDiagnosticSeverity,
  _checkDiagnostic,
  _checkAssetType,
  _checkAssetReference,
  _checkDocumentMetadata,
  _checkDetectedFeatures,
  _checkRenderResult,
  _checkFeatureOptions,
  _checkSecurityOptions,
  _checkRenderOptions,
  _checkLinkTargetKind,
  _checkLinkTarget,
  _checkDocumentTarget,
  _checkAssetRequest,
  _checkResolvedAsset,
  _checkRenderErrorCode,
  _checkCapabilityErrorCode,
];

// ---------------------------------------------------------------------------
// Runtime value checks
// ---------------------------------------------------------------------------

describe("@axis-love/core public API", () => {
  it("exports CORE_VERSION", () => {
    expect(typeof CORE_VERSION).toBe("string");
    expect(CORE_VERSION).toBe("0.1.0");
  });

  it("re-exports defaultRenderOptions from contracts", () => {
    expect(defaultRenderOptions).toBeDefined();
    expect(defaultRenderOptions.security.allowRemoteImages).toBe(false);
  });

  it("re-exports RenderError from contracts", () => {
    expect(typeof RenderError).toBe("function");
    const err = new RenderError("sanitize-error", "x");
    expect(err).toBeInstanceOf(RenderError);
    expect(err.code).toBe("sanitize-error");
  });

  it("re-exports CapabilityError from contracts", () => {
    expect(typeof CapabilityError).toBe("function");
    const err = new CapabilityError("link-blocked", "LinkHandler", "x");
    expect(err).toBeInstanceOf(CapabilityError);
    expect(err.capability).toBe("LinkHandler");
  });
});
