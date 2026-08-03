# API Support Matrix

> **Scope:** `@axis-love/*` packages in the kmd-web monorepo.
> All information here is verified against source. Every package is `type: "module"` with ESM-only exports — there is no CommonJS `require` condition.

---

## Package Matrix

| Package | Main Exports | Browser Support | SSR Safe | Bundle Size | Notes |
|---|---|---|---|---|---|
| `@axis-love/contracts` | `CONTRACTS_VERSION`, `defaultRenderOptions`, `RenderError`, `CapabilityError`, `MANIFEST_SCHEMA_VERSION`, `FeatureState`, `FeatureMatrixEntry`; types: `RenderResult`, `RenderOptions`, `FeatureOptions`, `SecurityOptions`, `OutlineEntry`, `Diagnostic`, `DiagnosticSeverity`, `AssetReference`, `AssetType`, `AssetRequest`, `ResolvedAsset`, `LinkTarget`, `LinkTargetKind`, `DocumentTarget`, `DocumentMetadata`, `DetectedFeatures`, `RenderErrorCode`, `CapabilityErrorCode`, conformance types | Any (pure types + constants) | Yes | N/A (types/constants) | Foundational contract layer. Imports nothing. Consumed by JS and native (Unity) implementations. |
| `@axis-love/core` | `CORE_VERSION`, `render`, `classifyLink`, `isExternalUrl`, `isSafeUrl`; re-exports types + `defaultRenderOptions`, `RenderError`, `CapabilityError` from contracts | Any JS runtime (Node.js, browser, worker, Deno, Bun) | Yes | ~45 KB | DOM-free. No React, Tauri, or Node I/O. Security policy lives here (URL classification, sanitization, feature detection). |
| `@axis-love/browser` | `BROWSER_VERSION`, `BrowserReader`, `BrowserReaderOptions`, `HostCapabilities`, `AssetResolver`, `LinkHandler`, `ClipboardProvider`, `WorkerFactory`, `WorkerRenderRequest`, `WorkerRenderResponse`, `WorkerBridge`, `WorkerBridgeOptions`, `RenderFn`, `ScrollTracker`, `ScrollTrackerOptions`, `LinkPolicy`, `LinkPolicyOptions`, `ParseCache`, `ParseCacheOptions`, `AssetLifecycle`, `AssetLifecycleOptions`, `CodeCopyEnhancer`, `CodeCopyOptions`, `CopyNotifier`, `FeatureCoordinator`, `FeatureCoordinationOptions`, `FeaturePassResult`, `morphMarkdownBody`, `RAW_IMAGE_SRC_ATTR`, `findAnchorTarget`, `scrollContainerToTarget`, `getReaderScrollTopForTarget`; re-exports `DocumentTarget`, `LinkTarget` | Modern browsers (ES2022, ES Modules, Web Workers, DOM, CSS Custom Properties) | No | ~15 KB | Requires DOM. Consumes host capabilities — never detects Tauri. Worker bridge with main-thread fallback. |
| `@axis-love/styles` | `TOKENS_VERSION`, `STYLES_VERSION`, `TOKEN_THEMES`, `DEFAULT_THEME`; CSS exports: `./styles.css`, `./tokens.css`, `./generated/tokens.css`, `./generated/unity-tokens.json` | Any (CSS file) | Yes | ~12 KB CSS | `sideEffects: ["**/*.css"]`. Themes: `dark`, `light`. |
| `@axis-love/react` | `REACT_PACKAGE_VERSION`, `MarkdownReader`, `MarkdownReaderProps`, `DocumentShell`, `DocumentShellProps`, `useMarkdownReader`, `UseMarkdownReaderResult`, `useScrollTracking`, `useOutline`; re-exports `HostCapabilities` from browser, `OutlineEntry` + `RenderOptions` from contracts | Modern browsers | Yes | ~5 KB | Requires React 19+ as peer dep. SSR-safe (uses `useEffect`, no module-level DOM access). Imports `@axis-love/styles/styles.css` at module load. |
| `@axis-love/element` | `ELEMENT_VERSION`, `KmdReaderElement`, `registerKmdReader`; event detail types: `KmdOutlineChangeDetail`, `KmdActiveHeadingChangeDetail`, `KmdRenderedDetail`, `KmdErrorDetail`, `KmdLinkExternalDetail`, `KmdLinkDocumentDetail`, `KmdCopyDetail`; re-exports `DocumentTarget`, `HostCapabilities` from browser, `OutlineEntry`, `RenderOptions`, `RenderResult` from contracts | Modern browsers (Custom Elements, ES Modules) | No | ~4 KB | `<kmd-reader>` custom element. Light DOM (not shadow DOM). Themes: `dark`, `light`, `sepia`. |
| `@axis-love/highlighting` | `HIGHLIGHTING_VERSION`, `rehypeShiki`, `disposeHighlighter`, `getLoadedLanguages`, `HighlightOptions` | Modern browsers (dynamic import, Shiki) | No (requires DOM for rendering) | ~200 KB core + ~10–50 KB per language | Lazy-loaded. Per-language on demand. Plain-code fallback for unknown languages or Shiki failure. |
| `@axis-love/mermaid` | `MERMAID_VERSION`, `renderMermaidPlaceholders`, `resetMermaidState`, `renderMermaid`, `MermaidRenderOptions`, `MermaidRenderResult`, `createMermaidFallback`, `hasMermaidPlaceholders` | Modern browsers (dynamic import, Mermaid 11.x) | No (requires DOM for rendering) | ~1.2 MB | Lazy-loaded. `securityLevel: "strict"`. 10s timeout per diagram. Readable source fallback on failure/timeout. Max source 50,000 chars. |
| `@axis-love/math` | `MATH_VERSION`, `rehypeKatex`, `renderMath`, `ensureKatexCss`, `resetMathState`, `hasMathElements`, `createMathFallback`, `MathRenderOptions` | Modern browsers (dynamic import, KaTeX) | No (requires DOM for rendering) | ~280 KB + ~23 KB CSS | Lazy-loaded. `trust=false`, `maxExpand=1000`, `throwOnError=false`, `strict="error"`. CSS auto-loaded when math detected. |
| `@axis-love/design` | `DESIGN_VERSION`, `scanDesignDoc`, `runDesignPipeline`, `runDesignPipelineCached`, `clearDesignPipelineCache`, `detectDesignDocument`, `detectDesignDocumentCheap`, `enrichSpec`, `resolveSpec`, `mergeSpecs`, `extractComponents`, `extractCss`, `extractGradient`, `extractLayout`, `extractProse`, `extractShadow`, `extractSurface`, `extractTables`, `extractYaml`, `splitYamlFrontMatter`, `DesignHtmlExportBuilder`, `ensureHtmlFilename`, `suggestDesignExportFilename`, `escapeHtml`, `EXTRACTORS`, `EXTRACTOR_PRECEDENCE`; IR types: `DesignDocument`, `DesignSpec`, `DetectionResult`, `ColorToken`, `ColorGroup`, `ColorRole`, `TypographyToken`, `SpacingToken`, `RadiusToken`, `ElevationToken`, `LayoutToken`, `BreakpointToken`, `GradientToken`, `MotionToken`, `SurfaceToken`, `ComponentRecipe`, `Provenance`, `IconSetHint`, `DesignDiagnostic`; design-mode: `DesignModeDocumentSummary`, `DesignModeSection`, `ProseDesignSpec`, `parseProseDesignSpec`, `summarizeMarkdownForDesignMode`, `hasDesignTokens` | Modern browsers or Node.js (dynamic import) | No (rendering requires DOM; detection in core is safe) | ~50 KB pipeline (~200 KB with all deps) | Lazy-loaded. Core detection is cheap (regex). Design IR pipeline. `./ir` subpath export for IR types only. |
| `@axis-love/kmd-web` | `VERSION`; re-exports `CONTRACTS_VERSION`, `CORE_VERSION`, `BROWSER_VERSION`, `CapabilityError`, `defaultRenderOptions`, `RenderError` from sub-packages; re-exports all contracts types + browser types (`AssetResolver`, `ClipboardProvider`, `HostCapabilities`, `LinkHandler`, `WorkerFactory`, `WorkerRenderRequest`, `WorkerRenderResponse`) | Modern browsers | Yes (re-exports only) | N/A (re-exports) | Convenience package. Currently exports `.` only. |

---

## Feature Cost Table

| Feature | Package | Runtime Cost | When Loaded | Fallback | Timeout |
|---|---|---|---|---|---|
| Syntax highlighting | `@axis-love/highlighting` | Shiki core ~200 KB + ~10–50 KB per language pack | When code blocks with `language-*` tags are detected (`hasCodeHighlighting`) | Plain `<pre><code>` with escaped text | N/A (per-document render timeout applies) |
| Mermaid diagrams | `@axis-love/mermaid` | Mermaid 11.x ~1.2 MB | When mermaid code fences are detected (`hasMermaid`) | `<pre class="mermaid-error">` with original source | 10,000 ms (10 s) per diagram |
| Math (KaTeX) | `@axis-love/math` | KaTeX ~280 KB + ~23 KB CSS | When math delimiters are detected (`hasMath`) | `<code class="katex-error">` with original source | N/A (render timeout applies) |
| Design doc | `@axis-love/design` | Pipeline ~50 KB | When DESIGN.md content is detected (`hasDesignDoc`) | N/A (parse-time feature, no DOM-side action) | N/A |

All features are loaded via `dynamic import()` on first use — they are never statically imported by `core` or `browser`. Feature **detection** always runs (cheap, in core); feature **rendering** is gated by `RenderOptions.features`.

---

## Worker Support

### WorkerFactory

```typescript
export interface WorkerFactory {
  createWorker(): {
    postMessage(message: WorkerRenderRequest): void;
    addEventListener(type: "message", listener: (event: MessageEvent<WorkerRenderResponse>) => void): void;
    addEventListener(type: "error", listener: (event: ErrorEvent) => void): void;
    terminate(): void;
  };
}
```

- Provided via `HostCapabilities.workerFactory`.
- When absent, all rendering runs on the main thread (default).
- Small documents (below `mainThreadThreshold`, default 4096 chars) always use the main thread regardless.

### WorkerRenderRequest / WorkerRenderResponse

```typescript
export interface WorkerRenderRequest {
  readonly id: number;
  readonly source: string;
  readonly options?: RenderOptions;
}

export type WorkerRenderResponse =
  | { readonly type: "result"; readonly id: number; readonly result: RenderResult }
  | { readonly type: "error"; readonly id: number; readonly error: string };
```

### WorkerBridge

`WorkerBridge` (from `@axis-love/browser`) manages worker lifecycle, stale-result tracking, and fallback:

- Each request gets a monotonically increasing ID. Stale responses (from superseded requests) are discarded.
- If the worker errors or the factory is absent, rendering falls back to the main-thread `renderFn`.
- `dispose()` terminates the worker and rejects all pending requests.

### CSP requirement

Workers require the `worker-src` directive in your Content Security Policy:

```
Content-Security-Policy: worker-src 'self';
```

Without `worker-src 'self'`, the browser will block worker creation and `WorkerBridge` will fall back to main-thread rendering (degraded performance, not a crash).

---

## Import Path Reference

All valid import paths from `@axis-love/*` packages:

### `@axis-love/contracts`
```typescript
import { ... } from "@axis-love/contracts";          // main entry
import { ... } from "@axis-love/contracts/runner";   // contract runner
import manifest from "@axis-love/contracts/manifest.json";
// Fixture/observation files:
import fixture from "@axis-love/contracts/fixtures/<name>";
import observation from "@axis-love/contracts/observations/<name>";
```

### `@axis-love/core`
```typescript
import { render, classifyLink, isExternalUrl, isSafeUrl, CORE_VERSION } from "@axis-love/core";
```

### `@axis-love/browser`
```typescript
import { BrowserReader, WorkerBridge, FeatureCoordinator, ... } from "@axis-love/browser";
```

### `@axis-love/styles`
```typescript
import "@axis-love/styles/styles.css";
import "@axis-love/styles/tokens.css";
import "@axis-love/styles/generated/tokens.css";
import unityTokens from "@axis-love/styles/generated/unity-tokens.json";
import { TOKENS_VERSION, STYLES_VERSION, TOKEN_THEMES, DEFAULT_THEME } from "@axis-love/styles";
```

### `@axis-love/react`
```typescript
import { MarkdownReader, DocumentShell, useMarkdownReader, useScrollTracking, useOutline } from "@axis-love/react";
```

### `@axis-love/element`
```typescript
import { KmdReaderElement, registerKmdReader } from "@axis-love/element";
```

### `@axis-love/highlighting`
```typescript
import { rehypeShiki, disposeHighlighter } from "@axis-love/highlighting";
```

### `@axis-love/mermaid`
```typescript
import { renderMermaidPlaceholders, resetMermaidState } from "@axis-love/mermaid";
```

### `@axis-love/math`
```typescript
import { rehypeKatex, renderMath, ensureKatexCss, resetMathState } from "@axis-love/math";
```

### `@axis-love/design`
```typescript
import { scanDesignDoc, runDesignPipeline } from "@axis-love/design";
import type { DesignDocument, DesignSpec } from "@axis-love/design/ir";
```

### `@axis-love/kmd-web`
```typescript
import { VERSION, ... } from "@axis-love/kmd-web";
```

> **Note:** `@axis-love/kmd-web` currently exports only the `.` entry point. There is no `./react`, `./element`, or `./styles` subpath — import those from their dedicated packages.

---

## React Peer Dependencies

`@axis-love/react` declares peer dependencies:

```json
{
  "peerDependencies": {
    "react": "^19.0.0",
    "react-dom": "^19.0.0"
  }
}
```

React 19+ is required. The package uses `useEffect` (not `useLayoutEffect`) for SSR safety, and React/ReactDOM are never bundled — they must be provided by the host.

---

## ESM-Only

All 11 packages are `"type": "module"` with ESM `exports` maps. The `exports` field in each `package.json` specifies only `import` and `types` conditions — there is no `require` condition.

**Consequences:**

- `require("@axis-love/core")` will fail with `ERR_PACKAGE_PATH_NOT_EXPORTED`.
- Consumers must use `import` syntax.
- In Node.js, ensure your consumer package has `"type": "module"` or use `.mjs` extensions.
- Bundlers (Vite, esbuild, Rollup) with ESM support work out of the box.

---

## Private Packages

All packages currently have `"private": true` in their `package.json`. They will remain private until KWEB-016 (intentional publishing milestone).

Until then, consumers install prerelease builds via the monorepo workspace mechanism — there are no published npm packages to `npm install`. Use the workspace directly:

```json
{
  "dependencies": {
    "@axis-love/kmd-web": "workspace:*"
  }
}
```

Once KWEB-016 lands, packages will be published to npm under the `@axis-love` scope.