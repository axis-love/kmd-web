# @axis-love/element

The framework-neutral `<kmd-reader>` Web Component for kmd-web. It wraps the
same core/browser engine as the React bindings using custom-element lifecycle
callbacks, renders into light DOM (so host CSS and screen readers reach the
content directly), and reports everything through `kmd:*` custom events. Use
it in plain HTML, Vue, Svelte, Lit, or any framework that can render a custom
element.

```bash
npm install @axis-love/element
```

Most consumers install the `@axis-love/kmd-web` convenience package instead
and import from its `./element` subpath; both paths resolve to the same
implementation.

## Example

```ts
import { registerKmdReader } from "@axis-love/element";
import "@axis-love/styles/styles.css";

// Call once at bootstrap. Duplicate registration is silently ignored.
registerKmdReader();

const reader = document.createElement("kmd-reader");
document.body.appendChild(reader);
reader.source = "# Hello, kmd\n\nRendered by a **Web Component**.";

reader.addEventListener("kmd:outline-change", (e) => {
  console.log(e.detail.outline);
});
```

Properties: `source`, `renderOptions`, `capabilities`, `theme`. Events:
`kmd:outline-change`, `kmd:active-heading-change`, `kmd:rendered`,
`kmd:error`, `kmd:link-external`, `kmd:link-document`, `kmd:copy`.

## Part of kmd-web

This package is part of the [kmd-web](https://github.com/axis-love/kmd-web)
family. Full documentation lives in the repo's
[docs/](https://github.com/axis-love/kmd-web/tree/main/docs) directory — start
with the [Web Component quick start](https://github.com/axis-love/kmd-web/blob/main/docs/quick-start-web-component.md).

## License

MIT
