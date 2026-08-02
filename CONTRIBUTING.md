# Contributing to kmd-web

Thank you for your interest in contributing to kmd-web. This document covers the essentials.

## Prerequisites

- Node.js 20 or later
- npm 10 or later

## Getting started

```bash
git clone git@github.com:axis-love/kmd-web.git
cd kmd-web
npm install
npm run verify
```

`npm run verify` runs lint, typecheck, tests, and build. All four must pass before a PR is mergeable.

## Development commands

| Command | Purpose |
|---|---|
| `npm run lint` | Lint with Biome |
| `npm run lint:fix` | Lint and auto-fix |
| `npm run format` | Format with Biome |
| `npm run typecheck` | TypeScript type checking (no emit) |
| `npm run test` | Run unit tests (Vitest) |
| `npm run test:watch` | Watch mode |
| `npm run test:coverage` | With V8 coverage |
| `npm run build` | Build all packages via `tsc --build` |
| `npm run clean` | Clean build artifacts |

## Workspace structure

kmd-web is an npm workspace monorepo. Each package lives under `packages/`:

- 11 packages with explicit boundaries (see `AGENTS.md` for the full dependency matrix)
- All packages are `private: true` until intentionally published
- ESM-first with explicit `exports` maps
- Lockstep `0.x` versioning

### Adding code to a package

1. Identify the correct package from the boundary table in `AGENTS.md`.
2. Add source files under `packages/<name>/src/`.
3. Export from `packages/<name>/src/index.ts`.
4. Add a focused test under `packages/<name>/src/`.
5. Run `npm run verify`.

## Code style

- Biome handles formatting and linting. Run `npm run lint:fix` before committing.
- Double quotes, semicolons, trailing commas, 2-space indent, 100-char line width.
- Use `import type` for type-only imports (enforced by Biome).
- Strict TypeScript: no `any` without justification, no unused locals/params.

## Commit messages

Follow [Conventional Commits](https://www.conventionalcommits.org/):

```
feat: add KaTeX render timeout (KWEB-009)
fix: sanitize raw HTML before outline extraction
docs: update package boundary table
```

Include the Flow task key (e.g. `KWEB-007`) in the subject for traceability.

## Pull requests

1. Create a branch from `main`.
2. Make focused, reviewable changes. Avoid mixing unrelated work.
3. Ensure `npm run verify` passes.
4. Reference the Flow task in the PR description.
5. For security-sensitive changes, describe the threat model and how fixtures cover it.
6. For package changes, include a package-contents check and size observation.

## CI

Every pull request and push to `main` runs:

- Lint (Biome)
- Typecheck (`tsc --build --noEmit`)
- Test (Vitest)
- Build (`tsc --build`)
- Package contents check (`scripts/check-package-contents.mjs`)
- API surface check (`scripts/check-api-surface.mjs`)
- Size report (`scripts/size-report.mjs`)
- Security audit (`npm audit`)

Build artifacts and size reports are uploaded as workflow artifacts.

## Releases

Releases are automated via `.github/workflows/release.yml`. See
[RELEASING.md](./RELEASING.md) for the full release process, version policy,
and rollback procedure.

## Security

See [SECURITY.md](./SECURITY.md) and the [Security Specification](https://github.com/axis-love/kmd/blob/main/docs/planning/09-security-privacy.md).

Markdown is untrusted content. All rendering changes must maintain the security invariants documented in the specification.

## License

By contributing, you agree that your contributions are licensed under the MIT license.