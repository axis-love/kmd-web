# Releasing kmd-web

This document describes the release process, version policy, and rollback
procedure for the `@axis-love/*` packages published from this monorepo.

## Publishable packages

All 11 packages are intended for publication. They are currently `private: true`
to prevent accidental publishes during development. The release workflow
flips this by publishing with `--access public` (scoped packages are private
by default on npm).

| Package | Description | Public entry |
|---|---|---|
| `@axis-love/contracts` | Versioned schemas, fixtures, observations | `.` + `./runner` + `./fixtures/*` + `./observations/*` |
| `@axis-love/core` | DOM-free Markdown rendering core | `.` |
| `@axis-love/browser` | DOM runtime, worker bridge, cache | `.` |
| `@axis-love/styles` | Scoped reader CSS and design tokens | `.` + `./styles.css` + `./tokens.css` + `./generated/*` |
| `@axis-love/react` | React components and hooks | `.` |
| `@axis-love/element` | `<kmd-reader>` custom element | `.` |
| `@axis-love/highlighting` | Shiki syntax highlighting | `.` |
| `@axis-love/mermaid` | Mermaid diagram rendering | `.` |
| `@axis-love/math` | KaTeX math rendering | `.` |
| `@axis-love/design` | DESIGN.md extraction pipeline | `.` + `./ir` |
| `@axis-love/kmd-web` | Convenience re-exports | `.` |

## Version policy

### Lockstep (0.x)

Until the 1.0 release, all packages share a single lockstep version. Every
release bumps all packages together. This simplifies the consumer experience:
there is exactly one version to pin, and all packages are guaranteed to be
compatible.

Current version: `0.1.0` across all packages.

### Post-1.0

After 1.0, packages move to independent semver. Each package is versioned
according to its own breaking changes, features, and fixes. The convenience
package `@axis-love/kmd-web` will re-export from specific versions of its
dependencies and declare exact ranges.

### Changelog

Changes are tracked via Conventional Commits. Each commit message includes the
Flow task key (e.g. `KWEB-016`). To generate a changelog for a release:

```bash
# List commits since the last tag
git log $(git describe --tags --abbrev=0)..HEAD --oneline --format="%s"

# Or use a changelog generator if one is added later
```

The release workflow does not auto-generate a changelog file. Commits serve as
the changelog. A GitHub release is created from the tag with a summary.

## How to cut a release

### Prerequisites

1. `npm run verify` passes on `main`
2. All package versions are lockstep (check with `node -e
   "console.log(new Set(require('./packages/*/package.json'.replace('*',
   Object.keys(require('./package.json').workspaces).includes('packages/*') ?
   Object.keys(require('./package.json').workspaces).map(w=>w.replace('/*',''))
   : ['packages']).map(d=>require('./'+d+'/package.json').version)).size)"`
   — should print `1`)
3. The `publish` GitHub environment is configured with an `NPM_TOKEN` secret
4. npm trusted publishing (OIDC) is configured for the `@axis-love` scope

### Steps

1. **Verify everything passes on main:**
   ```bash
   npm run verify
   npm run check:release  # dry-run tarball + consumer verification
   ```

2. **Update all package versions (lockstep):**
   ```bash
   # Example: bump from 0.1.0 to 0.2.0
   for pkg in packages/*/package.json; do
     npm version 0.2.0 --no-git-tag-version --prefix "$(dirname "$pkg")"
   done
   ```

3. **Commit the version bump:**
   ```bash
   git add -A
   git commit -m "chore: bump version to 0.2.0"
   ```

4. **Tag and push:**
   ```bash
   git tag v0.2.0
   git push origin main
   git push origin v0.2.0
   ```

5. **The release workflow runs automatically:**
   - `verify` job: lint + typecheck + test + build + package-contents + API-surface
   - `dry-run` job: npm pack + tarball verification + fresh consumer projects +
     publish dry-run
   - `publish` job: publishes to npm with `--provenance` (OIDC trusted publishing)

6. **Create a GitHub release** from the tag with a summary of changes.

### Manual dispatch

To trigger the release workflow without a tag (e.g. for testing):

```bash
gh workflow run release.yml -f version=0.2.0
```

The `publish` job only runs on tag pushes, so manual dispatch runs verify +
dry-run only. This is useful for validating the release pipeline without
publishing.

## npm provenance

The publish job uses [npm provenance attestation](https://docs.npmjs.com/generating-provenance-statements)
via GitHub OIDC. This requires:

1. `permissions: id-token: write` on the publish job (already configured)
2. `NPM_TOKEN` secret in the `publish` GitHub environment
3. The npm publishing account has provenance enabled

No npm tokens are stored in the repository. The `NPM_TOKEN` is a GitHub
environment secret that is only available to jobs targeting the `publish`
environment. The token is never logged.

## Publishing

Both the real publish and its dry-run go through `scripts/publish-packages.mjs`,
so CI exercises the same loop that ships the release:

```bash
node scripts/publish-packages.mjs --dry-run   # CI and the release dry-run job
node scripts/publish-packages.mjs             # the release publish job
```

The script walks `packages/*`, skips any package marked `private: true` with a
log line, and runs `npm publish` **with the working directory set to that
package**. `npm publish` resolves the package from its cwd: running it from the
repo root packs the private root manifest instead, once per iteration, and ships
nothing (KWEB-041).

Dist-tags follow the version. A prerelease publishes under its prerelease
identifier (`0.1.0-rc.0` → tag `rc`) so a release candidate never becomes
`latest`; stable versions publish under `latest`.

Dry-run mode adds `--dry-run --json` (and drops `--provenance`, which needs the
release job's OIDC token) and then verifies, per package, that npm reported the
package it was pointed at: matching name, matching version, the expected tarball
filename, a `package.json` in the tarball, and every `files` entry present. Any
mismatch — including the root-cwd regression — fails the job. The run ends with a
summary listing all 11 package names, versions, dist-tags, and file counts.

Locally:
```bash
npm run build
npm run check:publish
```

## Dry-run verification

The dry-run job (`scripts/dry-run-release.mjs`) performs:

1. `npm pack` each publishable package into tarballs
2. Verify tarball file lists match `package.json` `files` field
3. Create a fresh vanilla consumer project, install all tarballs, verify
   every package's dist/index.js and dist/index.d.ts exist
4. Create a fresh React consumer project, install all tarballs + React 19,
   verify `@axis-love/react` dist contains `MarkdownReader` and
   `@axis-love/styles` CSS files exist

No workspace resolution — tarballs are installed as real `file:` dependencies.
This proves the packages work without the monorepo's workspace symlinks.

To run locally:
```bash
npm run build
npm run check:release
```

## How downstream consumers pin versions

### npm (JavaScript/TypeScript)

```bash
# Pin exact version
npm install @axis-love/core@0.2.0

# Or use a tilde range (patch only)
npm install @axis-love/core@~0.2.0
```

For the convenience package:
```bash
npm install @axis-love/kmd-web@0.2.0
```

### Unity (native port)

kmd-unity snapshots contract artifacts (fixtures, observations, manifest,
generated tokens) at a pinned `CONTRACTS_VERSION`. See
`references/unity-contract-conformance.md` in the kmd-web skill for the full
update workflow.

### Other native consumers

Pin the contracts version and snapshot the artifacts:
1. Copy `packages/contracts/fixtures/`, `packages/contracts/observations/`,
   `packages/contracts/manifest.json`
2. Copy `packages/styles/generated/unity-tokens.json` (or `tokens.css`)
3. Run conformance tests offline against the snapshot

## Rollback procedure

### Unpublish window (within 72 hours)

npm allows unpublishing within 72 hours of publication. This should only be
used for critical security issues or accidental publishes.

```bash
npm unpublish @axis-love/core@0.2.0
# Repeat for each package
```

### Deprecate (after 72 hours)

After the unpublish window, deprecate the version instead:

```bash
npm deprecate @axis-love/core@0.2.0 "Security vulnerability — upgrade to 0.2.1"
# Repeat for each package
```

### Point release

Cut a new release with the fix:
```bash
# Bump to 0.2.1
for pkg in packages/*/package.json; do
  npm version 0.2.1 --no-git-tag-version --prefix "$(dirname "$pkg")"
done
git add -A
git commit -m "fix: security patch (KWEB-XXX)"
git tag v0.2.1
git push origin main
git push origin v0.2.1
```

## Security

- Never publish from a pull request — the release workflow's `publish` job
  only triggers on tag pushes to the main repository
- Never log secrets — `NPM_TOKEN` is in a GitHub environment secret, never
  echoed
- The `publish` environment requires approval (GitHub protected environment)
- Provenance attestation links the published package to the GitHub Actions run