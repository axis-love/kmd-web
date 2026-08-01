// @axis-love/core — asset extraction
//
// Extracts media asset references (images, videos, audio) from the HAST tree
// after rendering. These are the raw URLs from the Markdown source —
// resolution is a host capability, not a core responsibility.
//
// Internal — not re-exported.

import type { AssetReference, AssetType } from "@axis-love/contracts";
import type { Element, Root as HastRoot } from "hast";
import { visit } from "unist-util-visit";

const ASSET_TAGS: ReadonlyMap<string, AssetType> = new Map([
  ["img", "image"],
  ["video", "video"],
  ["audio", "audio"],
  ["source", "other"],
]);

/**
 * Extract asset references from a HAST tree.
 * Returns the list of assets with their original source URLs.
 */
export function extractAssets(tree: HastRoot): AssetReference[] {
  const assets: AssetReference[] = [];

  visit(tree, "element", (node: Element) => {
    const tag = node.tagName;
    const type = ASSET_TAGS.get(tag);
    if (!type) return;

    const src = node.properties?.src;
    if (typeof src !== "string" || src === "") return;

    const alt = tag === "img" ? (node.properties?.alt as string | undefined) : undefined;

    assets.push({
      url: src,
      type,
      alt: alt || undefined,
    });
  });

  return assets;
}
