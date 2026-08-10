# @axis-love/math

Optional KaTeX math rendering for kmd-web. It provides a `rehypeKatex` plugin
for the core render pipeline plus helpers for rendering TeX strings directly.
Without this package installed, math stays as readable source text — the
reader stays fully functional.

```bash
npm install @axis-love/math katex rehype-katex
```

`katex` and `rehype-katex` are peer dependencies — the KaTeX engine is never
bundled here. When installed alongside `@axis-love/browser`, the browser layer
lazy-loads this package automatically (`renderWithFeaturePlugins` in
`@axis-love/kmd-web` wires it up for you).

## Example

```ts
import { render } from "@axis-love/core";
import { rehypeKatex, ensureKatexCss } from "@axis-love/math";

const result = await render("Euler: $e^{i\\pi} + 1 = 0$", undefined, [
  [rehypeKatex],
]);

// In a browser, inject the KaTeX stylesheet once:
ensureKatexCss();
```

`renderMath(tex, options?)` renders a single TeX string to HTML, and
`createMathFallback(source, error?)` produces the readable fallback markup
used when rendering fails.

## Part of kmd-web

This package is part of the [kmd-web](https://github.com/axis-love/kmd-web)
family. Full documentation lives in the repo's
[docs/](https://github.com/axis-love/kmd-web/tree/main/docs) directory — see
[features.md](https://github.com/axis-love/kmd-web/blob/main/docs/features.md).

## License

MIT
