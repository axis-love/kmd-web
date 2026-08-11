// Compile-time public API tests for @axis-love/contracts.
//
// These tests verify that the intentional public types and values are
// exported from the package entry point. They run at compile time
// (type-level) and at runtime (value-level).

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
import {
  CapabilityError,
  CONTRACTS_VERSION,
  defaultRenderOptions,
  RenderError,
} from "@axis-love/contracts";
import { describe, expect, it } from "vitest";

// ---------------------------------------------------------------------------
// Compile-time type checks
//
// Each `const _check: T = null as never` line fails at compile time if the
// type is not exported. The variable is never used at runtime.
// ---------------------------------------------------------------------------

const _checkFeatureState: FeatureState = "full";
const _checkFeatureMatrixEntry: FeatureMatrixEntry = { feature: "x", state: "full" };
const _checkOutlineEntry: OutlineEntry = { level: 1, text: "a", slug: "a" };
const _checkDiagnosticSeverity: DiagnosticSeverity = "info";
const _checkDiagnostic: Diagnostic = { severity: "info", message: "ok" };
const _checkAssetType: AssetType = "image";
const _checkAssetReference: AssetReference = { url: "x", type: "image" };
const _checkDocumentMetadata: DocumentMetadata = { title: "t" };
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
  links: [],
  metadata: {},
  detectedFeatures: _checkDetectedFeatures,
  rendererVersion: "0.1.0",
};
const _checkFeatureOptions: FeatureOptions = { math: true };
const _checkSecurityOptions: SecurityOptions = { allowRemoteImages: false };
const _checkRenderOptions: RenderOptions = { features: _checkFeatureOptions };
const _checkLinkTargetKind: LinkTargetKind = "external";
const _checkLinkTarget: LinkTarget = { kind: "external", rawUrl: "https://x" };
const _checkDocumentTarget: DocumentTarget = { href: "doc.md" };
const _checkAssetRequest: AssetRequest = { url: "x", type: "image" };
const _checkResolvedAsset: ResolvedAsset = { url: "blob:x", originalUrl: "x" };
const _checkRenderErrorCode: RenderErrorCode = "parse-error";
const _checkCapabilityErrorCode: CapabilityErrorCode = "asset-blocked";

// Ensure the compile-time checks are referenced to satisfy noUnusedLocals.
void [
  _checkFeatureState,
  _checkFeatureMatrixEntry,
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

describe("@axis-love/contracts public API", () => {
  it("exports CONTRACTS_VERSION", () => {
    expect(typeof CONTRACTS_VERSION).toBe("string");
    expect(CONTRACTS_VERSION).toBe("0.1.0");
  });

  it("exports defaultRenderOptions with security-first defaults", () => {
    expect(defaultRenderOptions).toBeDefined();
    expect(defaultRenderOptions.security.allowRemoteImages).toBe(false);
    expect(defaultRenderOptions.security.allowedLinkSchemes).toEqual([
      "https",
      "http",
      "mailto",
      "tel",
    ]);
    expect(defaultRenderOptions.security.allowedRawHtmlTags).toEqual([
      "br",
      "kbd",
      "sub",
      "sup",
      "mark",
      "abbr",
      "details",
      "summary",
    ]);
    expect(defaultRenderOptions.maxSourceSize).toBe(10_485_760);
    expect(defaultRenderOptions.timeoutMs).toBe(30_000);
    expect(defaultRenderOptions.features.codeHighlighting).toBe(true);
    expect(defaultRenderOptions.features.mermaid).toBe(true);
    expect(defaultRenderOptions.features.math).toBe(true);
    expect(defaultRenderOptions.features.designDoc).toBe(true);
  });

  it("exports RenderError as a class", () => {
    expect(typeof RenderError).toBe("function");
    const err = new RenderError("parse-error", "test");
    expect(err).toBeInstanceOf(Error);
    expect(err).toBeInstanceOf(RenderError);
    expect(err.name).toBe("RenderError");
    expect(err.code).toBe("parse-error");
    expect(err.message).toBe("test");
  });

  it("exports CapabilityError as a class", () => {
    expect(typeof CapabilityError).toBe("function");
    const err = new CapabilityError("asset-blocked", "AssetResolver", "blocked");
    expect(err).toBeInstanceOf(Error);
    expect(err).toBeInstanceOf(CapabilityError);
    expect(err.name).toBe("CapabilityError");
    expect(err.code).toBe("asset-blocked");
    expect(err.capability).toBe("AssetResolver");
    expect(err.message).toBe("blocked");
  });
});
