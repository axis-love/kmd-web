# DesignMD Theming

kmd-web can restyle the reader from any user-supplied `DESIGN.md`: the design
pipeline in `@axis-love/design` extracts a resolved spec, maps it onto the
`--kmd-*` design tokens, and applies custom **light and dark** themes scoped to
the reader — the mode the design.md doesn't describe is derived by inversion.

Design record: [ADR 0001 — DesignMD-driven theming](./adr/0001-designmd-theming.md).
Token vocabulary and manual overrides: [Styling and Theming](./styling.md).

## Requirements

`@axis-love/design` is an **optional peer dependency** of `@axis-love/browser`,
loaded lazily the first time a design source is applied. Readers that never
use the feature never load it, and the reader-only bundle is unaffected.

```bash
npm install @axis-love/design
```

## Usage

Pass the designMD **text** (never a path) as `designSource`.

### React

```tsx
import { MarkdownReader } from "@axis-love/kmd-web/react";

<MarkdownReader
  source={markdown}
  designSource={designMdText}          // undefined removes the custom theme
  onDesignTheme={({ applied, diagnostics }) => {
    if (!applied) console.warn("design theme not applied", diagnostics);
  }}
/>
```

### BrowserReader

```js
const reader = new BrowserReader({
  container,
  designSource: designMdText,          // optional, can also be set later
  onDesignTheme: (info) => console.log(info),
});

await reader.setDesignSource(otherDesignMdText); // replace at runtime
await reader.setDesignSource(undefined);         // back to default themes
```

### Web Component

```html
<kmd-reader source="# Hello" design-source="…designMD text…"></kmd-reader>
<script>
  el.addEventListener("kmd:design-theme", (e) => console.log(e.detail.info));
  el.designSource = designMdText; // property form
</script>
```

## What gets themed

The mapping is **role-based**, not name-based: the pipeline's enrichment stage
infers semantic roles (background, surface, text, muted text, divider, accent,
success/warning/error/info) from token names and values, and each role maps to
its `--kmd-*` token group — colors, plus `--kmd-font-body`/`--kmd-font-mono`
(family only) and `--kmd-radius-*`. The full table lives in the
[ADR](./adr/0001-designmd-theming.md#2-spec--token-mapping-table).

Not themeable in v1: spacing, layout widths, font sizes/line heights, motion,
and the sepia theme. Tokens the design.md doesn't determine keep their default
values — fallback is per-token, never all-or-nothing.

A minimal design.md the table extractor understands:

```markdown
# My Design

## Colors

| Token | Value |
|---|---|
| color-background | #faf4ec |
| color-text | #2b2118 |
| color-accent | #c2410c |
```

## Light/dark behavior

The emitter decides which mode the design.md authored from the background's
luminance, emits that mode as written, and derives the other mode (explicit
light/dark token pairs in the design.md are used when present; otherwise
lightness inversion). Theme switching keeps working through the existing
selectors (`data-theme`, `data-kmd-theme`, `.kmd-theme-*`) — no new switching
API — and mermaid diagrams re-render from the new computed tokens on theme
change, exactly as with the built-in themes.

## Scoping

Overrides are applied via a `data-kmd-design` attribute on the reader root and
one shared `<style data-kmd-design-theme>` element per design source
(refcounted across readers, removed when the last reader disposes). Because
custom properties resolve by proximity, the overrides beat ancestor theme
selectors inside the reader and never affect the host page.

## Failure behavior

Design-theme problems are **non-fatal by contract** and never blank the
document or fire `onError`:

- Invalid, empty, or non-design markdown → default themes, outcome reported
  through `onDesignTheme` / `kmd:design-theme` with the pipeline diagnostics.
- `@axis-love/design` not installed → default themes plus a warning diagnostic.
- Unparseable individual values → that token falls back; the rest apply.

## Demo

`examples/website` ships an "Ember" sample theme
([sample-design.md](../examples/website/src/sample-design.md)) behind a
checkbox; `?design=1` pins it on, combining with `?theme=light|dark` to review
all four combinations.
