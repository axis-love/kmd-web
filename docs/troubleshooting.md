# Troubleshooting

> Common issues and solutions for `@axis-love/*` packages.
> All information verified against source code. Feature detection, diagnostics, and capability defaults are accurate as of `0.1.0`.

---

## Workers

### Worker fails to load — CSP `worker-src` not set

**Symptom:** Console error: `Refused to create a worker from 'blob:...'` or worker silently fails. Rendering still works but is slow (main thread).

**Cause:** The Content Security Policy does not include a `worker-src` directive (or it is too restrictive). `WorkerFactory` creates Web Workers for off-main-thread rendering of large documents.

**Solution:** Add `worker-src 'self'` to your CSP header:

```
Content-Security-Policy: worker-src 'self';
```

If you use blob-based workers, use `worker-src 'self' blob:;`.

**Fallback behavior:** When the worker cannot be created or errors, `WorkerBridge` automatically falls back to main-thread rendering via the injected `renderFn`. This is degraded performance, not a crash. Documents below `mainThreadThreshold` (default 4096 chars) always use the main thread anyway.

```typescript
// WorkerBridge falls back silently — check FeaturePassResult or console
const bridge = new WorkerBridge({
  workerFactory: myFactory,  // omit to always use main thread
  renderFn: render,           // required: main-thread render function
});
```

---

## SSR / Import Errors

### `ERR_PACKAGE_PATH_NOT_EXPORTED` — `require()` not supported

**Symptom:**
```
Error [ERR_PACKAGE_PATH_NOT_EXPORTED]: ...
```

**Cause:** All `@axis-love/*` packages are `"type": "module"` with ESM-only `exports` maps. There is no `require` condition. Using `require()` fails.

**Solution:** Use `import` syntax. Ensure your consumer package is ESM:

```json
// package.json
{
  "type": "module"
}
```

```typescript
// ✅ Correct
import { render } from "@axis-love/core";

// ❌ Wrong — will throw ERR_PACKAGE_PATH_NOT_EXPORTED
const { render } = require("@axis-love/core");
```

### `ReferenceError: document is not defined` — using browser/element in SSR

**Symptom:**
```
ReferenceError: document is not defined
ReferenceError: window is not defined
```

**Cause:** `@axis-love/browser` and `@axis-love/element` require a DOM environment. They access `document`, `HTMLElement`, `customElements`, etc. at module load or construction time. Using them during SSR (Node.js without DOM) throws.

**Solution:** Use `@axis-love/core` for server-side rendering — it is DOM-free and works in any JS runtime:

```typescript
// ✅ Server-side / SSR / Node.js
import { render } from "@axis-love/core";

const result = await render(markdownSource, renderOptions);
// result.html is safe HTML — send it to the client
```

```typescript
// ✅ Browser-only code — dynamically import browser/element
if (typeof document !== "undefined") {
  const { BrowserReader } = await import("@axis-love/browser");
  // ...
}
```

**Note:** `@axis-love/react` is SSR-safe — it uses `useEffect` (runs only in browser) and does not access DOM at module level.

### `Cannot resolve @axis-love/kmd-web/react` — subpath export missing

**Symptom:**
```
Module not found: Can't resolve '@axis-love/kmd-web/react'
```

**Cause:** The `@axis-love/kmd-web` convenience package only exports the `.` entry point. There is no `./react` subpath in its `exports` map.

**Solution:** Import from the dedicated package instead:

```typescript
// ✅ Correct
import { MarkdownReader } from "@axis-love/react";

// ❌ Wrong — subpath does not exist
import { MarkdownReader } from "@axis-love/kmd-web/react";
```

---

## Content Security Policy (CSP)

### Required CSP directives

The library uses Web Workers, blob URLs (for resolved assets), inline styles (CSS custom properties), and dynamic imports. A compatible CSP:

```
Content-Security-Policy:
  script-src 'self';
  style-src 'self';
  worker-src 'self';
  img-src 'self' data: blob:;
```

**Key points:**

- **No `unsafe-inline` needed.** Styles are scoped CSS files with custom properties, not inline styles. Scripts are ES modules.
- **`worker-src 'self'`** is required if you use `WorkerFactory`. Without it, workers are blocked and rendering falls back to main thread.
- **`img-src 'self' data: blob:`** is required because `AssetResolver` may produce `blob:` or `data:` URLs for resolved assets.
- **`script-src 'self'`** covers dynamic imports of feature packages (they are same-origin modules).

### CSP violations for blob URLs

**Symptom:** Console errors: `Refused to load media from 'blob:...'` or images not appearing.

**Cause:** `img-src` does not allow `blob:` or `data:` URLs.

**Solution:**
```
img-src 'self' data: blob:;
```

---

## Remote Images

### Remote images not showing — `allowRemoteImages` defaults to `false`

**Symptom:** Images with `https://` URLs are stripped from rendered output. A diagnostic is emitted.

**Cause:** `SecurityOptions.allowRemoteImages` defaults to `false`. Remote image URLs are removed and a diagnostic with code (e.g. `unsafe-url`) is added to `RenderResult.diagnostics`.

**Solution:** Enable remote images explicitly in render options:

```typescript
import { render, defaultRenderOptions } from "@axis-love/core";

const result = await render(markdown, {
  security: {
    allowRemoteImages: true,
  },
});

// Or use an AssetResolver for host-controlled resolution:
const capabilities: HostCapabilities = {
  assetResolver: {
    async resolveAsset(request) {
      // Validate and return a safe URL
      return { url: request.url, originalUrl: request.url };
    },
  },
};
```

**Check diagnostics:**
```typescript
const result = await render(markdown);
for (const diag of result.diagnostics) {
  if (diag.code === "unsafe-url") {
    console.warn(`${diag.severity}: ${diag.message}`);
  }
}
```

---

## Optional Features

### Mermaid shows source instead of diagram — feature disabled or timeout

**Symptom:** Mermaid code fences render as plain `<pre>` blocks or `<pre class="mermaid-error">` with the original source text.

**Cause:** One of:
1. `renderOptions.features.mermaid` is set to `false`.
2. Mermaid render exceeded the 10-second timeout.
3. The `@axis-love/mermaid` package is not installed (dynamic import rejects).

**Solution:** Check that the feature is enabled (default is `true`):

```typescript
const result = await render(markdown, {
  features: {
    mermaid: true,  // default — ensure it's not explicitly false
  },
});
```

If diagrams time out (complex diagrams), check `FeaturePassResult`:

```typescript
const passes = await coordinator.enhance(container, result.detectedFeatures);
const mermaidPass = passes.find(p => p.feature === "mermaid");
if (mermaidPass?.error) {
  console.error("Mermaid failed:", mermaidPass.error);
}
```

The mermaid timeout is 10,000 ms (10 s) per diagram. Failed renders show a `<pre class="mermaid-error">` fallback with the original source.

### Code not highlighted — feature disabled or language unsupported

**Symptom:** Code blocks appear as plain `<pre><code>` without syntax coloring.

**Cause:** One of:
1. `renderOptions.features.codeHighlighting` is set to `false`.
2. The code block has no `language-*` class (no language specified).
3. The language is not in Shiki's supported set (see `LANGUAGE_LOADERS` in the highlighting source).
4. Shiki failed to load entirely (network/CSP issue).

**Solution:** Ensure the feature is enabled (default is `true`) and code fences have language tags:

````markdown
```typescript
const x: string = "hello";
```
````

```typescript
const result = await render(markdown, {
  features: {
    codeHighlighting: true,  // default — ensure it's not explicitly false
  },
});
```

Supported languages (from source): `c`, `cpp`, `csharp`, `css`, `diff`, `dockerfile`, `go`, `html`, `java`, `javascript`, `json`, `jsx`, `markdown`, `php`, `powershell`, `python`, `ruby`, `rust`, `shellscript`, `sql`, `swift`, `toml`, `tsx`, `typescript`, `xml`, `yaml`.

Excluded languages (never highlighted — have their own renderers): `text`, `plain`, `plaintext`, `mermaid`.

### Math not rendering — KaTeX CSS not loaded

**Symptom:** Math expressions appear as raw LaTeX source or unstyled HTML.

**Cause:** KaTeX CSS is required for proper rendering. The `@axis-love/math` package auto-loads CSS via `ensureKatexCss()` when math is detected, but this may fail in non-browser environments or if the CSS import is blocked.

**Solution:** In browser environments, the `FeatureCoordinator` calls `ensureKatexCss()` automatically when `detectedFeatures.hasMath` is true. In SSR or custom setups, import the CSS manually:

```typescript
// For manual setup or SSR
import "katex/dist/katex.min.css";
```

Or ensure the `FeatureCoordinator` runs after DOM morph:

```typescript
const coordinator = new FeatureCoordinator();
await coordinator.enhance(container, result.detectedFeatures);
```

### Design doc not detected

**Symptom:** DESIGN.md content is not extracted or presented.

**Cause:** `renderOptions.features.designDoc` is set to `false`, or the content does not match the design document detection patterns.

**Solution:** Ensure the feature is enabled (default is `true`). Design detection is regex-based and runs in core. The `@axis-love/design` package provides the full extraction pipeline, loaded via dynamic import when needed.

```typescript
const result = await render(markdown, {
  features: {
    designDoc: true,  // default
  },
});
```

---

## Common Errors

### Styles not applying — CSS not imported

**Symptom:** Rendered HTML appears unstyled. Reader has no typography, colors, or layout.

**Cause:** The CSS file from `@axis-love/styles` was not imported.

**Solution:**

```typescript
// Option 1: Import directly from styles package
import "@axis-love/styles/styles.css";

// Option 2: Import from styles package with tokens
import "@axis-love/styles/styles.css";
import "@axis-love/styles/tokens.css";

// Option 3: If using @axis-love/react, the CSS is imported automatically
// (the react package imports "@axis-love/styles/styles.css" at module load)
import { MarkdownReader } from "@axis-love/react";
```

### Theme not changing — attribute not set

**Symptom:** Theme does not switch between dark/light/sepia.

**Cause:** Theme is controlled by the `data-kmd-theme` attribute (for the custom element) or `data-theme` attribute (for CSS custom properties). If not set, the default theme (`dark`) applies.

**Solution:**

```html
<!-- Custom element: set the theme attribute -->
<kmd-reader theme="light" source="# Hello"></kmd-reader>
```

```typescript
// Programmatic (custom element)
const el = document.querySelector("kmd-reader");
el.theme = "light";  // sets data-kmd-theme="light"
```

```html
<!-- CSS-based: set data-kmd-theme on a wrapper -->
<div data-kmd-theme="light">
  <div class="kmd-reader-content"><!-- rendered HTML --></div>
</div>
```

Valid themes for the custom element: `dark`, `light`, `sepia`. The styles package defines: `dark`, `light`.

### Links not working — no LinkHandler

**Symptom:** Clicking links in the rendered content does nothing (or uses default browser navigation instead of host-controlled navigation).

**Cause:** No `LinkHandler` was provided in `HostCapabilities`. Without it:
- External links: rendered with `rel="noopener noreferrer"` and `target="_blank"` but not intercepted.
- Document links: fall back to in-page navigation (treated as `internal`).

**Solution:** Provide a `LinkHandler` in capabilities:

```typescript
import type { HostCapabilities } from "@axis-love/browser";

const capabilities: HostCapabilities = {
  linkHandler: {
    async openExternal(url: URL) {
      // Open in OS browser, WebView, etc.
      window.open(url.href, "_blank");
    },
    async openDocument(target) {
      // Navigate to another Markdown document
      console.log("Open document:", target.href, target.anchor);
    },
  },
};

// Pass to BrowserReader, MarkdownReader, or KmdReaderElement
```

---

## Debug Tips

### Check `RenderResult.diagnostics`

`RenderResult.diagnostics` contains non-fatal observations from rendering. Each has `severity`, `message`, optional `line`/`column`, and optional `code`:

```typescript
const result = await render(markdown);

for (const diag of result.diagnostics) {
  console.log(`[${diag.severity}] ${diag.code ?? ""}: ${diag.message}`);
  if (diag.line) console.log(`  at line ${diag.line}, col ${diag.column}`);
}
```

Common diagnostic codes: `unsafe-url`, `raw-html-blocked`, `mermaid-timeout`.

### Check `RenderResult.detectedFeatures`

`detectedFeatures` tells you what the document contains, regardless of whether features were rendered:

```typescript
const result = await render(markdown);

console.log("Has math:", result.detectedFeatures.hasMath);
console.log("Has mermaid:", result.detectedFeatures.hasMermaid);
console.log("Has code highlighting:", result.detectedFeatures.hasCodeHighlighting);
console.log("Has design doc:", result.detectedFeatures.hasDesignDoc);
console.log("Has tables:", result.detectedFeatures.hasTables);
console.log("Has task lists:", result.detectedFeatures.hasTaskLists);
console.log("Has footnotes:", result.detectedFeatures.hasFootnotes);
console.log("Has alerts:", result.detectedFeatures.hasAlerts);
```

If a feature was detected but not rendered, check `renderOptions.features` — a `false` value skips rendering but detection still reports `true`.

### Check `FeaturePassResult` from `FeatureCoordinator`

After DOM enhancement, `FeatureCoordinator.enhance()` returns an array of `FeaturePassResult`:

```typescript
const coordinator = new FeatureCoordinator();
const passes = await coordinator.enhance(container, result.detectedFeatures);

for (const pass of passes) {
  if (pass.error) {
    console.warn(`Feature ${pass.feature}: ${pass.error}`);
  } else {
    console.log(`Feature ${pass.feature}: applied=${pass.applied}`);
  }
}
```

### Check console for capability errors

`CapabilityError` is thrown when a host capability fails. It has `code` and `capability` fields:

```typescript
import { CapabilityError } from "@axis-love/contracts";

try {
  await capabilities.linkHandler?.openDocument(target);
} catch (err) {
  if (err instanceof CapabilityError) {
    console.error(`Capability ${err.capability} failed: [${err.code}] ${err.message}`);
  }
}
```

Capability error codes: `asset-not-found`, `asset-blocked`, `link-blocked`, `clipboard-denied`, `capability-unsupported`.

### Render errors

`RenderError` is thrown when rendering fails completely (not a diagnostic — a fatal error). It has a `code` field:

```typescript
import { RenderError } from "@axis-love/contracts";

try {
  const result = await render(markdown);
} catch (err) {
  if (err instanceof RenderError) {
    console.error(`Render failed: [${err.code}] ${err.message}`);
  }
}
```

Render error codes: `source-too-large`, `render-timeout`, `parse-error`, `sanitize-error`, `invalid-options`, `feature-unavailable`.