// Compile-time public API tests for @axis-love/browser.
//
// These tests verify that the host capability interfaces and the
// worker bridge types are exported from the browser package.

import type {
  AssetResolver,
  BrowserReaderOptions,
  ClipboardProvider,
  CodeCopyOptions,
  CopyNotifier,
  DocumentTarget,
  FeatureCoordinationOptions,
  FeaturePassResult,
  HostCapabilities,
  LinkHandler,
  LinkPolicyOptions,
  LinkTarget,
  ParseCacheOptions,
  RenderFn,
  ScrollTrackerOptions,
  WorkerBridgeOptions,
  WorkerFactory,
  WorkerRenderRequest,
  WorkerRenderResponse,
} from "@axis-love/browser";
import {
  AssetLifecycle,
  BROWSER_VERSION,
  BrowserReader,
  CodeCopyEnhancer,
  FeatureCoordinator,
  LinkPolicy,
  ParseCache,
  RAW_IMAGE_SRC_ATTR,
  ScrollTracker,
  WorkerBridge,
} from "@axis-love/browser";
import { describe, expect, it } from "vitest";

// ---------------------------------------------------------------------------
// Compile-time type checks
//
// Verify each capability interface can be implemented and that the
// types are structurally correct.
// ---------------------------------------------------------------------------

const _noOpAssetResolver: AssetResolver = {
  async resolveAsset(request) {
    return { url: `blob:${request.url}`, originalUrl: request.url };
  },
};

const _noOpLinkHandler: LinkHandler = {
  async openExternal(_url: URL) {},
  async openDocument(_target: DocumentTarget) {},
};

const _noOpClipboardProvider: ClipboardProvider = {
  async writeText(_value: string) {},
};

const _noOpWorkerFactory: WorkerFactory = {
  createWorker() {
    return {
      postMessage(_msg: WorkerRenderRequest) {},
      addEventListener(_type: string, _listener: never) {},
      terminate() {},
    };
  },
};

const _emptyHostCapabilities: HostCapabilities = {};
const _fullHostCapabilities: HostCapabilities = {
  assetResolver: _noOpAssetResolver,
  linkHandler: _noOpLinkHandler,
  clipboardProvider: _noOpClipboardProvider,
  workerFactory: _noOpWorkerFactory,
};

const _linkTarget: LinkTarget = { kind: "document", rawUrl: "doc.md" };
const _documentTarget: DocumentTarget = { href: "doc.md", anchor: "section" };

// Worker response type checks
const _workerSuccess: WorkerRenderResponse = {
  type: "result",
  id: 1,
  result: {
    html: "<p></p>",
    outline: [],
    diagnostics: [],
    assets: [],
    links: [],
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
  },
};
const _workerError: WorkerRenderResponse = { type: "error", id: 1, error: "fail" };

void [
  _noOpAssetResolver,
  _noOpLinkHandler,
  _noOpClipboardProvider,
  _noOpWorkerFactory,
  _emptyHostCapabilities,
  _fullHostCapabilities,
  _linkTarget,
  _documentTarget,
  _workerSuccess,
  _workerError,
];

// ---------------------------------------------------------------------------
// Runtime value checks
// ---------------------------------------------------------------------------

describe("@axis-love/browser public API", () => {
  it("exports BROWSER_VERSION", () => {
    expect(typeof BROWSER_VERSION).toBe("string");
    expect(BROWSER_VERSION).toBe("0.1.0");
  });

  it("exports RAW_IMAGE_SRC_ATTR", () => {
    expect(typeof RAW_IMAGE_SRC_ATTR).toBe("string");
  });
});

// Verify new runtime module exports are accessible
void [
  ParseCache,
  WorkerBridge,
  CodeCopyEnhancer,
  LinkPolicy,
  AssetLifecycle,
  FeatureCoordinator,
  BrowserReader,
  ScrollTracker,
];

// Verify type exports are accessible
void 0 as unknown as AssetLifecycle;
void 0 as unknown as RenderFn;
void 0 as unknown as ParseCacheOptions;
void 0 as unknown as WorkerBridgeOptions;
void 0 as unknown as CodeCopyOptions;
void 0 as unknown as CopyNotifier;
void 0 as unknown as LinkPolicyOptions;
void 0 as unknown as BrowserReaderOptions;
void 0 as unknown as FeatureCoordinationOptions;
void 0 as unknown as FeaturePassResult;
void 0 as unknown as ScrollTrackerOptions;
