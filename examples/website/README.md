# kmd-web Website Demo

A small docs/demo website page consuming `@axis-love/kmd-web` from the packed release-candidate tarballs.

## Purpose

This is the **third-party-consumer proof** for the KWEB-024 RC gate. It demonstrates that a real website can:

1. Install `@axis-love/kmd-web` from the packed `.tgz` tarballs (not workspace source)
2. Render a representative kmd document exercising: headings, code+Shiki, KaTeX math, alerts, tables, links, and security (script tag stripping)
3. Build successfully with Vite

## Usage

```bash
# From the kmd-web repo root, pack tarballs first:
npm run build && node scripts/dry-run-release.mjs

# Then install and build this demo:
cd examples/website
npm install
npm run build
```

The demo renders a single page with a `MarkdownReader` component consuming a representative document. The built output is in `dist/`.