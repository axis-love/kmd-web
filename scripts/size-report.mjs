#!/usr/bin/env node
/**
 * Report minified and gzip size of each package's dist/ output.
 * Prints a table and writes a size-report.json artifact.
 *
 * Run after "npm run build".
 *
 * Exit code 0 always (informational only, never fails CI).
 */
import { gzipSync } from "node:zlib";
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join, resolve, relative } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(fileURLToPath(import.meta.url), "../..");
const packagesDir = join(root, "packages");

/**
 * Collect all .js files in a directory tree.
 * @param {string} dir
 * @returns {string[]}
 */
function collectJsFiles(dir) {
  const results = [];
  if (!existsSync(dir)) return results;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...collectJsFiles(full));
    } else if (entry.name.endsWith(".js")) {
      results.push(full);
    }
  }
  return results;
}

/**
 * Gzip a buffer and return the compressed size.
 * @param {Buffer} buffer
 * @returns {number}
 */
function gzipSize(buffer) {
  return gzipSync(buffer).length;
}

// --- Main ---

const packages = readdirSync(packagesDir, { withFileTypes: true })
  .filter((d) => d.isDirectory())
  .map((d) => d.name)
  .sort();

/** @type {{ package: string, files: { path: string, rawBytes: number, gzipBytes: number }[], totalRaw: number, totalGzip: number }[]} */
const report = [];

console.log("Size report (dist/ .js files)\n");
console.log("  Package                      Files   Raw (KB)   Gzip (KB)");
console.log("  ──────────────────────────── ────── ────────── ──────────");

for (const pkgName of packages) {
  const pkgDir = join(packagesDir, pkgName);
  const pkgJsonPath = join(pkgDir, "package.json");
  if (!existsSync(pkgJsonPath)) continue;

  const pkg = JSON.parse(readFileSync(pkgJsonPath, "utf-8"));
  const distDir = join(pkgDir, "dist");
  const jsFiles = collectJsFiles(distDir);

  let totalRaw = 0;
  let totalGzip = 0;

  for (const filePath of jsFiles) {
    const raw = readFileSync(filePath);
    const rawBytes = raw.length;
    const gzipBytes = gzipSize(raw);
    totalRaw += rawBytes;
    totalGzip += gzipBytes;
  }

  const name = pkg.name.replace("@axis-love/", "");
  console.log(
    `  ${name.padEnd(28)} ${String(jsFiles.length).padStart(6)} ${String((totalRaw / 1024).toFixed(1)).padStart(10)} ${String((totalGzip / 1024).toFixed(1)).padStart(10)}`,
  );

  report.push({
    package: pkg.name,
    files: jsFiles.map((f) => ({
      path: relative(pkgDir, f),
      rawBytes: statSync(f).size,
      gzipBytes: gzipSize(readFileSync(f)),
    })),
    totalRaw,
    totalGzip,
  });
}

console.log("");

// Write size-report.json
const reportPath = join(root, "size-report.json");
writeFileSync(reportPath, JSON.stringify(report, null, 2) + "\n");
console.log(`Written: ${relative(root, reportPath)}`);