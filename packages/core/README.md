# @axis-love/core

The DOM-free Markdown-to-safe-HTML rendering core of kmd-web. No DOM, React,
Tauri, or Node I/O — it accepts a Markdown string and resolves to a sanitized,
JSON-serializable `RenderResult`. Safe to run in a Web Worker, on the server,
or in any runtime that speaks strings. Most consumers install the
`@axis-love/kmd-web` convenience package instead, which re-exports this
surface; install core directly for the smallest dependency graph.

```bash
npm install @axis-love/core
```

## Example

```ts
import { render } from "@axis-love/core";

const result = await render("# Hello, kmd\n\nSome **Markdown**.");

console.log(result.html);             // sanitized, safe-to-render HTML
console.log(result.outline);          // heading tree
console.log(result.diagnostics);      // non-fatal notes
console.log(result.detectedFeatures); // what the document contains
```

Fatal errors throw `RenderError`; everything else surfaces as diagnostics.
Optional features (highlighting, math) can be injected as rehype plugins via
the third `render` argument (`RehypePluginEntry[]`) — the browser layer's
`renderWithFeaturePlugins` does this for you.

Link classification and URL safety helpers are also exported:
`classifyLink`, `isExternalUrl`, `isSafeUrl`.

## Part of kmd-web

This package is part of the [kmd-web](https://github.com/axis-love/kmd-web)
family. Full documentation lives in the repo's
[docs/](https://github.com/axis-love/kmd-web/tree/main/docs) directory — start
with the [Core quick start](https://github.com/axis-love/kmd-web/blob/main/docs/quick-start-core.md).

## License

MIT
