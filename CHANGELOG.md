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