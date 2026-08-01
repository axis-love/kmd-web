// @axis-love/core — GitHub-style alert remark plugin
//
// Transforms blockquotes starting with [!NOTE], [!TIP], [!IMPORTANT],
// [!WARNING], [!CAUTION] into div elements with alert classes.
//
// Unlike remark-github-alerts, this plugin preserves the [!TYPE] marker
// text in the output so consumers can style and detect the alert type.
//
// Internal plugin — not re-exported.

import type { Root } from "mdast";
import { visit } from "unist-util-visit";

const ALERT_TYPES = new Set(["NOTE", "TIP", "IMPORTANT", "WARNING", "CAUTION"]);
const ALERT_RE = /^\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\]/i;

export function remarkAlerts() {
  return (tree: Root): Root => {
    visit(tree, "blockquote", (node, index, parent) => {
      if (index === undefined || !parent) return;

      const firstChild = node.children[0];
      if (firstChild?.type !== "paragraph") return;

      const firstText = firstChild.children[0];
      if (firstText?.type !== "text") return;

      const matchResult = firstText.value.match(ALERT_RE);
      if (!matchResult) return;

      const alertType = matchResult[1]?.toLowerCase();
      const alertTypeKey = matchResult[1];
      if (!alertType || !alertTypeKey || !ALERT_TYPES.has(alertTypeKey)) return;

      // Add hProperties to the blockquote so remark-rehype produces a div
      // with the alert class. Preserve the [!TYPE] marker text.
      (node as unknown as { data?: Record<string, unknown> }).data = {
        hName: "div",
        hProperties: {
          className: ["markdown-alert", `markdown-alert-${alertType}`],
        },
      };

      // Also add class to the first paragraph for the title
      (firstChild as unknown as { data?: Record<string, unknown> }).data = {
        hName: "p",
        hProperties: {
          className: ["markdown-alert-title"],
        },
      };
    });

    return tree;
  };
}
