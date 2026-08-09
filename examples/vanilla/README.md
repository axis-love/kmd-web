# Vanilla Example

Plain HTML + ESM example using the `@axis-love/kmd-web` package.

This example imports `renderWithFeaturePlugins` from the convenience package's root entry, renders a Markdown string into a container, and shows how to access the outline, diagnostics, and detected features from the `RenderResult`.

## Running

```bash
# 1. Install the convenience package
npm install @axis-love/kmd-web

# 2. Optional — turn on math and syntax highlighting.
#    These are optional peer dependencies of @axis-love/browser. Without them
#    the page still renders: math stays as source text, code stays unhighlighted.
npm install @axis-love/math @axis-love/highlighting

# 3. Serve the directory with any static server
npx serve .
# or: python3 -m http.server 8000
```

Then open the printed URL (e.g. `http://localhost:3000`) in your browser.

## What it demonstrates

- Importing `renderWithFeaturePlugins` from the `@axis-love/kmd-web` root entry
- Graceful degradation when the optional feature peers are not installed
- Importing scoped styles from `@axis-love/kmd-web/styles.css`
- Rendering Markdown to a `.kmd-reader` container with `data-kmd-theme="dark"`
- Accessing `result.outline`, `result.diagnostics`, and `result.detectedFeatures`
- A simple external link handler using a delegated `click` listener
- CSP-compatible with the library's security defaults (no `unsafe-inline`)

## Files

| File         | Purpose                                         |
| ------------ | ----------------------------------------------- |
| `index.html` | HTML page with CSP meta tag and reader container|
| `main.js`    | ESM module that renders Markdown and inspects result |
| `package.json` | Minimal package manifest                      |

## Security

The CSP meta tag enforces:

```
default-src 'self'; style-src 'self'; script-src 'self'; img-src 'self' data: blob:; worker-src 'self'
```

No `unsafe-inline` is used anywhere. All dynamic text in the example code uses `textContent` — the only `innerHTML` assignment is the library's own sanitized HTML output.