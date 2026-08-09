# kmd-web

Canonical JavaScript rendering engine for the **kmd** ecosystem.

A DOM-free Markdown-to-safe-HTML core, browser runtime, React wrapper, Web Component, and shared design tokens — consumed by desktop, iOS, and Unity ports.

## Status

Pre-release. See the [implementation plan](https://github.com/axis-love/kmd/blob/main/docs/planning/18-kmd-web-implementation-plan.md) for the roadmap.

## Installation

```bash
npm install @axis-love/kmd-web
```

React:

```tsx
import { MarkdownReader } from "@axis-love/kmd-web/react";
import "@axis-love/kmd-web/styles.css";
```

Everything else — the root entry is renderable, not contract-only (see the
[package README](./packages/kmd-web/README.md) for the decision and its rationale):

```js
import { renderWithFeaturePlugins } from "@axis-love/kmd-web";
import "@axis-love/kmd-web/styles.css";

const result = await renderWithFeaturePlugins("# Hello");
```

The root exports `render` (core's DOM-free pipeline), `renderWithFeaturePlugins`
(the same pipeline with the optional features injected) and `BrowserReader` (the
full reader lifecycle). `MarkdownReader` and `<kmd-reader>` stay on the `./react`
and `./element` subpaths so the root never pulls a framework into a bundle that
did not ask for one.

Syntax highlighting, math, and Mermaid are optional peer dependencies of
`@axis-love/browser`. They are lazy-loaded: install them to turn the features on,
omit them and documents still render — code unhighlighted, math as source text.

```bash
npm install @axis-love/highlighting @axis-love/math @axis-love/mermaid
```

Advanced consumers can import only the engine or browser surface they need via individual `@axis-love/*` packages.

## Host-provided UI surfaces

kmd-web renders the document, not the chrome around it. Error screens,
loading skeletons, and copy/toast feedback are the host's to render — kmd-web
signals them through callbacks (`onError`, `onOutlineChange`, `onCopy`) and
`<kmd-reader>` events (`kmd:error`, `kmd:rendered`, `kmd:copy`). A fresh
integration therefore looks barer than the kmd desktop app until those are
wired up.

See [Host-provided UI surfaces](./docs/quick-start-host-adapter.md#host-provided-ui-surfaces)
for the full surface-to-callback table and minimal wiring examples for React,
raw `BrowserReader`, and the Web Component.

## Packages

| Package | Description |
|---|---|
| `@axis-love/contracts` | Versioned schemas, fixtures, expected results, feature matrix |
| `@axis-love/core` | DOM-free Markdown to safe RenderResult — no DOM, React, Tauri, or Node I/O |
| `@axis-love/browser` | DOM enhancement, worker bridge, cache, asset URL lifecycle |
| `@axis-love/styles` | Scoped reader CSS and generated design tokens |
| `@axis-love/react` | `<MarkdownReader>`, `<DocumentShell>`, React hooks |
| `@axis-love/element` | Optional `<kmd-reader>` custom element |
| `@axis-love/design` | Optional DESIGN.md extraction pipeline and HTML-export contract (hosts render) |
| `@axis-love/highlighting` | Optional Shiki integration |
| `@axis-love/mermaid` | Optional Mermaid integration |
| `@axis-love/math` | Optional KaTeX integration |
| `@axis-love/kmd-web` | Convenience exports for supported public entry points |

## Development

```bash
# Install dependencies
npm install

# Run all checks
npm run verify

# Individual commands
npm run lint          # Lint with Biome
npm run lint:fix      # Lint and auto-fix
npm run format        # Format with Biome
npm run typecheck     # TypeScript type checking
npm run test          # Run unit tests (Vitest)
npm run test:watch    # Watch mode
npm run test:coverage # With coverage
npm run build         # Build all packages (tsc --build)
npm run clean         # Clean build artifacts
```

## Architecture

This repository implements the kmd ecosystem North Star: one canonical web rendering engine and one observable compatibility contract, consumed by desktop, iOS, and Unity.

See:
- [North Star](https://github.com/axis-love/kmd/blob/main/docs/planning/17-kmd-ecosystem-north-star.md)
- [Implementation Plan](https://github.com/axis-love/kmd/blob/main/docs/planning/18-kmd-web-implementation-plan.md)
- [Security Specification](https://github.com/axis-love/kmd/blob/main/docs/planning/09-security-privacy.md)

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md).

## Security

See [SECURITY.md](./SECURITY.md). Markdown is untrusted, including local Markdown.

## License

MIT