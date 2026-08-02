// @axis-love/design — design-doc validation
//
// Scans DESIGN.md source for invalid token values and emits diagnostics.
// This is the design-doc validation that was previously in core's render.ts.
// It is moved here so ordinary Markdown consumers don't load design validation.

import type { Diagnostic } from "@axis-love/contracts";
import { splitYamlFrontMatter } from "./extract/yaml.js";

const COLOR_LINE_RE = /^(color-\S+):\s*["']?([^"'\n]+)["']?\s*$/gm;
const HEX_COLOR_RE = /^#[0-9a-fA-F]{3,8}$/;
const VAR_REF_RE = /^var\(--[\w-]+\)$/;

/**
 * Scan DESIGN.md source for invalid color token values.
 * Emits `design-validation` diagnostics with severity "warning" for each
 * invalid color value found (not hex, not var(), not rgb/hsl).
 *
 * This function is cheap (regex-based) and does NOT run the full design
 * pipeline. It is the validation step that core's render() used to call
 * directly. Now hosts opt into design validation by importing this package.
 *
 * @param source - The raw Markdown source text.
 * @returns An array of design-validation diagnostics.
 */
export function scanDesignDoc(source: string): Diagnostic[] {
  const { body } = splitYamlFrontMatter(source);
  const diagnostics: Diagnostic[] = [];

  let match: RegExpExecArray | null;
  COLOR_LINE_RE.lastIndex = 0;
  match = COLOR_LINE_RE.exec(body);
  while (match !== null) {
    const name = match[1] ?? "";
    const value = (match[2] ?? "").trim();

    if (value) {
      if (
        !HEX_COLOR_RE.test(value) &&
        !VAR_REF_RE.test(value) &&
        !value.startsWith("rgb") &&
        !value.startsWith("hsl")
      ) {
        diagnostics.push({
          severity: "warning",
          message: `Invalid color value for ${name}: "${value}"`,
          code: "design-validation",
        });
      }
    }
    match = COLOR_LINE_RE.exec(body);
  }

  return diagnostics;
}
