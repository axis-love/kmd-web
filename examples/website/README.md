# kmd-web Website Demo

A small docs/demo website page consuming `@axis-love/kmd-web` from the packed release-candidate tarballs.

## Purpose

This is the **third-party-consumer proof** for the KWEB-024 RC gate. It demonstrates that a real website can:

1. Install `@axis-love/kmd-web` from the packed `.tgz` tarballs (not workspace source)
2. Render a representative kmd document exercising: headings, code+Shiki, KaTeX math, alerts, tables, links, and security (script tag stripping)
3. Build successfully with Vite

## Usage

```bash
# From the kmd-web repo root — builds, repacks .tarballs/, and force-reinstalls this demo:
npm run refresh:examples

# Then build or run the demo:
cd examples/website
npm run build
```

> **Run `npm run refresh:examples` after any package change.** This demo
> installs the library from `file:` tarballs pinned at a fixed version, and npm
> will silently keep an existing install even when a tarball is repacked with
> new contents under the same version — the demo then renders with stale CSS/JS
> that no longer matches the workspace. `npm run check:examples` (repo root)
> detects a stale install without reinstalling.

The demo renders a single page with a `MarkdownReader` component consuming a representative document. The built output is in `dist/`.