#!/usr/bin/env node
/**
 * Verify one coherent version across every manifest and every exported package
 * VERSION constant.
 *
 * Usage:
 *   node scripts/check-versions.mjs
 *
 * Workspace packages are versioned in lockstep until 1.0 (see RELEASING.md), and
 * each package also re-declares its version as an exported constant so consumers
 * can read it at runtime. Those two sides drifted apart at the KWEB-024 RC freeze:
 * every package.json moved to 0.1.0-rc.0 while every VERSION constant stayed on
 * 0.1.0, so `@axis-love/core` reported a `rendererVersion` that was never
 * published (KWEB-043). This guard fails the build instead.
 *
 * It checks that:
 *  1. The root manifest and all packages/*\/package.json share one version.
 *  2. Every package registers its version constant here, and that constant
 *     equals the package's own manifest version.
 *  3. No unregistered `export const *VERSION` is silently drifting — a new one
 *     must be registered as either a package version or an artifact version.
 *  4. The contracts manifest's `contractsVersion` matches the lockstep version.
 *
 * Exit code 0 = every version agrees, 1 = one or more disagree.
 */
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const defaultRoot = resolve(fileURLToPath(import.meta.url), "../..");

/**
 * The runtime version constant each package exports, by package directory.
 * Every directory under packages/ must appear here.
 * @type {Record<string, string>}
 */
export const PACKAGE_VERSION_CONSTANTS = {
  browser: "BROWSER_VERSION",
  contracts: "CONTRACTS_VERSION",
  core: "CORE_VERSION",
  design: "DESIGN_VERSION",
  element: "ELEMENT_VERSION",
  highlighting: "HIGHLIGHTING_VERSION",
  "kmd-web": "VERSION",
  math: "MATH_VERSION",
  mermaid: "MERMAID_VERSION",
  react: "REACT_PACKAGE_VERSION",
  styles: "STYLES_VERSION",
};

/**
 * Version constants that describe a data artifact's schema rather than the
 * package itself. These version independently of the npm release and are
 * exempt from lockstep.
 * @type {Record<string, string[]>}
 */
export const ARTIFACT_VERSION_CONSTANTS = {
  // Shape of packages/contracts/manifest.json, consumed by native ports.
  contracts: ["MANIFEST_SCHEMA_VERSION"],
  // Shape of the generated design-token artifacts.
  styles: ["TOKENS_VERSION"],
};

/**
 * @typedef {object} VersionConstant
 * @property {string} name
 * @property {string} value
 * @property {string} file  path as given to the parser
 */

/**
 * @typedef {object} ManifestVersion
 * @property {string} label  human-readable manifest identity
 * @property {string} version
 */

/**
 * Every `export const SOMETHING_VERSION = "..."` in a source file.
 * @param {string} source
 * @param {string} [file]
 * @returns {VersionConstant[]}
 */
export function parseVersionConstants(source, file = "") {
  /** @type {VersionConstant[]} */
  const found = [];
  const pattern = /export const ([A-Z][A-Z0-9_]*)\s*(?::[^=]+)?=\s*"([^"]*)"/g;
  for (const match of source.matchAll(pattern)) {
    if (!match[1].endsWith("VERSION")) continue;
    found.push({ name: match[1], value: match[2], file });
  }
  return found;
}

/**
 * Confirm every manifest carries the same version.
 * @param {ManifestVersion[]} manifests
 * @returns {string[]} problems, empty when the workspace is in lockstep
 */
export function lockstepProblems(manifests) {
  if (manifests.length === 0) return ["no package manifests found"];

  const versions = [...new Set(manifests.map((m) => m.version))];
  if (versions.length === 1) return [];

  // Report against the most common version so the outliers are the ones named.
  const counts = new Map();
  for (const { version } of manifests) counts.set(version, (counts.get(version) ?? 0) + 1);
  const [expected] = [...counts.entries()].sort((a, b) => b[1] - a[1])[0];

  return manifests
    .filter((m) => m.version !== expected)
    .map((m) => `${m.label}: version "${m.version}" breaks lockstep (expected "${expected}")`);
}

/**
 * Confirm a package's exported version constant matches its manifest, and that
 * no other version constant is drifting unregistered.
 * @param {object} pkg
 * @param {string} pkg.dirName          directory under packages/
 * @param {string} pkg.name             package.json "name"
 * @param {string} pkg.version          package.json "version"
 * @param {VersionConstant[]} pkg.constants  every version constant in its sources
 * @returns {string[]} problems, empty when the package is coherent
 */
export function constantProblems(pkg) {
  /** @type {string[]} */
  const problems = [];

  const expectedName = PACKAGE_VERSION_CONSTANTS[pkg.dirName];
  if (!expectedName) {
    return [
      `${pkg.name}: no version constant registered for packages/${pkg.dirName} — add one to PACKAGE_VERSION_CONSTANTS in scripts/check-versions.mjs`,
    ];
  }

  const declared = pkg.constants.filter((c) => c.name === expectedName);
  if (declared.length === 0) {
    problems.push(`${pkg.name}: exports no ${expectedName} constant`);
  }
  for (const constant of declared) {
    if (constant.value !== pkg.version) {
      problems.push(
        `${pkg.name}: ${expectedName} is "${constant.value}" in ${constant.file} but package.json says "${pkg.version}"`,
      );
    }
  }

  const exempt = new Set(ARTIFACT_VERSION_CONSTANTS[pkg.dirName] ?? []);
  for (const constant of pkg.constants) {
    if (constant.name === expectedName || exempt.has(constant.name)) continue;
    problems.push(
      `${pkg.name}: unregistered version constant ${constant.name} in ${constant.file} — register it in PACKAGE_VERSION_CONSTANTS or ARTIFACT_VERSION_CONSTANTS`,
    );
  }

  return problems;
}

/**
 * Every non-test TypeScript source file under a directory.
 * @param {string} dir
 * @returns {string[]} absolute paths
 */
function listSourceFiles(dir) {
  if (!existsSync(dir)) return [];
  /** @type {string[]} */
  const files = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...listSourceFiles(full));
    } else if (/\.tsx?$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name)) {
      files.push(full);
    }
  }
  return files;
}

/**
 * @typedef {object} VersionReport
 * @property {string[]} problems
 * @property {string} version    the lockstep version (best guess when broken)
 * @property {number} packages   how many workspace packages were checked
 */

/**
 * Run every version check over a checkout.
 * @param {string} [root] repo root
 * @returns {VersionReport}
 */
export function checkVersions(root = defaultRoot) {
  const packagesDir = join(root, "packages");
  /** @type {string[]} */
  const problems = [];

  const rootManifest = JSON.parse(readFileSync(join(root, "package.json"), "utf-8"));
  /** @type {ManifestVersion[]} */
  const manifests = [{ label: rootManifest.name ?? "package.json", version: rootManifest.version }];

  const dirNames = readdirSync(packagesDir, { withFileTypes: true })
    .filter((d) => d.isDirectory() && existsSync(join(packagesDir, d.name, "package.json")))
    .map((d) => d.name)
    .sort();

  for (const dirName of dirNames) {
    const dir = join(packagesDir, dirName);
    const manifest = JSON.parse(readFileSync(join(dir, "package.json"), "utf-8"));
    manifests.push({ label: manifest.name, version: manifest.version });

    const constants = listSourceFiles(join(dir, "src")).flatMap((file) =>
      parseVersionConstants(readFileSync(file, "utf-8"), relative(root, file).replace(/\\/g, "/")),
    );

    problems.push(
      ...constantProblems({
        dirName,
        name: manifest.name,
        version: manifest.version,
        constants,
      }),
    );
  }

  problems.unshift(...lockstepProblems(manifests));

  // The contracts manifest is snapshotted by native ports at a pinned
  // CONTRACTS_VERSION, so it has to name the same version the package ships.
  const contractsManifestPath = join(packagesDir, "contracts", "manifest.json");
  if (existsSync(contractsManifestPath)) {
    const contractsManifest = JSON.parse(readFileSync(contractsManifestPath, "utf-8"));
    const contractsVersion = manifests.find((m) => m.label === "@axis-love/contracts")?.version;
    if (contractsManifest.contractsVersion !== contractsVersion) {
      problems.push(
        `packages/contracts/manifest.json: contractsVersion is "${contractsManifest.contractsVersion}", expected "${contractsVersion}"`,
      );
    }
  }

  return { problems, version: rootManifest.version, packages: dirNames.length };
}

// --- Main ---

/**
 * @returns {number} process exit code
 */
function main() {
  const { problems, version, packages } = checkVersions();

  if (problems.length > 0) {
    for (const problem of problems) console.error(`  FAIL  ${problem}`);
    console.error(`\nVersion check: ${problems.length} problem(s)`);
    return 1;
  }

  console.log(`Version check: OK (${packages} packages and their VERSION constants all at ${version}).`);
  return 0;
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))) {
  process.exit(main());
}
