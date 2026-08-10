# @axis-love/browser

The browser runtime of kmd-web: DOM enhancement, worker bridge, parse cache,
DOM morphing, anchor navigation, scroll tracking, code copy, link policy, and
asset URL lifecycle. It consumes narrow host capabilities (asset resolver,
link handler, clipboard provider, worker factory) supplied by the host instead
of detecting a platform. The React and Web Component wrappers are thin
lifecycles over this package.

```bash
npm install @axis-love/browser
```

`@axis-love/highlighting`, `@axis-love/math`, and `@axis-love/mermaid` are
optional peer dependencies — they are lazy-loaded when installed, and a
document renders fine without them.

## Example

```ts
import { BrowserReader } from "@axis-love/browser";

const reader = new BrowserReader({
  container: document.querySelector(".kmd-reader-content"),
  onOutlineChange: (outline) => console.log(outline),
  onError: (error) => console.error(error),
});

await reader.update("# Hello, kmd\n\nRendered by the browser runtime.");
// later: reader.dispose();
```

For a one-shot render with the optional features injected when installed, use
`renderWithFeaturePlugins(source, options?)` — same output as core's `render`,
plus KaTeX and Shiki when those peers are present.

## Part of kmd-web

This package is part of the [kmd-web](https://github.com/axis-love/kmd-web)
family. Full documentation lives in the repo's
[docs/](https://github.com/axis-love/kmd-web/tree/main/docs) directory — see
the [Host Adapter quick start](https://github.com/axis-love/kmd-web/blob/main/docs/quick-start-host-adapter.md)
for the full `HostCapabilities` contract.

## License

MIT
