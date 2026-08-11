# kmd-web compatibility matrix

**Current release:** `0.1.0` (dist-tag `latest`, npm provenance via OIDC trusted
publishing, published 2026-08-11 from tag `v0.1.0`).
All 11 `@axis-love/*` packages are lockstep-versioned; `scripts/check-versions.mjs` enforces it.

## Consumers

| Consumer | Consumes | Version pin | Verified | Notes |
|---|---|---|---|---|
| kmd desktop (Windows/macOS, Tauri) | all 11 packages | `file:` sibling links (dev) → npm `0.1.0` at release | ✅ 337/337 tests + production build against the RC (gate Addendum v2) | switch pins to registry versions when cutting a desktop release |
| kmd-ios (private) | react/browser/core/styles via upstream merge | upstream kmd pins | ✅ rebased, built, and running against the RC with no issues (confirmed 2026-08-11) | was the last stable-gate exception |
| kmd-unity | contracts manifest + generated tokens (snapshot, no npm dep) | `contractsVersion 0.1.0`, `TOKENS_VERSION 1.0.0` | ✅ version-locked by check-versions | consumes data contracts only |
| Websites (vanilla JS) | `@axis-love/kmd-web` root entry | `@latest` | ✅ fresh-dir consumer + registry smoke test | `render` / `renderWithFeaturePlugins` / `BrowserReader` from the root |
| Websites (React) | `@axis-love/kmd-web/react` | `@latest` | ✅ fresh-dir React 19 consumer | `MarkdownReader` |
| Web Component hosts | `@axis-love/kmd-web/element` | `@latest` | ✅ packed-consumer resolution | `<kmd-reader>` |

## Runtime requirements

- Node ≥ 20 (ESM only). Browsers: evergreen (ES2022).
- React consumers: React 19 (peer range in `@axis-love/react`).
- Optional features are optional peers of `@axis-love/browser`: `@axis-love/highlighting` (Shiki), `@axis-love/math` (KaTeX), `@axis-love/mermaid`. Absent peers degrade gracefully (plain code blocks, math as source).

## Dist-tags

- `latest` → `0.1.0`
- `rc` → `0.1.0-rc.1` (the last release candidate; superseded by stable)

## Rollback / bad-release response

- A bad version is **deprecated, never unpublished**: `npm deprecate @axis-love/<pkg>@<version> "<reason>"` for each affected package, then publish a fixed lockstep version and move the dist-tag.
- Dist-tags can be repointed without republishing: `npm dist-tag add @axis-love/<pkg>@<good-version> rc`.
- Consumers pin exact versions (kmd) or a dist-tag (websites), so repointing the tag is the fastest mitigation.
- Publishing runs only from the release workflow on a `v*` tag after verify + dry-run; no local publishes.
