#!/usr/bin/env node
/**
 * Bundle budget checker — compares measured sizes against budgets.json.
 *
 * Run after "npm run build" and "node scripts/size-report.mjs".
 * Reads size-report.json and checks each package against the budgets
 * defined in tests/benchmarks/budgets.json (bundle section).
 *
 * Usage:
 *   node tests/benchmarks/check-bundle-budgets.mjs
 *
 * Exit codes:
 *   0 = all sizes within budget
 *   1 = one or more hard budget failures
 *   2 = error (no size-report.json or no budgets.json)
 *
 * This script is informational by default — it reports sizes and
 * warnings. Hard failures only occur when a package exceeds its "fail"
 * threshold.
 */

import { existsSync, readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..", "..");

const sizeReportPath = join(root, "size-report.json");
const budgetsPath = join(__dirname, "budgets.json");

if (!existsSync(sizeReportPath)) {
  console.error("Missing size-report.json — run 'npm run build && node scripts/size-report.mjs' first");
  process.exit(2);
}

if (!existsSync(budgetsPath)) {
  console.error("Missing budgets.json — run 'node tests/benchmarks/generate-fixtures.mjs' first");
  process.exit(2);
}

const sizeReport = JSON.parse(readFileSync(sizeReportPath, "utf-8"));
const budgets = JSON.parse(readFileSync(budgetsPath, "utf-8"));

const violations = [];

console.log("Bundle Budget Check");
console.log("===================\n");
console.log("  Package               Raw (KB)   Gzip (KB)   Budget Raw   Budget Gzip   Status");
console.log("  ────────────────────────── ────────── ─────────── ────────── ─────────── ────────");

for (const pkg of sizeReport) {
  const shortName = pkg.package.replace("@axis-love/", "");
  const rawKB = pkg.totalRaw / 1024;
  const gzipKB = pkg.totalGzip / 1024;

  const budget = budgets.bundle?.[shortName];
  if (!budget) {
    console.log(`  ${shortName.padEnd(24)} ${rawKB.toFixed(1).padStart(10)} ${gzipKB.toFixed(1).padStart(11)}         n/a           n/a    skip`);
    continue;
  }

  let status = "ok";
  const tags = [];

  if (budget.rawFail !== undefined && rawKB > budget.rawFail) {
    status = "fail";
    tags.push("raw-fail");
  } else if (budget.rawWarn !== undefined && rawKB > budget.rawWarn) {
    status = "warn";
    tags.push("raw-warn");
  }

  if (budget.gzipFail !== undefined && gzipKB > budget.gzipFail) {
    status = "fail";
    tags.push("gzip-fail");
  } else if (budget.gzipWarn !== undefined && gzipKB > budget.gzipWarn) {
    if (status === "ok") status = "warn";
    tags.push("gzip-warn");
  }

  const rawBudgetStr = budget.rawFail !== undefined ? `${budget.rawFail}KB` : budget.rawWarn !== undefined ? `>${budget.rawWarn}KB` : "n/a";
  const gzipBudgetStr = budget.gzipFail !== undefined ? `${budget.gzipFail}KB` : budget.gzipWarn !== undefined ? `>${budget.gzipWarn}KB` : "n/a";

  console.log(
    `  ${shortName.padEnd(24)} ${rawKB.toFixed(1).padStart(10)} ${gzipKB.toFixed(1).padStart(11)} ${rawBudgetStr.padStart(11)} ${gzipBudgetStr.padStart(13)}    ${status}`,
  );

  if (status === "fail" || status === "warn") {
    violations.push({
      package: shortName,
      status,
      rawKB,
      gzipKB,
      tags,
    });
  }
}

console.log("");

if (violations.length === 0) {
  console.log("All packages within budget.");
  process.exit(0);
} else {
  const fails = violations.filter((v) => v.status === "fail");
  const warns = violations.filter((v) => v.status === "warn");
  if (warns.length > 0) {
    console.log(`Warnings: ${warns.length} package(s) approaching budget limit.`);
  }
  if (fails.length > 0) {
    console.log(`Failures: ${fails.length} package(s) exceeding budget.`);
    for (const f of fails) {
      console.log(`  FAIL ${f.package}: raw ${f.rawKB.toFixed(1)}KB, gzip ${f.gzipKB.toFixed(1)}KB [${f.tags.join(", ")}]`);
    }
    process.exit(1);
  }
  process.exit(0);
}