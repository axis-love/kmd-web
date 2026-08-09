# @axis-love/kmd-web

Convenience exports for the supported public kmd-web entry points.

One install, one import path per surface. Everything here is a re-export — this
package holds no implementation of its own. Consumers who want a narrower
dependency graph can install the individual `@axis-love/*` packages instead.

```bash
npm install @axis-love/kmd-web
```

## Entry points

| Import | What you get |
|---|---|
| `@axis-love/kmd-web` | `render`, `renderWithFeaturePlugins`, `BrowserReader`, host-capability types, contracts types, version constants |
| `@axis-love/kmd-web/react` | `<MarkdownReader>`, `<DocumentShell>`, the React hooks |
| `@axis-love/kmd-web/element` | `<kmd-reader>` (`KmdReaderElement`, `registerKmdReader`) |
| `@axis-love/kmd-web/styles.css` | The scoped reader stylesheet |

## Root-entry decision (KWEB-045)

**The root entry is renderable, not contract-only.**

Through KWEB-044 the root exported types and version constants and nothing else.
That made the documented single-install path a dead end: `npm install
@axis-love/kmd-web` followed by `import { render } from "@axis-love/kmd-web"` —
the exact line in `examples/vanilla/main.js` and in the root README — resolved to
nothing. Rendering was reachable only through `./react` or `./element`, so a
consumer who wanted neither React nor a custom element had to work out on their
own that the real entry point was a different package.

So the root now re-exports the renderable surface:

- `render` — core's DOM-free pipeline. Sanitized HTML, math left as source, code
  left unhighlighted. Safe to call anywhere, including Node.
- `renderWithFeaturePlugins` / `loadFeatureRehypePlugins` — the same pipeline with
  KaTeX and Shiki injected when those optional peers are installed. This is the
  render entry a browser host wants.
- `BrowserReader` — the full reader lifecycle: worker bridge, parse cache, DOM
  morphing, anchor navigation, scroll tracking, code copy, link policy, asset
  lifecycle, feature coordination.

The framework surfaces deliberately stay on their subpaths. `MarkdownReader` and
`KmdReaderElement` are **not** re-exported from the root, so importing the root
never pulls React or a custom-element registration into a bundle that did not ask
for one.

## Optional features

Syntax highlighting, math, and Mermaid are optional peer dependencies of
`@axis-love/browser` (which this package depends on). They are lazy-loaded, and a
document renders fine without them — code stays unhighlighted, math stays as
source text. Install the ones you want:

```bash
npm install @axis-love/highlighting @axis-love/math @axis-love/mermaid
```

## Example

```js
import { renderWithFeaturePlugins } from "@axis-love/kmd-web";
import "@axis-love/kmd-web/styles.css";

const result = await renderWithFeaturePlugins("# Hello\n\n$E = mc^2$");

// The library's output is already sanitized.
document.querySelector(".kmd-reader").innerHTML = result.html;
console.log(result.outline, result.diagnostics, result.detectedFeatures);
```

## Versioning

Every `@axis-love/*` package moves in lockstep below 1.0 (see
[RELEASING.md](../../RELEASING.md)). `VERSION` from this package is the version of
the whole set; `CONTRACTS_VERSION`, `CORE_VERSION` and `BROWSER_VERSION` are
re-exported so a host can report what it is actually running.
