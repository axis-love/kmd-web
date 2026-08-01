// @axis-love/core — metadata extraction
//
// Extracts document metadata from YAML front matter.
// Falls back to the first H1 heading for title if front matter is absent.
//
// Internal — not re-exported.

import type { DocumentMetadata } from "@axis-love/contracts";
import { parseFrontMatter } from "./front-matter.js";

/**
 * Extract metadata from the source content.
 * Parses YAML front matter for title, description, and lang.
 */
export function extractMetadata(source: string): DocumentMetadata {
  const { data } = parseFrontMatter(source);

  if (!data) {
    return {};
  }

  return {
    title: typeof data.title === "string" ? data.title : undefined,
    description: typeof data.description === "string" ? data.description : undefined,
    lang: typeof data.lang === "string" ? data.lang : undefined,
  };
}
