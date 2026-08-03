# Vanilla Example

Plain HTML + ESM example using the `@axis-love/kmd-web` package.

This example imports `render` from the convenience package, renders a Markdown string into a container, and shows how to access the outline, diagnostics, and detected features from the `RenderResult`.

## Running

```bash
# 1. Install dependencies
npm install @axis-love/kmd-web

# 2. Serve the directory with any static server
npx serve .
# or: python3 -m http.server 8000
```

Then open the printed URL (e.g. `http://localhost:3000`) in your browser.

## What it demonstrates

- Importing `render` from `@axis-love/kmd-web`
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