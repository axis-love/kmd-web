# Migration from kmd Reader/Parser Modules

kmd-web extracts the reader and parser from the original kmd app (github.com/axis-love/kmd) into standalone, framework-neutral packages under the `@axis-love/` scope. This guide covers migrating from the copied kmd modules to the kmd-web packages.

## What changed

### Architecture

| Aspect | Old (kmd) | New (kmd-web) |
|---|---|---|
| Scope | Single app (`kmd/src/`) | 11 packages under `@axis-love/` |
| Core rendering | `kmd/src/parser/*.ts` — DOM-dependent | `@axis-love/core` — DOM-free |
| Reader UI | `kmd/src/reader/Reader.tsx` — React + Tauri | `@axis-love/react` — React, no Tauri |
| Document layout | `kmd/src/reader/DocumentShell.tsx` — React + Tauri | `@axis-love/react` `DocumentShell` — no Tauri |
| Platform detection | Tauri detection in reader/parser | `HostCapabilities` — no platform detection |
| Security | Inline in parser | Owned by `@axis-love/core`, non-bypassable |
| Features | Static imports | Lazy-loaded via dynamic `import()` |

### Key differences

1. **kmd-web has no Tauri detection.** The browser package (`@axis-love/browser`) never imports or detects Tauri. All platform-specific behavior is injected via `HostCapabilities`. Desktop (Tauri), iOS, and web hosts all use the same packages — they just provide different capabilities.

2. **kmd-web core is DOM-free.** The `render()` function in `@axis-love/core` has no DOM, React, Tauri, or Node I/O dependencies. It runs in Node.js, Web Workers, and the browser. The old kmd parser had DOM dependencies that prevented server-side rendering.

3. **Security is centralized.** URL classification, sanitization, and link target classification are owned by `@axis-love/core`. Host capabilities cannot bypass these policies. In old kmd, some validation was spread across the reader and parser.

4. **Features are lazy-loaded.** Shiki highlighting, Mermaid, KaTeX math, and DESIGN.md extraction are separate packages loaded via dynamic `import()`. In old kmd, these were statically imported.

## Old vs. new modules

### Old modules (kmd)

| Module | Role |
|---|---|
| `kmd/src/reader/DocumentShell.tsx` | Document layout: outline sidebar + content area (React + Tauri) |
| `kmd/src/reader/Reader.tsx` | Main reader component (React + Tauri) |
| `kmd/src/parser/*.ts` | Markdown parsing, rendering, sanitization |

### New packages (kmd-web)

| Package | Role | Replaces |
|---|---|---|
| `@axis-love/core` | DOM-free rendering pipeline (`render()`), security policy, feature detection | `kmd/src/parser/*.ts` |
| `@axis-love/browser` | Browser runtime: `BrowserReader`, `HostCapabilities`, worker bridge, DOM morphing, link policy, asset lifecycle, code copy | Reader runtime logic in `kmd/src/reader/Reader.tsx` |
| `@axis-love/react` | React components: `MarkdownReader`, `DocumentShell`, `useMarkdownReader` hook | `kmd/src/reader/Reader.tsx`, `kmd/src/reader/DocumentShell.tsx` |
| `@axis-love/element` | `<kmd-reader>` custom element (framework-neutral) | (new — no direct equivalent) |
| `@axis-love/styles` | Scoped reader CSS and design tokens | Reader CSS in kmd (old `.mdr-*` classes → new `.kmd-*` classes) |
| `@axis-love/contracts` | Versioned types, fixtures, feature matrix | Inline types in parser/reader |
| `@axis-love/highlighting` | Shiki syntax highlighting (lazy) | Inline highlighting in parser |
| `@axis-love/mermaid` | Mermaid diagram rendering (lazy) | Inline Mermaid in parser/reader |
| `@axis-love/math` | KaTeX math rendering (lazy) | Inline KaTeX in parser |
| `@axis-love/design` | DESIGN.md extraction pipeline (lazy) | Inline design extraction in parser |
| `@axis-love/kmd-web` | Convenience re-exports | (new) |

## Import path migration table

| Old import | New import |
|---|---|
| `import { Reader } from "kmd/src/reader/Reader"` | `import { MarkdownReader } from "@axis-love/react"` |
| `import { DocumentShell } from "kmd/src/reader/DocumentShell"` | `import { DocumentShell } from "@axis-love/react"` |
| `import { renderMarkdown } from "kmd/src/parser"` | `import { render } from "@axis-love/core"` |
| `import { parseMarkdown } from "kmd/src/parser"` | `import { render } from "@axis-love/core"` (parsing is internal to `render()`) |
| `import type { RenderResult } from "kmd/src/parser"` | `import type { RenderResult } from "@axis-love/contracts"` |
| `import type { RenderOptions } from "kmd/src/parser"` | `import type { RenderOptions } from "@axis-love/contracts"` |
| `import type { DetectedFeatures } from "kmd/src/parser"` | `import type { DetectedFeatures } from "@axis-love/contracts"` |
| `import { classifyLink } from "kmd/src/parser"` | `import { classifyLink } from "@axis-love/core"` |
| `import { BrowserReader } from "kmd/src/reader"` | `import { BrowserReader } from "@axis-love/browser"` |
| `import type { HostCapabilities } from "kmd/src/reader"` | `import type { HostCapabilities } from "@axis-love/browser"` |
| `import "@axis-love/styles/styles.css"` (unchanged) | `import "@axis-love/styles/styles.css"` |
| `import { useMarkdownReader } from "kmd/src/reader"` | `import { useMarkdownReader } from "@axis-love/react"` |

## CSS class renames

Old kmd used `.mdr-*` CSS classes. kmd-web renames them to `.kmd-*`:

| Old class | New class |
|---|---|
| `.mdr-reader` | `.kmd-reader` |
| `.mdr-document-shell` | `.kmd-document-shell` |
| `.mdr-content` | `.kmd-content` |
| `.mdr-outline-sidebar` | `.kmd-outline-sidebar` |
| `.mdr-outline-item` | `.kmd-outline-item` |
| `.mdr-loading` | `.mdr-loading` (kept — internal loading state) |
| `.mdr-error` | `.mdr-error` (kept — internal error state) |
| `.mdr-empty` | `.mdr-empty` (kept — internal empty state) |

**Note**: Some `.mdr-*` classes are kept for internal state indicators (`mdr-loading`, `mdr-error`, `mdr-empty`). The main scoping classes are renamed to `.kmd-*`.

## Adapter responsibilities

### Desktop (Tauri) adapter

| Capability | Responsibility |
|---|---|
| `AssetResolver` | Resolve local file paths to `blob:` URLs. Read files via Tauri's file API, create blob objects. |
| `LinkHandler` | `openExternal`: open links in the OS default browser via Tauri's shell API. `openDocument`: open another Markdown document in the app. |
| `ClipboardProvider` | Write to clipboard via Tauri's clipboard API. |
| `WorkerFactory` | Create a Web Worker from a Tauri-compatible URL. The worker runs the same `render()` function. |

```typescript
import { BrowserReader } from "@axis-love/browser";
import type { HostCapabilities } from "@axis-love/browser";

const capabilities: HostCapabilities = {
  assetResolver: new TauriAssetResolver(),
  linkHandler: new TauriLinkHandler(),
  clipboardProvider: new TauriClipboardProvider(),
  workerFactory: new TauriWorkerFactory(),
};

const reader = new BrowserReader({
  container: document.getElementById("reader")!,
  capabilities,
  renderOptions: { /* ... */ },
});
```

### iOS adapter

| Capability | Responsibility |
|---|---|
| `AssetResolver` | Resolve bundled assets from the app bundle. |
| `LinkHandler` | `openExternal`: open links in `SFSafariViewController` or the system browser. `openDocument`: open another document in the app. |
| `ClipboardProvider` | Write to clipboard via `UIPasteboard`. |
| `WorkerFactory` | May not be available — omit it. `BrowserReader` falls back to main-thread rendering. |

```typescript
const capabilities: HostCapabilities = {
  assetResolver: new IosAssetResolver(),
  linkHandler: new IosLinkHandler(),
  clipboardProvider: new IosClipboardProvider(),
  // No workerFactory — main-thread rendering is used
};

const reader = new BrowserReader({
  container: document.getElementById("reader")!,
  capabilities,
});
```

## Gradual migration

You don't need to migrate everything at once. The packages are designed for incremental adoption:

### Step 1: Core `render()` for server-side

Start by replacing the old parser with `@axis-love/core` for server-side rendering or rendering that doesn't need a DOM:

```typescript
import { render } from "@axis-love/core";

// Server-side or worker — no DOM needed
const result = await render(markdownSource, {
  features: { mermaid: false },
  security: { allowRemoteImages: true },
});

// result.html — safe HTML string
// result.outline — heading tree
// result.detectedFeatures — what features were found
// result.links — classified links
// result.diagnostics — warnings/errors
```

This works in Node.js, Web Workers, and any environment without a DOM. The old kmd parser had DOM dependencies that prevented this.

### Step 2: Add browser `BrowserReader`

When you need DOM-side rendering (Mermaid SVG rendering, KaTeX CSS loading, code copy buttons, link interception, asset resolution), add `@axis-love/browser`:

```typescript
import { BrowserReader } from "@axis-love/browser";

const reader = new BrowserReader({
  container: document.getElementById("reader")!,
  capabilities: {
    assetResolver: myAssetResolver,
    linkHandler: myLinkHandler,
  },
  renderOptions: { /* ... */ },
  onOutlineChange: (outline) => updateOutlineUI(outline),
  onActiveHeadingChange: (slug) => highlightOutlineItem(slug),
});

await reader.update(markdownSource);

// Later:
reader.dispose();
```

### Step 3: Add React or element wrapper

For React apps, use `@axis-love/react`:

```tsx
import { MarkdownReader, DocumentShell } from "@axis-love/react";

function App() {
  const [outline, setOutline] = useState([]);
  const [activeSlug, setActiveSlug] = useState();

  return (
    <DocumentShell outline={outline} activeId={activeSlug}>
      <MarkdownReader
        source={markdown}
        capabilities={myCapabilities}
        onOutlineChange={setOutline}
        onActiveHeadingChange={setActiveSlug}
      />
    </DocumentShell>
  );
}
```

For framework-neutral or non-React apps, use `@axis-love/element`:

```html
<kmd-reader source="## Hello world"></kmd-reader>
<script type="module">
  import "@axis-love/element";
  const el = document.querySelector("kmd-reader");
  el.capabilities = myCapabilities;
  el.source = markdownText;
</script>
```

## What's gone

These patterns from old kmd do **not** exist in kmd-web:

- **No `window.__TAURI__` detection.** The browser package never checks for Tauri. If you need Tauri, provide `HostCapabilities`.
- **No `isTauri()` or platform detection helpers.** Use `HostCapabilities` instead.
- **No static imports of feature packages.** Shiki, Mermaid, KaTeX, and design are loaded via dynamic `import()` only when needed.
- **No DOM dependencies in core.** `render()` is pure — it takes a string and returns a `RenderResult`. It never touches `document`, `window`, or any DOM API.
- **No public plugin API.** The unified/remark/rehype pipeline is internal to core. You cannot add custom plugins. (This is intentional — it keeps the security boundary closed.)

## Package boundaries

When migrating, respect these package boundaries (from `AGENTS.md`):

| Package | May import | Must not import |
|---|---|---|
| `contracts` | (nothing) | Any implementation package |
| `core` | `contracts` | `browser`, `react`, `element`, any DOM lib |
| `browser` | `contracts`, `core` | `react`, `element` |
| `styles` | (nothing) | Any TS package |
| `react` | `contracts`, `core`, `browser`, `styles` | `element` |
| `element` | `contracts`, `core`, `browser` | `react` |
| `design` | `contracts`, `core` | `browser`, `react` |
| `highlighting` | `contracts`, `core` | `browser`, `react` |
| `mermaid` | `contracts`, `core` | `browser`, `react` |
| `math` | `contracts`, `core` | `browser`, `react` |

## SSR safety

- `@axis-love/core` — SSR-safe (DOM-free). Use directly in Node.js or workers.
- `@axis-love/react` — SSR-safe. Uses `useEffect` (not `useLayoutEffect`). No module-level DOM access. React and ReactDOM are peer dependencies.
- `@axis-love/browser` — Requires a DOM. Not for SSR.
- `@axis-love/element` — Requires a DOM (custom elements). Not for SSR.

For SSR: render with `@axis-love/core` on the server, then hydrate with `@axis-love/react` or `@axis-love/element` on the client.