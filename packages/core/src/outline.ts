// @axis-love/core — outline extraction
//
// Extracts heading entries from the HAST tree. Slug IDs are read from
// the `id` property set by rehype-slug (which uses github-slugger).
// This ensures outline slugs match the id attributes on heading
// elements in the rendered HTML.
//
// Headings inside the auto-generated footnotes section are excluded.
//
// Internal — not re-exported.

import type { OutlineEntry } from "@axis-love/contracts";
import type { Element, Root as HastRoot } from "hast";
import { visit } from "unist-util-visit";
import { extractText } from "./hast-utils.js";

/**
 * Check if a heading is the auto-generated footnotes section heading.
 */
function isFootnotesSectionHeading(node: Element): boolean {
  const props = node.properties;
  if (!props) return false;

  const className = props.className;
  if (Array.isArray(className) && className.includes("sr-only")) {
    return true;
  }

  const id = typeof props.id === "string" ? props.id : "";
  if (id === "footnote-label") {
    return true;
  }

  return false;
}

/**
 * Extract the heading outline from a HAST tree.
 * Reads slug IDs from the `id` property set by rehype-slug.
 * Headings without an `id` property are skipped (they won't be
 * navigable via anchor links).
 *
 * Headings inside the footnotes section are excluded.
 */
export function extractOutline(tree: HastRoot): OutlineEntry[] {
  const entries: OutlineEntry[] = [];

  visit(tree, "element", (node: Element) => {
    if (!/^h[1-6]$/.test(node.tagName)) return;

    // Skip auto-generated footnotes section heading
    if (isFootnotesSectionHeading(node)) return;

    const level = Number.parseInt(node.tagName.charAt(1), 10);
    const text = extractText(node);
    if (!text) return;

    // Read the id set by rehype-slug (runs earlier in the pipeline).
    // rehype-slug uses github-slugger for slug generation, which handles
    // Unicode, emoji, and deduplication automatically.
    // Sanitize may prefix ids with "user-content-" for clobber protection —
    // strip the prefix so outline slugs match fragment identifiers.
    const rawId = typeof node.properties?.id === "string" ? node.properties.id : "";
    if (!rawId) return;

    const slug = rawId.startsWith("user-content-") ? rawId.slice("user-content-".length) : rawId;

    entries.push({ text, level, slug });
  });

  return entries;
}
