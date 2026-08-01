// @axis-love/core — outline extraction with slug generation
//
// Extracts heading entries from the HAST tree and generates URL-safe
// slug IDs with deduplication matching the contract convention.
//
// The contract deduplication convention starts at -2 for the first
// duplicate (e.g. "section", "section-2").
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
 * Convert heading text to a URL-safe slug.
 * Matches GitHub's slug algorithm: lowercase, replace spaces with hyphens,
 * strip special characters.
 */
function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "") // Remove non-word chars (except spaces and hyphens)
    .replace(/\s+/g, "-") // Replace spaces with hyphens
    .replace(/-+/g, "-") // Collapse multiple hyphens
    .replace(/^-|-$/g, ""); // Strip leading/trailing hyphens
}

/**
 * Deduplicate slugs using the contract convention:
 * "section", "section-2", "section-3", ...
 */
function deduplicateSlugs(entries: OutlineEntry[]): OutlineEntry[] {
  const seen = new Map<string, number>();

  return entries.map((entry) => {
    const base = entry.slug;
    const count = seen.get(base) ?? 0;

    if (count === 0) {
      seen.set(base, 1);
      return entry;
    }

    const newSlug = `${base}-${count + 1}`;
    seen.set(base, count + 1);
    return { ...entry, slug: newSlug };
  });
}

/**
 * Extract the heading outline from a HAST tree.
 * Generates URL-safe slug IDs from heading text with deduplication.
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
    if (text) {
      const slug = slugify(text);
      entries.push({ text, level, slug });
    }
  });

  return deduplicateSlugs(entries);
}
