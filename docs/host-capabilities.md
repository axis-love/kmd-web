# Host Capabilities

kmd-web's browser runtime (`@axis-love/browser`) consumes narrow host capabilities instead of detecting a specific platform (no Tauri detection, no iOS detection). Hosts implement only the capabilities they need and pass them to `BrowserReader` or `MarkdownReader`.

## Design principle

**Core classifies actions; capabilities only carry out already-classified actions.**

The security policy lives inside `@axis-love/core`. Core classifies link targets, validates URL schemes, and decides whether an action is safe. Host capabilities receive already-classified, already-validated actions — they never re-validate URLs or decide safety. This prevents host adapters from bypassing core security policy.

## The four interfaces

### AssetResolver

Resolves asset URLs (images, video, audio, other) through the host.

```typescript
export interface AssetResolver {
  resolveAsset(request: AssetRequest): Promise<ResolvedAsset>;
}
```

**Default behavior when absent**: The browser runtime does not load unresolved assets. Local relative assets remain unresolved (no `src` attribute set), and remote assets follow the `allowRemoteImages` security policy.

### LinkHandler

Handles link navigation through the host.

```typescript
export interface LinkHandler {
  openExternal(url: URL): Promise<void>;
  openDocument(target: DocumentTarget): Promise<void>;
}
```

**Default behavior when absent**:
- `openExternal`: External links are rendered with `rel="noopener noreferrer"` and `target="_blank"` in the HTML. The browser runtime's `LinkPolicy` intercepts clicks and opens them with `window.open(url, "_blank", "noopener,noreferrer")`.
- `openDocument`: Document links fall back to in-page navigation (treated as `internal` — fragment scroll if an anchor exists).

### ClipboardProvider

Provides clipboard write access through the host.

```typescript
export interface ClipboardProvider {
  writeText(value: string): Promise<void>;
}
```

**Default behavior when absent**: The browser runtime uses `navigator.clipboard.writeText` if available (requires a secure context — `window.isSecureContext === true`). If the Web Clipboard API is unavailable, copy controls are hidden (removed from the DOM). The `CodeCopyEnhancer` also has a `document.execCommand("copy")` fallback as a last resort.

### WorkerFactory

Factory for creating render workers to offload rendering off the main thread.

```typescript
export interface WorkerFactory {
  createWorker(): {
    postMessage(message: WorkerRenderRequest): void;
    addEventListener(
      type: "message",
      listener: (event: MessageEvent<WorkerRenderResponse>) => void,
    ): void;
    addEventListener(type: "error", listener: (event: ErrorEvent) => void): void;
    terminate(): void;
  };
}
```

**Default behavior when absent**: All rendering runs on the main thread via `render()` from `@axis-love/core`. Small documents (below 4,096 characters — `mainThreadThreshold`) always use the main thread regardless, because worker overhead is not worth it for small inputs.

If a worker render fails (worker error event), the `WorkerBridge` automatically falls back to main-thread rendering.

## HostCapabilities bundle

All four capabilities are bundled into a single optional object. **Every field is optional** — implement only what you need:

```typescript
export interface HostCapabilities {
  readonly assetResolver?: AssetResolver;
  readonly linkHandler?: LinkHandler;
  readonly clipboardProvider?: ClipboardProvider;
  readonly workerFactory?: WorkerFactory;
}
```

This object is intentionally narrow — each capability is a separate interface to prevent a single growing adapter object. Hosts implement only the capabilities they need.

## Types

### AssetRequest

```typescript
export interface AssetRequest {
  readonly url: string;          // Original URL from Markdown source (may be relative)
  readonly type: AssetType;      // "image" | "video" | "audio" | "other"
  readonly documentBase?: string; // Base URL of the document (for resolving relative paths)
}
```

### ResolvedAsset

```typescript
export interface ResolvedAsset {
  readonly url: string;          // Safe, loadable URL (blob:, data:, or https:)
  readonly originalUrl: string;  // Source URL before resolution
  readonly cached?: boolean;     // True if served from cache without network/filesystem round-trip
}
```

`url` must not be `javascript:`, `vbscript:`, `file:`, or any unknown scheme. For local assets resolved through a native backend, this is typically a `blob:` or `data:` URL. For allowed remote assets, it is the original HTTPS URL.

### DocumentTarget

```typescript
export interface DocumentTarget {
  readonly href: string;    // Resolved path or URL (never javascript: or unsafe scheme)
  readonly anchor?: string;  // Fragment identifier (without #) within the target document
  readonly title?: string;   // Human-readable label for the target
}
```

### WorkerRenderRequest / WorkerRenderResponse

```typescript
export interface WorkerRenderRequest {
  readonly id: number;
  readonly source: string;
  readonly options?: RenderOptions;
}

export type WorkerRenderResponse =
  | { readonly type: "result"; readonly id: number; readonly result: RenderResult; }
  | { readonly type: "error"; readonly id: number; readonly error: string; };
```

## How capabilities are consumed

`BrowserReader` (in `@axis-love/browser/src/reader-runtime.ts`) consumes `HostCapabilities` at construction time:

```typescript
const reader = new BrowserReader({
  container: myContainer,
  capabilities: {
    assetResolver: myAssetResolver,
    linkHandler: myLinkHandler,
    clipboardProvider: myClipboardProvider,
    workerFactory: myWorkerFactory,
  },
  renderOptions: { /* ... */ },
});
```

Each capability is passed to the relevant internal module:

| Capability | Consumer module |
|---|---|
| `assetResolver` | `AssetLifecycle` — resolves `<img src>` URLs in the rendered DOM |
| `linkHandler` | `LinkPolicy` — routes classified link clicks to the host |
| `clipboardProvider` | `CodeCopyEnhancer` — writes code to clipboard on copy button click |
| `workerFactory` | `WorkerBridge` — creates a worker for off-main-thread rendering |

With React:

```tsx
import { MarkdownReader } from "@axis-love/react";

<MarkdownReader
  source={markdown}
  capabilities={{
    assetResolver: myAssetResolver,
    linkHandler: myLinkHandler,
    clipboardProvider: myClipboardProvider,
    workerFactory: myWorkerFactory,
  }}
/>
```

**Note**: Capabilities are set at construction time. Changing capabilities requires remounting the component (creating a new `BrowserReader`).

## Implementation guide

### Implementing AssetResolver

```typescript
import type { AssetResolver } from "@axis-love/browser";
import type { AssetRequest, ResolvedAsset } from "@axis-love/contracts";

// Example: Tauri desktop — resolve local file paths to blob URLs
class TauriAssetResolver implements AssetResolver {
  async resolveAsset(request: AssetRequest): Promise<ResolvedAsset> {
    const { url, type, documentBase } = request;

    // Resolve relative URL against document base
    const resolved = documentBase
      ? new URL(url, documentBase).pathname
      : url;

    // Read file via Tauri backend, create blob URL
    const bytes = await readFileFromBackend(resolved);
    const blob = new Blob([bytes], { type: guessMime(resolved) });
    const blobUrl = URL.createObjectURL(blob);

    return {
      url: blobUrl,
      originalUrl: url,
      cached: false,
    };
  }
}
```

```typescript
// Example: iOS — resolve bundled assets
class IosAssetResolver implements AssetResolver {
  async resolveAsset(request: AssetRequest): Promise<ResolvedAsset> {
    // Resolve from app bundle
    const bundlePath = resolveBundlePath(request.url);
    return {
      url: bundlePath,
      originalUrl: request.url,
      cached: true,
    };
  }
}
```

### Implementing LinkHandler

```typescript
import type { LinkHandler } from "@axis-love/browser";
import type { DocumentTarget } from "@axis-love/contracts";

// Example: Tauri desktop
class TauriLinkHandler implements LinkHandler {
  async openExternal(url: URL): Promise<void> {
    // Open in the system browser (not the WebView)
    await window.__TAURI__.shell.open(url.toString());
  }

  async openDocument(target: DocumentTarget): Promise<void> {
    // Open another Markdown document in the app
    await loadDocument(target.href, target.anchor);
  }
}
```

```typescript
// Example: iOS
class IosLinkHandler implements LinkHandler {
  async openExternal(url: URL): Promise<void> {
    // Open in SFSafariViewController or system browser
    openInSafariViewController(url.toString());
  }

  async openDocument(target: DocumentTarget): Promise<void> {
    // Open another document in the app
    await loadDocument(target.href, target.anchor);
  }
}
```

### Implementing ClipboardProvider

```typescript
import type { ClipboardProvider } from "@axis-love/browser";

// Example: Tauri desktop
class TauriClipboardProvider implements ClipboardProvider {
  async writeText(value: string): Promise<void> {
    await window.__TAURI__.clipboard.writeText(value);
  }
}
```

```typescript
// Example: iOS
class IosClipboardProvider implements ClipboardProvider {
  async writeText(value: string): Promise<void> {
    UIPasteboard.general.string = value;
  }
}
```

### Implementing WorkerFactory

```typescript
import type { WorkerFactory } from "@axis-love/browser";

// Example: Web Worker from a URL
class WebWorkerFactory implements WorkerFactory {
  createWorker() {
    const worker = new Worker(
      new URL("./render-worker.js", import.meta.url),
      { type: "module" }
    );
    return worker;
  }
}
```

```typescript
// Example: Tauri — create worker from a Tauri-compatible URL
class TauriWorkerFactory implements WorkerFactory {
  createWorker() {
    // Tauri may need a custom worker URL scheme
    const worker = new Worker(
      new URL("./render-worker.js", window.__TAURI__.webpackAssetUrl),
      { type: "module" }
    );
    return worker;
  }
}
```

```typescript
// Example: iOS — WorkerFactory may not be available
// Do not provide a WorkerFactory. BrowserReader falls back to main-thread rendering.
const reader = new BrowserReader({
  container,
  capabilities: {
    // No workerFactory — main-thread rendering is used
    assetResolver: iosAssetResolver,
    linkHandler: iosLinkHandler,
    clipboardProvider: iosClipboardProvider,
  },
});
```

## Security

**Capabilities never re-validate URLs or decide safety.**

- `AssetResolver.resolveAsset` receives an `AssetRequest` with a `url` that has already passed core's `isSafeUrl()` validation. The resolver should not re-check the scheme — it should resolve the URL within its allowed document root or asset policy.
- `LinkHandler.openExternal` receives a `URL` that core has already classified as `external` (or `mailto`/`tel`). The handler should not re-validate the scheme — it should open the URL in the OS handler.
- `LinkHandler.openDocument` receives a `DocumentTarget` that core has already classified as `document`. The `href` is never a `javascript:` or other unsafe scheme.
- `ClipboardProvider.writeText` receives the text to copy. No validation is needed — the text comes from the rendered content (code blocks, inline code) and is safe to write to the clipboard.
- `WorkerFactory.createWorker` creates a worker for rendering. The worker receives `WorkerRenderRequest` (source + options) and returns `WorkerRenderResponse` (result or error). The worker runs the same `render()` function as the main thread — all security policy applies identically.

If a capability fails (throws an error), the browser runtime handles it gracefully:

- `AssetResolver` failure: the image keeps its original `src` (or no `src`).
- `LinkHandler` failure: the click is prevented (the default `preventDefault` already ran).
- `ClipboardProvider` failure: a "Copy failed" message is emitted via `onCopy`.
- `WorkerFactory` failure (worker error event): rendering falls back to the main thread.

## CapabilityError

Capability failures can throw `CapabilityError` (from `@axis-love/contracts`):

```typescript
export type CapabilityErrorCode =
  | "asset-not-found"
  | "asset-blocked"
  | "link-blocked"
  | "clipboard-denied"
  | "capability-unsupported";

export class CapabilityError extends Error {
  readonly code: CapabilityErrorCode;
  readonly capability: string;  // "AssetResolver", "LinkHandler", "ClipboardProvider"
  readonly cause?: unknown;
}
```

Hosts may throw `CapabilityError` to signal specific failure modes that the runtime or host application can handle programmatically.