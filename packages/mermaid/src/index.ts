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
// Theming (KWEB-055): mermaid bakes colors into the SVG, so the palette must
// be chosen before rendering and the diagram redrawn when the theme changes.
// ./theme resolves the palette from the live --kmd-* tokens; this module
// re-initializes mermaid whenever that palette changes, stamps each rendered
// placeholder with the palette it was drawn under, and watches the document
// so a live theme toggle never leaves a stale-colored SVG behind.
//
// Two entry points:
// 1. renderMermaidPlaceholders(container) — DOM-side rendering of existing placeholders
// 2. createMermaidRenderer() — factory for a stateful renderer (for testing)

import type { RenderResult } from "@axis-love/contracts";
import { type MermaidThemeConfig, resolveMermaidTheme } from "./theme";

export {
  detectDarkMode,
  type MermaidThemeConfig,
  parseCssColor,
  relativeLuminance,
  resolveMermaidTheme,
} from "./theme";

// ---------------------------------------------------------------------------
// Version
// ---------------------------------------------------------------------------

export const MERMAID_VERSION = "0.2.0";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DEFAULT_RENDER_TIMEOUT_MS = 10_000;
const MAX_DIAGRAM_SOURCE_LENGTH = 50_000;

// Mermaid security levels — "strict" is the only safe option for untrusted input
const SAFE_SECURITY_LEVEL = "strict";

/**
 * Attributes whose change on the container or any of its ancestors can flip
 * the active kmd theme. Mirrors the selectors in @axis-love/styles.
 */
const THEME_MUTATION_ATTRIBUTES = ["data-kmd-theme", "data-theme", "class", "style"];

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

/**
 * Id of the theme mermaid is currently initialized with, or null when it has
 * not been initialized yet. This replaces the old boolean once-flag: mermaid
 * must be re-initialized whenever the palette changes, or every diagram drawn
 * after a theme switch keeps the previous theme's colors.
 */
let initializedThemeId: string | null = null;

async function loadMermaid(): Promise<MermaidApi> {
  if (!mermaidCache) {
    mermaidCache = import("mermaid").then((m) => m.default as MermaidApi);
  }
  return mermaidCache;
}

function initializeMermaid(api: MermaidApi, theme: MermaidThemeConfig): void {
  if (initializedThemeId === theme.id) return;
  api.initialize({
    startOnLoad: false,
    securityLevel: SAFE_SECURITY_LEVEL,
    theme: theme.theme,
    ...(Object.keys(theme.themeVariables).length > 0
      ? { themeVariables: theme.themeVariables }
      : {}),
  });
  initializedThemeId = theme.id;
}

// ---------------------------------------------------------------------------
// Public API — lifecycle management
// ---------------------------------------------------------------------------

/**
 * Reset the mermaid module state. Clears the cached instance, the applied
 * theme, and every active theme watcher. Useful for testing and teardown.
 */
export function resetMermaidState(): void {
  mermaidCache = null;
  initializedThemeId = null;
  renderQueue = Promise.resolve();
  for (const dispose of [...activeThemeWatchers]) {
    dispose();
  }
  activeThemeWatchers.clear();
}

// ---------------------------------------------------------------------------
// Single diagram rendering
// ---------------------------------------------------------------------------

export interface MermaidRenderOptions {
  /** Timeout in milliseconds per diagram (default: 10000). */
  readonly timeoutMs?: number;
  /**
   * Element whose computed --kmd-* tokens define the diagram palette
   * (default: `document.documentElement`). Pass the reader container when the
   * host themes a subtree rather than the whole page.
   */
  readonly themeScope?: Element | null;
  /**
   * Pre-resolved palette. Overrides `themeScope`. Mainly used internally so a
   * batch of placeholders shares one resolution, and by hosts that pin a theme.
   */
  readonly theme?: MermaidThemeConfig;
}

export interface MermaidPlaceholderOptions extends MermaidRenderOptions {
  /**
   * Keep watching the document and re-render these placeholders when the kmd
   * theme changes. Defaults to true, except when `theme` pins a palette. Set
   * false for one-shot rendering — for example when the host drives its own
   * re-render on theme change.
   */
  readonly watchTheme?: boolean;
}

export interface MermaidRenderResult {
  readonly svg: string;
}

/**
 * Render a single Mermaid diagram source string to SVG.
 * Loads mermaid.js lazily on first call.
 *
 * The palette is resolved from the live --kmd-* tokens (see `themeScope`), and
 * mermaid is re-initialized whenever that palette differs from the one it
 * currently holds.
 *
 * @param source - The Mermaid diagram source text
 * @param options - Optional render options (timeout, theme scope or palette)
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
  const theme = options?.theme ?? resolveMermaidTheme(options?.themeScope);
  const api = await loadMermaid();

  // Mermaid holds one global configuration, so initialize + render must run
  // as an atomic pair: two containers with different palettes rendering
  // concurrently could otherwise re-initialize between another render's
  // initialize and its render, baking the wrong palette into the SVG.
  const result = await enqueueRender(() => {
    initializeMermaid(api, theme);

    const id = `mermaid-${Math.random().toString(36).slice(2, 10)}`;
    const renderPromise = api.render(id, source);

    if (timeoutMs > 0) {
      return Promise.race([
        renderPromise,
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error("Mermaid render timeout")), timeoutMs),
        ),
      ]);
    }
    return renderPromise;
  });
  return { svg: result.svg };
}

/**
 * Serialize initialize+render pairs. The timeout clock starts when a task
 * starts, not when it is enqueued, so a slow diagram ahead in the queue
 * cannot burn another diagram's budget.
 */
let renderQueue: Promise<unknown> = Promise.resolve();

function enqueueRender<T>(task: () => Promise<T>): Promise<T> {
  const run = renderQueue.then(task);
  renderQueue = run.catch(() => {});
  return run;
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
 * Each placeholder is rendered once *per theme*: data-mermaid-rendered marks it
 * as drawn and data-mermaid-theme records which palette it was drawn under, so
 * a call after a theme switch redraws exactly the diagrams that went stale.
 * Failed renders show the original source as a readable fallback.
 *
 * Unless `watchTheme: false` is passed, the container is also watched for
 * theme changes and re-rendered automatically — a live toggle in the host
 * needs no cooperation from the caller.
 *
 * @param container - The DOM container to search for placeholders
 * @param options - Optional render options (timeout, theme scope, theme watching)
 */
export async function renderMermaidPlaceholders(
  container: HTMLElement,
  options?: MermaidPlaceholderOptions,
): Promise<void> {
  const placeholders = container.querySelectorAll<HTMLElement>(MERMAID_PLACEHOLDER_SELECTOR);
  if (placeholders.length === 0) return;

  const timeoutMs = options?.timeoutMs ?? DEFAULT_RENDER_TIMEOUT_MS;
  // Resolve once for the whole batch so every diagram in a pass agrees on the
  // palette even if the host toggles the theme midway through.
  const theme = options?.theme ?? resolveMermaidTheme(options?.themeScope ?? container);

  // A caller that pins an explicit palette owns it — don't second-guess them
  // by re-resolving from the DOM later.
  if (options?.watchTheme ?? options?.theme === undefined) {
    watchMermaidTheme(container, options);
  }

  for (const placeholder of placeholders) {
    // Skip placeholders already drawn under this exact palette (idempotent —
    // safe on re-renders). A different palette means the SVG is stale.
    if (
      placeholder.dataset.mermaidRendered === "true" &&
      placeholder.dataset.mermaidTheme === theme.id
    ) {
      continue;
    }
    placeholder.dataset.mermaidRendered = "true";
    placeholder.dataset.mermaidTheme = theme.id;

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
      const result = await renderMermaid(source, { timeoutMs, theme });
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
// Live theme switching
// ---------------------------------------------------------------------------

/**
 * Disposers for every container currently being watched, so a container is
 * never watched twice and resetMermaidState can tear all of them down.
 */
const themeWatchers = new WeakMap<HTMLElement, () => void>();
const activeThemeWatchers = new Set<() => void>();

type ObserverLike = {
  observe: (target: Element, options: Record<string, unknown>) => void;
  disconnect: () => void;
};

type MediaQueryLike = {
  matches: boolean;
  addEventListener?: (type: "change", listener: () => void) => void;
  removeEventListener?: (type: "change", listener: () => void) => void;
};

type WatchWindow = {
  MutationObserver?: new (callback: () => void) => ObserverLike;
  matchMedia?: (query: string) => MediaQueryLike;
};

/**
 * Re-render a container's diagrams whenever the active kmd theme changes.
 *
 * Theme changes arrive two ways, and both are watched: a host flipping a
 * theme attribute or class on the container or any ancestor, and the OS
 * color-scheme preference changing while no explicit theme is set.
 *
 * Idempotent per container. Returns a disposer; the watcher also disposes
 * itself once the container leaves the document.
 *
 * @returns A function that stops watching. Safe to call more than once.
 */
export function watchMermaidTheme(
  container: HTMLElement,
  options?: MermaidRenderOptions,
): () => void {
  const existing = themeWatchers.get(container);
  if (existing) return existing;

  const view = container.ownerDocument?.defaultView as WatchWindow | null | undefined;
  if (!view || typeof view.MutationObserver !== "function") {
    // No DOM observation available (SSR, minimal test DOM) — nothing to watch.
    return () => {};
  }

  const scope = options?.themeScope ?? container;
  let lastThemeId = resolveMermaidTheme(scope).id;
  let disposed = false;
  // Re-renders are serialized: two toggles in quick succession must not
  // interleave, or a placeholder can end up carrying the older theme's SVG.
  let pending: Promise<void> = Promise.resolve();

  const dispose = (): void => {
    if (disposed) return;
    disposed = true;
    observer.disconnect();
    media?.removeEventListener?.("change", onChange);
    themeWatchers.delete(container);
    activeThemeWatchers.delete(dispose);
  };

  const onChange = (): void => {
    if (disposed) return;
    // A detached container can never change theme again, and keeping the
    // observer alive would keep the detached subtree alive with it.
    if (container.isConnected === false) {
      dispose();
      return;
    }
    const nextThemeId = resolveMermaidTheme(scope).id;
    if (nextThemeId === lastThemeId) return;
    lastThemeId = nextThemeId;
    pending = pending
      .then(() =>
        renderMermaidPlaceholders(container, { ...options, theme: undefined, watchTheme: false }),
      )
      .catch(() => {
        // renderMermaidPlaceholders already writes a readable fallback into
        // each failing target; nothing further to do here.
      });
  };

  const observer = new view.MutationObserver(onChange);
  // Custom properties inherit, so only the container and its ancestors can
  // change its palette. Watching that chain is both precise and cheap.
  for (let element: Element | null = container; element; element = element.parentElement) {
    observer.observe(element, {
      attributes: true,
      attributeFilter: THEME_MUTATION_ATTRIBUTES,
    });
  }

  let media: MediaQueryLike | null = null;
  if (typeof view.matchMedia === "function") {
    try {
      media = view.matchMedia("(prefers-color-scheme: dark)");
      media.addEventListener?.("change", onChange);
    } catch {
      media = null;
    }
  }

  themeWatchers.set(container, dispose);
  activeThemeWatchers.add(dispose);
  return dispose;
}

/**
 * Stop watching a container for theme changes, if it is being watched.
 */
export function stopMermaidThemeWatch(container: HTMLElement): void {
  themeWatchers.get(container)?.();
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
