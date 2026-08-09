// @axis-love/react
// React components: <MarkdownReader>, <DocumentShell>, and hooks.
// React and ReactDOM are peer dependencies — never bundled.
//
// This package wraps the browser runtime (BrowserReader from
// @axis-love/browser) in a thin React lifecycle. All DOM effects go
// through BrowserReader — React never directly mutates the rendered
// HTML container's content.

import "@axis-love/styles/styles.css";

import type { HostCapabilities } from "@axis-love/browser";
import {
  BrowserReader,
  findAnchorTarget,
  ScrollTracker,
  scrollContainerToTarget,
} from "@axis-love/browser";
import type { OutlineEntry, RenderOptions } from "@axis-love/contracts";
import type { FC, ReactNode } from "react";
import { useCallback, useEffect, useRef, useState } from "react";

export const REACT_PACKAGE_VERSION = "0.1.0-rc.1";

// ---------------------------------------------------------------------------
// SSR-safe layout effect
// ---------------------------------------------------------------------------

// SSR safety: useLayoutEffect is not safe during SSR (no `document`).
// All DOM operations in this package go through useEffect (which runs
// only in the browser) or BrowserReader (created inside useEffect).
// We do not use useLayoutEffect directly anywhere — React 19's
// useEffect is sufficient and SSR-safe.

// ---------------------------------------------------------------------------
// MarkdownReader
// ---------------------------------------------------------------------------

/**
 * Props for the MarkdownReader component.
 */
export interface MarkdownReaderProps {
  /** The Markdown source text to render. Never a file path. */
  readonly source: string;
  /** Render options passed to the core renderer. */
  readonly renderOptions?: RenderOptions;
  /** Host capabilities bundle (asset resolver, link handler, etc.). */
  readonly capabilities?: HostCapabilities;
  /** Additional CSS class name(s) applied to the root element. */
  readonly className?: string;
  /** Called when rendering fails with a non-recoverable error. */
  readonly onError?: (error: Error) => void;
  /** Called when the outline (heading tree) changes. */
  readonly onOutlineChange?: (outline: readonly OutlineEntry[]) => void;
  /** Called when the active heading (from scroll tracking) changes. */
  readonly onActiveHeadingChange?: (slug: string | undefined) => void;
  /** Called when a copy action succeeds (e.g. code block copy button). */
  readonly onCopy?: (message: string) => void;
}

/**
 * Renders Markdown source text as safe HTML inside a scoped reader.
 *
 * Wraps BrowserReader from @axis-love/browser. All DOM mutations go
 * through BrowserReader — React never writes to the rendered content
 * container directly (except for error/empty states which are React-owned).
 *
 * Lifecycle:
 * - Creates a BrowserReader on mount.
 * - Calls update() when source or renderOptions change.
 * - Disposes BrowserReader on unmount.
 *
 * States:
 * - Loading: first render in progress (container not yet populated).
 * - Error: render failure — shows error message with source.
 * - Empty: source is empty string — shows empty-state message.
 * - Content: rendered HTML is in the container (managed by BrowserReader).
 *
 * Multiple MarkdownReader instances on the same page operate
 * independently — each has its own BrowserReader, cache, and scroll tracker.
 */
export const MarkdownReader: FC<MarkdownReaderProps> = ({
  source,
  renderOptions,
  capabilities,
  className,
  onError,
  onOutlineChange,
  onActiveHeadingChange,
  onCopy,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const readerRef = useRef<BrowserReader | null>(null);
  const sourceRef = useRef(source);
  const renderOptionsRef = useRef(renderOptions);

  const [error, setError] = useState<Error | null>(null);
  const [isLoading, setIsLoading] = useState(source.length > 0);

  // Track whether the component is mounted to avoid setting state
  // after unmount (React 18+ warns about this).
  const mountedRef = useRef(true);

  // Stale-ref guards: the callbacks may change identity between renders
  // without the effect re-running (we only re-run on source/renderOptions).
  // Store the latest callbacks in refs so BrowserReader always calls
  // the current ones.
  const onErrorRef = useRef(onError);
  const onOutlineChangeRef = useRef(onOutlineChange);
  const onActiveHeadingChangeRef = useRef(onActiveHeadingChange);
  const onCopyRef = useRef(onCopy);
  onErrorRef.current = onError;
  onOutlineChangeRef.current = onOutlineChange;
  onActiveHeadingChangeRef.current = onActiveHeadingChange;
  onCopyRef.current = onCopy;

  // Create BrowserReader once on mount and dispose on unmount.
  // The reader is created with stable callbacks that read from refs.
  // `capabilities` is intentionally not a dependency — changing capabilities
  // requires remounting the component (creating a new BrowserReader).
  // biome-ignore lint/correctness/useExhaustiveDependencies: capabilities set at construction time only
  useEffect(() => {
    mountedRef.current = true;

    const container = containerRef.current;
    if (!container) return;

    const reader = new BrowserReader({
      container,
      capabilities,
      renderOptions: renderOptionsRef.current,
      onOutlineChange: (outline) => {
        if (mountedRef.current) {
          onOutlineChangeRef.current?.(outline);
        }
      },
      onActiveHeadingChange: (slug) => {
        if (mountedRef.current) {
          onActiveHeadingChangeRef.current?.(slug);
        }
      },
      onCopy: (message) => {
        if (mountedRef.current) {
          onCopyRef.current?.(message);
        }
      },
      onError: (err) => {
        if (mountedRef.current) {
          setError(err);
          setIsLoading(false);
          onErrorRef.current?.(err);
        }
      },
    });

    readerRef.current = reader;

    return () => {
      mountedRef.current = false;
      reader.dispose();
      readerRef.current = null;
    };
    // capabilities is intentionally not a dependency — changing capabilities
    // requires remounting the component (creating a new BrowserReader).
    // This matches the BrowserReader lifecycle: capabilities are set at
    // construction time.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Update the document when source or renderOptions change.
  useEffect(() => {
    const reader = readerRef.current;
    if (!reader) return;

    sourceRef.current = source;
    renderOptionsRef.current = renderOptions;

    // Empty source — show empty state, clear container.
    if (source === "") {
      setError(null);
      setIsLoading(false);
      // Clear the rendered content.
      if (containerRef.current) {
        containerRef.current.innerHTML = "";
      }
      onOutlineChangeRef.current?.([]);
      return;
    }

    setError(null);
    setIsLoading(true);

    let cancelled = false;

    reader
      .update(source)
      .then(() => {
        if (!cancelled && mountedRef.current) {
          setError(null);
          setIsLoading(false);
        }
      })
      .catch((err: unknown) => {
        // The BrowserReader's onError callback already handles error
        // state. The catch here is a safety net for any rejection that
        // escapes the reader's own error handling. We only set state,
        // not re-call onError (the reader's onError already did that).
        if (!cancelled && mountedRef.current) {
          const e = err instanceof Error ? err : new Error(String(err));
          setError(e);
          setIsLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [source, renderOptions]);

  // --- Render ---

  // The container div is ALWAYS rendered (even in error/empty/loading
  // states) so the BrowserReader has a stable container reference.
  // The error/empty/loading indicators are siblings, not replacements.
  return (
    <div className={`kmd-reader${className ? ` ${className}` : ""}`}>
      {isLoading && !error && source !== "" && (
        <div className="mdr-loading" aria-busy="true" aria-live="polite">
          <p>Loading…</p>
        </div>
      )}
      {error && (
        <div className="mdr-error">
          <h2>Render Error</h2>
          <p>{error.message}</p>
        </div>
      )}
      {source === "" && !error && <p className="mdr-empty">This document is empty.</p>}
      <div
        ref={containerRef}
        className="kmd-reader-content"
        hidden={isLoading || error !== null || source === ""}
      />
    </div>
  );
};

// ---------------------------------------------------------------------------
// DocumentShell
// ---------------------------------------------------------------------------

/**
 * Props for the DocumentShell component.
 */
export interface DocumentShellProps {
  /** The heading outline to render in the sidebar. */
  readonly outline: readonly OutlineEntry[];
  /** The slug of the currently active heading, or undefined. */
  readonly activeId?: string;
  /** The reader content to display in the content area. */
  readonly children: ReactNode;
  /** Called when an outline item is clicked with the heading slug. */
  readonly onAnchorClick?: (slug: string) => void;
  /** Additional CSS class name(s) applied to the root element. */
  readonly className?: string;
  /**
   * Initial outline visibility when the component owns the state
   * (uncontrolled mode). Defaults to `true`. Ignored when
   * `outlineVisible` is provided.
   */
  readonly defaultOutlineVisible?: boolean;
  /**
   * Outline visibility owned by the host (controlled mode). When this is
   * defined the component never changes visibility on its own — the toggle
   * reports the requested value through `onOutlineVisibleChange` and the
   * host decides.
   */
  readonly outlineVisible?: boolean;
  /**
   * Called with the requested visibility whenever the toggle is pressed, in
   * both controlled and uncontrolled mode.
   */
  readonly onOutlineVisibleChange?: (visible: boolean) => void;
}

/**
 * Maps a heading level (1-6) to a depth index (0-3) for outline indentation.
 */
function outlineDepth(level: number): 0 | 1 | 2 | 3 {
  if (level <= 1) return 0;
  if (level === 2) return 1;
  if (level === 3) return 2;
  return 3;
}

/**
 * Document layout with an outline sidebar and content area.
 *
 * Ported from kmd/src/reader/DocumentShell.tsx — no Tauri imports.
 * The outline sidebar can be toggled visible/hidden. Outline items
 * show depth indentation via the `data-depth` attribute. The active
 * heading is highlighted.
 *
 * Outline visibility follows the standard controlled/uncontrolled pattern:
 * pass nothing and the component owns the state (starting from
 * `defaultOutlineVisible`, default `true`); pass `outlineVisible` and the
 * host owns it, with the toggle reporting through `onOutlineVisibleChange`.
 * Hosts that render the shell on a small screen — where the CSS turns the
 * sidebar into an overlay — typically start it hidden.
 *
 * Accessibility:
 * - The outline navigation has `aria-label="Document outline"`.
 * - The toggle button has a descriptive `title`.
 * - Outline items are keyboard-focusable links with `href` (fragment).
 */
export const DocumentShell: FC<DocumentShellProps> = ({
  outline,
  activeId,
  children,
  onAnchorClick,
  className,
  defaultOutlineVisible = true,
  outlineVisible,
  onOutlineVisibleChange,
}) => {
  const [uncontrolledOutlineVisible, setUncontrolledOutlineVisible] =
    useState(defaultOutlineVisible);
  const docRef = useRef<HTMLElement>(null);

  const isControlled = outlineVisible !== undefined;
  const showOutline = isControlled ? outlineVisible : uncontrolledOutlineVisible;

  const handleToggleOutline = useCallback(() => {
    const next = !showOutline;
    if (!isControlled) {
      setUncontrolledOutlineVisible(next);
    }
    onOutlineVisibleChange?.(next);
  }, [isControlled, onOutlineVisibleChange, showOutline]);

  const handleOutlineClick = useCallback(
    (slug: string) => {
      if (onAnchorClick) {
        onAnchorClick(slug);
        return;
      }

      // Default: scroll to the heading within the doc container.
      if (!docRef.current) return;

      const target = findAnchorTarget(docRef.current, slug);
      if (target) {
        scrollContainerToTarget(docRef.current, target);
      }
    },
    [onAnchorClick],
  );

  return (
    <div className={`kmd-document-shell${className ? ` ${className}` : ""}`}>
      <nav
        className={`kmd-outline-sidebar${showOutline ? "" : " collapsed"}`}
        aria-label="Document outline"
      >
        <div className="kmd-outline-title">Outline</div>
        <ul className="kmd-outline-list">
          {outline.map((entry) => (
            <li key={entry.slug}>
              <a
                href={`#${entry.slug}`}
                className={`kmd-outline-item${entry.slug === activeId ? " active" : ""}`}
                data-depth={outlineDepth(entry.level)}
                onClick={(e) => {
                  e.preventDefault();
                  handleOutlineClick(entry.slug);
                }}
              >
                {entry.text}
              </a>
            </li>
          ))}
        </ul>
      </nav>
      <button
        className="kmd-outline-toggle"
        onClick={handleToggleOutline}
        title={showOutline ? "Hide outline" : "Show outline"}
        type="button"
        aria-expanded={showOutline}
        aria-label={showOutline ? "Hide outline" : "Show outline"}
      >
        {showOutline ? "◀" : "▶"}
      </button>
      <article ref={docRef} className="kmd-doc">
        <div className="kmd-content">{children}</div>
      </article>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Hooks
// ---------------------------------------------------------------------------

/**
 * Return type of useMarkdownReader.
 */
export interface UseMarkdownReaderResult {
  /** The rendered HTML string, or empty string if not yet rendered. */
  readonly html: string;
  /** The heading outline from the rendered document. */
  readonly outline: readonly OutlineEntry[];
  /** Error from the last render attempt, or null. */
  readonly error: Error | null;
  /** True while a render is in progress. */
  readonly isLoading: boolean;
  /** The slug of the active heading, or undefined. */
  readonly activeHeading: string | undefined;
}

/**
 * Hook that renders Markdown source text and returns the result.
 *
 * Uses BrowserReader internally. The hook manages the BrowserReader
 * lifecycle: creates on mount, updates on source change, disposes on
 * unmount. The rendered HTML is written to a container element that
 * the caller provides via a ref (or an internal one if not provided).
 *
 * This hook is for consumers who need the render state without the
 * full <MarkdownReader> component. The component is preferred for
 * most use cases.
 */
export function useMarkdownReader(
  source: string,
  options?: {
    readonly renderOptions?: RenderOptions;
    readonly capabilities?: HostCapabilities;
    readonly onOutlineChange?: (outline: readonly OutlineEntry[]) => void;
    readonly onActiveHeadingChange?: (slug: string | undefined) => void;
    readonly onCopy?: (message: string) => void;
  },
): UseMarkdownReaderResult {
  const containerRef = useRef<HTMLDivElement>(null);
  const readerRef = useRef<BrowserReader | null>(null);
  const mountedRef = useRef(true);

  const [html, setHtml] = useState("");
  const [outline, setOutline] = useState<readonly OutlineEntry[]>([]);
  const [error, setError] = useState<Error | null>(null);
  const [isLoading, setIsLoading] = useState(source.length > 0);
  const [activeHeading, setActiveHeading] = useState<string | undefined>(undefined);

  // Callback refs for stable reader creation
  const optsRef = useRef(options);
  optsRef.current = options;

  useEffect(() => {
    mountedRef.current = true;

    // Create a container element if none exists. This allows the hook
    // to be used without a ref — the container is internal.
    if (!containerRef.current) {
      containerRef.current = document.createElement("div");
    }
    const container = containerRef.current;

    const reader = new BrowserReader({
      container,
      capabilities: optsRef.current?.capabilities,
      renderOptions: optsRef.current?.renderOptions,
      onOutlineChange: (o) => {
        if (mountedRef.current) {
          setOutline(o);
          optsRef.current?.onOutlineChange?.(o);
        }
      },
      onActiveHeadingChange: (slug) => {
        if (mountedRef.current) {
          setActiveHeading(slug);
          optsRef.current?.onActiveHeadingChange?.(slug);
        }
      },
      onCopy: (message) => {
        if (mountedRef.current) {
          optsRef.current?.onCopy?.(message);
        }
      },
      onRendered: (result) => {
        if (mountedRef.current) {
          setHtml(result.html);
        }
      },
      onError: (err) => {
        if (mountedRef.current) {
          setError(err);
          setIsLoading(false);
        }
      },
    });

    readerRef.current = reader;

    return () => {
      mountedRef.current = false;
      reader.dispose();
      readerRef.current = null;
    };
  }, []);

  useEffect(() => {
    const reader = readerRef.current;
    if (!reader) return;

    if (source === "") {
      setHtml("");
      setOutline([]);
      setError(null);
      setIsLoading(false);
      if (containerRef.current) {
        containerRef.current.innerHTML = "";
      }
      return;
    }

    setError(null);
    setIsLoading(true);

    let cancelled = false;

    reader
      .update(source)
      .then(() => {
        if (!cancelled && mountedRef.current) {
          setError(null);
          setIsLoading(false);
        }
      })
      .catch((err: unknown) => {
        // BrowserReader's onError callback already handles error state.
        if (!cancelled && mountedRef.current) {
          const e = err instanceof Error ? err : new Error(String(err));
          setError(e);
          setIsLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [source]);

  return { html, outline, error, isLoading, activeHeading };
}

/**
 * Hook that tracks scroll position in a container and reports the
 * active heading slug based on the provided outline.
 *
 * Uses ScrollTracker from @axis-love/browser internally.
 * Cleans up all listeners on unmount.
 *
 * @param containerRef - Ref to the scrollable container element.
 * @param bodyRef - Ref to the element containing rendered content (headings).
 * @param outline - The heading outline to track.
 * @returns The slug of the active heading, or undefined.
 */
export function useScrollTracking(
  containerRef: React.RefObject<HTMLElement | null>,
  bodyRef: React.RefObject<HTMLElement | null>,
  outline: readonly OutlineEntry[],
): string | undefined {
  const [activeHeading, setActiveHeading] = useState<string | undefined>(undefined);
  const trackerRef = useRef<ScrollTracker | null>(null);
  const cleanupRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    const body = bodyRef.current;
    if (!container || !body || outline.length === 0) {
      cleanupRef.current?.();
      cleanupRef.current = null;
      trackerRef.current = null;
      setActiveHeading(undefined);
      return;
    }

    // Dispose previous tracker
    cleanupRef.current?.();
    cleanupRef.current = null;
    trackerRef.current = null;

    const slugs = outline.map((e) => e.slug);
    const tracker = new ScrollTracker(container, body, slugs, (slug) => {
      setActiveHeading(slug);
    });
    trackerRef.current = tracker;
    cleanupRef.current = tracker.start();

    return () => {
      cleanupRef.current?.();
      cleanupRef.current = null;
      trackerRef.current = null;
    };
  }, [containerRef, bodyRef, outline]);

  return activeHeading;
}

/**
 * Hook that manages outline sidebar visibility state.
 *
 * @param outline - The heading outline (used to auto-hide when empty).
 * @param initialVisible - Initial visibility, default true.
 * @returns A tuple of [visible, toggle, setVisible].
 */
export function useOutline(
  outline: readonly OutlineEntry[],
  initialVisible = true,
): [boolean, () => void, (visible: boolean) => void] {
  const [visible, setVisible] = useState(initialVisible);

  const toggle = useCallback(() => {
    setVisible((v) => !v);
  }, []);

  // The outline is accepted so consumers can auto-hide the sidebar when
  // the outline is empty. The hook returns the toggle for the consumer
  // to wire up to a button.
  void outline;

  return [visible, toggle, setVisible];
}

// ---------------------------------------------------------------------------
// Re-exports for convenience
// ---------------------------------------------------------------------------

export type { HostCapabilities } from "@axis-love/browser";
export type { OutlineEntry, RenderOptions } from "@axis-love/contracts";
