// @axis-love/browser — code copy enhancement
//
// Wires copy button click handlers in the rendered DOM. Uses the host's
// ClipboardProvider if supplied; falls back to navigator.clipboard.writeText
// in secure contexts. When clipboard is unavailable, copy controls are
// hidden (their click handlers are never registered).

import type { ClipboardProvider } from "./index.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * Callback for copy result notifications.
 * Receives a message string (e.g. "Copied to clipboard" or "Copy failed").
 */
export type CopyNotifier = (message: string) => void;

// ---------------------------------------------------------------------------
// Internal state key
// ---------------------------------------------------------------------------

const HANDLER_KEY = "__kmdCodeClickHandler";

// ---------------------------------------------------------------------------
// CodeCopyEnhancer
// ---------------------------------------------------------------------------

/**
 * Options for creating a code copy enhancer.
 */
export interface CodeCopyOptions {
  /** Host clipboard provider. If absent, falls back to navigator.clipboard. */
  readonly clipboardProvider?: ClipboardProvider;
  /** Called with status messages (e.g. "Copied to clipboard"). */
  readonly onCopy?: CopyNotifier;
}

/**
 * Manages code copy click handlers for a container element.
 *
 * When clipboard is unavailable (no ClipboardProvider and no
 * navigator.clipboard, or not in a secure context), copy controls are
 * hidden by removing them from the DOM.
 */
export class CodeCopyEnhancer {
  private readonly clipboardProvider: ClipboardProvider | undefined;
  private readonly onCopy: CopyNotifier | undefined;

  constructor(options?: CodeCopyOptions) {
    this.clipboardProvider = options?.clipboardProvider;
    this.onCopy = options?.onCopy;
  }

  /** Whether clipboard is available in the current environment. */
  get clipboardAvailable(): boolean {
    if (this.clipboardProvider) return true;
    return (
      typeof navigator !== "undefined" &&
      !!navigator.clipboard &&
      typeof window !== "undefined" &&
      window.isSecureContext
    );
  }

  /**
   * Attach copy click handlers to the container. If clipboard is
   * unavailable, copy controls are hidden.
   */
  attach(container: HTMLElement): void {
    // Remove any existing handler first (idempotent attach)
    this.detach(container);

    if (!this.clipboardAvailable) {
      this.hideCopyControls(container);
      return;
    }

    const handleClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;

      const copyButton = target.closest(".code-copy-button");
      if (copyButton) {
        e.stopPropagation();
        e.preventDefault();
        const pre = copyButton.closest("pre");
        if (pre) {
          const code = pre.querySelector("code");
          // For Shiki blocks, the <code> element may have empty text content
          // if the language grammar didn't load. Fall back to pre.textContent.
          const text = code?.textContent?.trim() ? code.textContent : (pre.textContent ?? "");
          if (text.trim()) {
            void this.copy(text);
          }
        }
        return;
      }

      const span = target.closest("pre code span.shiki-token");
      if (span) {
        e.stopPropagation();
        e.preventDefault();
        const text = span.textContent ?? "";
        if (text.trim()) {
          void this.copy(text);
        }
        return;
      }

      const inlineCode = target.closest(
        "p code, li code, td code, h1 code, h2 code, h3 code, h4 code, h5 code, h6 code",
      );
      if (inlineCode) {
        e.stopPropagation();
        e.preventDefault();
        const text = inlineCode.textContent ?? "";
        if (text.trim()) {
          void this.copy(text);
        }
      }
    };

    container.addEventListener("click", handleClick);
    // Store handler for later removal. Using a typed accessor.
    (container as unknown as Record<string, unknown>)[HANDLER_KEY] = handleClick;
  }

  /** Remove the copy click handler from the container. */
  detach(container: HTMLElement): void {
    const handler = (container as unknown as Record<string, unknown>)[HANDLER_KEY];
    if (typeof handler === "function") {
      container.removeEventListener("click", handler as EventListener);
      delete (container as unknown as Record<string, unknown>)[HANDLER_KEY];
    }
  }

  // -----------------------------------------------------------------------
  // Private
  // -----------------------------------------------------------------------

  private hideCopyControls(container: HTMLElement): void {
    const controls = container.querySelectorAll(".code-copy-button");
    for (const control of controls) {
      control.remove();
    }
  }

  private async copy(text: string): Promise<void> {
    try {
      if (this.clipboardProvider) {
        await this.clipboardProvider.writeText(text);
      } else if (navigator.clipboard) {
        await navigator.clipboard.writeText(text);
      } else {
        this.onCopy?.("Copy failed: clipboard unavailable");
        return;
      }
      this.onCopy?.("Copied to clipboard");
    } catch {
      // Last-resort: execCommand fallback
      if (this.fallbackCopy(text)) {
        this.onCopy?.("Copied to clipboard");
      } else {
        this.onCopy?.("Copy failed");
      }
    }
  }

  private fallbackCopy(text: string): boolean {
    if (typeof document === "undefined") return false;
    try {
      const textarea = document.createElement("textarea");
      textarea.value = text;
      textarea.style.position = "fixed";
      textarea.style.opacity = "0";
      document.body.appendChild(textarea);
      textarea.select();
      const ok = document.execCommand("copy");
      document.body.removeChild(textarea);
      return ok;
    } catch {
      return false;
    }
  }
}
