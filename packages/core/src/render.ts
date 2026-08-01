// @axis-love/core — the rendering pipeline
//
// The canonical Markdown-to-safe-RenderResult engine.
// Uses a unified (remark + rehype) pipeline internally — no public plugin API.
//
// Core has NO DOM, React, Tauri, or Node I/O dependencies.
// It accepts source text and explicit RenderOptions, returns RenderResult.

import type {
  AssetReference,
  DetectedFeatures,
  Diagnostic,
  DocumentMetadata,
  OutlineEntry,
  RenderOptions,
  RenderResult,
} from "@axis-love/contracts";
import { defaultRenderOptions, RenderError } from "@axis-love/contracts";
import type { Root as HastRoot } from "hast";
import raw from "rehype-raw";
import rehypeSanitize from "rehype-sanitize";
import rehypeStringify from "rehype-stringify";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import remarkParse from "remark-parse";
import remarkRehype from "remark-rehype";
import { unified } from "unified";
import { extractAssets } from "./assets.js";
import { DiagnosticCollector } from "./diagnostics.js";
import { detectFeatures } from "./feature-detection.js";
import { splitYamlFrontMatter } from "./front-matter.js";
import { extractMetadata } from "./metadata.js";
import { extractOutline } from "./outline.js";
import { rehypeCopyButton } from "./rehype-copy-button.js";
import { rehypeMermaidPlaceholder } from "./rehype-mermaid.js";
import { rehypeSanitizeText } from "./rehype-sanitize-text.js";
import { rehypeStripRaw } from "./rehype-strip-raw.js";
import { rehypeResponsiveTables } from "./rehype-tables.js";
import { remarkAlerts } from "./remark-alerts.js";
import { remarkWikilinks } from "./remark-wikilinks.js";
import { createRehypeUrlPolicy, isSafeUrl, sanitizeSchema } from "./sanitize.js";

export const CORE_VERSION = "0.1.0";

// ---------------------------------------------------------------------------
// Options normalization
// ---------------------------------------------------------------------------

interface ResolvedOptions {
  readonly features: {
    readonly codeHighlighting: boolean;
    readonly mermaid: boolean;
    readonly math: boolean;
    readonly designDoc: boolean;
  };
  readonly security: {
    readonly allowRemoteImages: boolean;
    readonly allowedLinkSchemes: readonly string[];
    readonly allowedRawHtmlTags: readonly string[];
  };
  readonly maxSourceSize: number;
  readonly timeoutMs: number;
  readonly baseUrl: string | undefined;
}

function resolveOptions(options?: RenderOptions): ResolvedOptions {
  const opts = options ?? {};
  const d = defaultRenderOptions;

  return {
    features: {
      codeHighlighting: opts.features?.codeHighlighting ?? d.features.codeHighlighting ?? true,
      mermaid: opts.features?.mermaid ?? d.features.mermaid ?? true,
      math: opts.features?.math ?? d.features.math ?? true,
      designDoc: opts.features?.designDoc ?? d.features.designDoc ?? true,
    },
    security: {
      allowRemoteImages: opts.security?.allowRemoteImages ?? d.security.allowRemoteImages ?? false,
      allowedLinkSchemes: opts.security?.allowedLinkSchemes ??
        d.security.allowedLinkSchemes ?? ["https", "http", "mailto", "tel"],
      allowedRawHtmlTags: opts.security?.allowedRawHtmlTags ??
        d.security.allowedRawHtmlTags ?? [
          "br",
          "kbd",
          "sub",
          "sup",
          "mark",
          "abbr",
          "details",
          "summary",
        ],
    },
    maxSourceSize: opts.maxSourceSize ?? d.maxSourceSize,
    timeoutMs: opts.timeoutMs ?? d.timeoutMs,
    baseUrl: opts.baseUrl ?? d.baseUrl,
  };
}

// ---------------------------------------------------------------------------
// Raw HTML diagnostic pre-scan
// ---------------------------------------------------------------------------

const RAW_HTML_TAG_RE = /<\/?([a-zA-Z][a-zA-Z0-9]*)\b[^>]*>/g;

function scanRawHtml(
  source: string,
  allowedTags: ReadonlySet<string>,
  collector: DiagnosticCollector,
): void {
  const { body } = splitYamlFrontMatter(source);
  let match = RAW_HTML_TAG_RE.exec(body);
  while (match !== null) {
    const tag = match[1]?.toLowerCase();
    if (tag && !allowedTags.has(tag)) {
      collector.rawHtmlBlocked(tag);
    }
    match = RAW_HTML_TAG_RE.exec(body);
  }
}

// ---------------------------------------------------------------------------
// Unsafe URL diagnostic scan
// ---------------------------------------------------------------------------

const MD_LINK_RE = /\]\(([^)]+)\)/g;
const HTML_URL_ATTR_RE = /(?:href|src)\s*=\s*["']([^"']+)["']/gi;

function scanUnsafeUrls(
  source: string,
  allowedSchemes: ReadonlySet<string>,
  collector: DiagnosticCollector,
): void {
  const { body } = splitYamlFrontMatter(source);

  // Check Markdown link URLs (covers both [text](url) and ![alt](url))
  let match = MD_LINK_RE.exec(body);
  while (match !== null) {
    const url = match[1]?.trim();
    if (url && !isSafeUrl(url, allowedSchemes)) {
      collector.unsafeUrl(url);
    }
    match = MD_LINK_RE.exec(body);
  }

  // Check raw HTML href/src attributes
  HTML_URL_ATTR_RE.lastIndex = 0;
  match = HTML_URL_ATTR_RE.exec(body);
  while (match !== null) {
    const url = match[1]?.trim();
    if (url && !isSafeUrl(url, allowedSchemes)) {
      collector.unsafeUrl(url);
    }
    match = HTML_URL_ATTR_RE.exec(body);
  }
}

// ---------------------------------------------------------------------------
// Asset filtering (remote images)
// ---------------------------------------------------------------------------

function filterAssets(
  assets: readonly AssetReference[],
  allowRemoteImages: boolean,
  allowedSchemes: ReadonlySet<string>,
): AssetReference[] {
  return assets.filter((a) => {
    const url = a.url.trim();

    // Block unsafe URLs (path traversal, unsafe schemes)
    if (!isSafeUrl(url, allowedSchemes)) {
      return false;
    }

    if (allowRemoteImages) {
      return true;
    }

    // Block remote images when allowRemoteImages is false
    if (
      url.startsWith("#") ||
      url.startsWith("./") ||
      url.startsWith("../") ||
      !url.includes(":")
    ) {
      return true;
    }
    const colonIdx = url.indexOf(":");
    if (colonIdx === -1) return true;
    const scheme = url.slice(0, colonIdx).toLowerCase();
    if (scheme === "http" || scheme === "https") {
      return false;
    }
    return true;
  });
}

// ---------------------------------------------------------------------------
// Design doc validation
// ---------------------------------------------------------------------------

const COLOR_LINE_RE = /^(color-\S+):\s*["']?([^"'\n]+)["']?\s*$/gm;
const HEX_COLOR_RE = /^#[0-9a-fA-F]{3,8}$/;
const VAR_REF_RE = /^var\(--[\w-]+\)$/;

function scanDesignDoc(source: string, collector: DiagnosticCollector): void {
  const { body } = splitYamlFrontMatter(source);

  let match: RegExpExecArray | null;
  COLOR_LINE_RE.lastIndex = 0;
  match = COLOR_LINE_RE.exec(body);
  while (match !== null) {
    const name = match[1] ?? "";
    const value = (match[2] ?? "").trim();

    if (value) {
      // Check if it's a valid hex color or a var() reference
      if (
        !HEX_COLOR_RE.test(value) &&
        !VAR_REF_RE.test(value) &&
        !value.startsWith("rgb") &&
        !value.startsWith("hsl")
      ) {
        collector.add({
          severity: "warning",
          message: `Invalid color value for ${name}: "${value}"`,
          code: "design-validation",
        });
      }
    }
    match = COLOR_LINE_RE.exec(body);
  }
}

// ---------------------------------------------------------------------------
// Main render function
// ---------------------------------------------------------------------------

/**
 * Render Markdown source text into a safe, serializable RenderResult.
 *
 * Core has no DOM, React, Tauri, or Node I/O dependencies.
 * The unified/HAST pipeline is internal — no public plugin API.
 *
 * @param source - The Markdown source text to render.
 * @param options - Optional render options (features, security, limits).
 * @returns A serializable RenderResult with HTML, outline, diagnostics, assets, metadata, and detected features.
 * @throws RenderError if the source exceeds maxSourceSize or the render times out.
 */
export async function render(source: string, options?: RenderOptions): Promise<RenderResult> {
  const resolved = resolveOptions(options);

  // Source size check
  if (resolved.maxSourceSize > 0 && source.length > resolved.maxSourceSize) {
    throw new RenderError(
      "source-too-large",
      `Source size ${source.length} exceeds maximum ${resolved.maxSourceSize}`,
    );
  }

  const { body } = splitYamlFrontMatter(source);
  const features: DetectedFeatures = detectFeatures(source);
  const metadata: DocumentMetadata = extractMetadata(source);
  const collector = new DiagnosticCollector();

  // Build allowed sets
  const allowedSchemes = new Set(resolved.security.allowedLinkSchemes);
  const allowedRawHtmlTags = new Set(resolved.security.allowedRawHtmlTags);

  // Pre-scan for diagnostics (raw HTML blocks and unsafe URLs in source)
  scanRawHtml(source, allowedRawHtmlTags, collector);
  scanUnsafeUrls(source, allowedSchemes, collector);

  // Design doc validation: emit warnings for invalid design token values
  if (features.hasDesignDoc) {
    scanDesignDoc(source, collector);
  }

  // Sanitize pathological math sequences: replace runs of 4+ dollar signs
  // with a harmless placeholder to prevent remark-math from consuming
  // the rest of the document. See KWEB-007 conformance: pathological math input.
  // Using a replacement that is NOT a valid math delimiter.
  const sanitizedBody = body.replace(/\${4,}/g, "[dollar-signs]");

  let capturedOutline: OutlineEntry[] = [];
  let capturedAssets: AssetReference[] = [];

  const captureOutline = () => (tree: HastRoot) => {
    capturedOutline = extractOutline(tree);
  };

  const captureAssets = () => (tree: HastRoot) => {
    capturedAssets = extractAssets(tree);
  };

  // Build the pipeline — unified/HAST stays internal
  const pipeline = unified()
    .use(remarkParse)
    .use(remarkGfm)
    .use(remarkMath)
    .use(remarkWikilinks)
    .use(remarkAlerts)
    .use(remarkRehype, { allowDangerousHtml: true })
    .use(raw);

  // Mermaid placeholder (structural only — no DOM execution)
  if (resolved.features.mermaid) {
    pipeline.use(rehypeMermaidPlaceholder);
  }

  pipeline
    .use(rehypeResponsiveTables)
    .use(createRehypeUrlPolicy(allowedSchemes, collector))
    .use(rehypeSanitize, sanitizeSchema)
    .use(rehypeStripRaw)
    .use(rehypeSanitizeText)
    .use(captureOutline)
    .use(captureAssets)
    .use(rehypeCopyButton)
    .use(rehypeStringify);

  // Render with optional timeout
  let htmlFile: { toString(): string };

  if (resolved.timeoutMs > 0) {
    const timeoutPromise = new Promise<never>((_resolve, reject) => {
      setTimeout(() => {
        reject(new RenderError("render-timeout", `Render exceeded ${resolved.timeoutMs}ms`));
      }, resolved.timeoutMs);
    });

    htmlFile = await Promise.race([pipeline.process(sanitizedBody), timeoutPromise]);
  } else {
    htmlFile = await pipeline.process(sanitizedBody);
  }

  // Filter assets based on remote image policy
  const filteredAssets = filterAssets(
    capturedAssets,
    resolved.security.allowRemoteImages,
    allowedSchemes,
  );

  const diagnostics: Diagnostic[] = [...collector.all];

  return {
    html: String(htmlFile),
    outline: capturedOutline,
    diagnostics,
    assets: filteredAssets,
    metadata,
    detectedFeatures: features,
    rendererVersion: CORE_VERSION,
  };
}
