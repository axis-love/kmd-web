// @axis-love/browser — DOM morphing
//
// Efficiently replaces rendered HTML in a container by diffing top-level
// blocks and swapping only those that changed. This avoids full
// innerHTML replacement (which causes image re-decode and document flash)
// when a full parse arrives after a quick parse.
//
// Preserves authored source identity (data attributes) so that
// already-resolved images are not needlessly replaced.

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Attribute where the original Markdown `src` is kept once an image has
 * been resolved to an inline data/blob URL. Used by the morph algorithm
 * to skip replacing an already-resolved image whose raw src matches. */
export const RAW_IMAGE_SRC_ATTR = "data-kmd-raw-src";

const COPY_TITLE = "Click to copy";

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Clone a live block and undo in-place enhancements (resolved image
 * sources, copy-hint titles) so it can be compared against freshly
 * parsed HTML for the same Markdown.
 */
function normalizedClone(node: Element): Element {
  const clone = node.cloneNode(true) as Element;

  const images = clone.querySelectorAll(`img[${RAW_IMAGE_SRC_ATTR}]`);
  for (const img of images) {
    const rawSrc = img.getAttribute(RAW_IMAGE_SRC_ATTR);
    if (rawSrc !== null) {
      img.setAttribute("src", rawSrc);
    }
    img.removeAttribute(RAW_IMAGE_SRC_ATTR);
  }

  const titled = clone.querySelectorAll("code[title], code span[title]");
  for (const el of titled) {
    if (el.getAttribute("title") === COPY_TITLE) {
      el.removeAttribute("title");
    }
  }

  return clone;
}

function nodesEquivalent(liveNode: Node, nextNode: Node): boolean {
  if (liveNode.isEqualNode(nextNode)) return true;
  if (liveNode.nodeType !== Node.ELEMENT_NODE || nextNode.nodeType !== Node.ELEMENT_NODE) {
    return false;
  }

  return normalizedClone(liveNode as Element).isEqualNode(nextNode);
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Update `container` children in place to match `nextHtml`, replacing
 * only the blocks that differ. Returns `true` when anything changed.
 *
 * Handles edge cases:
 * - Empty `nextHtml` clears the container.
 * - Identical content produces no changes (returns false).
 * - Resolved images (with `data-kmd-raw-src`) are treated as equal to
 *   their raw source form.
 * - Copy-hint `title` attributes are ignored during comparison.
 */
export function morphMarkdownBody(container: HTMLElement, nextHtml: string): boolean {
  const template = container.ownerDocument.createElement("template");
  template.innerHTML = nextHtml;

  const liveNodes = Array.from(container.childNodes);
  const nextNodes = Array.from(template.content.childNodes);
  let changed = false;

  const max = Math.max(liveNodes.length, nextNodes.length);
  for (let i = 0; i < max; i++) {
    const liveNode = liveNodes[i];
    const nextNode = nextNodes[i];

    if (liveNode === undefined && nextNode !== undefined) {
      container.appendChild(nextNode);
      changed = true;
      continue;
    }

    if (liveNode !== undefined && nextNode === undefined) {
      container.removeChild(liveNode);
      changed = true;
      continue;
    }

    if (liveNode === undefined || nextNode === undefined) continue;

    if (!nodesEquivalent(liveNode, nextNode)) {
      container.replaceChild(nextNode, liveNode);
      changed = true;
    }
  }

  return changed;
}
