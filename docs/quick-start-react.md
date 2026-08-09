# Quick Start — React `<MarkdownReader>` + `<DocumentShell>`

> The React wrapper around the kmd-web browser runtime. `<MarkdownReader>`
> renders Markdown into a scoped, accessible reader; `<DocumentShell>` lays
> out an outline sidebar alongside the reader content. Both are thin React
> lifecycles over the DOM-free core and the `@axis-love/browser` runtime.

## Install

```bash
npm install @axis-love/kmd-web react react-dom
```

`@axis-love/kmd-web` is the consumer-facing convenience package. It re-exports
the React components, the core engine, the host-capability types, and the
scoped styles.

> **React 19+ is a peer dependency.** React and ReactDOM are never bundled —
> they must be installed by the host app.
>
> **Subpath exports.** The `@axis-love/kmd-web` package exposes the React
> components via the `./react` subpath and the scoped CSS via the
> `./styles.css` subpath. These subpaths are part of the package's `exports`
> map (added in KWEB-015). Make sure your bundler resolves Node
> `exports` conditions (all modern bundlers do).

## Import

```tsx
import { MarkdownReader, DocumentShell } from "@axis-love/kmd-web/react";
import "@axis-love/kmd-web/styles.css";
```

You can also pull the hooks:

```tsx
import {
  MarkdownReader,
  DocumentShell,
  useMarkdownReader,
  useScrollTracking,
  useOutline,
} from "@axis-love/kmd-web/react";
import "@axis-love/kmd-web/styles.css";
```

Type-only imports for the props and host capabilities:

```tsx
import type {
  HostCapabilities,
  OutlineEntry,
  RenderOptions,
} from "@axis-love/kmd-web";
```

## `<MarkdownReader>`

Renders Markdown source text as safe HTML inside a scoped reader. All DOM
mutations go through `BrowserReader` (from `@axis-love/browser`) — React never
writes to the rendered content container directly (except for error/empty
states, which are React-owned).

### Props

```tsx
interface MarkdownReaderProps {
  /** The Markdown source text to render. Never a file path. Required. */
  source: string;
  /** Render options passed to the core renderer. */
  renderOptions?: RenderOptions;
  /** Host capabilities bundle (asset resolver, link handler, etc.). */
  capabilities?: HostCapabilities;
  /** Additional CSS class name(s) applied to the root element. */
  className?: string;
  /** Called when rendering fails with a non-recoverable error. */
  onError?: (error: Error) => void;
  /** Called when the outline (heading tree) changes. */
  onOutlineChange?: (outline: readonly OutlineEntry[]) => void;
  /** Called when the active heading (from scroll tracking) changes. */
  onActiveHeadingChange?: (slug: string | undefined) => void;
  /** Called when a copy action succeeds (e.g. code block copy button). */
  onCopy?: (message: string) => void;
}
```

`onError`, `onOutlineChange`, and `onCopy` are the seams for host-provided UI
— your error screen, loading skeleton, and toast stack. The built-in
`.mdr-error` / `.mdr-loading` / `.mdr-empty` blocks are minimal fallbacks, and
copy feedback has no fallback at all. See
[Host-provided UI surfaces](./quick-start-host-adapter.md#host-provided-ui-surfaces).

### Minimal usage

```tsx
import { MarkdownReader } from "@axis-love/kmd-web/react";
import "@axis-love/kmd-web/styles.css";

export function App() {
  return (
    <MarkdownReader source={"# Hello, kmd\n\nRendered by **React**."} />
  );
}
```

### Feature opt-in

All features default to `true` (include if detected). Disable features by
passing `renderOptions.features`:

```tsx
<MarkdownReader
  source={source}
  renderOptions={{ features: { mermaid: false, math: false } }}
/>
```

Feature *detection* still runs — `detectedFeatures` in the render result still
reports what the document contains — but the heavy implementation is not
invoked. Read the [Core quick start](./quick-start-core.md) for the full
`FeatureOptions` and `SecurityOptions` reference.

## `<DocumentShell>`

Document layout with an outline sidebar and content area. The outline sidebar
can be toggled visible/hidden. Outline items show depth indentation via the
`data-depth` attribute; the active heading is highlighted.

### Props

```tsx
interface DocumentShellProps {
  /** The heading outline to render in the sidebar. */
  outline: readonly OutlineEntry[];
  /** The slug of the currently active heading, or undefined. */
  activeId?: string;
  /** The reader content to display in the content area. */
  children: ReactNode;
  /** Called when an outline item is clicked with the heading slug. */
  onAnchorClick?: (slug: string) => void;
  /** Additional CSS class name(s) applied to the root element. */
  className?: string;
}
```

### Usage with `<MarkdownReader>`

`<DocumentShell>` is layout-only — it does not render Markdown itself. Pair
it with `<MarkdownReader>` (or the `useMarkdownReader` hook) to supply the
outline and content:

```tsx
import { useState } from "react";
import { MarkdownReader, DocumentShell } from "@axis-love/kmd-web/react";
import "@axis-love/kmd-web/styles.css";
import type { OutlineEntry } from "@axis-love/kmd-web";

export function Reader({ source }: { source: string }) {
  const [outline, setOutline] = useState<readonly OutlineEntry[]>([]);
  const [activeId, setActiveId] = useState<string | undefined>();

  return (
    <DocumentShell outline={outline} activeId={activeId}>
      <MarkdownReader
        source={source}
        onOutlineChange={setOutline}
        onActiveHeadingChange={setActiveId}
      />
    </DocumentShell>
  );
}
```

## Hooks

### `useMarkdownReader(source, options?)`

Renders Markdown source text and returns the render state. Uses
`BrowserReader` internally; creates on mount, updates on source change,
disposes on unmount. Prefer `<MarkdownReader>` for most use cases — this hook
is for consumers who need render state without the full component.

```tsx
interface UseMarkdownReaderResult {
  readonly html: string;                  // rendered HTML, or "" if not yet rendered
  readonly outline: readonly OutlineEntry[];
  readonly error: Error | null;
  readonly isLoading: boolean;
  readonly activeHeading: string | undefined;
}

function useMarkdownReader(
  source: string,
  options?: {
    readonly renderOptions?: RenderOptions;
    readonly capabilities?: HostCapabilities;
    readonly onOutlineChange?: (outline: readonly OutlineEntry[]) => void;
    readonly onActiveHeadingChange?: (slug: string | undefined) => void;
    readonly onCopy?: (message: string) => void;
  },
): UseMarkdownReaderResult;
```

### `useScrollTracking(containerRef, bodyRef, outline)`

Tracks scroll position in a container and reports the active heading slug
based on the provided outline. Uses `ScrollTracker` from
`@axis-love/browser`. Cleans up all listeners on unmount.

```tsx
function useScrollTracking(
  containerRef: React.RefObject<HTMLElement | null>,
  bodyRef: React.RefObject<HTMLElement | null>,
  outline: readonly OutlineEntry[],
): string | undefined;
```

### `useOutline(outline, initialVisible?)`

Manages outline sidebar visibility state. Returns a tuple of
`[visible, toggle, setVisible]`. Accept `outline` so consumers can auto-hide
the sidebar when the outline is empty.

```tsx
function useOutline(
  outline: readonly OutlineEntry[],
  initialVisible?: boolean, // default: true
): [boolean, () => void, (visible: boolean) => void];
```

## Theme customization

Set the `data-kmd-theme` attribute on a wrapper `div` to one of `"dark"`,
`"light"`, or `"sepia"`. The scoped styles in `@axis-love/styles` activate
the theme via `[data-kmd-theme="..."]`. The three equivalent activation
methods are `[data-theme="..."]`, `[data-kmd-theme="..."]`, and
`.kmd-theme-...` — use whichever fits your app.

```tsx
<div data-kmd-theme="light">
  <MarkdownReader source={source} />
</div>
```

Override individual tokens with CSS custom properties in the `--kmd-color-*`
namespace:

```css
.my-reader {
  --kmd-color-primary: #0a0a0a;
  --kmd-color-surface: #fafafa;
  --kmd-color-link: #6d28d9;
}
```

See the [Core quick start](./quick-start-core.md#theme-customization) for the
full token table.

## Link handling

Pass a `linkHandler` inside `capabilities` to intercept classified link
clicks. Core classifies links first; the handler only receives
already-classified targets — it does not re-validate URL schemes or decide
safety.

```tsx
import type { HostCapabilities } from "@axis-love/kmd-web";

const capabilities: HostCapabilities = {
  linkHandler: {
    openExternal: async (url: URL) => {
      // Open in the host's preferred external handler (e.g. OS browser, Tauri shell).
      window.open(url.href, "_blank", "noopener,noreferrer");
    },
    openDocument: async (target) => {
      // target: { href: string; anchor?: string; title?: string }
      // Open another local Markdown document in the host.
      console.log("open document", target.href, target.anchor);
    },
  },
};

<MarkdownReader source={source} capabilities={capabilities} />
```

> **When no `linkHandler` is supplied:** external links are rendered with
> `rel="noopener noreferrer"` and `target="_blank"`; the browser runtime does
> not intercept clicks. Document links fall back to in-page navigation
> (treated as `internal`). See the
> [Host Adapter quick start](./quick-start-host-adapter.md) for the full
> `LinkHandler` contract.

## Asset handling

Pass an `assetResolver` inside `capabilities` to resolve asset URLs through
the host. The host fulfills requests within its allowed document root or asset
policy.

```tsx
import type { HostCapabilities } from "@axis-love/kmd-web";

const capabilities: HostCapabilities = {
  assetResolver: {
    resolveAsset: async (request) => {
      // request: { url: string; type: AssetType; documentBase?: string }
      const resolvedUrl = await myBackend.resolve(request.url, request.documentBase);
      return { url: resolvedUrl, originalUrl: request.url };
    },
  },
};

<MarkdownReader source={source} capabilities={capabilities} />
```

> **When no `assetResolver` is supplied:** local relative assets remain
> unresolved (no `src` is set in the DOM), and remote assets follow the
> `allowRemoteImages` render-option policy (blocked by default). See the
> [Host Adapter quick start](./quick-start-host-adapter.md) for the full
> `AssetResolver` and `AssetRequest` / `ResolvedAsset` contracts.

## SSR

`<MarkdownReader>` is SSR-safe:

- It uses `useEffect` (not `useLayoutEffect`) for all DOM operations.
- It performs no module-level DOM access. `BrowserReader` is created inside
  `useEffect`, which only runs in the browser.
- The container `div` is always rendered (even during SSR) so the reader has
  a stable container reference after hydration.

The scoped CSS import (`@axis-love/kmd-web/styles.css`) is a normal stylesheet
import; ensure your SSR setup handles CSS imports (most frameworks do).

## Bundle cost

- The React package (`@axis-love/react`) is ~5 KB minified.
- React 19+ is a peer dependency — never bundled.
- The scoped styles (`@axis-love/styles`) are ~12 KB of CSS.
- Heavy features (Shiki, Mermaid, KaTeX) are lazy-loaded by the browser layer
  only when a document needs them; they are not part of the base React bundle.

## Full example — theme switcher, outline sidebar, link handler

```tsx
import { useCallback, useRef, useState } from "react";
import {
  MarkdownReader,
  DocumentShell,
  useScrollTracking,
} from "@axis-love/kmd-web/react";
import "@axis-love/kmd-web/styles.css";
import type { HostCapabilities, OutlineEntry } from "@axis-love/kmd-web";

type Theme = "dark" | "light" | "sepia";

const SAMPLE_SOURCE = `# Sample Document

## Overview
This is a rendered Markdown document with an [external link](https://example.com)
and a [document link](./other.md).

## Section A
Content for section A.

## Section B
Content for section B.
`;

export function FullReader() {
  const [theme, setTheme] = useState<Theme>("dark");
  const [outline, setOutline] = useState<readonly OutlineEntry[]>([]);
  const [activeId, setActiveId] = useState<string | undefined>();

  const containerRef = useRef<HTMLDivElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const trackedActive = useScrollTracking(containerRef, bodyRef, outline);

  const handleExternal = useCallback(async (url: URL) => {
    if (confirm(`Open ${url.href} in a new tab?`)) {
      window.open(url.href, "_blank", "noopener,noreferrer");
    }
  }, []);

  const handleDocument = useCallback(async (target: { href: string; anchor?: string }) => {
    console.log("Open document:", target.href, target.anchor ?? "");
  }, []);

  const capabilities: HostCapabilities = {
    linkHandler: {
      openExternal: handleExternal,
      openDocument: handleDocument,
    },
  };

  return (
    <div data-kmd-theme={theme}>
      <header>
        <label htmlFor="theme-select">Theme:</label>
        <select
          id="theme-select"
          value={theme}
          onChange={(e) => setTheme(e.target.value as Theme)}
        >
          <option value="dark">Dark</option>
          <option value="light">Light</option>
          <option value="sepia">Sepia</option>
        </select>
      </header>

      <DocumentShell
        outline={outline}
        activeId={trackedActive ?? activeId}
        onAnchorClick={(slug) => {
          const el = bodyRef.current?.querySelector(`#${slug}`);
          el?.scrollIntoView({ behavior: "smooth", block: "start" });
        }}
      >
        <div ref={containerRef} style={{ maxHeight: "80vh", overflowY: "auto" }}>
          <div ref={bodyRef}>
            <MarkdownReader
              source={SAMPLE_SOURCE}
              capabilities={capabilities}
              onOutlineChange={setOutline}
              onActiveHeadingChange={setActiveId}
            />
          </div>
        </div>
      </DocumentShell>
    </div>
  );
}
```

## Next steps

- [Core quick start](./quick-start-core.md) — the DOM-free `render` API.
- [Web Component quick start](./quick-start-web-component.md) — the
  `<kmd-reader>` custom element.
- [Host Adapter quick start](./quick-start-host-adapter.md) — implementing
  `AssetResolver`, `LinkHandler`, `ClipboardProvider`, and `WorkerFactory`.