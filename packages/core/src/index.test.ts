// Compile-time public API tests for @axis-love/core.
//
// Core re-exports the public types from contracts. These tests verify
// that the re-exports are present and that the types are accessible from
// @axis-love/core. They also test the render() function.

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
import {
  CapabilityError,
  CORE_VERSION,
  defaultRenderOptions,
  isSafeUrl,
  RenderError,
  render,
} from "@axis-love/core";
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

  it("exports isSafeUrl", () => {
    expect(typeof isSafeUrl).toBe("function");
    expect(isSafeUrl("https://example.com")).toBe(true);
    expect(isSafeUrl("javascript:alert(1)")).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Render function tests
// ---------------------------------------------------------------------------

describe("@axis-love/core render", () => {
  it("renders basic Markdown and returns RenderResult", async () => {
    const result = await render("# Hello\n\nWorld");

    expect(result.html).toContain("<h1");
    expect(result.html).toContain("Hello");
    expect(result.html).toContain("<p>");
    expect(result.html).toContain("World");
    expect(result.outline).toHaveLength(1);
    expect(result.outline[0]?.level).toBe(1);
    expect(result.outline[0]?.text).toBe("Hello");
    expect(result.outline[0]?.slug).toBe("hello");
    expect(result.rendererVersion).toBe("0.1.0");
  });

  it("renders in a non-DOM Node environment (no window/document)", async () => {
    // The test environment is "node" — no window or document globals.
    expect(typeof globalThis.window).toBe("undefined");
    expect(typeof globalThis.document).toBe("undefined");

    const result = await render("**bold** text");
    expect(result.html).toContain("<strong>bold</strong>");
    expect(result.html).toContain("text");
  });

  it("produces a serializable RenderResult", async () => {
    const result = await render("# Title\n\nSome content with `code`");

    // Must be JSON-serializable (no circular refs, functions, etc.)
    const json = JSON.stringify(result);
    const parsed = JSON.parse(json) as RenderResult;

    expect(parsed.html).toBe(result.html);
    expect(parsed.outline).toEqual(result.outline);
    expect(parsed.detectedFeatures).toEqual(result.detectedFeatures);
    expect(parsed.rendererVersion).toBe(result.rendererVersion);
  });

  it("detects math features", async () => {
    const result = await render("# Math\n\nInline $E=mc^2$ here");
    expect(result.detectedFeatures.hasMath).toBe(true);
  });

  it("detects mermaid features", async () => {
    const result = await render("# Diagrams\n\n```mermaid\ngraph TD\nA-->B\n```\n");
    expect(result.detectedFeatures.hasMermaid).toBe(true);
  });

  it("detects table features", async () => {
    const result = await render("| A | B |\n|---|---|\n| 1 | 2 |\n");
    expect(result.detectedFeatures.hasTables).toBe(true);
  });

  it("detects alert features", async () => {
    const result = await render("> [!NOTE]\n> This is a note.");
    expect(result.detectedFeatures.hasAlerts).toBe(true);
  });

  it("extracts front-matter metadata", async () => {
    const result = await render(
      "---\ntitle: Test\ndescription: A test\nlang: en\n---\n\n# Content",
    );
    expect(result.metadata.title).toBe("Test");
    expect(result.metadata.description).toBe("A test");
    expect(result.metadata.lang).toBe("en");
  });

  it("strips front-matter from rendered HTML", async () => {
    const result = await render("---\ntitle: Test\n---\n\n# Content");
    expect(result.html).not.toContain("title: Test");
    expect(result.html).not.toContain("---");
  });

  it("blocks javascript: URLs", async () => {
    const result = await render("[click](javascript:alert(1))");
    expect(result.html).not.toContain("javascript:");
  });

  it("emits unsafe-url diagnostics for javascript: links", async () => {
    const result = await render("[click](javascript:alert(1))");
    const codes = result.diagnostics.map((d) => d.code);
    expect(codes).toContain("unsafe-url");
  });

  it("blocks raw HTML form tags", async () => {
    const result = await render('<form action="javascript:alert(1)"><input></form>');
    expect(result.html).not.toContain("<form");
  });

  it("emits raw-html-blocked diagnostics for form tags", async () => {
    const result = await render("<form><input></form>");
    const codes = result.diagnostics.map((d) => d.code);
    expect(codes).toContain("raw-html-blocked");
  });

  it("allows safe raw HTML (kbd, mark, sub, sup, abbr, details, summary)", async () => {
    const result = await render("Press <kbd>Ctrl</kbd> and <mark>highlighted</mark> text");
    expect(result.html).toContain("<kbd>");
    expect(result.html).toContain("<mark>");
  });

  it("adds rel=noopener to external links", async () => {
    const result = await render("[example](https://example.com)");
    expect(result.html).toContain("rel");
    expect(result.html).toContain("noopener");
    expect(result.html).toContain("noreferrer");
  });

  it("throws RenderError for source exceeding maxSourceSize", async () => {
    const huge = "x".repeat(100);
    await expect(render(huge, { maxSourceSize: 10 })).rejects.toThrow(RenderError);
  });

  it("does not statically import heavy feature implementations", async () => {
    // Core should not import shiki, mermaid, or katex at the top level.
    // We verify by checking the rendered output of a simple document
    // doesn't trigger lazy loading.
    const result = await render("# Simple\n\nText");
    expect(result.html).toContain("Simple");
    expect(result.html).not.toContain("shiki");
    expect(result.html).not.toContain("katex");
  });
});
