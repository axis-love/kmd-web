# ADR 0001 — DesignMD-driven theming of the kmd-web reader

- Status: Accepted (KWEB-059, epic KWEB-058; Nyx review 2026-08-20). Amended by KWEB-068 (2026-08-22): single extractor.
- Date: 2026-08-11
- Deciders: Nyx
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

## Amendment — KWEB-068: one token extractor (2026-08-22)

The original §2 and §5 described a second, role-based extractor inside
`emitThemeTokens` (enrich-stage roles plus name patches). In practice it never
agreed with the kmd design-mode showcase on the same DESIGN.md: Apple's
derived dark theme got a `#2997ff` page background, Nyx's light theme lost its
accent and border, Dylan Brouwer emitted no surface or divider, and heading
fonts and type scale were never themed. Every new fixture needed another patch.

Decision (Master): **there is exactly one DESIGN.md token extractor, and it
lives in kmd-web.** The showcase extraction core moved from
`kmd/src/components/design/showcaseTheme.ts` into
`packages/design/src/showcase.ts` as `buildShowcaseThemeVars(doc) → { light,
dark }` (`--nyx-*` variable maps; DOM-free). `emitThemeTokens` is now a fixed
projection of those maps onto `--kmd-*` tokens — a table, no heuristics. kmd
keeps only the presentation half (`buildShowcaseCSS` serializes the maps onto
`.nyx-showcase` selectors) and re-exports the helpers from the package, so the
showcase and the reader can no longer drift: what design mode shows for a
file is what the reader is themed with.

Sections §2 and §5 below are superseded as noted; §1, §3, §4, §6, §7 stand.

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

### 2. Showcase-variable → token mapping table (KWEB-068)

`emitThemeTokens` projects each `--nyx-*` showcase variable onto `--kmd-*`
tokens, per mode. A showcase variable that is absent emits nothing, so the
default theme value cascades per token. Values are sanitized before emission.

| Showcase variable | Emitted `--kmd-*` tokens |
|---|---|
| `--nyx-bg` | `--kmd-color-neutral` |
| `--nyx-surface` | `--kmd-color-surface` |
| `--nyx-surface-elevated` | `--kmd-color-surface-muted`, `--kmd-color-code-bg`, `--kmd-color-table-header-bg` |
| `--nyx-text-head` | `--kmd-color-primary`, `--kmd-color-outline-depth-0` |
| `--nyx-text-body` | `--kmd-color-on-surface`, `--kmd-color-code-text`, `--kmd-color-outline-depth-1` |
| `--nyx-text-muted` | `--kmd-color-secondary`, `--kmd-color-blockquote-text`, `--kmd-color-outline-depth-2` |
| `--nyx-text-dim` | `--kmd-color-outline-depth-3` |
| `--nyx-btn-primary-text` | `--kmd-color-on-primary` |
| `--nyx-sep` | `--kmd-color-border`, `--kmd-color-table-border`, `--kmd-color-blockquote-border`, `--kmd-color-scrollbar-thumb` |
| `--nyx-accent` | `--kmd-color-tertiary`, `--kmd-color-link`, `--kmd-color-outline-active-border` |
| `--nyx-accent-hover` | `--kmd-color-link-hover` |
| `--nyx-accent-bg` | `--kmd-color-selection-bg`, `--kmd-color-outline-active-bg` |
| `--nyx-positive` / `-warning` / `-error` / `-info` | `--kmd-color-success` / `-warning` / `-danger` / `-info` |
| `--nyx-font-body` / `-heading` / `-code` | `--kmd-font-body` / `--kmd-font-heading` (new token, KWEB-068) / `--kmd-font-mono` |
| `--nyx-body-size`, `--nyx-body-line` | `--kmd-font-size-body-md`, `--kmd-line-height-body-md` |
| `--nyx-heading-weight`, `--nyx-heading-line` | `--kmd-font-weight-headline-lg/md`, `--kmd-line-height-headline-lg/md` |
| `--nyx-code-size`, `--nyx-code-line` | `--kmd-font-size-code-md`, `--kmd-line-height-code-md` |
| `--nyx-label-size` / `-weight` / `-track` | `--kmd-font-size-label-caps` / `--kmd-font-weight-label-caps` / `--kmd-letter-spacing-label-caps` |
| `--nyx-radius-sm` / `-md` / `-lg` / `-xl` / `-full` (size-named radius tokens; a global radius fills gaps — component radii like `-btn`/`-tag` are never projected) | `--kmd-radius-sm` / `-md` / `-lg` / `-xl` / `-full` |

The semantic aliases (`--kmd-color-heading`, `-body`, `-muted`, `-accent`,
`-background`, `-card`, plus `--kmd-focus-outline-color`) **are re-emitted** as
`var()` references on the scope element whenever anything is emitted. This is
load-bearing, not redundancy: the default themes declare them on the ancestor
carrying the theme selector, and custom properties inherit by computed value —
the ancestor bakes them to the default base values, so a scoped override of
the base tokens alone would never reach anything styled through an alias
(including the reader background itself).

`authoredMode` is informational (both modes are always emitted): the polarity
of the design's page background, else its surface, else the inverse of its
text color.

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

### 5. Dark/light derivation (KWEB-068)

Derivation of the non-authored mode is the showcase's, unchanged and shared:
`buildShowcaseThemeVars` classifies tokens by light/dark affinity (`…-on-dark`,
`dark-surface`, …), scores candidates per variable with keyword confidence,
keeps accents identical across modes, derives missing structural values
conservatively (charcoal band for backgrounds/surfaces, lifted text, low-alpha
separators), and repairs polarity so a light-authored file never yields a
light dark-mode background or vice versa. `emitThemeTokens` adds no derivation
of its own. Deterministic: identical spec in → byte-identical output out.

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

- **Spacing and layout widths** — layout-integrity tokens; a design.md tuned
  for marketing pages can easily produce an unreadable reader. Since KWEB-068
  the body/code/label sizes and line heights and the headline weights/line
  heights *are* themed, but only through the showcase's page-clamped
  typography (`clampPageFontSize`), never raw display sizes.
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
