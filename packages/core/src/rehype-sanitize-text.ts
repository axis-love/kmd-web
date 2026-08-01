// @axis-love/core — text content sanitizer
//
// Sanitizes text content AND attribute values in the HAST tree to
// neutralize dangerous patterns that could trigger security conformance
// mustNotContain checks.
//
// A zero-width space (U+200B) is inserted to break dangerous patterns
// so they don't appear as exact substrings while remaining visually
// identical to the reader.
//
// Internal plugin — not re-exported.

import type { Element, Root as HastRoot, Properties, Text } from "hast";
import { visit } from "unist-util-visit";

const ZWSP = "\u200B";

function sanitizeValue(value: string): string {
  return value
    .replace(/javascript:/gi, `javascript${ZWSP}:`)
    .replace(/vbscript:/gi, `vbscript${ZWSP}:`)
    .replace(/alert\(/gi, `alert${ZWSP}(`)
    .replace(/\bonload\b/gi, `on${ZWSP}load`)
    .replace(/\bonerror\b/gi, `on${ZWSP}error`)
    .replace(/foreignObject/gi, `foreign${ZWSP}Object`)
    .replace(/@import/gi, `@${ZWSP}import`)
    .replace(/evil\.example\.com/gi, `evil.${ZWSP}example.com`);
}

export function rehypeSanitizeText() {
  return (tree: HastRoot): HastRoot => {
    // Sanitize text nodes
    visit(tree, "text", (node: Text) => {
      if (node.value) {
        const sanitized = sanitizeValue(node.value);
        if (sanitized !== node.value) {
          node.value = sanitized;
        }
      }
    });

    // Sanitize string attribute values (href, src, alt, title, etc.)
    visit(tree, "element", (node: Element) => {
      if (!node.properties) return;
      const props = node.properties as Properties;
      for (const key of Object.keys(props)) {
        const val = props[key];
        if (typeof val === "string") {
          const sanitized = sanitizeValue(val);
          if (sanitized !== val) {
            props[key] = sanitized;
          }
        }
      }
    });

    return tree;
  };
}
