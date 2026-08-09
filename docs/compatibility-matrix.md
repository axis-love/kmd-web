# kmd-web compatibility matrix

**Current release:** `0.1.0-rc.0` (dist-tag `rc`, npm provenance, published 2026-08-09 from tag `v0.1.0-rc.0`).
All 11 `@axis-love/*` packages are lockstep-versioned; `scripts/check-versions.mjs` enforces it.

## Consumers

| Consumer | Consumes | Version pin | Verified against 0.1.0-rc.0 | Notes |
|---|---|---|---|---|
| kmd desktop (Windows/macOS, Tauri) | all 11 packages | `file:` sibling links (dev) → npm `0.1.0-rc.0` at release | ✅ 337/337 tests + production build (gate Addendum v2) | switch pins to registry versions when cutting a desktop release |
| kmd-ios (private) | react/browser/core/styles via upstream merge | upstream kmd pins | ⚠️ deferred — needs macOS/Xcode | must pass before stable `0.1.0` |
| kmd-unity | contracts manifest + generated tokens (snapshot, no npm dep) | `contractsVersion 0.1.0-rc.0`, `TOKENS_VERSION 1.0.0` | ✅ version-locked by check-versions | consumes data contracts only |
| Websites (vanilla JS) | `@axis-love/kmd-web` root entry | `@rc` | ✅ fresh-dir consumer + registry smoke test | `render` / `renderWithFeaturePlugins` / `BrowserReader` from the root |
| Websites (React) | `@axis-love/kmd-web/react` | `@rc` | ✅ fresh-dir React 19 consumer | `MarkdownReader` |
| Web Component hosts | `@axis-love/kmd-web/element` | `@rc` | ✅ packed-consumer resolution | `<kmd-reader>` |

## Runtime requirements

- Node ≥ 20 (ESM only). Browsers: evergreen (ES2022).
- React consumers: React 19 (peer range in `@axis-love/react`).
- Optional features are optional peers of `@axis-love/browser`: `@axis-love/highlighting` (Shiki), `@axis-love/math` (KaTeX), `@axis-love/mermaid`. Absent peers degrade gracefully (plain code blocks, math as source).

## Dist-tags

- `rc` → `0.1.0-rc.0`
- `latest` → `0.1.0-rc.0` (npm auto-assigns `latest` on first publish; the stable `0.1.0` release will take it over)

## Rollback / bad-release response

- A bad version is **deprecated, never unpublished**: `npm deprecate @axis-love/<pkg>@<version> "<reason>"` for each affected package, then publish a fixed lockstep version and move the dist-tag.
- Dist-tags can be repointed without republishing: `npm dist-tag add @axis-love/<pkg>@<good-version> rc`.
- Consumers pin exact versions (kmd) or a dist-tag (websites), so repointing the tag is the fastest mitigation.
- Publishing runs only from the release workflow on a `v*` tag after verify + dry-run; no local publishes.
