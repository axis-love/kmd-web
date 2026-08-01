// @axis-love/core
// DOM-free Markdown-to-safe-HTML rendering core.
// No DOM, React, Tauri, or Node I/O dependencies.

export const CORE_VERSION = "0.1.0";

/**
 * The serializable result of rendering Markdown to safe HTML.
 * As defined in the North Star document.
 */
export interface RenderResult {
  readonly html: string;
  readonly outline: readonly OutlineEntry[];
  readonly diagnostics: readonly Diagnostic[];
  readonly assets: readonly AssetReference[];
  readonly metadata: DocumentMetadata;
  readonly detectedFeatures: DetectedFeatures;
  readonly rendererVersion: string;
}

export interface OutlineEntry {
  readonly level: number;
  readonly text: string;
  readonly slug: string;
}

export interface Diagnostic {
  readonly severity: "info" | "warning" | "error";
  readonly message: string;
  readonly line?: number;
  readonly column?: number;
}

export interface AssetReference {
  readonly url: string;
  readonly type: "image" | "video" | "audio" | "other";
  readonly resolved?: string;
}

export interface DocumentMetadata {
  readonly title?: string;
  readonly description?: string;
  readonly lang?: string;
}

export interface DetectedFeatures {
  readonly hasMath: boolean;
  readonly hasMermaid: boolean;
  readonly hasDesignDoc: boolean;
  readonly hasCodeHighlighting: boolean;
  readonly hasTables: boolean;
  readonly hasTaskLists: boolean;
  readonly hasFootnotes: boolean;
  readonly hasAlerts: boolean;
}
