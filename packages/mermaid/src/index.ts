// @axis-love/mermaid
// Optional Mermaid diagram rendering integration.
// Lazy-loaded with timeouts and readable fallbacks.
//
// Design:
// - Core produces placeholders: <div class="mermaid-placeholder" data-mermaid-source="base64...">
// - This package decodes the base64 source and renders it with mermaid.js
// - Mermaid is loaded lazily only when placeholders are present
// - Safe config: securityLevel "strict", no external fetches
// - Timeout per diagram (default 10s) with readable source fallback
// - Errors produce a <pre class="mermaid-error"> with the original source
//
// Two entry points:
// 1. renderMermaidPlaceholders(container) — DOM-side rendering of existing placeholders
// 2. createMermaidRenderer() — factory for a stateful renderer (for testing)

import type { RenderResult } from "@axis-love/contracts";

// ---------------------------------------------------------------------------
// Version
// ---------------------------------------------------------------------------

export const MERMAID_VERSION = "0.1.0";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DEFAULT_RENDER_TIMEOUT_MS = 10_000;
const MAX_DIAGRAM_SOURCE_LENGTH = 50_000;
const SAFE_THEME = "default";

// Mermaid security levels — "strict" is the only safe option for untrusted input
const SAFE_SECURITY_LEVEL = "strict";

// ---------------------------------------------------------------------------
// Types (lazy — mermaid types are loaded at runtime)
// ---------------------------------------------------------------------------

type MermaidApi = {
  initialize: (config: Record<string, unknown>) => void;
  render: (id: string, text: string) => Promise<{ svg: string }>;
};

// ---------------------------------------------------------------------------
// Encoding utilities
// ---------------------------------------------------------------------------

/**
 * Base64-decode a string to UTF-8.
 * Works in both Node and browser environments (no Buffer dependency).
 */
function base64Decode(encoded: string): string {
  if (typeof globalThis.atob === "function") {
    const binary = globalThis.atob(encoded);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return new TextDecoder().decode(bytes);
  }
  // Manual base64 decoding for environments without atob
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
  let binary = "";
  let i = 0;
  while (i < encoded.length) {
    const a = chars.indexOf(encoded.charAt(i++));
    const b = chars.indexOf(encoded.charAt(i++));
    const c = chars.indexOf(encoded.charAt(i++));
    const d = chars.indexOf(encoded.charAt(i++));
    binary += String.fromCharCode((a << 2) | (b >> 4));
    if (c >= 0) binary += String.fromCharCode(((b & 15) << 4) | (c >> 2));
    if (d >= 0) binary += String.fromCharCode(((c & 3) << 6) | d);
  }
  const bytes = new Uint8Array(binary.length);
  for (let j = 0; j < binary.length; j++) {
    bytes[j] = binary.charCodeAt(j);
  }
  return new TextDecoder().decode(bytes);
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

// ---------------------------------------------------------------------------
// Fallback HTML generation
// ---------------------------------------------------------------------------

/**
 * Generate a readable fallback for a failed Mermaid diagram.
 * Shows the original source in a <pre> block with an error message.
 */
export function createMermaidFallback(source: string, error?: string): string {
  const truncatedSource = source.slice(0, MAX_DIAGRAM_SOURCE_LENGTH);
  const errorHtml = error ? escapeHtml(error) : "Unknown error";
  return `<pre class="mermaid-error"><code>${escapeHtml(truncatedSource)}</code></pre><p class="mermaid-error-msg">Diagram rendering failed: ${errorHtml}</p>`;
}

// ---------------------------------------------------------------------------
// Lazy mermaid loader
// ---------------------------------------------------------------------------

let mermaidCache: Promise<MermaidApi> | null = null;
let mermaidInitialized = false;

async function loadMermaid(): Promise<MermaidApi> {
  if (!mermaidCache) {
    mermaidCache = import("mermaid").then((m) => m.default as MermaidApi);
  }
  return mermaidCache;
}

function initializeMermaid(api: MermaidApi): void {
  if (mermaidInitialized) return;
  api.initialize({
    startOnLoad: false,
    securityLevel: SAFE_SECURITY_LEVEL,
    theme: SAFE_THEME,
  });
  mermaidInitialized = true;
}

// ---------------------------------------------------------------------------
// Public API — lifecycle management
// ---------------------------------------------------------------------------

/**
 * Reset the mermaid module state. Clears the cached instance and
 * initialization flag. Useful for testing.
 */
export function resetMermaidState(): void {
  mermaidCache = null;
  mermaidInitialized = false;
}

// ---------------------------------------------------------------------------
// Single diagram rendering
// ---------------------------------------------------------------------------

export interface MermaidRenderOptions {
  /** Timeout in milliseconds per diagram (default: 10000). */
  readonly timeoutMs?: number;
}

export interface MermaidRenderResult {
  readonly svg: string;
}

/**
 * Render a single Mermaid diagram source string to SVG.
 * Loads mermaid.js lazily on first call.
 *
 * @param source - The Mermaid diagram source text
 * @param options - Optional render options (timeout)
 * @returns The rendered SVG string
 * @throws Error if rendering fails or times out
 */
export async function renderMermaid(
  source: string,
  options?: MermaidRenderOptions,
): Promise<MermaidRenderResult> {
  if (!source || source.trim().length === 0) {
    throw new Error("Empty Mermaid source");
  }

  if (source.length > MAX_DIAGRAM_SOURCE_LENGTH) {
    throw new Error(
      `Mermaid source exceeds maximum length of ${MAX_DIAGRAM_SOURCE_LENGTH} characters`,
    );
  }

  const timeoutMs = options?.timeoutMs ?? DEFAULT_RENDER_TIMEOUT_MS;
  const api = await loadMermaid();
  initializeMermaid(api);

  const id = `mermaid-${Math.random().toString(36).slice(2, 10)}`;

  const renderPromise = api.render(id, source);

  if (timeoutMs > 0) {
    const result = await Promise.race([
      renderPromise,
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("Mermaid render timeout")), timeoutMs),
      ),
    ]);
    return { svg: result.svg };
  }

  const result = await renderPromise;
  return { svg: result.svg };
}

// ---------------------------------------------------------------------------
// DOM-side placeholder rendering
// ---------------------------------------------------------------------------

/**
 * Mermaid placeholder element selector.
 */
const MERMAID_PLACEHOLDER_SELECTOR = ".mermaid-placeholder";

/**
 * Find all Mermaid placeholders in a container and render their diagrams.
 *
 * This function is the DOM-side companion to core's mermaid placeholder.
 * Core produces <div class="mermaid-placeholder" data-mermaid-source="base64...">,
 * and this function decodes the source and renders the SVG.
 *
 * Each placeholder is rendered once (tracked via data-mermaid-rendered).
 * Failed renders show the original source as a readable fallback.
 *
 * @param container - The DOM container to search for placeholders
 * @param options - Optional render options (timeout)
 */
export async function renderMermaidPlaceholders(
  container: HTMLElement,
  options?: MermaidRenderOptions,
): Promise<void> {
  const placeholders = container.querySelectorAll<HTMLElement>(MERMAID_PLACEHOLDER_SELECTOR);
  if (placeholders.length === 0) return;

  const timeoutMs = options?.timeoutMs ?? DEFAULT_RENDER_TIMEOUT_MS;

  for (const placeholder of placeholders) {
    // Skip already-rendered placeholders (idempotent — safe on re-renders)
    if (placeholder.dataset.mermaidRendered === "true") continue;
    placeholder.dataset.mermaidRendered = "true";

    const encodedSource = placeholder.dataset.mermaidSource ?? "";
    const target = placeholder.querySelector<HTMLElement>(".mermaid-render-target");
    if (!target || !encodedSource) continue;

    let source: string;
    try {
      source = base64Decode(encodedSource);
    } catch {
      target.innerHTML = createMermaidFallback(encodedSource, "Invalid base64 encoding");
      continue;
    }

    try {
      const result = await renderMermaid(source, { timeoutMs });
      target.innerHTML = result.svg;
    } catch (err) {
      target.innerHTML = createMermaidFallback(
        source,
        err instanceof Error ? err.message : String(err),
      );
    }
  }
}

// ---------------------------------------------------------------------------
// RenderResult post-processing
// ---------------------------------------------------------------------------

/**
 * Check if a RenderResult's HTML contains Mermaid placeholders.
 * Used to decide whether to load the Mermaid package.
 */
export function hasMermaidPlaceholders(result: RenderResult): boolean {
  return result.html.includes('class="mermaid-placeholder"');
}
