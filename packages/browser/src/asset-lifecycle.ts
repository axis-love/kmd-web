// @axis-love/browser — asset URL lifecycle
//
// Manages object/blob URLs for resolved assets. Creates them via the
// host's AssetResolver, tracks active URLs, and revokes them at
// replacement and unmount to prevent memory leaks.
//
// Supports environments without AssetResolver — in that case, assets
// remain unresolved (their original src is left in the DOM).

import type { AssetReference, AssetRequest, ResolvedAsset } from "@axis-love/contracts";
import { RAW_IMAGE_SRC_ATTR } from "./dom-morph.js";
import type { AssetResolver } from "./index.js";

// ---------------------------------------------------------------------------
// AssetLifecycle
// ---------------------------------------------------------------------------

/**
 * Options for creating an asset lifecycle manager.
 */
export interface AssetLifecycleOptions {
  /** The host's asset resolver. If absent, assets remain unresolved. */
  readonly assetResolver?: AssetResolver;
  /** Base URL of the document, for resolving relative asset paths. */
  readonly documentBase?: string;
}

/**
 * Tracks active object/blob URLs for resolved assets and revokes them
 * when they are no longer needed (at replacement or unmount).
 *
 * Lifecycle:
 * 1. `resolveAssets(container, assets)` — resolves each asset reference
 *    via the AssetResolver, sets the resolved URL as the `src` attribute
 *    on the matching DOM element, and tracks the object URL.
 * 2. `revokeAll()` — revokes all tracked object URLs. Call on unmount
 *    or before re-resolving.
 *
 * When no AssetResolver is supplied, `resolveAssets` is a no-op.
 */
export class AssetLifecycle {
  private readonly assetResolver: AssetResolver | undefined;
  private readonly documentBase: string | undefined;
  private readonly activeUrls = new Map<string, string>(); // originalUrl → objectUrl

  constructor(options?: AssetLifecycleOptions) {
    this.assetResolver = options?.assetResolver;
    this.documentBase = options?.documentBase;
  }

  /** Whether asset resolution is available. */
  get resolverAvailable(): boolean {
    return this.assetResolver !== undefined;
  }

  /**
   * Resolve asset references in a DOM container. For each asset that
   * has not already been resolved, calls the AssetResolver and sets
   * the resolved URL on the matching element.
   *
   * Already-resolved assets (tracked in `activeUrls`) are skipped to
   * avoid re-creating object URLs.
   */
  async resolveAssets(container: HTMLElement, assets: readonly AssetReference[]): Promise<void> {
    if (!this.assetResolver || assets.length === 0) return;

    const images = container.querySelectorAll<HTMLImageElement>("img[src]");
    if (images.length === 0) return;

    const tasks: Promise<void>[] = [];

    for (const img of images) {
      const src = img.getAttribute("src");
      if (!src) continue;

      // Skip already-resolved URLs (http/https/data/blob)
      if (
        src.startsWith("http:") ||
        src.startsWith("https:") ||
        src.startsWith("data:") ||
        src.startsWith("blob:") ||
        src.startsWith("#")
      ) {
        continue;
      }

      // Skip if already tracked (resolved in a previous pass)
      if (this.activeUrls.has(src)) continue;

      // Find the matching asset reference
      const assetRef = assets.find((a) => a.url === src);
      const assetType = assetRef?.type ?? "image";

      const request: AssetRequest = {
        url: src,
        type: assetType,
        documentBase: this.documentBase,
      };

      tasks.push(
        this.assetResolver
          .resolveAsset(request)
          .then((resolved: ResolvedAsset) => {
            // Keep the original src around so DOM morphing can detect
            // already-resolved images and skip them.
            img.setAttribute(RAW_IMAGE_SRC_ATTR, src);
            img.src = resolved.url;
            this.activeUrls.set(src, resolved.url);
          })
          .catch(() => {
            // Leave the original src if resolution fails
          }),
      );
    }

    await Promise.all(tasks);
  }

  /**
   * Revoke all tracked object URLs. Call before re-resolving or on
   * unmount to prevent memory leaks.
   */
  revokeAll(): void {
    for (const [, objectUrl] of this.activeUrls) {
      // Only revoke blob: URLs — data: URLs don't need revocation
      if (objectUrl.startsWith("blob:")) {
        try {
          URL.revokeObjectURL(objectUrl);
        } catch {
          // Ignore — URL may already be revoked
        }
      }
    }
    this.activeUrls.clear();
  }

  /** Number of currently active (tracked) object URLs. */
  get activeCount(): number {
    return this.activeUrls.size;
  }
}
