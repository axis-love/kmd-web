// @axis-love/core — front-matter splitter
//
// Splits YAML front matter from Markdown body content.
// Uses js-yaml for parsing front matter into metadata.
// This is a self-contained port of the kmd parser's YAML splitter,
// without any dependency on the design pipeline's IR types.

import * as yaml from "js-yaml";

export interface FrontMatterResult {
  /** Extracted YAML frontmatter string (without delimiters), or empty string. */
  readonly frontmatter: string;
  /** Remaining body content after the frontmatter. */
  readonly body: string;
}

export interface ParsedFrontMatter {
  /** Parsed front matter as a record, or null if no front matter or parse failure. */
  readonly data: Record<string, unknown> | null;
  /** The raw frontmatter string. */
  readonly raw: string;
}

const YAML_DELIMITER = "---";

/**
 * Split `---`-delimited YAML frontmatter from content.
 *
 * Supports both `---\nyaml\n---\nbody` and bare content without frontmatter.
 */
export function splitYamlFrontMatter(content: string): FrontMatterResult {
  if (!content.startsWith(YAML_DELIMITER)) {
    return { frontmatter: "", body: content };
  }

  const afterFirst = content.length > 3 ? content.indexOf("\n", 3) : -1;
  if (afterFirst === -1) {
    return { frontmatter: "", body: content };
  }

  const searchFrom = afterFirst + 1;
  const closeIdx = content.indexOf("\n---", searchFrom);

  if (closeIdx === -1) {
    return { frontmatter: "", body: content };
  }

  const frontmatter = content.slice(afterFirst + 1, closeIdx);
  const bodyStart = closeIdx + 4 + 1; // skip \n---\n
  const body = content.slice(Math.min(bodyStart, content.length));

  return { frontmatter, body };
}

/**
 * Parse YAML frontmatter from raw content, returning both the parsed data
 * and the raw string. Returns null data if no front matter or parse failure.
 */
export function parseFrontMatter(content: string): ParsedFrontMatter {
  const { frontmatter } = splitYamlFrontMatter(content);

  if (!frontmatter.trim()) {
    return { data: null, raw: "" };
  }

  try {
    const parsed = yaml.load(frontmatter);
    if (typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)) {
      return { data: parsed as Record<string, unknown>, raw: frontmatter };
    }
  } catch {
    // Parse failure — return null data, caller can emit a diagnostic
  }

  return { data: null, raw: frontmatter };
}
