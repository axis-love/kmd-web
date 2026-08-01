// @axis-love/core — link extraction and classification
//
// Extracts all link references from the rendered document and classifies
// them using core's URL policy. This produces the `links` field of
// RenderResult, separating URL classification (core's responsibility)
// from host execution (browser/host capability).
//
// The host receives pre-classified LinkTarget[] and only needs to
// execute the action for each kind — it must NOT re-classify.
//
// Links are extracted from two sources:
// 1. The HAST tree (post-parse) — captures links that survived parsing
// 2. The Markdown source text — captures links that the parser broke
//    (e.g. URLs containing < that get interpreted as raw HTML)
//
// Internal — not re-exported.

import type { LinkTarget } from "@axis-love/contracts";
import type { Element, Root as HastRoot } from "hast";
import { visit } from "unist-util-visit";
import { classifyLink } from "./links.js";

/**
 * Extract and classify all links from a HAST tree.
 * Returns LinkTarget[] for every <a> element with an href attribute.
 */
export function extractLinks(tree: HastRoot, allowedSchemes: ReadonlySet<string>): LinkTarget[] {
  const links: LinkTarget[] = [];
  const seen = new Set<string>();

  visit(tree, "element", (node: Element) => {
    if (node.tagName !== "a") return;

    const href = node.properties?.href;
    if (typeof href !== "string" || href === "") return;

    const classified = classifyLinkSafe(href, allowedSchemes);
    if (!seen.has(classified.rawUrl)) {
      seen.add(classified.rawUrl);
      links.push(classified);
    }
  });

  return links;
}

/**
 * Extract and classify links from the raw Markdown source text.
 *
 * This catches links that the Markdown parser breaks — for example,
 * `[link](data:text/html,<script>alert(1)</script>)` where the `<script>`
 * tag is parsed as raw HTML instead of being part of the URL.
 *
 * The source-level scan uses the same `[text](url)` regex as the
 * unsafe-URL pre-scan, ensuring every link URL in the source is
 * classified even if the parser mangles it.
 */
export function extractLinksFromSource(
  source: string,
  allowedSchemes: ReadonlySet<string>,
): LinkTarget[] {
  const links: LinkTarget[] = [];
  const seen = new Set<string>();

  // Match Markdown links: [text](url) and ![alt](url)
  // The URL is everything between the last `(` and the closing `)`.
  // This is intentionally simple — it may catch URLs that the parser
  // would not treat as links (e.g. in code blocks), but for security
  // classification it is better to over-classify than miss a link.
  const linkRe = /!?\[([^\]]*)\]\(([^)]+)\)/g;

  let match = linkRe.exec(source);
  while (match !== null) {
    const url = (match[2] ?? "").trim();
    if (url && !seen.has(url)) {
      seen.add(url);
      links.push(classifyLink(url, allowedSchemes));
    }
    match = linkRe.exec(source);
  }

  // Also match raw HTML <a href="url"> links
  const htmlLinkRe = /<a\s+[^>]*href\s*=\s*["']([^"']+)["'][^>]*>/gi;
  match = htmlLinkRe.exec(source);
  while (match !== null) {
    const url = (match[1] ?? "").trim();
    if (url && !seen.has(url)) {
      seen.add(url);
      links.push(classifyLink(url, allowedSchemes));
    }
    match = htmlLinkRe.exec(source);
  }

  return links;
}

/**
 * Merge HAST-extracted links with source-extracted links.
 * HAST links take priority (they have the parser's interpretation).
 * Source-only links are appended for any URL not already seen.
 */
export function mergeLinks(
  hastLinks: readonly LinkTarget[],
  sourceLinks: readonly LinkTarget[],
): LinkTarget[] {
  const merged = [...hastLinks];
  const seen = new Set(merged.map((l) => l.rawUrl));

  for (const link of sourceLinks) {
    if (!seen.has(link.rawUrl)) {
      seen.add(link.rawUrl);
      merged.push(link);
    }
  }

  return merged;
}

/**
 * Classify a link URL, wrapping classifyLink to handle edge cases
 * where the href has already been through the URL policy and may
 * have been neutralized by rehypeSanitizeText (zero-width spaces).
 * We strip zero-width spaces before classification so the original
 * URL intent is preserved for diagnostic/classification purposes.
 */
function classifyLinkSafe(href: string, allowedSchemes: ReadonlySet<string>): LinkTarget {
  // Remove zero-width spaces that rehypeSanitizeText may have inserted
  const cleanHref = href.replace(/\u200B/g, "");
  return classifyLink(cleanHref, allowedSchemes);
}
