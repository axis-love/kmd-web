# @axis-love/highlighting

Optional Shiki syntax highlighting for kmd-web. It provides a `rehypeShiki`
plugin for the core render pipeline plus DOM-side helpers for highlighting
already-rendered code blocks. Without this package installed, code blocks
simply render unhighlighted — the reader stays fully functional.

```bash
npm install @axis-love/highlighting shiki @shikijs/langs @shikijs/themes
```

`shiki`, `@shikijs/langs`, and `@shikijs/themes` are peer dependencies — the
heavy highlighter engine is never bundled here. When installed alongside
`@axis-love/browser`, the browser layer lazy-loads this package automatically
(`renderWithFeaturePlugins` in `@axis-love/kmd-web` wires it up for you).

## Example

```ts
import { render } from "@axis-love/core";
import { rehypeShiki, buildHighlightCss } from "@axis-love/highlighting";

const result = await render("```ts\nconsole.log(\"hi\");\n```", undefined, [
  [rehypeShiki],
]);

// Token colors come from a generated stylesheet, not inline styles:
const css = buildHighlightCss();
```

For content that is already in the DOM, `highlightCodeBlocks(container)`
finds and highlights unhighlighted code blocks in place.

## Part of kmd-web

This package is part of the [kmd-web](https://github.com/axis-love/kmd-web)
family. Full documentation lives in the repo's
[docs/](https://github.com/axis-love/kmd-web/tree/main/docs) directory — see
[features.md](https://github.com/axis-love/kmd-web/blob/main/docs/features.md).

## License

MIT
