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
  LinkTarget,
  OutlineEntry,
  RenderOptions,
  RenderResult,
} from "@axis-love/contracts";
import { defaultRenderOptions, RenderError } from "@axis-love/contracts";
import type { Root as HastRoot } from "hast";
import raw from "rehype-raw";
import rehypeSanitize from "rehype-sanitize";
import rehypeSlug from "rehype-slug";
import rehypeStringify from "rehype-stringify";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import remarkParse from "remark-parse";
import remarkRehype from "remark-rehype";
import { unified } from "unified";
import { extractAssets } from "./assets.js";
import { DiagnosticCollector } from "./diagnostics.js";
import { extractLinks, extractLinksFromSource, mergeLinks } from "./extract-links.js";
import { detectFeatures } from "./feature-detection.js";
import { splitYamlFrontMatter } from "./front-matter.js";
import { extractMetadata } from "./metadata.js";
import { extractOutline } from "./outline.js";
import { rehypeCopyButton } from "./rehype-copy-button.js";
import { rehypeMermaidPlaceholder } from "./rehype-mermaid.js";
import { rehypeSanitizeCss } from "./rehype-sanitize-css.js";
import { rehypeStripRaw } from "./rehype-strip-raw.js";
import { rehypeResponsiveTables } from "./rehype-tables.js";
import { remarkAlerts } from "./remark-alerts.js";
import { remarkWikilinks } from "./remark-wikilinks.js";
import {
  createRehypeUrlPolicy,
  isProtocolRelative,
  isSafeUrl,
  sanitizeSchema,
} from "./sanitize.js";

export const CORE_VERSION = "0.1.0";

// ---------------------------------------------------------------------------
// Plugin injection types
// ---------------------------------------------------------------------------

/**
 * A rehype plugin entry: a plugin function followed by its options.
 *
 * Core cannot statically import optional feature packages (KaTeX, Shiki)
 * — they are heavy and must remain lazy-loaded. Instead, the host injects
 * them via this type. The plugins run after `raw` and before `rehypeSanitize`
 * so their HTML output passes through the sanitizer.
 *
 * This is a direct-call-only feature — plugin functions are NOT serializable
 * and cannot cross worker boundaries.
 *
 * The plugin is typed as `unknown` (not `Plugin`) because unified's `Plugin`
 * type is invariant in its input/output node types. The host is responsible
 * for passing valid rehype plugins.
 */
export type RehypePluginEntry = readonly [plugin: unknown, ...options: unknown[]];

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

    // Protocol-relative URLs (//host/path) carry no scheme but resolve to a
    // remote http/https fetch, so they must be treated as remote — not as
    // local relative paths — and blocked when remote images are disabled.
    if (isProtocolRelative(url)) {
      return false;
    }

    // Block remote images when allowRemoteImages is false.
    // Only allow relative URLs (no scheme), data:, and blob:.
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
    if (scheme === "data" || scheme === "blob") {
      return true;
    }
    // Block all other schemes (http, https, ftp, file, etc.)
    return false;
  });
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
 *   These are JSON-serializable and can cross worker boundaries.
 * @param rehypePlugins - Optional rehype plugin entries to inject into the
 *   pipeline after `raw` (so raw HTML is parsed) and before `rehypeSanitize`
 *   (so plugin output is sanitized). Core does not statically import the
 *   optional feature packages — the host injects them here. Plugin functions
 *   are NOT serializable, so they cannot be posted to a worker: a worker entry
 *   must build its own list rather than receive one. `@axis-love/browser`
 *   exports `renderWithFeaturePlugins` for exactly that, so both the main
 *   thread and the worker inject the same plugins.
 * @returns A serializable RenderResult with HTML, outline, diagnostics, assets, metadata, and detected features.
 * @throws RenderError if the source exceeds maxSourceSize or the render times out.
 */
export async function render(
  source: string,
  options?: RenderOptions,
  rehypePlugins?: readonly RehypePluginEntry[],
): Promise<RenderResult> {
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

  // Design doc validation is now handled by the optional @axis-love/design
  // package. Core only detects hasDesignDoc; it does not validate design tokens.
  // See KWEB-010: scanDesignDoc moved to @axis-love/design.

  // Sanitize pathological math sequences: replace runs of 4+ dollar signs
  // with a harmless placeholder to prevent remark-math from consuming
  // the rest of the document. See KWEB-007 conformance: pathological math input.
  // Using a replacement that is NOT a valid math delimiter.
  const sanitizedBody = body.replace(/\${4,}/g, "[dollar-signs]");

  let capturedOutline: OutlineEntry[] = [];
  let capturedAssets: AssetReference[] = [];
  let capturedLinks: LinkTarget[] = [];

  const captureOutline = () => (tree: HastRoot) => {
    capturedOutline = extractOutline(tree);
  };

  const captureAssets = () => (tree: HastRoot) => {
    capturedAssets = extractAssets(tree);
  };

  const captureLinks = () => (tree: HastRoot) => {
    capturedLinks = extractLinks(tree, allowedSchemes);
  };

  // Build the pipeline — unified/HAST stays internal
  const pipeline = unified()
    .use(remarkParse)
    .use(remarkGfm)
    .use(remarkMath)
    .use(remarkWikilinks)
    .use(remarkAlerts)
    .use(remarkRehype, { allowDangerousHtml: true });

  // Inject optional rehype plugins (KaTeX, Shiki) after remarkRehype
  // and before rehype-raw. The plugins transform <code class="language-math">
  // and <pre><code class="language-X"> elements, producing raw HTML nodes.
  // The subsequent rehype-raw pass converts those raw nodes into proper
  // HAST elements so rehypeSanitize can process them.
  // Core does not import these packages — the host injects them.
  // The cast is necessary because unified's Plugin type is invariant in
  // its input/output node types — we accept unknown plugins from the host.
  if (rehypePlugins) {
    for (const entry of rehypePlugins) {
      const [plugin, ...pluginOpts] = entry;
      (pipeline.use as (p: unknown, ...opts: unknown[]) => void)(plugin, ...pluginOpts);
    }
  }

  pipeline.use(raw);

  // Add id attributes to heading elements (rehype-slug uses github-slugger).
  // Runs after rehype-raw so headings from raw HTML also get ids.
  // Sanitize preserves id/name (see sanitizeSchema) with clobber protection.
  pipeline.use(rehypeSlug);

  // Mermaid placeholder (structural only — no DOM execution)
  if (resolved.features.mermaid) {
    pipeline.use(rehypeMermaidPlaceholder);
  }

  pipeline
    .use(rehypeResponsiveTables)
    .use(captureLinks)
    .use(createRehypeUrlPolicy(allowedSchemes, collector))
    .use(rehypeSanitize, sanitizeSchema)
    .use(rehypeSanitizeCss)
    .use(rehypeStripRaw)
    .use(captureOutline)
    .use(captureAssets)
    .use(rehypeCopyButton)
    .use(rehypeStringify, { allowDangerousHtml: true });

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

  // Merge HAST-extracted links with source-extracted links.
  // Source extraction catches links the parser broke (e.g. URLs
  // containing < that get parsed as raw HTML instead of URL content).
  const sourceLinks = extractLinksFromSource(source, allowedSchemes);
  const allLinks = mergeLinks(capturedLinks, sourceLinks);

  const diagnostics: Diagnostic[] = [...collector.all];

  return {
    html: String(htmlFile),
    outline: capturedOutline,
    diagnostics,
    assets: filteredAssets,
    links: allLinks,
    metadata,
    detectedFeatures: features,
    rendererVersion: CORE_VERSION,
  };
}
