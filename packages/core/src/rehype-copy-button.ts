// @axis-love/core — copy button rehype plugin
//
// Adds a structural copy button to code blocks (pre > code).
// This is a structural-only transform — no DOM, no event handlers.
// The browser layer attaches click behavior.
//
// Internal plugin — not re-exported.

import type { Element, Root as HastRoot } from "hast";
import type { Plugin } from "unified";
import { visit } from "unist-util-visit";

export const rehypeCopyButton: Plugin<[], HastRoot, HastRoot> =
  () =>
  (tree: HastRoot): HastRoot => {
    visit(tree, "element", (node: Element) => {
      if (node.tagName !== "pre") return;

      const hasCode = node.children.some(
        (child) => child.type === "element" && child.tagName === "code",
      );
      const isShiki =
        Array.isArray(node.properties?.className) &&
        (node.properties.className as string[]).includes("shiki-code-block");

      if (!hasCode && !isShiki) return;

      const hasButton = node.children.some(
        (child) =>
          child.type === "element" &&
          child.tagName === "button" &&
          Array.isArray(child.properties?.className) &&
          (child.properties.className as string[]).includes("code-copy-button"),
      );

      if (hasButton) return;

      const copyButton: Element = {
        type: "element",
        tagName: "button",
        properties: {
          className: ["code-copy-button"],
          type: "button",
          ariaLabel: "Copy code",
        },
        children: [
          {
            type: "element",
            tagName: "svg",
            properties: {
              width: "16",
              height: "16",
              viewBox: "0 0 16 16",
              fill: "none",
              stroke: "currentColor",
              strokeWidth: "1.5",
              strokeLinecap: "round",
              strokeLinejoin: "round",
            },
            children: [
              {
                type: "element",
                tagName: "rect",
                properties: {
                  x: "5",
                  y: "5",
                  width: "9",
                  height: "9",
                  rx: "1",
                },
                children: [],
              },
              {
                type: "element",
                tagName: "path",
                properties: {
                  d: "M3 11V3a1 1 0 0 1 1-1h8",
                },
                children: [],
              },
            ],
          },
        ],
      };

      node.children.push(copyButton);
    });

    return tree;
  };
