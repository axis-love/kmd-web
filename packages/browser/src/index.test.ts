// Compile-time public API tests for @axis-love/browser.
//
// These tests verify that the host capability interfaces and the
// worker bridge types are exported from the browser package.

import type {
  AssetResolver,
  ClipboardProvider,
  DocumentTarget,
  HostCapabilities,
  LinkHandler,
  LinkTarget,
  WorkerFactory,
  WorkerRenderRequest,
  WorkerRenderResponse,
} from "@axis-love/browser";
import { BROWSER_VERSION } from "@axis-love/browser";
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
});
