// Compile-time public API tests for @axis-love/kmd-web.
//
// These tests verify that the convenience package re-exports all
// intentional public types and values from the individual packages.

import type {
  AssetReference,
  AssetRequest,
  // Browser
  AssetResolver,
  AssetType,
  CapabilityErrorCode,
  ClipboardProvider,
  DetectedFeatures,
  Diagnostic,
  DiagnosticSeverity,
  DocumentMetadata,
  DocumentTarget,
  FeatureMatrixEntry,
  FeatureOptions,
  // Contracts
  FeatureState,
  HostCapabilities,
  LinkHandler,
  LinkTarget,
  LinkTargetKind,
  OutlineEntry,
  RenderErrorCode,
  RenderOptions,
  RenderResult,
  ResolvedAsset,
  SecurityOptions,
  WorkerFactory,
  WorkerRenderRequest,
  WorkerRenderResponse,
} from "@axis-love/kmd-web";
import {
  BROWSER_VERSION,
  CapabilityError,
  CONTRACTS_VERSION,
  CORE_VERSION,
  defaultRenderOptions,
  RenderError,
  VERSION,
} from "@axis-love/kmd-web";
import { describe, expect, it } from "vitest";

// ---------------------------------------------------------------------------
// Compile-time type checks — verify all re-exports resolve
// ---------------------------------------------------------------------------

const _checkRenderResult: RenderResult = {
  html: "",
  outline: [],
  diagnostics: [],
  assets: [],
  metadata: {},
  detectedFeatures: {
    hasMath: false,
    hasMermaid: false,
    hasDesignDoc: false,
    hasCodeHighlighting: false,
    hasTables: false,
    hasTaskLists: false,
    hasFootnotes: false,
    hasAlerts: false,
  },
  rendererVersion: "0.1.0",
};
const _checkAssetResolver: AssetResolver = {
  async resolveAsset(r) {
    return { url: `blob:${r.url}`, originalUrl: r.url };
  },
};
const _checkHostCapabilities: HostCapabilities = {
  assetResolver: _checkAssetResolver,
};

void [
  _checkRenderResult,
  _checkAssetResolver,
  _checkHostCapabilities,
  null as FeatureState,
  null as FeatureMatrixEntry,
  null as OutlineEntry,
  null as DiagnosticSeverity,
  null as Diagnostic,
  null as AssetType,
  null as AssetReference,
  null as DocumentMetadata,
  null as DetectedFeatures,
  null as FeatureOptions,
  null as SecurityOptions,
  null as RenderOptions,
  null as LinkTargetKind,
  null as LinkTarget,
  null as DocumentTarget,
  null as AssetRequest,
  null as ResolvedAsset,
  null as RenderErrorCode,
  null as CapabilityErrorCode,
  null as LinkHandler,
  null as ClipboardProvider,
  null as WorkerFactory,
  null as WorkerRenderRequest,
  null as WorkerRenderResponse,
];

// ---------------------------------------------------------------------------
// Runtime value checks
// ---------------------------------------------------------------------------

describe("@axis-love/kmd-web convenience package", () => {
  it("exports VERSION", () => {
    expect(VERSION).toBe("0.1.0");
  });

  it("re-exports package versions", () => {
    expect(CONTRACTS_VERSION).toBe("0.1.0");
    expect(CORE_VERSION).toBe("0.1.0");
    expect(BROWSER_VERSION).toBe("0.1.0");
  });

  it("re-exports defaultRenderOptions", () => {
    expect(defaultRenderOptions.security.allowRemoteImages).toBe(false);
  });

  it("re-exports error classes", () => {
    expect(new RenderError("parse-error", "x")).toBeInstanceOf(RenderError);
    expect(new CapabilityError("link-blocked", "LinkHandler", "x")).toBeInstanceOf(CapabilityError);
  });
});
