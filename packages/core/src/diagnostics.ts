// @axis-love/core — diagnostics collection
//
// Collects diagnostic messages during rendering.
// Internal — not re-exported.

import type { Diagnostic } from "@axis-love/contracts";

/**
 * Diagnostic collector — accumulates diagnostics during the render pipeline.
 */
export class DiagnosticCollector {
  private readonly diagnostics: Diagnostic[] = [];

  add(diagnostic: Diagnostic): void {
    this.diagnostics.push(diagnostic);
  }

  unsafeUrl(url: string): void {
    this.diagnostics.push({
      severity: "warning",
      message: `Blocked unsafe URL: ${url}`,
      code: "unsafe-url",
    });
  }

  rawHtmlBlocked(tag: string): void {
    this.diagnostics.push({
      severity: "warning",
      message: `Blocked raw HTML element: <${tag}>`,
      code: "raw-html-blocked",
    });
  }

  get all(): readonly Diagnostic[] {
    return this.diagnostics;
  }
}
