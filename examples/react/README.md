# React Example

React app example using `@axis-love/kmd-web/react`.

This example demonstrates:

- `<MarkdownReader>` component with theme switching (dark/light/sepia)
- `<DocumentShell>` outline sidebar with active heading tracking
- `LinkHandler` capability that opens external links in a new window
- `AssetResolver` capability that resolves relative image paths
- `onOutlineChange` and `onActiveHeadingChange` callbacks

## Running

```bash
# 1. Install dependencies
npm install

# 2. Start the dev server
npm run dev
```

Then open the printed URL (e.g. `http://localhost:5173`) in your browser.

## What it demonstrates

| Feature                        | Implementation                                           |
| ------------------------------ | ------------------------------------------------------- |
| Theme switching                | `useState<Theme>` + `data-kmd-theme` attribute           |
| Outline sidebar                | `<DocumentShell outline={outline} activeId={activeId}>`  |
| Active heading tracking        | `onActiveHeadingChange` callback                         |
| External link handling         | `LinkHandler.openExternal` → `window.open`               |
| Asset resolution               | `AssetResolver.resolveAsset` → URL resolution            |
| Error handling                 | `onError` callback                                        |

## Files

| File             | Purpose                                              |
| ---------------- | ---------------------------------------------------- |
| `App.tsx`        | Main React component with MarkdownReader + DocumentShell |
| `main.tsx`       | Entry point — creates root and renders App           |
| `index.html`     | HTML page with CSP meta tag and root div              |
| `package.json`   | Dependencies: kmd-web, react, react-dom, vite          |
| `tsconfig.json`  | TypeScript config for React + TS                      |
| `vite.config.ts` | Vite config with React plugin                        |

## Security

- CSP meta tag enforces `default-src 'self'` with no `unsafe-inline`
- The `<MarkdownReader>` component handles all DOM mutations through `BrowserReader` — React never writes to the rendered content container
- External links are routed through the `LinkHandler` capability, never navigating the current page