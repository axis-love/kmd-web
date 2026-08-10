# @axis-love/mermaid

Optional Mermaid diagram rendering for kmd-web. Core renders ```mermaid fences
as placeholders; this package finds those placeholders in the DOM and renders
them into diagrams. Without this package installed, diagrams stay as readable
source text — the reader stays fully functional.

```bash
npm install @axis-love/mermaid mermaid
```

`mermaid` is a peer dependency — the diagram engine is never bundled here.
When installed alongside `@axis-love/browser`, the browser layer lazy-loads
this package automatically.

## Example

```ts
import { renderMermaidPlaceholders, stopMermaidThemeWatch } from "@axis-love/mermaid";

const container = document.querySelector(".kmd-reader-content");

// Renders every placeholder and starts watching for live theme switches —
// diagrams are redrawn automatically when the host changes theme.
await renderMermaidPlaceholders(container);

// On teardown (e.g. unmounting the reader):
stopMermaidThemeWatch(container);
```

## Theming (KWEB-055)

Diagrams derive their colors from the `--kmd-*` design tokens of the
surrounding reader, so they match the active theme instead of Mermaid's stock
palette — diagram lines are drawn at text strength, not surface-border
strength. `watchMermaidTheme` re-renders diagrams automatically when the host
switches themes at runtime.

## Part of kmd-web

This package is part of the [kmd-web](https://github.com/axis-love/kmd-web)
family. Full documentation lives in the repo's
[docs/](https://github.com/axis-love/kmd-web/tree/main/docs) directory — see
[features.md](https://github.com/axis-love/kmd-web/blob/main/docs/features.md).

## License

MIT
