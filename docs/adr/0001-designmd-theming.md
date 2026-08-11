# ADR 0001 — DesignMD-driven theming of the kmd-web reader

- Status: Proposed (KWEB-059, epic KWEB-058)
- Date: 2026-08-11
- Deciders: Nyx (review pending)
- Related: KWEB-028 (API stabilization), KWEB-055 (mermaid theme re-resolution), KWEB-056 (`?theme=` pin)

## Context

`@axis-love/design` already turns a user-supplied `DESIGN.md` into a resolved
design spec (`runDesignPipeline` → detect → extract → merge → resolve →
enrich). Today that spec only feeds design-doc *presentation* (catalog export).
This feature closes the loop: the same spec can restyle the reader itself by
overriding the `--kmd-*` design tokens, producing a custom light theme and a
custom dark theme from any design.md — with the missing mode derived by
inversion, matching the kmd desktop app's design mode behavior.

The missing piece is a resolved-spec → `--kmd-*` emitter and a way for the
three reader hosts (BrowserReader, `<MarkdownReader>`, `<kmd-reader>`) to apply
its output scoped to the reader subtree.

Constraints that shape the decision:

- `@axis-love/design` may import only `contracts` and `core`; it is DOM-free
  and must stay loadable in workers and Node (AGENTS.md package boundaries).
- `@axis-love/browser` must not statically import heavy feature packages;
  mermaid/math/highlighting are optional peers loaded via dynamic `import()`
  (feature-coordination.ts). Design theming follows the same pattern.
- Theme switching is selector-driven (`[data-theme]`, `[data-kmd-theme]`,
  `.kmd-theme-*`; dark is the default when nothing matches) and mermaid
  re-resolves its palette from *computed* tokens on theme change (KWEB-055).
  A custom theme must flow through those existing mechanisms untouched.
- Reader styles are scoped under `.kmd-reader`; overrides must never leak into
  the host page.

## Decision

### 1. Emitter in `@axis-love/design` (KWEB-060)

Two new exports, both DOM-free and deterministic (identical spec in →
byte-identical output out):

```ts
/** Map a pipeline result to --kmd-* overrides for both modes. */
export function emitThemeTokens(doc: DesignDocument): DesignThemeTokens;

export interface DesignThemeTokens {
  /** --kmd-* property → value, only for tokens the spec actually determines. */
  light: Record<string, string>;
  dark: Record<string, string>;
  /** Which mode the design.md authored; the other mode is derived. */
  authoredMode: "light" | "dark";
  /** True when no themeable token could be extracted (default themes intact). */
  empty: boolean;
  diagnostics: Diagnostic[];       // reuses the pipeline Diagnostic shape
}

/** Serialize the token sets to scoped CSS. Deterministic: property-sorted. */
export function designThemeCss(tokens: DesignThemeTokens, scopeId: string): string;
```

`emitThemeTokens` consumes the *enriched* document (roles, groups, light/dark
pairs from `enrichSpec`). `designThemeCss` produces the stylesheet described in
§3. Hosts normally call only the browser integration (§4); the two functions
are public so native ports (iOS, Unity) can reuse the exact mapping.

An `empty` result (undetectable design doc, no color tokens, pipeline failure)
emits **no CSS at all** — the default themes are untouched, and the reason is
reported through `diagnostics`.

### 2. Spec → token mapping table

Only *semantic roles* map to tokens, never raw token names — a design.md's
`primary` is its brand color, not kmd's `--kmd-color-primary` (which is the
primary *text* color). Roles come from `enrichSpec` (name patterns first,
value heuristics second).

| Spec source (role / token kind) | Emitted `--kmd-*` tokens |
|---|---|
| color role `brand` or `accent` (first by role priority: accent, then brand) | `--kmd-color-tertiary`, `--kmd-color-link`, `--kmd-color-link-hover` (derived: lightened step), `--kmd-color-selection-bg` (accent at mode-tuned alpha: 0.3 dark / 0.15 light, matching defaults), `--kmd-color-outline-active-bg` (accent at 0.12 dark / 0.1 light), `--kmd-color-outline-active-border` |
| color role `background` | `--kmd-color-neutral` |
| color role `surface` | `--kmd-color-surface`, `--kmd-color-table-header-bg`; derived `--kmd-color-surface-muted` (mix toward text), `--kmd-color-code-bg` (same as surface-muted) |
| color role `text` | `--kmd-color-primary`, `--kmd-color-on-surface`, `--kmd-color-code-text`, `--kmd-color-outline-depth-0/1` (and depth-2/3 derived by mixing toward background), `--kmd-color-on-primary` (the opposing mode's text or background, contrast-checked) |
| color role `text-muted` | `--kmd-color-secondary`, `--kmd-color-blockquote-text` |
| color role `divider` | `--kmd-color-border`, `--kmd-color-table-border`, `--kmd-color-blockquote-border`, `--kmd-color-scrollbar-thumb` |
| color roles `success` / `warning` / `error` / `info` | `--kmd-color-success` / `--kmd-color-warning` / `--kmd-color-danger` / `--kmd-color-info` |
| typography token whose name/value indicates a mono/code stack | `--kmd-font-mono` |
| first body-ish typography token with a `font-family` | `--kmd-font-body` |
| radius tokens named `sm`/`md`/`lg`/`xl`/`full` (suffix match) | `--kmd-radius-sm/md/lg/xl/full` |

Where a role has several candidate tokens, the first token carrying that role
in spec order wins (stable across runs). Semantic aliases
(`--kmd-color-heading`, `-body`, `-muted`, `-accent`, `-background`, `-card`)
are **not** re-emitted — they already reference the base tokens via `var()` in
the default themes and follow automatically.

Missing roles emit nothing: any token not in the emitted set falls back to the
default theme value through the normal cascade. Fallback is therefore
per-token, not all-or-nothing.

### 3. Scoping mechanism

The integration tags the reader **root element** with
`data-kmd-design="<scopeId>"` and injects one `<style data-kmd-design-theme="<scopeId>">`
element into `document.head`. Because CSS custom properties resolve by
inheritance proximity, values set *on the reader root itself* always beat the
ancestor-level theme selectors regardless of specificity — and never affect
anything outside the reader subtree.

Emitted rule structure (mirrors `styles.css` conventions; dark is the
no-selector default):

```css
/* dark (default when no theme selector matches) */
[data-kmd-design="ID"] { /* dark set, property-sorted */ }

/* explicit light — ancestor or self, all three activation methods */
[data-theme="light"] [data-kmd-design="ID"],
[data-kmd-theme="light"] [data-kmd-design="ID"],
.kmd-theme-light [data-kmd-design="ID"],
[data-kmd-design="ID"][data-theme="light"],
[data-kmd-design="ID"][data-kmd-theme="light"],
[data-kmd-design="ID"].kmd-theme-light { /* light set */ }

/* system preference fallback — same guard as generated tokens.css */
@media (prefers-color-scheme: light) {
  :root:not([data-theme]):not([data-kmd-theme]):not(.kmd-theme-light):not(.kmd-theme-dark):not(.kmd-theme-sepia)
    [data-kmd-design="ID"] { /* light set */ }
}
```

Explicit dark selectors need no extra rule — they resolve to the default set.
`sepia` (a light-side variant) intentionally keeps the custom *dark→default*
behavior of the base rule; sepia + custom design theme is out of scope for v1
(see Non-goals). The scope id is derived from the design source's content hash
(same DJB2 hash as `runDesignPipelineCached`), so two readers sharing a
design.md share one `<style>` element; the element is refcounted and removed
when the last reader using it disposes or switches source.

Theme *switching* needs no JS: the selectors above respond to the existing
attributes/classes, and mermaid's computed-token watcher (KWEB-055) re-renders
diagrams from the new computed values with no mermaid changes.

### 4. Public API across the three hosts (KWEB-061)

One option name everywhere: **`designSource`** — the raw designMD text (never
a path; consistent with `source`).

- **BrowserReader**: `BrowserReaderOptions.designSource?: string` plus
  `setDesignSource(source: string | undefined): Promise<void>` for runtime
  changes (`undefined` removes the overrides). A new optional callback
  `onDesignTheme?: (info: DesignThemeInfo) => void` reports
  `{ applied: boolean; diagnostics: readonly DesignDiagnostic[] }` after each
  apply attempt. `@axis-love/design` becomes an *optional* peer dependency of
  `@axis-love/browser`, loaded via dynamic `import()` exactly like mermaid —
  readers that never pass `designSource` never load it (bundle-neutral).
- **React `<MarkdownReader>`**: props `designSource?: string` and
  `onDesignTheme?: (info) => void`. Prop changes call `setDesignSource`.
- **`<kmd-reader>`**: property + observed attribute `design-source`
  (property name `designSource`), and a `kmd:design-theme` CustomEvent with
  the same detail. Invalid values follow the element's diagnostic-event
  convention, never exceptions.

`onError` is **not** used for design-theme problems: a bad design.md must not
blank the document. Failures are non-fatal by contract and flow through
`onDesignTheme` / `kmd:design-theme` only.

### 5. Dark-variant derivation

1. Determine `authoredMode` from the background role's relative luminance
   (WCAG formula, already in enrich.ts): luminance > 0.5 → authored light,
   else dark. No background token → fall back to surface, then to the text
   token inverted; no parseable signal at all → `empty` result.
2. The authored mode's set is emitted as extracted.
3. For the opposing mode, per token: if `enrichSpec` paired it with a
   counterpart (`pair`), use the counterpart's value; otherwise derive by
   HSL inversion:
   - structural roles (background, surface, text, muted text, divider):
     `L' = 1 − L` with hue/saturation kept — these define which mode the
     theme is, so they always flip;
   - accent and semantic status colors: near-neutrals (chroma < 0.15 — chroma,
     not HSL saturation, which misclassifies off-whites) also invert; chromatic
     colors keep hue and saturation with lightness clamped into the readable
     band for the target mode (dark mode: `L' = max(L, 0.60)`; light mode:
     `L' = min(L, 0.45)`);
   - colors that fail to parse (gradients, `color-mix()`, named colors outside
     the parser) are dropped from the derived mode only, with an `info`
     diagnostic — the default theme value covers that mode.
4. Derivation is pure arithmetic on the parsed color — deterministic.

### 6. Cache and invalidation

The integration calls `runDesignPipelineCached(designSource)` (existing LRU,
size 3, content-hashed) and caches the emitted `DesignThemeTokens` per content
hash alongside it. Changing `designSource` re-runs the pipeline only on cache
miss; setting the same string is a no-op. `setDesignSource(undefined)` removes
the scope attribute and drops the style element reference synchronously.

### 7. Failure behavior

| Condition | Behavior |
|---|---|
| Empty/whitespace `designSource` | Treated as `undefined`: overrides removed, `applied: false`, one `info` diagnostic |
| Not a design doc / no extractable colors | No CSS injected, default themes fully intact, `applied: false` with pipeline diagnostics |
| Pipeline stage throws | Already captured as pipeline diagnostics; same as above — never a thrown error, never a blank page |
| Partially usable spec | Emit what resolved; every missing token falls back per-token to defaults |
| `@axis-love/design` not installed | Dynamic import rejects → `applied: false`, diagnostic `design package not available`; rendering unaffected |

## Not themeable in v1 (and why)

- **Spacing, layout widths, font sizes, line heights** — these are legibility
  and layout-integrity tokens; a design.md tuned for marketing pages can
  easily produce an unreadable reader. Colors, font families, and radii
  restyle without breaking layout.
- **Motion tokens** — interact with `prefers-reduced-motion` accessibility
  overrides; deferred.
- **Component recipes, gradients, elevation, breakpoints, icon hints** — no
  `--kmd-*` vocabulary exists for them; mapping would invent new public token
  surface days after 0.1.0. Revisit with KWEB-028.
- **The sepia theme** — custom design themes override dark/light only; sepia
  keeps its built-in values under a custom theme's dark default.
- **Fonts are family-only** and still subject to the no-`@font-face` policy
  (KWEB-026): the emitter emits the stack, the host distributes the font.

## Consequences

- New public API surface in `design`, `browser`, `react`, `element` — flagged
  for the KWEB-028 stabilization review; everything here is additive and
  optional.
- `@axis-love/browser` gains an optional peer on `@axis-love/design`
  (bundle-neutral for non-users; import-graph check must stay green for
  reader-only consumers).
- iOS/desktop ports can reuse `emitThemeTokens` verbatim and apply the maps
  natively; the CSS serialization is web-only by design.
- KWEB-060/061 scopes are confirmed as written; no re-scoping needed.
