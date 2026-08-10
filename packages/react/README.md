# @axis-love/react

React bindings for kmd-web: the `<MarkdownReader>` component, the
`<DocumentShell>` outline-sidebar layout, and the `useMarkdownReader`,
`useScrollTracking`, and `useOutline` hooks. All of them are thin React
lifecycles over the DOM-free core and the `@axis-love/browser` runtime — React
never writes into the rendered content container itself.

```bash
npm install @axis-love/react react react-dom
```

React 19+ and ReactDOM are peer dependencies — never bundled, always supplied
by the host app. Most consumers install the `@axis-love/kmd-web` convenience
package instead and import from its `./react` subpath; both paths resolve to
the same implementation.

## Example

```tsx
import { MarkdownReader } from "@axis-love/react";
import "@axis-love/styles/styles.css";

export function App() {
  return (
    <MarkdownReader source={"# Hello, kmd\n\nRendered by **React**."} />
  );
}
```

Pair it with `<DocumentShell>` for an outline sidebar, or drop to the
`useMarkdownReader` hook when you need render state without the component.
Host capabilities (link handler, asset resolver) go in the `capabilities`
prop.

## Part of kmd-web

This package is part of the [kmd-web](https://github.com/axis-love/kmd-web)
family. Full documentation lives in the repo's
[docs/](https://github.com/axis-love/kmd-web/tree/main/docs) directory — start
with the [React quick start](https://github.com/axis-love/kmd-web/blob/main/docs/quick-start-react.md).

## License

MIT
