// @axis-love/browser — link click interception
//
// Intercepts link clicks in rendered content and routes them through
// core's link classification (classifyLink from @axis-love/core). The
// browser runtime never re-classifies URLs — it delegates to core's
// security policy.
//
// Routing:
// - External links → LinkHandler.openExternal (default: rel="noopener
//   noreferrer", target="_blank", no click interception — host page's
//   default navigation applies)
// - Document links → LinkHandler.openDocument (default: in-page
//   navigation fallback)
// - Fragment links → scroll to anchor within the container
// - Mailto/tel links → LinkHandler.openExternal (these are safe schemes)
// - Blocked links → click is prevented, no handler is invoked

import type { DocumentTarget, LinkTarget } from "@axis-love/contracts";
import { classifyLink } from "@axis-love/core";
import { findAnchorTarget, scrollContainerToTarget } from "./anchor-navigation.js";
import type { LinkHandler } from "./index.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * Options for creating a link policy handler.
 */
export interface LinkPolicyOptions {
  /** The host's link handler. If absent, safe browser defaults apply. */
  readonly linkHandler?: LinkHandler;
  /** The scroll container for fragment navigation. Required for fragment links. */
  readonly scrollContainer?: HTMLElement;
  /** The content container where rendered HTML lives. Required for fragment links. */
  readonly contentContainer?: HTMLElement;
  /** Allowed link schemes. If omitted, core's defaults are used. */
  readonly allowedSchemes?: readonly string[];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Parse a fragment ID from a `#fragment` href. Returns the decoded
 * fragment without the leading `#`, or null if not a fragment link.
 */
function getFragmentId(href: string): string | null {
  const trimmed = href.trim();
  if (!trimmed.startsWith("#") || trimmed.length <= 1) return null;
  try {
    return decodeURIComponent(trimmed.slice(1));
  } catch {
    return trimmed.slice(1);
  }
}

/**
 * Parse an internal href into path and fragment parts.
 */
function parseInternalHref(href: string): { path: string; fragment: string | null } {
  const hashIndex = href.indexOf("#");
  const pathPart = hashIndex === -1 ? href : href.slice(0, hashIndex);
  const fragmentPart = hashIndex === -1 ? null : href.slice(hashIndex + 1);
  const decode = (value: string): string => {
    try {
      return decodeURIComponent(value);
    } catch {
      return value;
    }
  };
  return {
    path: decode(pathPart),
    fragment: fragmentPart ? decode(fragmentPart) : null,
  };
}

// ---------------------------------------------------------------------------
// LinkPolicy
// ---------------------------------------------------------------------------

/**
 * Manages link click interception for a rendered content container.
 *
 * Core classifies links; this handler routes classified links to the
 * appropriate host capability or browser default. Blocked links never
 * reach handlers — the click is prevented and nothing happens.
 */
export class LinkPolicy {
  private readonly linkHandler: LinkHandler | undefined;
  private readonly scrollContainer: HTMLElement | undefined;
  private readonly contentContainer: HTMLElement | undefined;
  private readonly allowedSchemes: ReadonlySet<string> | undefined;

  constructor(options: LinkPolicyOptions) {
    this.linkHandler = options.linkHandler;
    this.scrollContainer = options.scrollContainer;
    this.contentContainer = options.contentContainer;
    this.allowedSchemes = options.allowedSchemes ? new Set(options.allowedSchemes) : undefined;
  }

  /**
   * Classify a link href using core's classification. This is the
   * security boundary — the browser runtime never decides whether a URL
   * is safe; it delegates to core.
   */
  classify(href: string): LinkTarget {
    return classifyLink(href, this.allowedSchemes ?? new Set(["https", "http", "mailto", "tel"]));
  }

  /**
   * Create a click handler that intercepts link clicks in the rendered
   * content. Attach it to the content container.
   */
  createClickHandler(): (e: MouseEvent) => void {
    return (e: MouseEvent) => {
      const anchor = (e.target as HTMLElement).closest("a");
      if (!anchor) return;
      const href = anchor.getAttribute("href");
      if (!href) return;

      const target = this.classify(href);

      // Blocked links: prevent default, do nothing else
      if (target.kind === "blocked") {
        e.preventDefault();
        e.stopPropagation();
        return;
      }

      // Fragment links: scroll to anchor
      if (target.kind === "internal" && href.startsWith("#")) {
        e.preventDefault();
        e.stopPropagation();
        this.scrollToFragment(href);
        return;
      }

      // External links (including mailto, tel)
      if (target.kind === "external" || target.kind === "mailto" || target.kind === "tel") {
        e.preventDefault();
        e.stopPropagation();
        if (this.linkHandler) {
          void this.linkHandler.openExternal(new URL(target.resolvedUrl ?? href));
        } else {
          // Default: open in a new tab with noopener,noreferrer
          window.open(target.resolvedUrl ?? href, "_blank", "noopener,noreferrer");
        }
        return;
      }

      // Document links: route through LinkHandler.openDocument
      if (target.kind === "document") {
        e.preventDefault();
        e.stopPropagation();
        const { path, fragment } = parseInternalHref(href);
        const docTarget: DocumentTarget = {
          href: path,
          anchor: fragment ?? undefined,
        };
        if (this.linkHandler) {
          void this.linkHandler.openDocument(docTarget);
        } else {
          // Default: treat as in-page navigation (fragment scroll if anchor exists)
          if (fragment && this.contentContainer && this.scrollContainer) {
            this.scrollToFragment(`#${fragment}`);
          }
        }
        return;
      }

      // Internal non-fragment links: treat as document link
      if (target.kind === "internal") {
        e.preventDefault();
        e.stopPropagation();
        if (this.linkHandler) {
          const { path, fragment } = parseInternalHref(href);
          void this.linkHandler.openDocument({ href: path, anchor: fragment ?? undefined });
        }
      }
    };
  }

  /**
   * Attach the link click handler to a container element.
   * Returns a cleanup function that removes the handler.
   */
  attach(container: HTMLElement): () => void {
    const handler = this.createClickHandler();
    container.addEventListener("click", handler, true);
    return () => container.removeEventListener("click", handler, true);
  }

  // -----------------------------------------------------------------------
  // Private
  // -----------------------------------------------------------------------

  private scrollToFragment(href: string): void {
    const fragmentId = getFragmentId(href);
    if (!fragmentId || !this.contentContainer || !this.scrollContainer) return;

    const target = findAnchorTarget(this.contentContainer, fragmentId);
    if (target) {
      scrollContainerToTarget(this.scrollContainer, target);
    }
  }
}
