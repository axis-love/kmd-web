# Releasing kmd-web

This document describes the release process, version policy, and rollback
procedure for the `@axis-love/*` packages published from this monorepo.

## Publishable packages

All 11 packages are published. Every one carries `private: false` and
`publishConfig: { access: "public" }`; the publish script also passes
`--access public` explicitly, because scoped packages default to restricted on
npm. `scripts/publish-packages.mjs` skips any package that is marked
`private: true` with a log line, so marking a package private is how you take it
out of a release.

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

Current version: `0.1.0-rc.0` across all packages — the release candidate frozen
by the KWEB-024 ecosystem gate (see `docs/rc-gate-report.md`). Prereleases
publish under their own dist-tag, so `0.1.0-rc.0` never becomes `latest`.

### One version, three places

The same version string is written in three places, and all three are checked:

1. Every `packages/*/package.json` (plus the private root manifest).
2. Each package's exported version constant — `CORE_VERSION`,
   `BROWSER_VERSION`, `CONTRACTS_VERSION`, `REACT_PACKAGE_VERSION`,
   `@axis-love/kmd-web`'s `VERSION`, and so on. `@axis-love/core` stamps
   `CORE_VERSION` onto every `RenderResult` as `rendererVersion`, so a stale
   constant misreports which renderer produced a document.
3. `packages/contracts/manifest.json` → `contractsVersion`, which native ports
   (kmd-unity) snapshot when they pin a contract revision.

`scripts/check-versions.mjs` fails the build when any of those disagree, when a
package is missing its version constant, or when a new `export const *VERSION`
appears without being registered as either a package version or an
independently-versioned artifact schema (`MANIFEST_SCHEMA_VERSION`,
`TOKENS_VERSION`). It runs in CI, in the release workflow's `verify` job, and as
the first step of `npm run verify`:

```bash
npm run check:versions
```

Two constants are deliberately exempt from lockstep because they describe data
shapes rather than the npm release: `MANIFEST_SCHEMA_VERSION` (the conformance
manifest schema) and `TOKENS_VERSION` (the generated design-token artifacts).

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

1. `npm run verify` passes on `main` (its first step is the version check)
2. All package versions are lockstep and agree with the exported version
   constants — `npm run check:versions` prints `Version check: OK`
3. The `publish` GitHub environment is configured with an `NPM_TOKEN` secret
4. npm trusted publishing (OIDC) is configured for the `@axis-love` scope

### Steps

1. **Verify everything passes on main:**
   ```bash
   npm run verify
   npm run check:publish  # per-package publish dry-run
   npm run check:release  # dry-run tarball + consumer verification
   ```

2. **Update all package versions (lockstep):**
   ```bash
   # Example: bump from 0.1.0-rc.0 to 0.2.0
   npm version 0.2.0 --no-git-tag-version
   for pkg in packages/*/package.json; do
     npm version 0.2.0 --no-git-tag-version --prefix "$(dirname "$pkg")"
   done
   ```

3. **Update the exported version constants to match**, then re-run the guard —
   `npm version` only touches manifests:
   ```bash
   npm run check:versions   # names every constant still on the old version
   ```
   Update each reported constant (and `packages/contracts/manifest.json` →
   `contractsVersion`) until the check passes. The per-package unit tests assert
   these constants literally, so `npm run test` has to be re-run too.

4. **Commit the version bump:**
   ```bash
   git add -A
   git commit -m "chore: bump version to 0.2.0"
   ```

5. **Tag and push:**
   ```bash
   git tag v0.2.0
   git push origin main
   git push origin v0.2.0
   ```

6. **The release workflow runs automatically:**
   - `verify` job: version check + lint + typecheck + test + build +
     package-contents + API-surface
   - `dry-run` job: npm pack + tarball verification + fresh consumer projects +
     publish dry-run (`scripts/publish-packages.mjs --dry-run`)
   - `publish` job: gated on both, tag pushes only — runs
     `scripts/publish-packages.mjs`, which publishes each package from its own
     directory with `--provenance` (OIDC trusted publishing)

7. **Create a GitHub release** from the tag with a summary of changes.

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
4. Every publishable manifest declares the metadata the attestation is tied to:
   an object-form `repository` (`git+https://github.com/axis-love/kmd-web.git`
   plus the package's own `directory`), `bugs.url`, and `homepage` (KWEB-042).
   `npm publish --provenance` refuses to run without `repository`, so
   `scripts/publish-packages.mjs` checks all 11 manifests up front and fails the
   whole run rather than shipping half a release.

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

Cut a new release with the fix (bump the exported version constants alongside
the manifests — `npm run check:versions` names any you miss):
```bash
# Bump to 0.2.1
npm version 0.2.1 --no-git-tag-version
for pkg in packages/*/package.json; do
  npm version 0.2.1 --no-git-tag-version --prefix "$(dirname "$pkg")"
done
npm run check:versions
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