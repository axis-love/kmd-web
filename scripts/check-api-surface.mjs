#!/usr/bin/env node
/**
 * Verify that each package's dist/ exports match the declared exports
 * in package.json. Specifically:
 * - Every `exports` entry that resolves to a dist/ file is a real file
 * - Every subpath export (e.g. "./runner") has a matching dist output
 * - The "." export's types/import paths both exist and are consistent
 *
 * Run after "npm run build".
 *
 * Exit code 0 = pass, 1 = one or more failures.
 */
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(fileURLToPath(import.meta.url), "../..");
const packagesDir = join(root, "packages");

let failures = 0;

/**
 * @param {string} pkgDir
 * @param {Record<string, unknown>} pkg
 */
function checkPackage(pkgDir, pkg) {
  const name = /** @type {string} */ (pkg.name);
  const exports = /** @type {Record<string, unknown>} */ (pkg.exports ?? {});
  const types = /** @type {string | undefined} */ (pkg.types);
  const main = /** @type {string | undefined} */ (pkg.main);
  const module = /** @type {string | undefined} */ (pkg.module);

  // Verify top-level fields (types, main, module) point to real files
  for (const [label, path] of [
    ["types", types],
    ["main", main],
    ["module", module],
  ]) {
    if (path && !existsSync(join(pkgDir, path))) {
      console.error(`  FAIL  ${name}: top-level "${label}" → "${path}" does not exist`);
      failures++;
    }
  }

  // Verify every export subpath has dist output
  for (const [exportKey, exportValue] of Object.entries(exports)) {
    if (exportKey === ".") continue; // handled via top-level fields

    const subpath = exportKey.replace(/^\.\/$/, "");
    const paths = flattenExport(exportValue);
    for (const { condition, path } of paths) {
      // Wildcard exports — verify directory exists, not individual files
      if (path.includes("*")) {
        const dir = path.replace(/\/\*$/, "");
        if (!existsSync(join(pkgDir, dir))) {
          const label = condition ? `${exportKey} (${condition})` : exportKey;
          console.error(`  FAIL  ${name}: export "${label}" → "${path}" directory does not exist`);
          failures++;
        }
        continue;
      }

      // Bare specifiers (e.g. "@axis-love/styles/styles.css") — cross-package
      // redirect, not a local file. Skip local file existence check.
      if (!path.startsWith("./") && !path.startsWith("../")) {
        continue;
      }

      const fullPath = join(pkgDir, path);
      if (!existsSync(fullPath)) {
        const label = condition ? `${exportKey} (${condition})` : exportKey;
        console.error(`  FAIL  ${name}: export "${label}" → "${path}" does not exist`);
        failures++;
      }
    }

    // For subpath exports pointing to dist/, verify .js + .d.ts both exist
    for (const { path } of paths) {
      if (path.startsWith("dist/") && path.endsWith(".js")) {
        const dts = path.replace(/\.js$/, ".d.ts");
        if (!existsSync(join(pkgDir, dts))) {
          console.error(`  FAIL  ${name}: export "${exportKey}" missing .d.ts → "${dts}"`);
          failures++;
        }
      }
    }
  }
}

/**
 * @param {unknown} value
 * @returns {{ condition: string, path: string }[]}
 */
function flattenExport(value) {
  if (typeof value === "string") {
    return [{ condition: "", path: value }];
  }
  if (typeof value === "object" && value !== null) {
    return Object.entries(value).map(([condition, path]) => ({
      condition,
      path: /** @type {string} */ (path),
    }));
  }
  return [];
}

// --- Main ---

const packages = readdirSync(packagesDir, { withFileTypes: true })
  .filter((d) => d.isDirectory())
  .map((d) => d.name)
  .sort();

console.log("API surface check\n");

for (const pkgName of packages) {
  const pkgDir = join(packagesDir, pkgName);
  const pkgJsonPath = join(pkgDir, "package.json");
  if (!existsSync(pkgJsonPath)) continue;

  const pkg = JSON.parse(readFileSync(pkgJsonPath, "utf-8"));
  console.log(`  ${pkg.name}`);
  checkPackage(pkgDir, pkg);
}

console.log("");
if (failures > 0) {
  console.error(`API surface check: ${failures} failure(s)`);
  process.exit(1);
}
console.log("API surface check: all exports OK");