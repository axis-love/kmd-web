// @axis-love/core — responsive tables rehype plugin
//
// Wraps each GFM table in a div.table-wrapper so wide tables can scroll
// horizontally instead of forcing the whole document to overflow.
//
// Internal plugin — not re-exported.

import type { Element, Root as HastRoot } from "hast";
import { visit } from "unist-util-visit";

export function rehypeResponsiveTables() {
  return (tree: HastRoot): HastRoot => {
    visit(tree, "element", (node: Element, index, parent) => {
      if (
        node.tagName !== "table" ||
        typeof index !== "number" ||
        !parent ||
        !("children" in parent)
      ) {
        return;
      }

      if (parent.type === "element" && parent.tagName === "div") {
        const classes = parent.properties?.className;
        if (Array.isArray(classes) && classes.includes("table-wrapper")) {
          return;
        }
      }

      parent.children[index] = {
        type: "element",
        tagName: "div",
        properties: { className: ["table-wrapper"] },
        children: [node],
      };
    });

    return tree;
  };
}
