#!/usr/bin/env node
/**
 * Keep the tarball-consuming examples in sync with the workspace.
 *
 * Usage:
 *   node scripts/refresh-examples.mjs           # repack .tarballs/ + force-reinstall examples
 *   node scripts/refresh-examples.mjs --check   # fail if an example's install is stale
 *
 * examples/website consumes the library via `file:` tarballs pinned at the
 * release-candidate version. npm resolves `file:` tarballs by integrity
 * recorded in the example's package-lock.json, so when a tarball is repacked
 * with new contents under the SAME version, an existing node_modules silently
 * keeps the old contents (KWEB-049: the demo shipped UA-margin quotes/alerts
 * for a day because its install predated the scoped reader reset).
 *
 * The refresh path makes the whole chain fresh: build → pack every publishable
 * package into .tarballs/ → delete the example's node_modules + lockfile →
 * npm install. The --check path detects the tarball→install half of the chain
 * going stale: it compares the sha512 integrity recorded in the example's
 * package-lock.json against the actual hash of each current .tarballs/*.tgz.
 * It cannot detect an unpacked source change (workspace edited, tarballs not
 * repacked) — run the full refresh after any package change.
 *
 * Exit code 0 = fresh (or refreshed), 1 = stale or a step failed.
 */
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, rmSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { discoverPackages } from "./publish-packages.mjs";

const root = resolve(fileURLToPath(import.meta.url), "../..");
const tarballDir = join(root, ".tarballs");
const npmBin = process.platform === "win32" ? "npm.cmd" : "npm";
// Node refuses to spawn .cmd shims directly on Windows; a shell is required there.
const useShell = process.platform === "win32";

/** Example projects that install the library from .tarballs/ via file: deps. */
export const TARBALL_EXAMPLES = ["examples/website"];

/**
 * The tarball filename npm derives from a package name and version
 * (mirrors expectedTarballName in publish-packages.mjs).
 * @param {string} name
 * @param {string} version
 * @returns {string}
 */
export function tarballNameFor(name, version) {
  return `${name.replace(/^@/, "").replace(/\//g, "-")}-${version}.tgz`;
}

/**
 * npm lockfile integrity string (sha512-<base64>) for a file's contents.
 * @param {Buffer} contents
 * @returns {string}
 */
export function integrityFor(contents) {
  return `sha512-${createHash("sha512").update(contents).digest("base64")}`;
}

/**
 * Compare the integrity recorded in an example's package-lock.json for each
 * workspace `file:` dependency against the actual hash of the tarball it
 * points at.
 *
 * @param {object} lockfile parsed package-lock.json (lockfile v2/v3)
 * @param {Map<string, string>} tarballIntegrity tarball filename → sha512 integrity
 * @returns {string[]} problems, empty when the install matches the tarballs
 */
export function findStaleInstalls(lockfile, tarballIntegrity) {
  /** @type {string[]} */
  const problems = [];
  const packages = lockfile.packages ?? {};
  let checked = 0;

  for (const [path, entry] of Object.entries(packages)) {
    const resolved = typeof entry.resolved === "string" ? entry.resolved : "";
    const match = /\.tarballs[\\/]([^\\/]+\.tgz)$/.exec(resolved);
    if (!match) continue;
    const filename = match[1];
    checked += 1;

    const current = tarballIntegrity.get(filename);
    if (!current) {
      problems.push(`${path}: lockfile points at ${filename}, which is not in .tarballs/`);
      continue;
    }
    if (entry.integrity !== current) {
      problems.push(
        `${path}: installed from an older ${filename} (lockfile integrity does not match the current tarball)`,
      );
    }
  }

  if (checked === 0) {
    problems.push("lockfile has no .tarballs/ file: dependencies — nothing to verify");
  }
  return problems;
}

/**
 * @param {string} cmd
 * @param {string[]} args
 * @param {string} cwd
 * @returns {boolean} true on exit 0
 */
function run(cmd, args, cwd) {
  const result = spawnSync(cmd, args, { cwd, stdio: "inherit", shell: useShell });
  return result.status === 0;
}

/**
 * @param {string[]} argv
 * @returns {number} process exit code
 */
function main(argv) {
  const checkOnly = argv.includes("--check");
  const publishable = discoverPackages().filter((pkg) => !pkg.private);

  if (checkOnly) {
    console.log("Example freshness check\n");
    const tarballIntegrity = new Map();
    for (const pkg of publishable) {
      const filename = tarballNameFor(pkg.name, pkg.version);
      const tarballPath = join(tarballDir, filename);
      if (existsSync(tarballPath)) {
        tarballIntegrity.set(filename, integrityFor(readFileSync(tarballPath)));
      }
    }

    /** @type {string[]} */
    const problems = [];
    for (const example of TARBALL_EXAMPLES) {
      const lockPath = join(root, example, "package-lock.json");
      const modulesPath = join(root, example, "node_modules");
      if (!existsSync(lockPath) || !existsSync(modulesPath)) {
        console.log(`  Skipping ${example} (not installed)`);
        continue;
      }
      const lockfile = JSON.parse(readFileSync(lockPath, "utf-8"));
      const found = findStaleInstalls(lockfile, tarballIntegrity);
      for (const problem of found) problems.push(`${example}: ${problem}`);
      if (found.length === 0) console.log(`  OK ${example}`);
    }

    if (problems.length > 0) {
      for (const problem of problems) console.error(`  STALE  ${problem}`);
      console.error(
        `\nExample installs are stale — run: npm run refresh:examples\n(${problems.length} problem(s))`,
      );
      return 1;
    }
    console.log("\nExample freshness check: OK");
    return 0;
  }

  console.log("Refreshing example installs\n");

  console.log("  Building workspace (tsc --build)...");
  if (!run(npmBin, ["exec", "--", "tsc", "--build"], root)) return 1;

  mkdirSync(tarballDir, { recursive: true });
  for (const pkg of publishable) {
    console.log(`  Packing ${pkg.name}@${pkg.version}...`);
    if (!run(npmBin, ["pack", "--pack-destination", tarballDir], pkg.dir)) return 1;
  }

  for (const example of TARBALL_EXAMPLES) {
    const exampleDir = join(root, example);
    console.log(`\n  Reinstalling ${example} (fresh node_modules + lockfile)...`);
    rmSync(join(exampleDir, "node_modules"), { recursive: true, force: true });
    rmSync(join(exampleDir, "package-lock.json"), { force: true });
    if (!run(npmBin, ["install"], exampleDir)) return 1;
  }

  console.log("\nRefresh complete. Restart any running example dev server to pick up the new install.");
  return 0;
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))) {
  process.exit(main(process.argv.slice(2)));
}
