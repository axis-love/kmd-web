#!/usr/bin/env node
/**
 * Verify each package's dist/ contains the expected files declared in
 * package.json `files` and `exports` fields.
 *
 * Run after "npm run build" — expects dist directories to exist.
 *
 * Exit code 0 = all checks pass, 1 = one or more failures.
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
  const files = /** @type {string[]} */ (pkg.files ?? []);
  const exports = /** @type {Record<string, unknown>} */ (pkg.exports ?? {});

  // 1. Verify every path in `files` exists on disk
  for (const file of files) {
    if (!existsSync(join(pkgDir, file))) {
      console.error(`  FAIL  ${name}: files entry "${file}" does not exist`);
      failures++;
    }
  }

  // 2. dist/ must exist if there are build outputs
  const distDir = join(pkgDir, "dist");
  if (!existsSync(distDir)) {
    if (files.includes("dist")) {
      console.error(`  FAIL  ${name}: dist/ directory does not exist`);
      failures++;
    }
    return;
  }

  // 3. Verify every export path resolves to a real file or directory
  for (const [exportKey, exportValue] of Object.entries(exports)) {
    const paths = resolveExportPaths(exportValue);
    for (const { condition, path } of paths) {
      const label = condition ? `${exportKey} (${condition})` : exportKey;

      // Node's exports resolver requires every target to be a "./"-relative
      // path. A bare specifier (e.g. "@axis-love/styles/styles.css") throws
      // ERR_INVALID_PACKAGE_TARGET at resolution time, so reject it here
      // rather than letting it reach a published tarball (KWEB-040).
      if (!path.startsWith("./")) {
        console.error(
          `  FAIL  ${name}: export "${label}" → "${path}" is not a "./"-relative target ` +
            `(bare specifiers throw ERR_INVALID_PACKAGE_TARGET)`,
        );
        failures++;
        continue;
      }

      // Wildcard exports (e.g. "./fixtures/*": "./fixtures/*") — verify directory exists
      if (path.includes("*")) {
        const dir = path.replace(/\/\*$/, "");
        if (!existsSync(join(pkgDir, dir))) {
          console.error(`  FAIL  ${name}: export "${label}" → "${path}" directory does not exist`);
          failures++;
        }
        continue;
      }

      const fullPath = join(pkgDir, path);
      if (!existsSync(fullPath)) {
        console.error(`  FAIL  ${name}: export "${label}" → "${path}" does not exist`);
        failures++;
      }
    }
  }
}

/**
 * Given an export entry value, return a list of { condition, path } pairs to verify.
 * Handles both string exports and conditional export objects.
 * @param {unknown} value
 * @returns {{ condition: string, path: string }[]}
 */
function resolveExportPaths(value) {
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

console.log("Package contents check\n");

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
  console.error(`Package contents check: ${failures} failure(s)`);
  process.exit(1);
}
console.log("Package contents check: all packages OK");