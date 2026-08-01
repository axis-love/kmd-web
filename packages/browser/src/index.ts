// @axis-love/browser
// Browser runtime: DOM enhancement, worker bridge, cache, asset URL lifecycle.
// Consumes host capabilities instead of detecting Tauri.

export const BROWSER_VERSION = "0.1.0";

/**
 * Narrow host capability: resolve assets through the host.
 */
export interface AssetResolver {
  resolveAsset(request: { readonly url: string }): Promise<{ readonly url: string }>;
}

/**
 * Narrow host capability: handle link navigation.
 */
export interface LinkHandler {
  openExternal(url: URL): Promise<void>;
  openDocument(target: { readonly href: string }): Promise<void>;
}

/**
 * Narrow host capability: clipboard access.
 */
export interface ClipboardProvider {
  writeText(value: string): Promise<void>;
}
