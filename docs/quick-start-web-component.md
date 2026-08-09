# Quick Start — `<kmd-reader>` Web Component

> The framework-neutral custom element. `<kmd-reader>` wraps the same
> core/browser engine as the React wrapper, using custom-element lifecycle
> callbacks instead of React hooks. Use it in plain HTML, Vue, Svelte, Lit,
> or any framework that can render a custom element.

## Install

```bash
npm install @axis-love/kmd-web
```

> **Subpath exports.** The `@axis-love/kmd-web` package exposes the element
> registration function via the `./element` subpath and the scoped CSS via the
> `./styles.css` subpath. These subpaths are part of the package's `exports`
> map (added in KWEB-015). Make sure your bundler resolves Node `exports`
> conditions (all modern bundlers do).

## Import and register

```ts
import { registerKmdReader } from "@axis-love/kmd-web/element";
import "@axis-love/kmd-web/styles.css";

// Call once, at module init or app bootstrap. Safe to call multiple times —
// duplicate registration is silently ignored.
registerKmdReader();
```

After registration, use `<kmd-reader>` anywhere in your HTML:

```html
<kmd-reader source="# Hello, kmd&#10;&#10;Rendered by a **Web Component**."></kmd-reader>
```

## Properties (set via JS)

| Property | Type | Description |
|---|---|---|
| `source` | `string` | Markdown source text. Setting it triggers a re-render. Invalid types emit a `kmd:error` event, not an exception. |
| `renderOptions` | `RenderOptions \| undefined` | Core render options (features, security, limits). Setting it triggers a re-render. |
| `capabilities` | `HostCapabilities \| undefined` | Host capability bundle. Set before connection (or before source) for cleanest lifecycle; changing it after connection recreates the internal `BrowserReader`. |
| `theme` | `"dark" \| "light" \| "sepia"` | Theme selector. Invalid values emit a `kmd:error` event. Updates the `data-kmd-theme` attribute. |
| `dataSourceUrl` | `string \| undefined` | Optional URL to fetch source from. Exposed for host-side tooling — the component does not fetch it automatically. |

```ts
const reader = document.querySelector("kmd-reader")!;
reader.source = "# Title\n\nBody";
reader.theme = "light";
reader.renderOptions = { features: { mermaid: false } };
reader.capabilities = { /* HostCapabilities */ };
```

## Attributes (reflected)

Observed attributes (handled by `attributeChangedCallback`):

| Attribute | Property | Notes |
|---|---|---|
| `source` | `source` | String. Updates the source and re-renders. |
| `theme` | `theme` | `"dark"`, `"light"`, or `"sepia"`. Also reflected as `data-kmd-theme`. |
| `data-source-url` | `dataSourceUrl` | Optional URL string. |

```html
<kmd-reader source="# Hi" theme="sepia" data-source-url="https://example.com/doc.md">
</kmd-reader>
```

## Events

All events are `CustomEvent`s dispatched with `bubbles: true` and
`composed: true`, so host page listeners can receive them across shadow
boundaries (the element uses light DOM, but `composed` keeps the contract
stable).

| Event | Detail type | Description |
|---|---|---|
| `kmd:outline-change` | `KmdOutlineChangeDetail` | Outline (heading tree) changed. `detail.outline: readonly OutlineEntry[]`. |
| `kmd:active-heading-change` | `KmdActiveHeadingChangeDetail` | Active heading from scroll tracking. `detail.slug: string \| undefined`. |
| `kmd:rendered` | `KmdRenderedDetail` | A render completed. `detail.result: RenderResult`. |
| `kmd:error` | `KmdErrorDetail` | A render or property error. `detail.error: Error`. |
| `kmd:link-external` | `KmdLinkExternalDetail` | An external link was clicked. `detail.url: URL`. |
| `kmd:link-document` | `KmdLinkDocumentDetail` | A document link was clicked. `detail.target: DocumentTarget`. |
| `kmd:copy` | `KmdCopyDetail` | A copy action succeeded. `detail.message: string`. |

`kmd:error`, `kmd:rendered`, and `kmd:copy` are the seams for host-provided UI
— your error screen, loading skeleton, and toast stack. See
[Host-provided UI surfaces](./quick-start-host-adapter.md#host-provided-ui-surfaces).

Event detail types are exported from `@axis-love/kmd-web/element`:

```ts
import type {
  KmdOutlineChangeDetail,
  KmdActiveHeadingChangeDetail,
  KmdRenderedDetail,
  KmdErrorDetail,
  KmdLinkExternalDetail,
  KmdLinkDocumentDetail,
  KmdCopyDetail,
} from "@axis-love/kmd-web/element";
```

## Light DOM — not Shadow DOM

`<kmd-reader>` renders into **light DOM**, not a shadow root. This is
intentional:

- Host page CSS custom properties (`--kmd-color-*`) can override reader
  styles without `::part()` wrappers.
- Screen readers have direct access to rendered content.
- Host CSS can style the reader naturally.

The internal structure built on connection is:

```html
<kmd-reader class="kmd-reader" data-kmd-theme="dark">
  <div class="mdr-loading" aria-busy="true" aria-live="polite" hidden>
    <p>Loading…</p>
  </div>
  <div class="mdr-error" hidden>
    <h2>Render Error</h2>
    <p>{message}</p>
  </div>
  <p class="mdr-empty" hidden>This document is empty.</p>
  <div class="kmd-reader-content"></div>
</kmd-reader>
```

The `.kmd-reader-content` container is always present so `BrowserReader` has
a stable reference across state transitions.

## Theme

Set the `theme` property or the `data-kmd-theme` attribute:

```ts
reader.theme = "light";
// or
reader.setAttribute("data-kmd-theme", "light");
```

The three equivalent theme activation selectors (from `@axis-love/styles`)
are `[data-theme="..."]`, `[data-kmd-theme="..."]`, and `.kmd-theme-...`.
Override individual tokens with CSS custom properties in the `--kmd-color-*`
namespace on the element or an ancestor:

```css
kmd-reader {
  --kmd-color-primary: #0a0a0a;
  --kmd-color-surface: #fafafa;
  --kmd-color-link: #6d28d9;
}
```

See the [Core quick start](./quick-start-core.md#theme-customization) for the
full token table.

## Link handling

Provide a `linkHandler` in `capabilities`. The element wraps the host's
handler so that `kmd:link-external` and `kmd:link-document` events are
emitted for observability before delegating to the host handler. If no host
handler is supplied, the events are still emitted and the browser runtime's
default behavior applies (`window.open` for external links, fragment scroll
for document links).

Set `capabilities` **before connection** for the cleanest lifecycle:

```ts
const reader = document.createElement("kmd-reader");

reader.capabilities = {
  linkHandler: {
    openExternal: async (url: URL) => {
      console.log("external link", url.href);
      window.open(url.href, "_blank", "noopener,noreferrer");
    },
    openDocument: async (target) => {
      // target: { href: string; anchor?: string; title?: string }
      console.log("document link", target.href, target.anchor ?? "");
    },
  },
};

document.body.appendChild(reader); // connection happens here
reader.source = "# Hello";
```

> Core classifies links first; the handler only receives already-classified
> targets — it does not re-validate URL schemes or decide safety. See the
> [Host Adapter quick start](./quick-start-host-adapter.md) for the full
> `LinkHandler` and `DocumentTarget` contracts.

## Feature opt-in

Pass `renderOptions` to disable features (all default to `true`):

```ts
reader.renderOptions = {
  features: { mermaid: false, math: false },
  security: { allowRemoteImages: true },
};
```

See the [Core quick start](./quick-start-core.md) for the full `RenderOptions`,
`FeatureOptions`, and `SecurityOptions` reference.

## Security — rendered content cannot forge events

Events are dispatched programmatically from the element's own `dispatchEvent`
inside a private `emit()` method. Rendered Markdown content lives in the light
DOM as child nodes but has no access to `dispatchEvent` on the host element or
to the private `emit` method. Rendered content cannot forge `kmd:link-external`,
`kmd:link-document`, or any other privileged event.

The link events are only ever fired by the element's internal
`createEventEmittingLinkHandler`, which is called by `BrowserReader`'s
`LinkPolicy` after core's `classifyLink` has validated the URL.

## Full example — event listeners and link handling

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>kmd-reader demo</title>
    <style>
      kmd-reader {
        display: block;
        max-width: 760px;
        margin: 2rem auto;
        padding: 2rem;
        border-radius: 8px;
      }
    </style>
  </head>
  <body>
    <kmd-reader></kmd-reader>

    <script type="module">
      import { registerKmdReader } from "@axis-love/kmd-web/element";
      import "@axis-love/kmd-web/styles.css";

      registerKmdReader();

      const reader = document.querySelector("kmd-reader");

      // Provide capabilities BEFORE setting source (and ideally before
      // connection, which already happened above — acceptable here because
      // source is set next, which recreates the reader internally).
      reader.capabilities = {
        linkHandler: {
          openExternal: async (url) => {
            if (confirm(`Open ${url.href} in a new tab?`)) {
              window.open(url.href, "_blank", "noopener,noreferrer");
            }
          },
          openDocument: async (target) => {
            console.log("Open document:", target.href, target.anchor ?? "");
          },
        },
      };

      reader.theme = "dark";

      // Event listeners — all events bubble and are composed.
      reader.addEventListener("kmd:outline-change", (e) => {
        const { outline } = e.detail;
        console.log("outline:", outline.map((o) => `${o.level} ${o.slug}`).join(", "));
      });

      reader.addEventListener("kmd:active-heading-change", (e) => {
        const { slug } = e.detail;
        console.log("active heading:", slug);
      });

      reader.addEventListener("kmd:rendered", (e) => {
        const { result } = e.detail;
        console.log("rendered, version:", result.rendererVersion);
      });

      reader.addEventListener("kmd:error", (e) => {
        const { error } = e.detail;
        console.error("kmd error:", error.message);
      });

      reader.addEventListener("kmd:link-external", (e) => {
        const { url } = e.detail;
        console.log("external link clicked:", url.href);
      });

      reader.addEventListener("kmd:link-document", (e) => {
        const { target } = e.detail;
        console.log("document link clicked:", target.href);
      });

      reader.addEventListener("kmd:copy", (e) => {
        const { message } = e.detail;
        console.log("copy:", message);
      });

      // Set the source last — this triggers the first render.
      reader.source = [
        "# kmd-reader Demo",
        "",
        "An [external link](https://example.com) and a [document link](./other.md).",
        "",
        "## Section A",
        "Content.",
        "",
        "## Section B",
        "More content.",
        "",
        "```ts",
        "console.log(\"hello\");",
        "```",
      ].join("\n");
    </script>
  </body>
</html>
```

## Next steps

- [Core quick start](./quick-start-core.md) — the DOM-free `render` API.
- [React quick start](./quick-start-react.md) — `<MarkdownReader>` and
  `<DocumentShell>`.
- [Host Adapter quick start](./quick-start-host-adapter.md) — implementing
  `AssetResolver`, `LinkHandler`, `ClipboardProvider`, and `WorkerFactory`.