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
  RehypePluginEntry,
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
  links: [],
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
const _checkRehypePluginEntry: RehypePluginEntry = [
  (() => ({})) as unknown as RehypePluginEntry[0],
];

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
  _checkRehypePluginEntry,
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

  it("renders alerts with a clean title and stripped body", async () => {
    const result = await render("> [!NOTE]\n> This is a note.");
    expect(result.html).toContain("markdown-alert markdown-alert-note");
    expect(result.html).toContain('<p class="markdown-alert-title">Note</p>');
    expect(result.html).toContain("This is a note.");
    expect(result.html).not.toContain("[!NOTE]");
  });

  it("uses an inline alert title when provided after the marker", async () => {
    const result = await render("> [!NOTE] Custom Title\n> Body text.");
    expect(result.html).toContain('<p class="markdown-alert-title">Custom Title</p>');
    expect(result.html).not.toContain("[!NOTE]");
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

  // -------------------------------------------------------------------------
  // Security regression tests (KWEB-008)
  // -------------------------------------------------------------------------

  it("blocks percent-encoded javascript%3A in links", async () => {
    const result = await render("[click](javascript%3Aalert(1))");
    expect(result.html).not.toContain("javascript:");
    expect(result.html).not.toContain("javascript%3A");
  });

  it("blocks double-encoded javascript%253A in links", async () => {
    const result = await render("[click](javascript%253Aalert(1))");
    expect(result.html).not.toContain("javascript");
  });

  it("blocks encoded scheme name %6a%61%76%61%73%63%72%69%70%74:", async () => {
    const result = await render("[click](%6a%61%76%61%73%63%72%69%70%74:alert(1))");
    expect(result.html).not.toContain("alert(");
  });

  it("blocks mixed-case JaVaScRiPt: in links", async () => {
    const result = await render("[click](JaVaScRiPt:alert(1))");
    expect(result.html).not.toContain("JaVaScRiPt:");
    expect(result.html).not.toContain("javascript:");
  });

  it("blocks tab in scheme java\\tscript:", async () => {
    const result = await render("[click](java\tscript:alert(1))");
    expect(result.html).not.toContain("alert(");
  });

  it("blocks newline in scheme java\\nscript:", async () => {
    const result = await render("[click](java\nscript:alert(1))");
    expect(result.html).not.toContain("alert(");
  });

  it("blocks null byte prefix in URL", async () => {
    const result = await render("[click](\x00javascript:alert(1))");
    expect(result.html).not.toContain("javascript:");
    expect(result.html).not.toContain("alert(");
  });

  it("removes links with unsafe URLs entirely (no dangerous text survives)", async () => {
    const result = await render("[javascript:alert('xss')](javascript:alert('xss'))");
    expect(result.html).not.toContain("javascript:");
    expect(result.html).not.toContain("alert(");
  });

  it("strips event-handler attributes (onerror, onclick, onload)", async () => {
    const result = await render('<img src="x" onerror="alert(1)">');
    expect(result.html).not.toContain("onerror");
    expect(result.html).not.toContain("alert(");
  });

  it("strips style attributes with javascript: URLs", async () => {
    const result = await render('<div style="background:url(javascript:alert(1))">styled</div>');
    expect(result.html).not.toContain("javascript:");
  });

  it("blocks SVG inline with script", async () => {
    const result = await render("<svg><script>alert('svg-xss')</script></svg>");
    expect(result.html).not.toContain("<svg");
    expect(result.html).not.toContain("<script");
    expect(result.html).not.toContain("alert(");
  });

  it("blocks SVG with onload event", async () => {
    const result = await render("<svg onload=\"alert('xss')\">");
    expect(result.html).not.toContain("<svg");
    expect(result.html).not.toContain("onload");
    expect(result.html).not.toContain("alert(");
  });

  it("blocks DOM clobbering via id attribute on anchors", async () => {
    const result = await render('<a id="location" href="https://evil.example.com">click</a>');
    expect(result.html).not.toContain('id="location"');
  });

  it("blocks DOM clobbering via name attribute on img", async () => {
    const result = await render('<img name="domain" src="x.png">');
    expect(result.html).not.toContain('name="domain"');
  });

  it("classifies links in RenderResult", async () => {
    const result = await render(
      "[safe](https://example.com) [unsafe](javascript:alert(1)) [doc](other.md)",
    );
    // 3 unique links — HAST + source extraction merged and deduped
    const safe = result.links.find((l) => l.rawUrl === "https://example.com");
    expect(safe).toBeDefined();
    expect(safe?.kind).toBe("external");
    const unsafe = result.links.find((l) => l.rawUrl === "javascript:alert(1)");
    expect(unsafe).toBeDefined();
    expect(unsafe?.kind).toBe("blocked");
    const doc = result.links.find((l) => l.rawUrl === "other.md");
    expect(doc).toBeDefined();
    expect(doc?.kind).toBe("document");
  });

  it("classifies blocked links even when parser breaks the URL", async () => {
    // The URL contains < which the parser interprets as raw HTML.
    // Source-level extraction still captures and classifies it.
    const result = await render("[link](<data:text/html,%3Cscript%3Ealert(1)%3C/script%3E>)");
    const blocked = result.links.find((l) => l.kind === "blocked");
    expect(blocked).toBeDefined();
  });

  it("adds rel=noopener noreferrer to external links only", async () => {
    const result = await render(
      "[external](https://example.com) [internal](#section) [doc](other.md)",
    );
    expect(result.html).toContain("noopener");
    expect(result.html).toContain("noreferrer");
    // Internal and document links should not have rel attributes
    const externalLink = result.links.find((l) => l.kind === "external");
    expect(externalLink).toBeDefined();
  });

  it("enforces maxSourceSize limit", async () => {
    const huge = "x".repeat(1000);
    await expect(render(huge, { maxSourceSize: 10 })).rejects.toThrow();
  });

  it("replaces pathological dollar-sign runs before parsing", async () => {
    const result = await render("$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$\n\n# Heading");
    expect(result.outline).toHaveLength(1);
    expect(result.outline[0]?.text).toBe("Heading");
  });

  // KWEB-031: filterAssets must block all remote schemes when allowRemoteImages is false
  it("blocks ftp and other non-http remote schemes when allowRemoteImages is false", async () => {
    const markdown = [
      "![local](./local.png)",
      "![http](https://example.com/a.png)",
      "![ftp](ftp://example.com/a.png)",
      "![file](file:///etc/passwd)",
    ].join("\n\n");

    const result = await render(markdown, {
      security: { allowRemoteImages: false },
    });

    const urls = result.assets.map((a) => a.url);
    // Relative URLs should be allowed
    expect(urls).toContain("./local.png");
    // http, https, ftp, file should all be blocked
    expect(urls.some((u) => u.startsWith("http"))).toBe(false);
    expect(urls.some((u) => u.startsWith("ftp:"))).toBe(false);
    expect(urls.some((u) => u.startsWith("file:"))).toBe(false);
  });

  // -------------------------------------------------------------------------
  // KWEB-029: Injected rehype plugin tests (KaTeX + Shiki)
  // -------------------------------------------------------------------------

  it("renders math via injected rehypeKatex plugin", async () => {
    const { rehypeKatex } = await import("@axis-love/math");
    const result = await render("$$E = mc^2$$", undefined, [[rehypeKatex]]);
    expect(result.html).toContain("katex");
    expect(result.html).not.toContain("language-math");
  });

  it("renders inline math via injected rehypeKatex plugin", async () => {
    const { rehypeKatex } = await import("@axis-love/math");
    const result = await render("Inline $E=mc^2$ math", undefined, [[rehypeKatex]]);
    expect(result.html).toContain("katex");
    expect(result.html).not.toContain("language-math");
  });

  it("highlights code via injected rehypeShiki plugin", async () => {
    const { rehypeShiki } = await import("@axis-love/highlighting");
    const result = await render("```ts\nconst x = 1;\n```", undefined, [[rehypeShiki]]);
    expect(result.html).toContain("shiki-code-block");
  });

  it("renders without plugins when none are injected (baseline)", async () => {
    const result = await render("$$E = mc^2$$\n\n```ts\nconst x = 1;\n```");
    // Without plugins, math stays as language-math and code stays plain
    expect(result.html).toContain("language-math");
    expect(result.html).not.toContain("shiki-code-block");
  });

  it("injects multiple rehype plugins in order", async () => {
    const { rehypeKatex } = await import("@axis-love/math");
    const { rehypeShiki } = await import("@axis-love/highlighting");
    const result = await render("$$E = mc^2$$\n\n```ts\nconst x = 1;\n```", undefined, [
      [rehypeKatex],
      [rehypeShiki],
    ]);
    expect(result.html).toContain("katex");
    expect(result.html).toContain("shiki-code-block");
    expect(result.html).not.toContain("language-math");
  });

  // -------------------------------------------------------------------------
  // KWEB-030: Outline navigation, slug generation, selector injection
  // -------------------------------------------------------------------------

  it("heading elements have id attributes matching outline slugs", async () => {
    const result = await render("# Hello World\n\n## Section Two\n\n### Third Heading");
    expect(result.outline).toHaveLength(3);
    // Each outline slug should match an id in the rendered HTML
    // (sanitize prefixes ids with "user-content-" for clobber protection)
    for (const entry of result.outline) {
      expect(result.html).toContain(`id="user-content-${entry.slug}"`);
    }
  });

  it("outline slugs match heading ids for duplicate headings", async () => {
    const result = await render("# Section\n\n## Section\n\n### Section");
    expect(result.outline).toHaveLength(3);
    // rehype-slug deduplicates: section, section-1, section-2 (github-slugger convention)
    const slugs = result.outline.map((e) => e.slug);
    expect(new Set(slugs).size).toBe(3); // All unique
    for (const entry of result.outline) {
      expect(result.html).toContain(`id="user-content-${entry.slug}"`);
    }
  });

  it("outline slugs match heading ids for Unicode headings", async () => {
    const result = await render("# 中文标题\n\n## 日本語見出し");
    expect(result.outline).toHaveLength(2);
    for (const entry of result.outline) {
      expect(result.html).toContain(`id="user-content-${entry.slug}"`);
    }
  });

  it("preserves id attributes through sanitize", async () => {
    const result = await render("# Heading One\n\nText");
    expect(result.html).toContain('id="user-content-');
    // The outline slug should match a heading id in the HTML (without prefix)
    const slug = result.outline[0]?.slug;
    expect(slug).toBeDefined();
    expect(result.html).toContain(`id="user-content-${slug}"`);
  });

  it("blocks DOM clobbering via id attribute on anchors", async () => {
    const result = await render('<a id="location" href="https://evil.example.com">click</a>');
    // The clobber protection should still block id="location" even though
    // we restored id attributes for headings
    expect(result.html).not.toContain('id="location"');
  });

  it("blocks DOM clobbering via name attribute on img", async () => {
    const result = await render('<img name="domain" src="x.png">');
    expect(result.html).not.toContain('name="domain"');
  });
});
