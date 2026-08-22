# Changelog

All notable changes to kmd-web are documented here.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## Release conventions

- Packages start at `0.x` with lockstep versions across the workspace.
- Prereleases are validated by desktop before promotion to stable.
- Every release includes: changelog, provenance, package contents check, size report, test report, and migration notes for breaking changes.
- Core behavior, sanitization, and public types follow semantic versioning.
- Internal module paths are never public API.

## [Unreleased]

## [0.2.0] — 2026-08-22

DESIGN.md theming release. Themes authored as DESIGN.md token specs can now
drive the reader's live `--kmd-*` tokens end to end: extracted by a single
showcase core, emitted with semantic aliases, and accepted by every host.
Verified by kmd desktop (migrated from vendored styles to the published
`@axis-love/*` packages).

### Added (0.2.0)

- DesignMD theming ADR: API shape, token mapping, dark-derivation rules
  (KWEB-059).
- Resolved-spec `--kmd-*` theme token emitter (KWEB-060).
- All three hosts — browser, React, and the element wrapper — accept a
  designMD theme source alongside the built-in light/dark themes (KWEB-061).
- Single DESIGN.md token extractor: showcase core lives in
  `@axis-love/design` (`showcase.ts`), with the theme emitter as a fixed
  mapping on top of it (KWEB-068).
- `--kmd-font-heading` token; reader headings pick it up so DESIGN.md specs
  can set a display face for headings independently of body text (KWEB-068).
- Website demo gains a design.md picker with the kmd reference samples —
  apple, dylanbrouwer, nyx, shopvibe, thoughtstream — selectable in-app
  (KWEB-068).
- `?design=` URL param pins a DesignMD theme in the website demo
  (KWEB-061).

### Changed (0.2.0)

- Derived themes align with the design-mode showcase: comfort-band contrast,
  brand-first accent selection, and a dedicated text-secondary role
  (KWEB-060).
- Semantic alias tokens are re-emitted on the scope element so alias-based
  CSS keeps working under live theme switches (KWEB-060).
- Text-role colors with unreadable contrast against the theme background are
  skipped instead of shipped (KWEB-060).
- ADR 0001 (rendering architecture) accepted after review (KWEB-058).

## [0.1.0] — 2026-08-11

First stable release. All 11 `@axis-love/*` packages published lockstep with
npm provenance via OIDC trusted publishing; `latest` dist-tag taken over from
the release candidates. Verified by kmd desktop (337/337 tests + production
build) and kmd-ios (rebased and running with no issues).

### Added (0.1.0)

- Per-package READMEs for every publishable package; `check-package-contents`
  warns when one goes missing (KWEB-050).
- Mermaid diagrams derive their palette from the live `--kmd-*` design tokens
  and re-render automatically on live theme switches; diagram strokes draw at
  text strength with a contrast-table regression guard (KWEB-055).
- The demo site accepts a `?theme=light|dark` query pin for side-by-side theme
  review (KWEB-056).

### Changed (0.1.0)

- npm publishing migrated to OIDC trusted publishing; the bootstrap
  bypass-2FA token is revoked and no standing credential remains anywhere in
  the pipeline (KWEB-051).
- Integration tests wait on the condition they assert instead of a fixed
  flush budget, eliminating the async-render-race false failures (KWEB-054).

### Fixed (0.1.0)

- Task-list checkboxes paint an explicit token fill and a visible border; the
  UA color-scheme background no longer leaks through `appearance: none`
  (KWEB-056).
- `mermaid` theme config passes `darkMode` as a real boolean; light mode no
  longer derives unmapped diagram variables through the dark-mode code paths
  (KWEB-055).
- `BrowserReader.dispose()` stops the mermaid theme watcher, so an unmounted
  reader is no longer retained by its observer (KWEB-055).
- `scripts/dry-run-release.mjs` tolerates CRLF `tar` listings on Windows.

### Changed (KWEB-045 — 2026-08-09)

- `@axis-love/browser` declares `@axis-love/highlighting`, `@axis-love/math` and `@axis-love/mermaid` as **optional** peer dependencies (`peerDependenciesMeta.optional`). They were previously devDependencies only, so an external consumer got no npm-level signal that the lazy-loaded features exist. Installs without them still succeed and documents still render — code unhighlighted, math left as source.
- The `@axis-love/kmd-web` root entry is renderable rather than contract-only. It now re-exports `render` (core's DOM-free pipeline), `renderWithFeaturePlugins` / `loadFeatureRehypePlugins` (the same pipeline with the optional features injected) and `BrowserReader`. `MarkdownReader` and `KmdReaderElement` stay on the `./react` and `./element` subpaths. The rationale is recorded in `packages/kmd-web/README.md`.
- `scripts/check-versions.mjs` also verifies workspace-internal dependency ranges — every field, `peerDependencies` included — so a peer range cannot drift off lockstep behind a workspace link.

### Fixed (KWEB-045 — 2026-08-09)

- `examples/vanilla/main.js` imported a render function from `@axis-love/kmd-web` that the package did not export; the example could not build against an installed package.
- `@axis-love/math`'s `ensureKatexCss()` left the KaTeX stylesheet import floating. `import()` rejects asynchronously, so the surrounding `try`/`catch` never saw it and a Node consumer died with `ERR_UNKNOWN_FILE_EXTENSION` after rendering math.
- `scripts/dry-run-release.mjs` listed tarballs by absolute path, which GNU tar reads as a remote host on Windows (`D:` → "cannot connect"), aborting the whole release check.

### Added (KWEB-003 — 2026-08-01)

- Scaffolded the kmd-web workspace with 11 packages under the `@axis-love` npm scope.
- Root workspace configuration: `package.json`, `tsconfig.base.json`, `tsconfig.json` (project references), `vitest.config.ts`, `biome.json`.
- Package directories: `contracts`, `core`, `browser`, `styles`, `react`, `element`, `design`, `highlighting`, `mermaid`, `math`, `kmd-web`.
- Each package has: `package.json` with explicit `exports`, `sideEffects` rules, peer dependencies (React where applicable), `tsconfig.json` with browser-safe build targets, and a placeholder `src/index.ts` with type stubs.
- Root scripts: `build`, `typecheck`, `test`, `lint`, `format`, `clean`, `verify`.
- Documentation: `README.md`, `AGENTS.md`, `CONTRIBUTING.md`, `SECURITY.md`, `CHANGELOG.md`.
- Example placeholders: `examples/vanilla`, `examples/react`, `examples/integration`.
- CI: GitHub Actions workflow running type/test/build checks on all packages. Publishing remains disabled.
- Unit test stubs in every package.
- Styles package includes placeholder `styles.css` and `tokens.css` with `sideEffects` configured for CSS only.