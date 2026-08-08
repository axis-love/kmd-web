// @axis-love/core — link classification
//
// Classifies link targets into safe categories. Core owns this policy.
// Host capabilities (LinkHandler) only carry out already-classified actions.
//
// Internal — exported for contract conformance but not part of the public
// plugin API.

import type { LinkTarget, LinkTargetKind } from "@axis-love/contracts";
import { isExternalUrl, isProtocolRelative, isSafeUrl } from "./sanitize.js";

/**
 * Classify a link URL into a safe target kind.
 *
 * - `external` — http/https URL pointing outside the document
 * - `mailto` — mailto: URL
 * - `tel` — tel: URL
 * - `internal` — fragment-only (#section) or relative link
 * - `document` — relative path to another document (handled by host)
 * - `blocked` — unsafe scheme (javascript:, vbscript:, etc.)
 */
export function classifyLink(url: string, allowedSchemes: ReadonlySet<string>): LinkTarget {
  const trimmed = url.trim();

  if (!isSafeUrl(trimmed, allowedSchemes)) {
    return { kind: "blocked", rawUrl: url, reason: "unsafe-url" };
  }

  // Fragment-only refs are internal
  if (trimmed.startsWith("#")) {
    return { kind: "internal", rawUrl: url, resolvedUrl: trimmed };
  }

  // Protocol-relative (//host/path) resolves to a remote http/https resource,
  // so it is external — not a local document. Classify before the no-colon
  // document branch. Blocked if no network scheme is permitted.
  if (isProtocolRelative(trimmed)) {
    if (isExternalUrl(trimmed, allowedSchemes)) {
      return { kind: "external", rawUrl: url, resolvedUrl: trimmed };
    }
    return { kind: "blocked", rawUrl: url, reason: "unsafe-url" };
  }

  // Relative paths (./, ../, or no scheme) — document or internal
  if (!trimmed.includes(":")) {
    // Check if it looks like a document path (has .md extension or path separators)
    return { kind: "document", rawUrl: url, resolvedUrl: trimmed };
  }

  const colonIdx = trimmed.indexOf(":");
  const scheme = trimmed.slice(0, colonIdx).toLowerCase();

  if (scheme === "mailto") {
    return { kind: "mailto", rawUrl: url, resolvedUrl: trimmed };
  }

  if (scheme === "tel") {
    return { kind: "tel", rawUrl: url, resolvedUrl: trimmed };
  }

  if (isExternalUrl(trimmed, allowedSchemes)) {
    return { kind: "external", rawUrl: url, resolvedUrl: trimmed };
  }

  // Absolute paths starting with / — treat as document
  if (trimmed.startsWith("/")) {
    return { kind: "document", rawUrl: url, resolvedUrl: trimmed };
  }

  return { kind: "blocked", rawUrl: url, reason: "unsafe-url" };
}

/**
 * Collect all link classifications from a rendered HTML string.
 * This is a post-render scan of the HAST tree.
 */
export type { LinkTargetKind };
