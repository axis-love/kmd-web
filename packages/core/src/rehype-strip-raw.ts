// @axis-love/core — strip raw HTML nodes
//
// After rehype-sanitize, some raw HTML may survive as `raw` nodes in the
// HAST tree (unparsed by rehype-raw). These nodes contain dangerous
// verbatim HTML that rehype-stringify would output as-is when
// allowDangerousHtml is true. This plugin removes all `raw` nodes entirely.
//
// Internal plugin — not re-exported.

import type { Element, Root as HastRoot } from "hast";
import { visit } from "unist-util-visit";

/**
 * Remove all `raw` nodes from the HAST tree.
 * This prevents unparsed raw HTML from appearing in the output.
 */
export function rehypeStripRaw() {
  return (tree: HastRoot): HastRoot => {
    visit(tree, "element", (node: Element) => {
      if (node.children) {
        node.children = node.children.filter(
          (child) => child.type !== "raw",
        ) as typeof node.children;
      }
    });

    // Also filter top-level raw nodes
    tree.children = tree.children.filter((child) => child.type !== "raw") as typeof tree.children;

    return tree;
  };
}
