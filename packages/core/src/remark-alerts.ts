// @axis-love/core — GitHub-style alert remark plugin
//
// Transforms blockquotes starting with [!NOTE], [!TIP], [!IMPORTANT],
// [!WARNING], [!CAUTION] into div elements with alert classes, matching
// the release-version behavior of remark-github-alerts:
//   - the [!TYPE] marker is stripped from the body text
//   - a dedicated title paragraph (class markdown-alert-title) is inserted
//     as the first child, containing the capitalized type (or a custom
//     inline title written after the marker)
//   - icons are NOT emitted as HTML; consumers render them via CSS
//     ::before on .markdown-alert-title (see @axis-love/styles)
//
// Internal plugin — not re-exported.

import type { Root, RootContent } from "mdast";
import { visit } from "unist-util-visit";

const ALERT_TYPES = new Set(["NOTE", "TIP", "IMPORTANT", "WARNING", "CAUTION"]);
const ALERT_RE = /^\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\]([^\n\r]*)/i;

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

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
      const alertTypeKey = matchResult[1]?.toUpperCase();
      if (!alertType || !alertTypeKey || !ALERT_TYPES.has(alertTypeKey)) return;

      const inlineTitle = (matchResult[2] ?? "").trim();
      const title = inlineTitle || capitalize(alertType);

      // Strip the marker (and any inline title) from the body paragraph.
      firstText.value = firstText.value.slice(matchResult[0].length).trimStart();

      // Blockquote becomes a div with the alert class.
      (node as unknown as { data?: Record<string, unknown> }).data = {
        hName: "div",
        hProperties: {
          className: ["markdown-alert", `markdown-alert-${alertType}`],
        },
      };

      // Insert a dedicated title paragraph as the first child.
      const titleParagraph: RootContent = {
        type: "paragraph",
        data: {
          hName: "p",
          hProperties: {
            className: ["markdown-alert-title"],
          },
        },
        children: [{ type: "text", value: title }],
      };
      node.children = [titleParagraph, ...node.children];
    });

    return tree;
  };
}
