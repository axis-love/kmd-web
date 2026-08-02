// @axis-love/design — HTML export host integration
//
// HTML export is an EXPLICIT host integration, not automatic.
// The design package provides types and a builder function that hosts
// (browser, React) can use to generate a self-contained HTML catalog.
// The design package itself does NOT depend on React or the DOM —
// hosts provide the rendering context.

import type { DesignDocument } from "./ir.js";

/**
 * Options for building a design catalog HTML export.
 * The host provides CSS and theme context.
 */
export interface DesignCatalogHtmlOptions {
  /** Light or dark theme for the export. */
  readonly theme: "light" | "dark";
  /** Optional title override. Defaults to the design document's name. */
  readonly title?: string;
  /** CSS for the design catalog presentation. Host provides this. */
  readonly catalogCss?: string;
}

/**
 * Contract for an HTML export builder. Hosts implement this with their
 * own rendering technology (React renderToStaticMarkup, string templates, etc.).
 * The design package provides the data; the host provides the presentation.
 */
export interface DesignHtmlExportBuilder {
  /**
   * Build a self-contained HTML document from a DesignDocument.
   * @param doc - The processed design document.
   * @param options - Export options (theme, title, CSS).
   * @returns A complete HTML document string.
   */
  buildHtml(doc: DesignDocument, options: DesignCatalogHtmlOptions): string;
}

/**
 * Suggest a filename for a design catalog export.
 * Strips .md/.markdown extensions and appends .html.
 */
export function suggestDesignExportFilename(documentName: string | null): string {
  const raw = documentName?.trim() || "design-mode";
  const name = raw.replace(/\.(?:md|markdown)$/i, "");
  const safe = name
    // biome-ignore lint/suspicious/noControlCharactersInRegex: intentional — strips control chars from filenames
    .replace(/[<>:"/\\|?*\u0000-\u001F]/g, "-")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/[. ]+$/g, "");
  return ensureHtmlFilename(safe || "design-mode");
}

/**
 * Ensure a filename ends with .html (or .htm).
 */
export function ensureHtmlFilename(filename: string): string {
  return /\.(?:html|htm)$/i.test(filename) ? filename : `${filename}.html`;
}

/**
 * Escape HTML special characters in a string.
 */
export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
