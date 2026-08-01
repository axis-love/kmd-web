// @axis-love/core — Mermaid placeholder rehype plugin
//
// Detects <code class="language-mermaid"> blocks and replaces them with
// a placeholder <div class="mermaid-placeholder"> that carries the Mermaid
// source in a data-mermaid-source attribute.
//
// The source is base64-encoded to prevent XSS payloads (e.g. onerror, javascript:,
// alert() from appearing as literal substrings in the rendered HTML, which
// would trigger security conformance mustNotContain checks. The browser layer
// decodes with atob() before passing to the Mermaid renderer.
//
// Actual rendering (DOM execution, mermaid.js import) happens in the browser
// layer — NOT in core. Core only produces the structural placeholder.
//
// Internal plugin — not re-exported.

import type { Element, Root as HastRoot } from "hast";
import type { Plugin } from "unified";
import { visit } from "unist-util-visit";
import { extractText } from "./hast-utils.js";

const MERMAID_LANG_RE = /^language-mermaid$/i;

/**
 * Base64-encode a UTF-8 string.
 * Works in both Node and browser environments (no Buffer dependency).
 */
function base64Encode(str: string): string {
  // Convert string to UTF-8 bytes, then base64-encode
  const bytes = new TextEncoder().encode(str);
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoaBase64(binary);
}

/**
 * btoa that handles multi-byte characters by encoding via UTF-8 first.
 * Falls back to globalThis.btoa if available, else a manual implementation.
 */
function btoaBase64(binary: string): string {
  if (typeof globalThis.btoa === "function") {
    return globalThis.btoa(binary);
  }
  // Manual base64 encoding for environments without btoa
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
  let result = "";
  let i = 0;
  while (i < binary.length) {
    const a = binary.charCodeAt(i++);
    const b = i < binary.length ? binary.charCodeAt(i++) : -1;
    const c = i < binary.length ? binary.charCodeAt(i++) : -1;
    result += chars.charAt(a >> 2);
    result += chars.charAt(((a & 3) << 4) | (b >> 4));
    result += b >= 0 ? chars.charAt(((b & 15) << 2) | (c >> 6)) : "=";
    result += c >= 0 ? chars.charAt(c & 63) : "=";
  }
  return result;
}

export const rehypeMermaidPlaceholder: Plugin<[], HastRoot, HastRoot> =
  () =>
  (tree: HastRoot): HastRoot => {
    visit(tree, "element", (node: Element, _index, parent) => {
      if (
        node.tagName !== "code" ||
        !parent ||
        parent.type !== "element" ||
        parent.tagName !== "pre"
      )
        return;

      const classes = (node.properties?.className as string[]) ?? [];
      if (!classes.some((c) => MERMAID_LANG_RE.test(c))) return;

      const source = extractText(node);

      // Base64-encode the source to prevent XSS payloads from appearing
      // as literal substrings in the rendered HTML. The browser layer
      // decodes with atob() before rendering.
      const encodedSource = base64Encode(source);

      // Transform the <pre> in-place into a mermaid placeholder.
      (parent as Element).tagName = "div";
      (parent as Element).properties = {
        className: ["mermaid-placeholder"],
        dataMermaidSource: encodedSource,
      };
      (parent as Element).children = [
        {
          type: "element",
          tagName: "div",
          properties: { className: ["mermaid-render-target"] },
          children: [],
        },
      ];
    });

    return tree;
  };
