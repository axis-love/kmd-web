// @axis-love/core — CSS style attribute sanitizer
//
// hast-util-sanitize allow-lists attribute NAMES but never inspects CSS
// values, so an allowed `style` attribute would carry any declaration an
// author writes — including `position:fixed` click-jacking overlays and
// `background:url(...)` network exfiltration.
//
// Legitimate renderer output needs a small set of layout properties
// (KaTeX emits `height`/`margin-*` struts and spacing on spans), so the
// attribute itself stays allowed; this plugin filters every declaration to a
// strict structural allow-list instead. Anything not explicitly permitted is
// dropped, which neutralizes scheme/url/expression-based CSS injection while
// preserving renderer layout output.
//
// This is a real security control (not cosmetic mutation): it removes
// dangerous structure from style values rather than altering visible text.
//
// Internal plugin — not re-exported.

import type { Element, Root as HastRoot, Properties } from "hast";
import { visit } from "unist-util-visit";

/**
 * CSS properties permitted in sanitized `style` attributes.
 *
 * Deliberately limited to box-model/typography values that cannot fetch
 * resources, reposition content above the page, or execute code. Resource-
 * loading properties (background*, list-style, border-image, mask*, ...),
 * positioning (position, float, z-index), and legacy script vectors
 * (behavior, -moz-binding) are intentionally absent.
 */
const SAFE_CSS_PROPERTIES = new Set([
  "color",
  "height",
  "width",
  "min-height",
  "min-width",
  "max-height",
  "max-width",
  "margin",
  "margin-top",
  "margin-right",
  "margin-bottom",
  "margin-left",
  "padding",
  "padding-top",
  "padding-right",
  "padding-bottom",
  "padding-left",
  "vertical-align",
  "line-height",
  "text-align",
  "top",
]);

/** Dangerous value tokens — rejected in any declaration, allow-listed or not. */
const DANGEROUS_VALUE_RE =
  /(url\s*\(|expression\s*\(|javascript:|behavior\s*:|-moz-binding|@import)/i;

// biome-ignore lint/suspicious/noControlCharactersInRegex: intentional — browsers ignore control chars in CSS, so they are stripped to normalize declarations before validation.
const CONTROL_CHARS_RE = /[\x00-\x1F\x7F]/g;

// ---------------------------------------------------------------------------
// Declaration filtering
// ---------------------------------------------------------------------------

/**
 * Filter a raw CSS declaration list to the safe allow-list.
 *
 * Returns the sanitized declarations (semicolon-joined), or an empty string
 * when nothing safe remains. Comments are stripped; declarations that are
 * incomplete, vendor-prefixed, custom properties, or whose values contain
 * dangerous tokens are dropped.
 */
export function sanitizeStyleValue(rawStyle: string): string {
  // Strip CSS comments — they can hide payloads and serve no layout purpose.
  const withoutComments = rawStyle.replace(/\/\*[\s\S]*?(?:\*\/|$)/g, "");

  const kept: string[] = [];
  for (const declaration of withoutComments.split(";")) {
    const colonIdx = declaration.indexOf(":");
    if (colonIdx === -1) continue;

    // Trim and remove control characters the browser would ignore anyway.
    const property = declaration
      .slice(0, colonIdx)
      .replace(CONTROL_CHARS_RE, "")
      .trim()
      .toLowerCase();
    const value = declaration.slice(colonIdx + 1).trim();

    if (!property || !value) continue;
    // No vendor prefixes, no custom properties — only the allow-list.
    if (property.startsWith("-") || property.startsWith("--")) continue;
    if (!SAFE_CSS_PROPERTIES.has(property)) continue;
    if (DANGEROUS_VALUE_RE.test(value)) continue;

    kept.push(`${property}:${value}`);
  }

  return kept.join(";");
}

// ---------------------------------------------------------------------------
// Rehype plugin
// ---------------------------------------------------------------------------

/**
 * Rehype plugin that filters `style` attribute values on every element to a
 * strict safe-property allow-list. Runs after `rehypeSanitize` (which
 * enforces the attribute-name allow-list) and before stringify.
 *
 * Elements whose style reduces to nothing have the attribute removed.
 */
export function rehypeSanitizeCss() {
  return (tree: HastRoot): HastRoot => {
    visit(tree, "element", (node: Element) => {
      if (!node.properties) return;
      const props = node.properties as Properties;
      const style = props.style;
      if (typeof style !== "string") return;

      const sanitized = sanitizeStyleValue(style);
      if (sanitized) {
        props.style = sanitized;
      } else {
        delete props.style;
      }
    });

    return tree;
  };
}
