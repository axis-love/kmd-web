# Native Conformance Guide

This document describes how native consumers (Unity, iOS, or any non-JavaScript platform) implement the same conformance observations as the JavaScript contract runner — without producing byte-identical HTML.

## Principle

The conformance contract is **behavioral**, not **structural**. Two renderers conform if they produce the same semantic observations for the same input fixtures, even if their HTML structures differ.

For example, the JavaScript renderer might produce `<th style="text-align:right">` while a Unity renderer produces `<th align="right">`. Both conform as long as the observation asserts "HTML must contain `<th>`" — which both satisfy.

## What native consumers must implement

### 1. ContractRenderer adapter

Implement the `ContractRenderer` interface from `@axis-love/contracts`:

```typescript
interface ContractRenderer {
  render(source: string, options?: RenderOptions): Promise<RenderResult>;
}
```

In practice, the native consumer exposes its renderer through a bridge (e.g., a Unity C# method called via IPC, or an Objective-C method via a host adapter). The bridge:

1. Receives the Markdown source string.
2. Runs the native rendering pipeline.
3. Returns a `RenderResult` with the same shape as the JavaScript version: `html`, `outline`, `diagnostics`, `assets`, `metadata`, `detectedFeatures`, `rendererVersion`.

### 2. Fixture and observation loading

Fixtures are plain Markdown files in `packages/contracts/fixtures/`. Observations are JSON files in `packages/contracts/observations/`. Both are platform-agnostic — the native consumer reads them from the contracts package or from a bundled copy.

The manifest at `packages/contracts/manifest.json` lists all fixtures, their categories, applicability per platform, and assertion groups.

### 3. Running conformance

Call the contract runner with the native renderer adapter:

```typescript
import { runConformance, formatRunSummary } from "@axis-love/contracts/runner";

const result = await runConformance(nativeRenderer, sources, observations);
console.log(formatRunSummary(result));
```

Or implement the same assertion logic natively using the observation JSON files directly — the assertion semantics are string inclusion/exclusion checks, structural HTML checks (elements, attributes, URL schemes), outline comparisons, and feature flag comparisons.

## Assertion semantics

Each observation file may assert the following:

| Field | What it checks | How native consumers implement it |
|---|---|---|
| `html.mustContain` | Substrings that must appear in rendered HTML | String search on the native HTML output |
| `html.mustNotContain` | Substrings that must NOT appear | Negated string search |
| `html.shouldContain` | Recommended substrings (warning, not error) | String search, warn on absence |
| `html.forbiddenElements` | Element tag names that must NOT appear | Parse/enumerate tags in the output; fail if any listed tag name (case-insensitive) is present |
| `html.forbiddenAttributes` | Attribute names that must NOT appear on any element | Enumerate attributes on every element; fail if any listed name (case-insensitive) is present |
| `html.forbidEventHandlerAttributes` | No `on*` attribute may appear | Enumerate attributes; fail if any name starts with `on` (case-insensitive) |
| `html.forbiddenUrlSchemes` | URL-bearing attributes must not use listed schemes | For `href`/`src`/`data`/`poster`/`action`/`formaction`/`xlink:href` and each `srcset` candidate: decode entities + control chars + up to two rounds of percent-encoding, read the scheme before the first colon (case-insensitive), fail if it matches a listed scheme |
| `outline.entries` | Expected heading outline (level, text, slug) | Compare native outline to expected entries |
| `diagnostics.mustIncludeCodes` | Diagnostic codes that must appear | Check native diagnostic codes |
| `diagnostics.mustNotIncludeCodes` | Diagnostic codes that must not appear | Negated check |
| `diagnostics.minSeverity` | Minimum severity required | Severity ordering: info < warning < error |
| `assets.count` | Expected number of asset references | Count native asset list |
| `assets.mustIncludeUrls` | URLs that must appear | Search native asset URL list |
| `assets.mustNotIncludeUrls` | URLs that must not appear | Negated search |
| `metadata.title` | Expected document title | Compare native metadata title |
| `metadata.description` | Expected description | Compare native metadata description |
| `metadata.lang` | Expected language tag | Compare native metadata lang |
| `detectedFeatures.*` | Expected feature detection flags | Compare each flag to expected boolean |
| `links.classifications` | Expected link URL → kind mapping | Check native link classification |

### Structural vs. substring assertions (security fixtures)

Security fixtures use the **structural** `html.forbidden*` checks rather than
`mustNotContain` wherever a dangerous string can legitimately appear in prose,
code blocks, or diagram sources. Structural checks assert on the parsed output
— which elements exist, which attribute names exist, and which schemes appear
in URL attributes — so a document that merely *mentions* `javascript:` in text
still passes, while an actual `href="javascript:..."` fails. Native consumers
must implement these against their parsed output (a real element/attribute
model), not by string-searching the serialized HTML. Do not add passes that
cosmetically mutate output to satisfy substring checks; that hides real gaps
(see `@axis-love/core` SECURITY.md, "No cosmetic output mutation").

## Applicability

The manifest marks each fixture with an applicability level:

- **required** — all conformant renderers must pass. These are baseline CommonMark, GFM, security, and front matter assertions.
- **optional** — the assertion may be relaxed for platforms that lack a specific feature. For example, syntax highlighting via Shiki is optional on Unity. The fixture still runs, but failures on optional assertions produce warnings, not errors.
- **not-applicable** — the assertion does not apply to certain platforms. For example, DOM-specific checks (like `id` attribute clobbering) are `not-applicable` on Unity which has no DOM. The fixture is skipped for that platform.

## Platform matrix

| Platform | Required | Optional | Not applicable |
|---|---|---|---|
| kmd-web (JavaScript) | All required fixtures | All optional fixtures | None |
| kmd-unity (Unity) | All required fixtures | Mermaid, math, highlighting, DESIGN.md | DOM clobbering (no DOM) |

## Fixture provenance and licensing

All fixtures in this package are authored from scratch for the kmd-web conformance contract. They are derived from:

- The kmd source repository's test fixtures (`kmd/fixtures/`, `kmd/samples/`) — MIT licensed, same project.
- The CommonMark specification examples — public domain.
- The GFM specification examples — public domain.
- The OWASP XSS prevention cheat sheet patterns — Creative Commons.

No proprietary or private data is included. No iOS-specific fixtures are copied into this public repository.

## Adding new fixtures

1. Create a Markdown file in the appropriate `fixtures/` subdirectory.
2. Create a corresponding JSON observation file in `observations/`.
3. Add an entry to `manifest.json` with the correct category, applicability, platforms, and features.
4. Run the contract runner to verify the baseline passes.
5. Commit the fixture, observation, and manifest update together.