# Quick Start — Core Rendering API

> The DOM-free Markdown-to-safe-HTML rendering core.
> Use `@axis-love/core` (or the convenience re-export from `@axis-love/kmd-web`)
> when you need rendered HTML without any browser, React, or DOM dependency —
> in a Web Worker, on the server, in Node.js, or inside any runtime that
> speaks strings.

## Install

```bash
npm install @axis-love/kmd-web
```

The convenience package `@axis-love/kmd-web` re-exports the core `render`
function and all the public types. If you want only the engine with the
smallest dependency surface, install the core package directly:

```bash
npm install @axis-love/core
```

Both paths resolve to the same canonical implementation.

## Import

From the convenience package (re-exports the core surface plus browser
capabilities and contracts):

```ts
import { render, type RenderResult, type RenderOptions } from "@axis-love/kmd-web";
import { defaultRenderOptions, CORE_VERSION } from "@axis-love/kmd-web";
```

From the core package directly (no browser dependency in your graph):

```ts
import { render, CORE_VERSION } from "@axis-love/core";
import type { RenderResult, RenderOptions } from "@axis-love/core";
import { defaultRenderOptions } from "@axis-love/core";
```

The types `RenderResult`, `RenderOptions`, `FeatureOptions`,
`SecurityOptions`, `OutlineEntry`, `Diagnostic`, `AssetReference`,
`LinkTarget`, `DocumentMetadata`, `DetectedFeatures`, and
`defaultRenderOptions` all originate in `@axis-love/contracts` and are
re-exported by both `@axis-love/core` and `@axis-love/kmd-web`.

## Render

`render` is the single entry point:

```ts
function render(source: string, options?: RenderOptions): Promise<RenderResult>;
```

It accepts a Markdown source string and optional `RenderOptions`, and resolves
to a `RenderResult`. The result is fully JSON-serializable — safe to send
across a `postMessage` boundary, cache, or store.

### Minimal example

```ts
import { render } from "@axis-love/core";

const source = `# Hello, kmd

This is **Markdown** with a \`code\` span and a [link](https://example.com).

\`\`\`ts
console.log("hi");
\`\`\`
`;

const result = await render(source);

console.log(result.html);            // sanitized, safe-to-render HTML string
console.log(result.outline);         // readonly OutlineEntry[] — heading tree
console.log(result.diagnostics);    // readonly Diagnostic[] — non-fatal notes
console.log(result.detectedFeatures); // DetectedFeatures — what the doc contains
console.log(result.rendererVersion); // CORE_VERSION, e.g. "0.1.0-rc.0"
```

### `RenderResult` fields

| Field | Type | Description |
|---|---|---|
| `html` | `string` | Sanitized, safe-to-render HTML. No `javascript:`, `vbscript:`, or unsafe `data:` URLs. |
| `outline` | `readonly OutlineEntry[]` | Heading tree in document order. `OutlineEntry` = `{ level: number; text: string; slug: string }`. May be empty. |
| `diagnostics` | `readonly Diagnostic[]` | Non-fatal observations (`info` / `warning` / `error`). Fatal errors throw `RenderError` instead. |
| `assets` | `readonly AssetReference[]` | Every media asset reference found. `AssetReference` = `{ url: string; type: AssetType; resolved?: string; alt?: string }`. |
| `links` | `readonly LinkTarget[]` | Every classified link. `LinkTarget` = `{ kind: LinkTargetKind; rawUrl: string; resolvedUrl?: string; reason?: string }`. |
| `metadata` | `DocumentMetadata` | Extracted metadata (`title?`, `description?`, `lang?`). May be an empty object. |
| `detectedFeatures` | `DetectedFeatures` | Flags: `hasMath`, `hasMermaid`, `hasDesignDoc`, `hasCodeHighlighting`, `hasTables`, `hasTaskLists`, `hasFootnotes`, `hasAlerts`. |
| `rendererVersion` | `string` | Semver version of the renderer that produced this result (set by core). |

## `RenderOptions`

All fields are optional; defaults apply when omitted. The object is
JSON-serializable so it can cross worker boundaries.

```ts
interface RenderOptions {
  features?: FeatureOptions;
  security?: SecurityOptions;
  maxSourceSize?: number;   // default: 10_485_760 (10 MB). 0 = no limit.
  timeoutMs?: number;       // default: 30_000. 0 = no timeout.
  baseUrl?: string;         // base URL for resolving relative links/assets.
}
```

### `FeatureOptions` — opt in to heavy features

Every flag defaults to `true` (include if detected). Feature *detection* always
runs regardless of these flags — only the rendering/presentation is skipped.
When a feature is skipped, the renderer produces a readable fallback (e.g. a
raw code block instead of highlighted code).

```ts
interface FeatureOptions {
  codeHighlighting?: boolean; // Shiki syntax highlighting. Default: true.
  mermaid?: boolean;          // Mermaid diagrams. Default: true.
  math?: boolean;              // KaTeX math expressions. Default: true.
  designDoc?: boolean;          // DESIGN.md section extraction. Default: true.
}
```

Disable a feature:

```ts
const result = await render(source, {
  features: { mermaid: false, math: false },
});
```

> Note: Core only *detects* features and emits structural placeholders. The
> heavy feature implementations (Shiki, Mermaid, KaTeX) are lazy-loaded by the
> browser layer (`@axis-love/browser` and the optional `@axis-love/highlighting`,
> `@axis-love/mermaid`, `@axis-love/math` packages). Core itself has no
> dependency on them.

### `SecurityOptions` — tighten or relax the policy

```ts
interface SecurityOptions {
  allowRemoteImages?: boolean;            // default: false
  allowedLinkSchemes?: readonly string[]; // default: ["https", "http", "mailto", "tel"]
  allowedRawHtmlTags?: readonly string[]; // default: ["br", "kbd", "sub", "sup", "mark", "abbr", "details", "summary"]
}
```

- `allowRemoteImages` — when `false` (default), remote image URLs are stripped
  and a diagnostic is emitted. When `true`, remote images pass through URL
  scheme validation.
- `allowedLinkSchemes` — relative links and fragment-only refs are always
  allowed. Any scheme not in this set is blocked.
- `allowedRawHtmlTags` — raw HTML tags not in this set are stripped.

```ts
const result = await render(source, {
  security: {
    allowRemoteImages: true,
    allowedLinkSchemes: ["https", "http", "mailto", "tel"],
  },
});
```

### Defaults — `defaultRenderOptions`

The security-first defaults are exported from `@axis-love/contracts` and
re-exported by core and kmd-web:

```ts
import { defaultRenderOptions } from "@axis-love/core";

// defaultRenderOptions ===
// {
//   features: { codeHighlighting: true, mermaid: true, math: true, designDoc: true },
//   security: {
//     allowRemoteImages: false,
//     allowedLinkSchemes: ["https", "http", "mailto", "tel"],
//     allowedRawHtmlTags: ["br", "kbd", "sub", "sup", "mark", "abbr", "details", "summary"],
//   },
//   maxSourceSize: 10_485_760,
//   timeoutMs: 30_000,
//   baseUrl: undefined,
// }
```

### `CORE_VERSION`

```ts
import { CORE_VERSION } from "@axis-love/core";
console.log(CORE_VERSION); // "0.1.0-rc.0"
```

## Handling errors

`render` throws a `RenderError` (from `@axis-love/contracts`) for fatal
conditions: source exceeds `maxSourceSize`, or the render exceeds `timeoutMs`.

```ts
import { render, RenderError } from "@axis-love/core";

try {
  const result = await render(hugeSource);
} catch (err) {
  if (err instanceof RenderError) {
    console.error(err.code, err.message); // e.g. "source-too-large"
  }
}
```

## Theme customization

**Core does not apply themes.** Core returns safe HTML strings — theming is a
presentation concern owned by the host. Themes are CSS custom properties
applied by whoever owns the DOM (the React wrapper, Web Component, or your own
host markup).

The shared style tokens live in `@axis-love/styles` and use the `--kmd-color-*`
namespace. A subset:

| Token | Default (dark) |
|---|---|
| `--kmd-color-primary` | `#e8eaed` |
| `--kmd-color-secondary` | `#9aa0ab` |
| `--kmd-color-tertiary` | `#9b6dff` |
| `--kmd-color-neutral` | `#1a1c1f` |
| `--kmd-color-surface` | `#222428` |
| `--kmd-color-surface-muted` | `#2c2f35` |
| `--kmd-color-on-primary` | `#1a1c1f` |
| `--kmd-color-on-surface` | `#e8eaed` |
| `--kmd-color-border` | `#3a3f48` |
| `--kmd-color-info` | `#5b9cf5` |
| `--kmd-color-success` | `#3ebd82` |
| `--kmd-color-warning` | `#d4a735` |
| `--kmd-color-danger` | `#e8594e` |
| `--kmd-color-code-bg` | `#2c2f35` |

Themes (`dark`, `light`, `sepia`) are activated by any of three equivalent
selectors on the host page:

```css
[data-theme="dark"]      .kmd-reader { /* ... */ }
[data-kmd-theme="dark"]  .kmd-reader { /* ... */ }
.kmd-theme-dark          .kmd-reader { /* ... */ }
```

See the React and Web Component quick-start guides for end-to-end theme
examples that apply these tokens to rendered core output.

## Handling links and assets

Core *classifies* links and *collects* asset references — it does not load
assets or navigate. The `links` and `assets` arrays on `RenderResult` are the
contract you use to wire up host behavior (see the
[Host Adapter quick start](./quick-start-host-adapter.md)).

```ts
const result = await render(source);

for (const link of result.links) {
  // link.kind: "external" | "mailto" | "tel" | "internal" | "document" | "blocked"
  console.log(link.kind, link.rawUrl, link.resolvedUrl);
}

for (const asset of result.assets) {
  // asset.type: "image" | "video" | "audio" | "other"
  console.log(asset.type, asset.url, asset.alt);
}
```

- Blocked links are already stripped from `result.html`; they appear in
  `result.links` with `kind: "blocked"` and a `reason`.
- Unresolved assets (no `resolved` field) should not be loaded by the browser
  runtime until a host `AssetResolver` resolves them.

## Where core fits

- **No DOM dependency.** Core never touches `document`, `window`, or any DOM
  API. It runs in Web Workers, Node.js, Deno, Bun, and server-side renderers
  without polyfills.
- **No React, Tauri, or Node I/O.** The package boundary in `AGENTS.md`
  forbids core from importing `browser`, `react`, `element`, or any DOM lib.
- **Bundle cost.** Core is ~45 KB minified (the unified `remark` + `rehype`
  pipeline). It has no static dependency on Shiki, Mermaid, or KaTeX — those
  are lazy-loaded by the browser layer only when a document actually needs
  them.
- **Serializable.** `RenderResult` is JSON-compatible so it can cross worker
  boundaries, be cached, and be consumed by non-JavaScript implementations
  (e.g. Unity) through shared contract fixtures.

## Next steps

- [React quick start](./quick-start-react.md) — `<MarkdownReader>` and
  `<DocumentShell>` with theme switcher and outline sidebar.
- [Web Component quick start](./quick-start-web-component.md) — the
  `<kmd-reader>` custom element.
- [Host Adapter quick start](./quick-start-host-adapter.md) — implementing
  `AssetResolver`, `LinkHandler`, `ClipboardProvider`, and `WorkerFactory`.