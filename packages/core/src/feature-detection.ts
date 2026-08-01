// @axis-love/core — feature detection
//
// Pre-parses the Markdown body to detect which optional features are present.
// Detection only records presence — it does not load any feature implementation.
//
// The detected flags are used to populate RenderResult.detectedFeatures.

import type { DetectedFeatures } from "@axis-love/contracts";
import { parseFrontMatter, splitYamlFrontMatter } from "./front-matter.js";

// Languages that benefit from syntax highlighting.
// "text", "plain", "plaintext", "mermaid" are excluded — they don't benefit.
const HIGHLIGHTABLE_LANGS = new Set([
  "c",
  "cpp",
  "csharp",
  "cs",
  "css",
  "diff",
  "docker",
  "dockerfile",
  "go",
  "html",
  "htm",
  "java",
  "javascript",
  "js",
  "jsx",
  "json",
  "markdown",
  "md",
  "php",
  "powershell",
  "ps",
  "ps1",
  "python",
  "py",
  "ruby",
  "rust",
  "rs",
  "shell",
  "sh",
  "bash",
  "shellscript",
  "sql",
  "swift",
  "toml",
  "tsx",
  "typescript",
  "ts",
  "xml",
  "yaml",
  "yml",
]);

// Match fenced code blocks with a language tag, excluding mermaid.
// Captures the language identifier after the opening backticks.
const FENCED_LANG_RE = /```([^\s`]+)/g;

// Math detection: look for $...$ or $$...$$ patterns that are NOT
// template literals (${...}) or shell variables ($1, $@, $!).
// Require at least one non-whitespace character between delimiters,
// and exclude patterns starting with ${ .
const MATH_INLINE_RE = /(^|[^\\$])\$([^$\n]+)\$/;
const MATH_BLOCK_RE = /\$\$([^$]+)\$\$/;

const MERMAID_FENCE_RE = /```mermaid\b/i;
const TABLE_PIPE_RE = /^\|.*\|$/m;
const TASK_LIST_RE = /^[-*]\s+\[[xX ]\]/m;
const FOOTNOTE_RE = /^\[\^[^\]]+\]:/m;
const ALERT_RE = /^>\s*\[!(?:NOTE|TIP|IMPORTANT|WARNING|CAUTION)\]/im;
const DESIGN_DOC_HEADING_RE = /^#{1,6}\s+design\b/im;

/**
 * Detect features in the Markdown source.
 * Returns a fully-populated DetectedFeatures object.
 */
export function detectFeatures(source: string): DetectedFeatures {
  const { body } = splitYamlFrontMatter(source);

  // Code highlighting: check for fenced code with a highlightable language
  let hasCodeHighlighting = false;
  FENCED_LANG_RE.lastIndex = 0;
  let match = FENCED_LANG_RE.exec(body);
  while (match !== null) {
    const lang = match[1]?.toLowerCase() ?? "";
    if (lang !== "text" && lang !== "plain" && lang !== "plaintext" && lang !== "mermaid") {
      if (HIGHLIGHTABLE_LANGS.has(lang)) {
        hasCodeHighlighting = true;
        break;
      }
    }
    match = FENCED_LANG_RE.exec(body);
  }

  // Math detection: exclude code blocks before checking.
  // Strip fenced code blocks to avoid false positives from code content.
  const bodyWithoutCode = body.replace(/```[\s\S]*?```/g, "");
  const hasMath = MATH_INLINE_RE.test(bodyWithoutCode) || MATH_BLOCK_RE.test(bodyWithoutCode);

  // Design doc detection: check for a "Design" heading or front matter title.
  let hasDesignDoc = DESIGN_DOC_HEADING_RE.test(body);
  if (!hasDesignDoc) {
    const { data } = parseFrontMatter(source);
    const title = data?.title;
    if (typeof title === "string" && /design/i.test(title)) {
      hasDesignDoc = true;
    }
  }

  return {
    hasMath,
    hasMermaid: MERMAID_FENCE_RE.test(body),
    hasDesignDoc,
    hasCodeHighlighting,
    hasTables: TABLE_PIPE_RE.test(body),
    hasTaskLists: TASK_LIST_RE.test(body),
    hasFootnotes: FOOTNOTE_RE.test(body),
    hasAlerts: ALERT_RE.test(body),
  };
}
