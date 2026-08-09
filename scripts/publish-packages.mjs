#!/usr/bin/env node
/**
 * Publish every non-private workspace package from its own directory.
 *
 * Usage:
 *   node scripts/publish-packages.mjs --dry-run   # pack + verify, no registry write
 *   node scripts/publish-packages.mjs             # real publish (CI, OIDC provenance)
 *
 * `npm publish` resolves the package from its working directory. The release
 * workflow used to loop over packages/*\/ but run `npm publish` from the repo
 * root, so every iteration tried to publish the private root manifest and
 * shipped nothing (KWEB-041). Each publish now runs with cwd set to the package
 * directory, and --dry-run asserts that npm reported the package it was pointed
 * at — a regression to the root-cwd form fails CI instead of a release.
 *
 * Before anything is packed, every publishable manifest is checked for the
 * repository/bugs/homepage metadata that `npm publish --provenance` attests
 * against (KWEB-042). A missing or mismatched repository fails the run.
 *
 * Exit code 0 = every non-private package would publish its own contents,
 * 1 = one or more failures.
 */
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { basename, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const root = resolve(fileURLToPath(import.meta.url), "../..");
const defaultPackagesDir = join(root, "packages");
const npmBin = process.platform === "win32" ? "npm.cmd" : "npm";
// Node refuses to spawn .cmd shims directly on Windows; a shell is required there.
const useShell = process.platform === "win32";

/**
 * Provenance attestation ties a published tarball to a repository and commit,
 * so `npm publish --provenance` refuses to run when the manifest carries no
 * repository field — and warns when the URL does not match the building repo
 * (KWEB-042). These are the canonical values every publishable package must
 * declare.
 */
export const REPOSITORY_URL = "git+https://github.com/axis-love/kmd-web.git";
export const BUGS_URL = "https://github.com/axis-love/kmd-web/issues";
export const HOMEPAGE_PREFIX = "https://github.com/axis-love/kmd-web/tree/main/packages/";

/**
 * @typedef {object} WorkspacePackage
 * @property {string} dir     absolute package directory
 * @property {string} name    package.json "name"
 * @property {string} version package.json "version"
 * @property {boolean} private package.json "private" === true
 * @property {string[]} files package.json "files"
 * @property {unknown} repository package.json "repository"
 * @property {unknown} bugs       package.json "bugs"
 * @property {unknown} homepage   package.json "homepage"
 */

/**
 * @typedef {object} DryRunReport
 * @property {string} name
 * @property {string} version
 * @property {string} [filename]
 * @property {({ path: string } | string)[]} [files]
 */

/**
 * Every directory under packages/ that carries a package.json, sorted by name.
 * @param {string} [packagesDir]
 * @returns {WorkspacePackage[]}
 */
export function discoverPackages(packagesDir = defaultPackagesDir) {
  return readdirSync(packagesDir, { withFileTypes: true })
    .filter((d) => d.isDirectory() && existsSync(join(packagesDir, d.name, "package.json")))
    .map((d) => {
      const dir = join(packagesDir, d.name);
      const pkg = JSON.parse(readFileSync(join(dir, "package.json"), "utf-8"));
      return {
        dir,
        name: /** @type {string} */ (pkg.name),
        version: /** @type {string} */ (pkg.version),
        private: pkg.private === true,
        files: /** @type {string[]} */ (pkg.files ?? []),
        repository: pkg.repository,
        bugs: pkg.bugs,
        homepage: pkg.homepage,
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Confirm a publishable package declares the repository metadata that
 * `npm publish --provenance` requires, plus the bugs/homepage links that make
 * the registry page usable.
 * @param {WorkspacePackage} pkg
 * @returns {string[]} problems, empty when the manifest is publish-ready
 */
export function verifyProvenanceMetadata(pkg) {
  /** @type {string[]} */
  const problems = [];
  const dirName = basename(pkg.dir);

  const repository = pkg.repository;
  if (repository === undefined || repository === null) {
    problems.push(
      `${pkg.name}: package.json has no "repository" field — npm publish --provenance cannot attest it`,
    );
  } else if (typeof repository !== "object" || Array.isArray(repository)) {
    // The shorthand string form is valid npm, but provenance tooling and the
    // "directory" hint both want the object form in a monorepo.
    problems.push(`${pkg.name}: "repository" must be an object with type/url/directory`);
  } else {
    const repo = /** @type {Record<string, unknown>} */ (repository);
    if (repo.type !== "git") {
      problems.push(`${pkg.name}: "repository.type" is "${repo.type}", expected "git"`);
    }
    if (repo.url !== REPOSITORY_URL) {
      problems.push(`${pkg.name}: "repository.url" is "${repo.url}", expected "${REPOSITORY_URL}"`);
    }
    if (repo.directory !== `packages/${dirName}`) {
      problems.push(
        `${pkg.name}: "repository.directory" is "${repo.directory}", expected "packages/${dirName}"`,
      );
    }
  }

  const bugs = pkg.bugs;
  if (typeof bugs !== "object" || bugs === null || /** @type {any} */ (bugs).url !== BUGS_URL) {
    problems.push(`${pkg.name}: "bugs.url" must be "${BUGS_URL}"`);
  }

  if (pkg.homepage !== `${HOMEPAGE_PREFIX}${dirName}#readme`) {
    problems.push(
      `${pkg.name}: "homepage" is "${pkg.homepage}", expected "${HOMEPAGE_PREFIX}${dirName}#readme"`,
    );
  }

  return problems;
}

/**
 * Prerelease versions publish under their prerelease identifier so that a
 * release candidate never becomes the "latest" tag.
 * @param {string} version
 * @returns {string}
 */
export function distTagFor(version) {
  const prerelease = /^\d+\.\d+\.\d+-([0-9A-Za-z-]+)/.exec(version);
  return prerelease ? prerelease[1] : "latest";
}

/**
 * The tarball name npm derives from a package name and version.
 * @param {string} name
 * @param {string} version
 * @returns {string}
 */
export function expectedTarballName(name, version) {
  return `${name.replace(/^@/, "").replace(/\//g, "-")}-${version}.tgz`;
}

/**
 * `npm publish --json` reports either a flat object or one keyed by package
 * name depending on the npm major. Accept both, reject anything else.
 * @param {string} stdout
 * @returns {DryRunReport | null}
 */
export function parseDryRunReport(stdout) {
  const start = stdout.indexOf("{");
  const end = stdout.lastIndexOf("}");
  if (start === -1 || end <= start) return null;

  let parsed;
  try {
    parsed = JSON.parse(stdout.slice(start, end + 1));
  } catch {
    return null;
  }
  if (parsed === null || typeof parsed !== "object") return null;
  if (typeof parsed.name === "string") return parsed;

  const entries = Object.values(parsed).filter(
    (v) => v !== null && typeof v === "object" && typeof v.name === "string",
  );
  return entries.length === 1 ? /** @type {DryRunReport} */ (entries[0]) : null;
}

/**
 * Confirm npm packed the package we pointed it at, with its own contents.
 * @param {WorkspacePackage} pkg
 * @param {DryRunReport | null} report
 * @returns {string[]} problems, empty when the package would publish correctly
 */
export function verifyDryRunReport(pkg, report) {
  if (!report) {
    return [`${pkg.name}: npm --dry-run produced no parsable report`];
  }

  /** @type {string[]} */
  const problems = [];

  if (report.name !== pkg.name) {
    problems.push(
      `${pkg.name}: npm reported "${report.name}" — publish did not run from ${pkg.name}'s directory`,
    );
  }
  if (report.version !== pkg.version) {
    problems.push(`${pkg.name}: npm reported version "${report.version}", expected "${pkg.version}"`);
  }

  const expectedTarball = expectedTarballName(pkg.name, pkg.version);
  if (report.filename !== undefined && report.filename !== expectedTarball) {
    problems.push(`${pkg.name}: tarball "${report.filename}", expected "${expectedTarball}"`);
  }

  const paths = (report.files ?? []).map((f) => (typeof f === "string" ? f : f.path));
  if (paths.length === 0) {
    problems.push(`${pkg.name}: tarball contains no files`);
    return problems;
  }
  if (!paths.includes("package.json")) {
    problems.push(`${pkg.name}: tarball contains no package.json`);
  }
  for (const entry of pkg.files) {
    if (!paths.some((p) => p === entry || p.startsWith(`${entry}/`))) {
      problems.push(`${pkg.name}: tarball is missing "files" entry "${entry}"`);
    }
  }

  return problems;
}

/**
 * @param {boolean} dryRun
 * @param {string} tag
 * @returns {string[]}
 */
export function npmPublishArgs(dryRun, tag) {
  const args = ["publish", "--access", "public", "--tag", tag];
  // --provenance needs the release job's OIDC token; --json gives the dry-run
  // the machine-readable report it verifies.
  args.push(...(dryRun ? ["--dry-run", "--json"] : ["--provenance"]));
  return args;
}

// --- Main ---

/**
 * @param {string[]} argv
 * @returns {number} process exit code
 */
function main(argv) {
  const dryRun = argv.includes("--dry-run");
  const packages = discoverPackages();

  /** @type {string[]} */
  const problems = [];
  /** @type {{ name: string, version: string, tag: string, entries: number }[]} */
  const handled = [];

  console.log(dryRun ? "Publish dry-run (no registry writes)\n" : "Publish packages\n");

  // Gate the whole run on manifest metadata: a real publish must not ship half
  // the packages before hitting the one that cannot be attested.
  const metadataProblems = packages
    .filter((pkg) => !pkg.private)
    .flatMap((pkg) => verifyProvenanceMetadata(pkg));
  if (metadataProblems.length > 0) {
    for (const problem of metadataProblems) console.error(`  FAIL  ${problem}`);
    console.error(`\nPublish metadata check: ${metadataProblems.length} problem(s)`);
    return 1;
  }

  for (const pkg of packages) {
    if (pkg.private) {
      console.log(`  Skipping ${pkg.name} (private)`);
      continue;
    }

    const tag = distTagFor(pkg.version);
    const cwd = relative(root, pkg.dir).replace(/\\/g, "/");
    console.log(`  ${dryRun ? "Dry-run" : "Publishing"} ${pkg.name}@${pkg.version} (tag ${tag}) from ${cwd}/`);

    const result = spawnSync(npmBin, npmPublishArgs(dryRun, tag), {
      cwd: pkg.dir,
      encoding: "utf-8",
      shell: useShell,
      // Real publishes stream npm's output straight to the job log; dry-runs
      // capture stdout so the JSON report can be verified.
      stdio: dryRun ? ["ignore", "pipe", "pipe"] : "inherit",
    });

    if (result.error) {
      problems.push(`${pkg.name}: failed to run npm (${result.error.message})`);
      continue;
    }
    if (result.status !== 0) {
      problems.push(`${pkg.name}: npm publish exited with status ${result.status}`);
      if (result.stderr) console.error(result.stderr);
      continue;
    }

    if (!dryRun) {
      handled.push({ name: pkg.name, version: pkg.version, tag, entries: 0 });
      continue;
    }

    const report = parseDryRunReport(result.stdout ?? "");
    const found = verifyDryRunReport(pkg, report);
    if (found.length > 0) {
      problems.push(...found);
      continue;
    }
    handled.push({
      name: /** @type {DryRunReport} */ (report).name,
      version: /** @type {DryRunReport} */ (report).version,
      tag,
      entries: (/** @type {DryRunReport} */ (report).files ?? []).length,
    });
  }

  console.log(`\n${dryRun ? "Would publish" : "Published"}:\n`);
  for (const { name, version, tag, entries } of handled) {
    const contents = entries > 0 ? `, ${entries} files` : "";
    console.log(`  ${name}@${version} (tag ${tag}${contents})`);
  }

  if (handled.length === 0) {
    problems.push("no publishable packages found under packages/");
  }

  console.log("");
  if (problems.length > 0) {
    for (const problem of problems) console.error(`  FAIL  ${problem}`);
    console.error(`\n${dryRun ? "Publish dry-run" : "Publish"}: ${problems.length} problem(s)`);
    return 1;
  }
  console.log(
    dryRun
      ? `Publish dry-run: ${handled.length} package(s) would publish their own contents`
      : `Publish: ${handled.length} package(s) published`,
  );
  return 0;
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))) {
  process.exit(main(process.argv.slice(2)));
}
