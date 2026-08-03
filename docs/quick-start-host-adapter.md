# Quick Start — Implementing Host Capabilities

> Host capabilities are the narrow interfaces the kmd-web browser runtime
> consumes instead of detecting a specific platform (Tauri, iOS, web). The
> core engine classifies and validates every action first; a capability only
> carries out an already-classified action. Implement only the capabilities
> your host needs — every field is optional.

## Install

```bash
npm install @axis-love/kmd-web
```

## Import

The capability interfaces are re-exported from `@axis-love/browser` via
`@axis-love/kmd-web`:

```ts
import type {
  AssetResolver,
  LinkHandler,
  ClipboardProvider,
  WorkerFactory,
  HostCapabilities,
} from "@axis-love/kmd-web";
```

Supporting types carried by the capability signatures are also available:

```ts
import type {
  AssetRequest,
  ResolvedAsset,
  AssetType,
  DocumentTarget,
  LinkTarget,
} from "@axis-love/kmd-web";
```

## `HostCapabilities`

An optional bundle — every field is optional. When a capability is absent,
the browser runtime applies its documented default behavior (described under
each interface below).

```ts
interface HostCapabilities {
  readonly assetResolver?: AssetResolver;
  readonly linkHandler?: LinkHandler;
  readonly clipboardProvider?: ClipboardProvider;
  readonly workerFactory?: WorkerFactory;
}
```

Pass the bundle to whichever surface you use:

```tsx
// React
<MarkdownReader source={source} capabilities={capabilities} />

// Hook
useMarkdownReader(source, { capabilities });

// Web Component (set before connection for cleanest lifecycle)
reader.capabilities = capabilities;

// Browser runtime directly
new BrowserReader({ container, capabilities });
```

## `AssetResolver`

Resolves asset URLs through the host. The host fulfills requests within its
allowed document root or asset policy. Core classifies asset references first;
the resolver only carries out the resolution.

```ts
interface AssetResolver {
  resolveAsset(request: AssetRequest): Promise<ResolvedAsset>;
}

interface AssetRequest {
  readonly url: string;          // original URL from the Markdown source; may be relative
  readonly type: AssetType;      // "image" | "video" | "audio" | "other"
  readonly documentBase?: string; // base URL of the document containing the reference
}

interface ResolvedAsset {
  readonly url: string;        // safe, loadable URL (blob:, data:, or allowed https:)
  readonly originalUrl: string; // the source URL before resolution
  readonly cached?: boolean;    // true if served from a host cache
}
```

`ResolvedAsset.url` must not be `javascript:`, `vbscript:`, `file:`, or any
unknown scheme.

**Default behavior when absent:** the browser runtime does not load
unresolved assets. Local relative assets remain unresolved (no `src` is set
in the DOM), and remote assets follow the `allowRemoteImages` render-option
policy (blocked by default).

Example implementation:

```ts
import type { AssetResolver, AssetRequest, ResolvedAsset } from "@axis-love/kmd-web";

const assetResolver: AssetResolver = {
  async resolveAsset(request: AssetRequest): Promise<ResolvedAsset> {
    // Resolve a relative URL against the document base.
    const base = request.documentBase ?? "/";
    const resolved = new URL(request.url, base).href;

    // Ask the host backend to produce a safe, loadable URL (e.g. a blob: URL
    // read from the allowed document root).
    const safeUrl = await myBackend.readFileAsBlobUrl(resolved);

    return {
      url: safeUrl,
      originalUrl: request.url,
      cached: false,
    };
  },
};
```

## `LinkHandler`

Handles link navigation through the host. Core classifies link targets into
safe categories; the handler only receives already-classified targets — it
does not re-validate the URL scheme or decide whether a link is safe.

```ts
interface LinkHandler {
  openExternal(url: URL): Promise<void>;
  openDocument(target: DocumentTarget): Promise<void>;
}

interface DocumentTarget {
  readonly href: string;     // resolved path or URL to the document (never javascript: etc.)
  readonly anchor?: string;  // fragment identifier (without #) within the target document
  readonly title?: string;   // human-readable label for the target
}
```

**Default behavior when absent:**

- `openExternal` — external links are rendered with
  `rel="noopener noreferrer"` and `target="_blank"`; the browser runtime does
  not intercept clicks (the host page's default navigation applies).
- `openDocument` — document links fall back to in-page navigation (treated as
  `internal`).

Example implementation:

```ts
import type { LinkHandler, DocumentTarget } from "@axis-love/kmd-web";

const linkHandler: LinkHandler = {
  async openExternal(url: URL): Promise<void> {
    // Route through the OS handler (e.g. Tauri shell.open, or window.open).
    if (typeof window !== "undefined") {
      window.open(url.href, "_blank", "noopener,noreferrer");
    } else {
      await myShell.open(url.href);
    }
  },

  async openDocument(target: DocumentTarget): Promise<void> {
    // Open another local Markdown document in the host.
    // target.href is already a validated path; target.anchor is an optional
    // fragment within the target document.
    await myRouter.navigate(target.href, { hash: target.anchor });
  },
};
```

## `ClipboardProvider`

Provides clipboard write access through the host.

```ts
interface ClipboardProvider {
  writeText(value: string): Promise<void>;
}
```

**Default behavior when absent:** the browser runtime uses
`navigator.clipboard.writeText` if available. If the Web Clipboard API is
unavailable, copy controls are hidden.

Example implementation (desktop app with a native clipboard bridge):

```ts
import type { ClipboardProvider } from "@axis-love/kmd-web";

const clipboardProvider: ClipboardProvider = {
  async writeText(value: string): Promise<void> {
    await myNativeBridge.writeClipboardText(value);
  },
};
```

## `WorkerFactory`

Factory for creating render workers. The browser runtime uses this to
offload rendering to a Web Worker when the document is large enough to
warrant it.

```ts
interface WorkerFactory {
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

`WorkerRenderRequest` and `WorkerRenderResponse` are exported from
`@axis-love/kmd-web`:

```ts
interface WorkerRenderRequest {
  readonly id: number;
  readonly source: string;
  readonly options?: RenderOptions;
}

type WorkerRenderResponse =
  | { readonly type: "result"; readonly id: number; readonly result: RenderResult }
  | { readonly type: "error"; readonly id: number; readonly error: string };
```

**Default behavior when absent:** all rendering runs on the main thread.
Small documents (below the worker bridge's `mainThreadThreshold`, default
4096 chars) never use a worker regardless.

Example implementation:

```ts
import type { WorkerFactory } from "@axis-love/kmd-web";

const workerFactory: WorkerFactory = {
  createWorker() {
    const worker = new Worker(new URL("./render-worker.js", import.meta.url), {
      type: "module",
    });
    return {
      postMessage(message) {
        worker.postMessage(message);
      },
      addEventListener(type, listener) {
        worker.addEventListener(type, listener as EventListener);
      },
      terminate() {
        worker.terminate();
      },
    };
  },
};
```

## `HostCapabilities` is optional — every field optional

You only implement the capabilities you need. A plain web app with no
native backend typically supplies only a `linkHandler`; a desktop app adds
`assetResolver`, `clipboardProvider`, and `workerFactory`.

```ts
import type { HostCapabilities } from "@axis-love/kmd-web";

// Minimal web-only — only link handling, everything else uses defaults.
const minimalCapabilities: HostCapabilities = {
  linkHandler: {
    openExternal: async (url) => {
      window.open(url.href, "_blank", "noopener,noreferrer");
    },
    openDocument: async (target) => {
      location.hash = ""; // default fallback already handles in-page navigation
    },
  },
};
```

## Example — full `HostCapabilities` for a desktop app (Tauri-like)

```ts
import type {
  AssetResolver,
  LinkHandler,
  ClipboardProvider,
  WorkerFactory,
  HostCapabilities,
} from "@axis-love/kmd-web";

// Hypothetical native bridge exposed by the host shell.
declare const nativeBridge: {
  readFileAsBlobUrl(path: string): Promise<string>;
  openExternal(url: string): Promise<void>;
  openDocument(path: string, anchor?: string): Promise<void>;
  writeClipboardText(text: string): Promise<void>;
};

const assetResolver: AssetResolver = {
  async resolveAsset(request) {
    const base = request.documentBase ?? "/";
    const resolved = new URL(request.url, base).href;
    const blobUrl = await nativeBridge.readFileAsBlobUrl(resolved);
    return { url: blobUrl, originalUrl: request.url, cached: false };
  },
};

const linkHandler: LinkHandler = {
  async openExternal(url) {
    await nativeBridge.openExternal(url.href);
  },
  async openDocument(target) {
    await nativeBridge.openDocument(target.href, target.anchor);
  },
};

const clipboardProvider: ClipboardProvider = {
  async writeText(value) {
    await nativeBridge.writeClipboardText(value);
  },
};

const workerFactory: WorkerFactory = {
  createWorker() {
    const worker = new Worker(new URL("./render-worker.js", import.meta.url), {
      type: "module",
    });
    return {
      postMessage: (msg) => worker.postMessage(msg),
      addEventListener: (type, listener) =>
        worker.addEventListener(type, listener as EventListener),
      terminate: () => worker.terminate(),
    };
  },
};

export const desktopCapabilities: HostCapabilities = {
  assetResolver,
  linkHandler,
  clipboardProvider,
  workerFactory,
};
```

Wire it into your reader:

```tsx
// React
import { MarkdownReader } from "@axis-love/kmd-web/react";
import "@axis-love/kmd-web/styles.css";

<MarkdownReader source={source} capabilities={desktopCapabilities} />
```

```ts
// Web Component
import { registerKmdReader } from "@axis-love/kmd-web/element";
import "@axis-love/kmd-web/styles.css";

registerKmdReader();

const reader = document.querySelector("kmd-reader")!;
reader.capabilities = desktopCapabilities;
reader.source = source;
```

## Example — minimal web-only `HostCapabilities`

```ts
import type { HostCapabilities } from "@axis-love/kmd-web";

const webCapabilities: HostCapabilities = {
  linkHandler: {
    openExternal: async (url) => {
      // Default browser behavior, but with a confirmation prompt.
      if (confirm(`Open ${url.href}?`)) {
        window.open(url.href, "_blank", "noopener,noreferrer");
      }
    },
    openDocument: async (target) => {
      // Route document links through your SPA router.
      console.log("navigate to document:", target.href, target.anchor ?? "");
    },
  },
  // assetResolver, clipboardProvider, workerFactory all use defaults.
};
```

## Security

Capabilities carry out **already-classified** actions. They do not
re-validate URLs or decide safety:

- Core's URL policy classifies every link (`classifyLink` in
  `@axis-love/core`) before a `LinkHandler` is ever called. The handler
  receives a `URL` (for external) or a `DocumentTarget` (for documents)
  whose `href` is already a validated, non-`javascript:` path.
- Core's asset classification filters unsafe URLs and applies the
  `allowRemoteImages` policy before the browser runtime asks an
  `AssetResolver` to resolve a request. The resolver must still return a
  safe, loadable URL (never `javascript:`, `vbscript:`, `file:`, or an
  unknown scheme) — it cannot use the capability to smuggle blocked content
  back in.
- A `ClipboardProvider` only writes text the user explicitly copied (e.g.
  code-block copy buttons). Rendered content cannot invoke it directly.
- A `WorkerFactory` only runs the core render pipeline; it cannot escalate
  privileges or bypass the URL/sanitization policy, which lives in core.

This boundary keeps the security policy inside core and prevents host
adapters from bypassing it. See the
[Security Specification](https://github.com/axis-love/kmd/blob/main/docs/planning/09-security-privacy.md)
for the full model.

## Next steps

- [Core quick start](./quick-start-core.md) — the DOM-free `render` API and
  `RenderResult` contract.
- [React quick start](./quick-start-react.md) — `<MarkdownReader>` and
  `<DocumentShell>`.
- [Web Component quick start](./quick-start-web-component.md) — the
  `<kmd-reader>` custom element.