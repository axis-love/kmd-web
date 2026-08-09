# Features

Opt-in feature packages for kmd-web. Each heavy rendering feature is a separate package under `@axis-love/` that is lazy-loaded via dynamic `import()` only when the document needs it. The core rendering pipeline (`@axis-love/core`) never statically imports any feature package — they are optional in every sense.

## Feature packages

| Package | Purpose | Dependency | Bundle cost |
|---|---|---|---|
| `@axis-love/highlighting` | Syntax-highlight fenced code blocks with Shiki | `shiki`, `@shikijs/langs`, `@shikijs/themes` (devDependencies) | Dynamic import — Shiki core + per-language packs loaded on demand |
| `@axis-love/mermaid` | Render Mermaid diagrams to SVG | `mermaid` 11.x (devDependency) | Dynamic import — Mermaid loaded on demand |
| `@axis-love/math` | Render math expressions with KaTeX | `katex`, `rehype-katex` (devDependencies) | Dynamic import — KaTeX + CSS loaded on demand |
| `@axis-love/design` | Extract and present DESIGN.md content | `mdast-util-from-markdown`, `js-yaml`, etc. (devDependencies) | Dynamic import — extraction pipeline loaded on demand |

Every feature package depends only on `@axis-love/contracts` and `@axis-love/core`. None of them import `@axis-love/browser` or `@axis-love/react`. This keeps features out of the baseline bundle and out of the core/browser/react dependency graph until they are actually needed.

## Feature detection

Feature detection is a **cheap, regex-based pre-scan** performed by core's `detectFeatures()` function (in `@axis-love/core/src/feature-detection.ts`). It records *presence* — it does not load any feature implementation. The result is exposed as `RenderResult.detectedFeatures`.

### `DetectedFeatures`

```typescript
export interface DetectedFeatures {
  readonly hasMath: boolean;
  readonly hasMermaid: boolean;
  readonly hasDesignDoc: boolean;
  readonly hasCodeHighlighting: boolean;
  readonly hasTables: boolean;
  readonly hasTaskLists: boolean;
  readonly hasFootnotes: boolean;
  readonly hasAlerts: boolean;
}
```

| Flag | Detection method |
|---|---|
| `hasMath` | Inline (`$...$`) or block (`$$...$$`) math delimiters, excluding code blocks and template-literal patterns (`${...}`) |
| `hasMermaid` | A fenced code block with `mermaid` as the language tag |
| `hasDesignDoc` | A heading matching `# Design` (case-insensitive) or front-matter `title` containing "design" |
| `hasCodeHighlighting` | At least one fenced code block with a language tag that benefits from highlighting (excludes `text`, `plain`, `plaintext`, `mermaid`) |
| `hasTables` | GFM table pipe syntax (`\|...\|`) |
| `hasTaskLists` | GFM task list checkbox syntax (`- [x]` / `- [ ]`) |
| `hasFootnotes` | Footnote definition syntax (`[^id]:`) |
| `hasAlerts` | GitHub-style alert block (`> [!NOTE]`, `> [!TIP]`, `> [!IMPORTANT]`, `> [!WARNING]`, `> [!CAUTION]`) |

### Detection always runs

Detection **always runs regardless of `FeatureOptions`**. Only rendering is skipped when a feature is disabled. This means `RenderResult.detectedFeatures` accurately reports what the document contains even when you choose not to render those features.

## FeatureOptions

`FeatureOptions` (inside `RenderOptions.features`) controls whether each heavy feature's *implementation* is invoked. The defaults are all `true` (include if detected).

```typescript
export interface FeatureOptions {
  readonly codeHighlighting?: boolean;  // Default: true
  readonly mermaid?: boolean;            // Default: true
  readonly math?: boolean;              // Default: true
  readonly designDoc?: boolean;         // Default: true
}
```

- Setting a flag to `true` means "include this feature if detected."
- Setting a flag to `false` means "skip this feature even if detected."
- When a feature is skipped, the renderer produces a **readable fallback** (see below).

## Fallbacks

When a feature is disabled, unavailable, or fails to load, the renderer produces a readable fallback so the document remains usable:

| Feature | Fallback behavior |
|---|---|
| Highlighting | Plain `<pre><code>` block with escaped text — no syntax coloring |
| Mermaid | Readable source in a `<pre class="mermaid-error">` block with an error message, or the original Mermaid source as text if the feature is disabled |
| Math | Plain text showing the original LaTeX source in a `<code class="katex-error">` element |
| Design | No extraction — the document is rendered as ordinary Markdown without design-doc presentation |

Fallbacks are always safe and readable. A failed feature never breaks the document.

## Feature coordination (browser layer)

The browser layer (`@axis-love/browser`) coordinates lazy loading via `FeatureCoordinator` (in `src/feature-coordination.ts`). After the DOM is morphed with new rendered HTML, `BrowserReader.update()` calls `FeatureCoordinator.enhance(container, detectedFeatures)`.

```typescript
export class FeatureCoordinator {
  constructor(options?: FeatureCoordinationOptions);
  async enhance(container: HTMLElement, features: DetectedFeatures): Promise<FeaturePassResult[]>;
}

export interface FeatureCoordinationOptions {
  readonly mermaidTimeoutMs?: number;  // Default: 10000 (10 seconds)
}
```

Each feature pass is **independent** — failure in one does not break others. If a feature package is not installed, the dynamic `import()` rejects and the feature is silently skipped (graceful fallback).

| Pass | Trigger | Action |
|---|---|---|
| Mermaid | `features.hasMermaid` | `import("@axis-love/mermaid")` → `renderMermaidPlaceholders(container, { timeoutMs })` |
| Math | `features.hasMath` | `import("@axis-love/math")` → `ensureKatexCss()` (KaTeX rendering is done in the rehype pipeline; CSS is loaded here) |
| Highlighting | `features.hasCodeHighlighting` | `import("@axis-love/highlighting")` (Shiki runs in the rehype pipeline; this pass checks for unhighlighted blocks) |
| Design | `features.hasDesignDoc` | No DOM-side action (design is a parse-time feature) |

### Timeouts

| Feature | Timeout | Default | On timeout |
|---|---|---|---|
| Mermaid | Per-diagram render timeout (`MermaidRenderOptions.timeoutMs`) | 10,000 ms (10 s) | Readable source fallback via `createMermaidFallback()` |
| Overall render | `RenderOptions.timeoutMs` | 30,000 ms (30 s) | `RenderError` with code `"render-timeout"` |

Mermaid also enforces a maximum source length of 50,000 characters (`MAX_DIAGRAM_SOURCE_LENGTH`). Diagrams exceeding this are rejected with a readable fallback.

## Browser support

- **All features require a DOM** (browser layer). The `FeatureCoordinator` operates on `HTMLElement` containers.
- **Core detection works everywhere** — `detectFeatures()` is pure string processing with no DOM dependency. It runs in Node.js, Web Workers, and the browser.
- **Core rendering** (the `render()` function) is DOM-free. It produces Mermaid placeholders and math elements as structural HTML; the browser layer replaces them with rendered output.
- Feature packages are loaded via `import()` which requires a bundler/runtime with ES module dynamic import support. Not for IE or old browsers.

## How to disable features

Pass `renderOptions.features` to `MarkdownReader` (React), `BrowserReader` (browser), or `render()` (core):

```typescript
import { render } from "@axis-love/core";

// Disable mermaid only — everything else stays on (defaults)
const result = await render(source, {
  features: { mermaid: false },
});

// Disable all heavy features (plain Markdown rendering)
const result = await render(source, {
  features: {
    codeHighlighting: false,
    mermaid: false,
    math: false,
    designDoc: false,
  },
});
```

With React:

```tsx
import { MarkdownReader } from "@axis-love/react";

<MarkdownReader
  source={markdown}
  renderOptions={{
    features: { mermaid: false },
  }}
/>
```

## Examples

### Enable all features (default)

All features are enabled by default. No configuration needed:

```typescript
import { render } from "@axis-love/core";
const result = await render(source);
// result.detectedFeatures reports what was found
// All detected features are rendered
```

### Disable specific features

```typescript
// Disable mermaid and math, keep highlighting and design
const result = await render(source, {
  features: {
    mermaid: false,
    math: false,
  },
});
// result.detectedFeatures still reports hasMermaid and hasMath
// but the rendered HTML uses fallbacks for those features
```

## Feature package details

### Highlighting (`@axis-love/highlighting`)

- **Engine**: Shiki core (`shiki/core` + `shiki/engine/javascript`) with the JavaScript regex engine.
- **Themes**: `github-dark-default` and `github-light-default` (dual-theme via `@shikijs/themes`). Dual-theme CSS variables (`--shiki-dark`, `--shiki-light`) switch based on the active kmd theme.
- **Per-language lazy loading**: Each language grammar is loaded via `import("@shikijs/langs/<lang>")` only when first encountered. A module-level `loadedLangs` Set tracks loaded languages.
- **Excluded languages**: `text`, `plain`, `plaintext`, `mermaid` are never highlighted.
- **Language aliases**: Common shorthand maps to Shiki canonical names (e.g. `ts` → `typescript`, `sh` → `shellscript`, `yml` → `yaml`).
- **Rehype plugin**: `rehypeShiki` transforms `<pre><code class="language-X">` elements in-place. Async — must be used in an async pipeline.
- **Fallback**: If Shiki fails to load entirely, all code blocks are left unhighlighted. If a specific language fails to load, that block falls back to `plaintext`.
- **Lifecycle**: `disposeHighlighter()` frees the Shiki instance and clears loaded languages. `getLoadedLanguages()` returns the set of loaded language names.
- **API**: `rehypeShiki` (plugin), `disposeHighlighter()`, `getLoadedLanguages()`, `HIGHLIGHTING_VERSION`.

### Mermaid (`@axis-love/mermaid`)

- **Engine**: Mermaid 11.x, loaded via `import("mermaid")`.
- **Security**: `securityLevel: "strict"`, `startOnLoad: false`. No external resource fetching.
- **Theming**: Mermaid bakes colors into the SVG it generates, so CSS custom properties cannot recolor a diagram after the fact. `resolveMermaidTheme(scope)` reads the computed `--kmd-*` tokens off the scope (default `document.documentElement`) and maps them onto mermaid's customizable `base` theme, so diagrams match the surrounding document in every kmd theme including sepia and host overrides. When the tokens are absent (styles.css not loaded, SSR), it falls back to mermaid's built-in `dark`/`default` themes, choosing between them the way styles.css does — explicit theme selector, then `prefers-color-scheme`, then dark.
- **Placeholder pattern**: Core produces `<div class="mermaid-placeholder" data-mermaid-source="base64...">`. The source is base64-encoded to prevent XSS payloads from appearing as literal substrings in the rendered HTML. The browser layer decodes with `atob()` before rendering.
- **DOM-side rendering**: `renderMermaidPlaceholders(container, options)` finds placeholders, decodes source, and renders SVG. Each placeholder is rendered once *per theme* — `data-mermaid-rendered` marks it drawn and `data-mermaid-theme` records the palette id it was drawn under.
- **Live theme switching**: rendering also installs a watcher on the container (opt out with `watchTheme: false`, automatically off when `theme` pins a palette). It observes the theme attributes and classes on the container and its ancestors plus the `prefers-color-scheme` media query, and re-renders when the resolved palette changes, so a toggle never leaves stale-colored SVGs. `watchMermaidTheme(container)` / `stopMermaidThemeWatch(container)` control it directly; the watcher disposes itself once the container leaves the document.
- **Timeout**: Per-diagram timeout (default 10 s). On timeout, `createMermaidFallback()` produces a `<pre class="mermaid-error">` with the original source.
- **Max source length**: 50,000 characters (`MAX_DIAGRAM_SOURCE_LENGTH`).
- **Detection helper**: `hasMermaidPlaceholders(result)` checks if a `RenderResult`'s HTML contains Mermaid placeholders.
- **API**: `renderMermaid(source, options)`, `renderMermaidPlaceholders(container, options)`, `createMermaidFallback(source, error?)`, `hasMermaidPlaceholders(result)`, `resolveMermaidTheme(scope?)`, `watchMermaidTheme(container, options?)`, `stopMermaidThemeWatch(container)`, `detectDarkMode(scope?)`, `resetMermaidState()`, `MERMAID_VERSION`.

### Math (`@axis-love/math`)

- **Engine**: KaTeX, loaded via `import("katex")`.
- **Safe configuration**: `trust: false` (blocks `\input`, `\includegraphics`, `\url`, `\href` with unsafe protocols, `\htmlClass`, `\htmlId`, `\htmlStyle`, `\htmlData`), `throwOnError: false` (renders unsupported commands in `errorColor` instead of throwing), `strict: "error"`, `maxExpand: 1000` (prevents macro expansion DoS), `output: "htmlAndMathml"` (HTML for visual, MathML for accessibility), `macros: {}` (no custom macros — prevents injection).
- **CSS loading**: `ensureKatexCss()` dynamically injects the KaTeX stylesheet only when math is detected. In Node/SSR this is a no-op.
- **Rehype plugin**: `rehypeKatex` transforms `<code class="language-math math-inline">` and `<pre><code class="language-math math-display">` elements into KaTeX-rendered HTML.
- **Fallback**: If KaTeX fails to load, all math elements fall back to `<code class="katex-error">` with the original source. If a single expression fails to render, it falls back to the source text in a `<code class="katex-error">` element.
- **Detection helper**: `hasMathElements(html)` checks if rendered HTML contains `language-math` class elements.
- **API**: `renderMath(tex, options)`, `rehypeKatex` (plugin), `ensureKatexCss()`, `createMathFallback(source, error?)`, `hasMathElements(html)`, `resetMathState()`, `MATH_VERSION`.

### Design (`@axis-love/design`)

- **Purpose**: Extract design system specifications from DESIGN.md files — colors, typography, spacing, radii, layout, gradients, shadows, surfaces, components, and more.
- **Pipeline stages**: Detect → Extract → Merge → Resolve → Enrich (in `src/pipeline.ts`). Each stage is a pure function receiving a mutable `DesignDocument`. If a stage throws, the error is captured as a diagnostic and the pipeline continues.
- **Extractors** (9 total, in `src/extractors.ts`):
  1. `extractYaml` — YAML front-matter and code blocks
  2. `extractTables` — GFM tables
  3. `extractProse` — prose paragraphs
  4. `extractCss` — CSS code blocks
  5. `extractComponents` — component recipes
  6. `extractShadow` — elevation/shadow tokens
  7. `extractGradient` — gradient tokens
  8. `extractSurface` — surface tokens
  9. `extractLayout` — layout tokens
- **IR types**: `DesignSpec`, `DesignDocument`, `ColorToken`, `TypographyToken`, `SpacingToken`, `RadiusToken`, `ElevationToken`, `SurfaceToken`, `LayoutToken`, `GradientToken`, `MotionToken`, `BreakpointToken`, `ComponentRecipe`, `Provenance`, `Diagnostic` (design-specific), and more (in `src/ir.ts`).
- **Caching**: `runDesignPipelineCached(content)` caches results. `clearDesignPipelineCache()` clears the cache.
- **Validation**: `scanDesignDoc()` validates design token content (moved from core to the design package).
- **Detection**: `detectDesignDocument()` and `detectDesignDocumentCheap()` provide detection at different cost levels.
- **HTML export**: Explicit host integration via `DesignHtmlExportBuilder`, `ensureHtmlFilename()`, `suggestDesignExportFilename()`, `escapeHtml()`. Not automatic.
- **Design mode**: `hasDesignTokens()`, `parseProseDesignSpec()`, `summarizeMarkdownForDesignMode()` for design-mode UI.
- **Presentation boundary**: the package ships the design *data* and an export *contract* — never the catalog UI. There is no `DesignCatalog` component, no showcase theme, and no HTML writer in `@axis-love/design`; the package is DOM-free and React-free by design (see the package boundary table in `AGENTS.md`). A host that wants a rendered catalog runs the pipeline, renders `DesignDocument` with its own components, and implements `DesignHtmlExportBuilder` with its own rendering technology, passing its stylesheet through `DesignCatalogHtmlOptions.catalogCss`. This is a deliberate decision, not a gap — recorded as KWEB-047 in [§6.3.1 of the extraction inventory](https://github.com/axis-love/kmd/blob/main/docs/planning/20-kmd-web-extraction-inventory.md).
- **API**: See `src/index.ts` for the full export list. Key exports: `runDesignPipeline`, `runDesignPipelineCached`, `enrichSpec`, `resolveSpec`, `mergeSpecs`, `EXTRACTORS`, `scanDesignDoc`, `detectDesignDocument`, `DESIGN_VERSION`.