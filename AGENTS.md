# AGENTS.md

This file is the working contract for agents and automated contributors working on `kmd-web`.

## Read order

Before changing files, read:

1. `README.md`
2. `AGENTS.md`
3. The Flow task or issue that defines the work
4. The [North Star](https://github.com/axis-love/kmd/blob/main/docs/planning/17-kmd-ecosystem-north-star.md)
5. The [Implementation Plan](https://github.com/axis-love/kmd/blob/main/docs/planning/18-kmd-web-implementation-plan.md)
6. The [Security Specification](https://github.com/axis-love/kmd/blob/main/docs/planning/09-security-privacy.md) for any rendering, link, image, WebView, Mermaid, math, or raw HTML work

## Naming rules

- The product name is `kmd`, always lowercase.
- The npm scope is `@axis-love`.
- Sub-packages live under `@axis-love/*`.
- Do not reintroduce uppercase shorthand or previous placeholder product names.

## Architecture decisions

- ESM-first with explicit `exports` in every package.
- Workspace packages use lockstep `0.x` versions initially.
- Packages remain `private: true` until intentionally published (KWEB-016+).
- `core` has no DOM, React, Tauri, or Node I/O dependencies.
- `browser` consumes host capabilities (AssetResolver, LinkHandler, ClipboardProvider) — never detects Tauri.
- React and ReactDOM are peer dependencies in `@axis-love/react`.
- Heavy features (highlighting, mermaid, math, design) are lazy-loaded and must not be statically imported by core.
- CSS has `sideEffects` — all other packages are `sideEffects: false`.

## Package boundaries

| Package | May import | Must not import |
|---|---|---|
| `contracts` | (nothing) | Any implementation package |
| `core` | `contracts` | `browser`, `react`, `element`, any DOM lib |
| `browser` | `contracts`, `core` | `react`, `element` |
| `styles` | (nothing) | Any TS package |
| `react` | `contracts`, `core`, `browser`, `styles` | `element` |
| `element` | `contracts`, `core`, `browser` | `react` |
| `design` | `contracts`, `core` | `browser`, `react` |
| `highlighting` | `contracts`, `core` | `browser`, `react` |
| `mermaid` | `contracts`, `core` | `browser`, `react` |
| `math` | `contracts`, `core` | `browser`, `react` |
| `kmd-web` | All public packages | (re-exports only) |

## Work tracking

- Work from one Flow task at a time.
- Keep tasks independent. Avoid editing files outside the requested scope.
- Add focused tests for every changed behavior.
- Security-sensitive rendering changes must include malicious fixtures.
- Do not mark a task complete while any acceptance criterion is unmet.
- Record exact commands and test results in the Flow completion note.

## Testing expectations

- Run `npm run verify` before committing (lint + typecheck + test + build).
- Docs-only changes: inspect `git diff` for stale references.
- Package changes: include a package-contents check and size observation.

## Security posture

Read the [Security Specification](https://github.com/axis-love/kmd/blob/main/docs/planning/09-security-privacy.md) before any rendering, link, image, WebView, Mermaid, math, or raw HTML work.

- Treat Markdown as untrusted even when it is local.
- Sanitize after parsing and transforms, not before.
- Raw HTML uses a strict allowlist.
- Block `javascript:`, `vbscript:`, unsafe `data:`, arbitrary `file:`, and unknown custom URL schemes.
- Remote images are blocked by default or require explicit host/user action.
- External links leave the reader through a validated host action.
- Mermaid, math, and SVG cannot fetch arbitrary external resources.
- Heavy rendering has timeouts, limits, and readable fallbacks.
- Rendered content cannot invoke Tauri or privileged host APIs directly.

## Style guidance

- kmd should feel premium, calm, technical, and typography-led.
- Prefer dense but readable reader controls over landing-page patterns.