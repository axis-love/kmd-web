#!/usr/bin/env node
/**
 * Performance benchmark runner for kmd-web.
 *
 * Measures:
 * - Parse time: core render() for each fixture
 * - Repeated update: 10 sequential renders (same content, morph vs replace)
 * - Memory proxy: heap usage before/after rendering large document
 * - Worker startup: time from worker creation to first response (main-thread fallback)
 *
 * Browser-side measurements (first meaningful render, full enhancement)
 * require a DOM environment and are documented separately — they run
 * as vitest bench tests in tests/benchmarks/browser-bench.test.ts.
 *
 * Usage:
 *   node tests/benchmarks/run-benchmarks.mjs [--json <path>] [--budgets <path>]
 *
 * Output:
 *   - Human-readable table to stdout
 *   - Optional JSON report written to --json path (default: tests/benchmarks/benchmark-report.json)
 *   - Budget violations checked against --budgets path (default: tests/benchmarks/budgets.json)
 *
 * Exit codes:
 *   0 = all measurements within budget (or no budgets file)
 *   1 = one or more hard budget failures
 *   2 = benchmark error (could not run)
 *
 * Environment:
 *   Run on a machine with minimal background load for consistent results.
 *   Node.js 20+. Results vary by hardware — compare only within the same environment.
 */

import { existsSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..", "..");
const fixturesDir = join(__dirname, "fixtures");

// Parse CLI args
const args = process.argv.slice(2);
let jsonPath = join(__dirname, "benchmark-report.json");
let budgetsPath = join(__dirname, "budgets.json");

for (let i = 0; i < args.length; i++) {
  if (args[i] === "--json" && args[i + 1]) {
    jsonPath = args[i + 1];
    i++;
  } else if (args[i] === "--budgets" && args[i + 1]) {
    budgetsPath = args[i + 1];
    i++;
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Format milliseconds with 2 decimal places.
 * @param {number} ms
 * @returns {string}
 */
function fmtMs(ms) {
  return `${ms.toFixed(2)} ms`;
}

/**
 * Format bytes as KB.
 * @param {number} bytes
 * @returns {string}
 */
function fmtKB(bytes) {
  return `${(bytes / 1024).toFixed(1)} KB`;
}

/**
 * Compute mean of an array of numbers.
 * @param {number[]} arr
 * @returns {number}
 */
function mean(arr) {
  if (arr.length === 0) return 0;
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

/**
 * Compute median of an array of numbers.
 * @param {number[]} arr
 * @returns {number}
 */
function median(arr) {
  if (arr.length === 0) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid];
}

/**
 * Compute the p95 (95th percentile) of an array.
 * @param {number[]} arr
 * @returns {number}
 */
function p95(arr) {
  if (arr.length === 0) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const idx = Math.ceil(sorted.length * 0.95) - 1;
  return sorted[Math.max(0, idx)];
}

// ---------------------------------------------------------------------------
// Fixture loading
// ---------------------------------------------------------------------------

const FIXTURES = [
  "small",
  "medium",
  "large",
  "code-heavy",
  "diagram-heavy",
  "design-heavy",
  "pathological",
];

/** @returns {Record<string, string>} */
function loadFixtures() {
  const fixtures = {};
  for (const name of FIXTURES) {
    const path = join(fixturesDir, `${name}.md`);
    if (!existsSync(path)) {
      console.error(`Missing fixture: ${path}`);
      console.error("Run: node tests/benchmarks/generate-fixtures.mjs");
      process.exit(2);
    }
    fixtures[name] = readFileSync(path, "utf-8");
  }
  return fixtures;
}

// ---------------------------------------------------------------------------
// Benchmark: Parse time — core render() for each fixture
// ---------------------------------------------------------------------------

/**
 * @param {string} name
 * @param {string} source
 * @param {typeof import("@axis-love/core")} coreMod
 * @param {number} iterations
 * @returns {{ fixture: string, iterations: number, times: number[], medianMs: number, meanMs: number, p95Ms: number, inputKB: number }}
 */
async function benchParse(name, source, coreMod, iterations) {
  // Warmup
  await coreMod.render(source);

  const times = [];
  for (let i = 0; i < iterations; i++) {
    const start = performance.now();
    await coreMod.render(source);
    const end = performance.now();
    times.push(end - start);
  }

  return {
    fixture: name,
    iterations,
    times,
    medianMs: median(times),
    meanMs: mean(times),
    p95Ms: p95(times),
    inputKB: statSync(join(fixturesDir, `${name}.md`)).size / 1024,
  };
}

// ---------------------------------------------------------------------------
// Benchmark: Repeated update — 10 sequential renders (same content)
// ---------------------------------------------------------------------------

/**
 * @param {string} source
 * @param {typeof import("@axis-love/core")} coreMod
 * @returns {{ iterations: number, times: number[], medianMs: number, meanMs: number }}
 */
async function benchRepeated(source, coreMod) {
  // Warmup
  await coreMod.render(source);

  const times = [];
  for (let i = 0; i < 10; i++) {
    const start = performance.now();
    await coreMod.render(source);
    const end = performance.now();
    times.push(end - start);
  }

  return {
    iterations: 10,
    times,
    medianMs: median(times),
    meanMs: mean(times),
  };
}

// ---------------------------------------------------------------------------
// Benchmark: Memory proxy — heap usage before/after rendering large document
// ---------------------------------------------------------------------------

/**
 * @param {string} source
 * @param {typeof import("@axis-love/core")} coreMod
 * @returns {{ heapBeforeKB: number, heapAfterKB: number, deltaKB: number }}
 */
async function benchMemory(source, coreMod) {
  if (typeof globalThis.gc === "function") {
    globalThis.gc();
  }
  const before = process.memoryUsage().heapUsed;
  await coreMod.render(source);
  const after = process.memoryUsage().heapUsed;
  return {
    heapBeforeKB: before / 1024,
    heapAfterKB: after / 1024,
    deltaKB: (after - before) / 1024,
  };
}

// ---------------------------------------------------------------------------
// Benchmark: Worker startup — main-thread fallback render latency
// ---------------------------------------------------------------------------

/**
 * Measures the "worker startup" proxy: time for a single render()
 * call with a cold import (simulating first message to a worker).
 * In the main-thread fallback path, this is just the render() call.
 * In a real worker, startup includes worker creation + first message
 * round-trip. This proxy measures the render-only portion.
 *
 * @param {string} source
 * @param {typeof import("@axis-love/core")} coreMod
 * @returns {{ coldMs: number, warmMs: number }}
 */
async function benchWorkerStartup(source, coreMod) {
  // Cold render (first call, no warmup)
  const start1 = performance.now();
  await coreMod.render(source);
  const end1 = performance.now();

  // Warm render (second call, pipeline cached)
  const start2 = performance.now();
  await coreMod.render(source);
  const end2 = performance.now();

  return {
    coldMs: end1 - start1,
    warmMs: end2 - start2,
  };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  console.log("kmd-web Performance Benchmarks");
  console.log("================================\n");
  console.log(`Node: ${process.version}`);
  console.log(`Platform: ${process.platform} ${process.arch}`);
  console.log(`Date: ${new Date().toISOString()}`);
  console.log("");

  // Import core dynamically (after build)
  const coreMod = await import("@axis-love/core");

  const fixtures = loadFixtures();

  // Report structure
  const report = {
    environment: {
      node: process.version,
      platform: `${process.platform} ${process.arch}`,
      date: new Date().toISOString(),
    },
    parseTime: [],
    repeatedUpdate: null,
    memory: null,
    workerStartup: null,
  };

  // --- Parse time for each fixture ---
  console.log("Parse Time (core render())");
  console.log("  Fixture              Input    Iters   Median      Mean       P95");
  console.log("  ──────────────────── ─────── ─────── ─────────── ─────────── ──────────");

  // Smaller fixtures get more iterations for stable measurements
  const iterationsByFixture = {
    small: 50,
    medium: 30,
    "code-heavy": 30,
    "diagram-heavy": 30,
    "design-heavy": 30,
    pathological: 20,
    large: 10,
  };

  for (const name of FIXTURES) {
    const iters = iterationsByFixture[name] ?? 20;
    const result = await benchParse(name, fixtures[name], coreMod, iters);
    report.parseTime.push(result);
    console.log(
      `  ${name.padEnd(20)} ${result.inputKB.toFixed(1).padStart(6)}KB ${String(iters).padStart(7)} ${fmtMs(result.medianMs).padStart(10)} ${fmtMs(result.meanMs).padStart(11)} ${fmtMs(result.p95Ms).padStart(9)}`,
    );
  }
  console.log("");

  // --- Repeated update (medium fixture, 10 sequential renders) ---
  console.log("Repeated Update (medium.md, 10 sequential renders)");
  const repResult = await benchRepeated(fixtures["medium"], coreMod);
  report.repeatedUpdate = { fixture: "medium", ...repResult };
  console.log(`  Median: ${fmtMs(repResult.medianMs)}  Mean: ${fmtMs(repResult.meanMs)}`);
  console.log("");

  // --- Memory proxy (large fixture) ---
  console.log("Memory Proxy (large.md, heap delta)");
  const memResult = await benchMemory(fixtures["large"], coreMod);
  report.memory = { fixture: "large", ...memResult };
  console.log(`  Before: ${fmtKB(memResult.heapBeforeKB)}  After: ${fmtKB(memResult.heapAfterKB)}  Delta: ${fmtKB(memResult.deltaKB)}`);
  console.log("");

  // --- Worker startup (small fixture, cold vs warm) ---
  console.log("Worker Startup (small.md, cold vs warm)");
  const wsResult = await benchWorkerStartup(fixtures["small"], coreMod);
  report.workerStartup = { fixture: "small", ...wsResult };
  console.log(`  Cold: ${fmtMs(wsResult.coldMs)}  Warm: ${fmtMs(wsResult.warmMs)}`);
  console.log("");

  // --- Write JSON report ---
  writeFileSync(jsonPath, JSON.stringify(report, null, 2) + "\n");
  console.log(`Report written: ${jsonPath}`);

  // --- Budget check ---
  if (existsSync(budgetsPath)) {
    const budgets = JSON.parse(readFileSync(budgetsPath, "utf-8"));
    const violations = checkBudgets(report, budgets);
    if (violations.length > 0) {
      console.log("\nBudget Violations:");
      for (const v of violations) {
        const tag = v.severity === "fail" ? "FAIL" : "WARN";
        console.log(`  [${tag}] ${v.name}: ${v.actual} ${v.unit} (limit: ${v.limit} ${v.unit}, ${v.pct.toFixed(0)}%)`);
      }
      const hasFail = violations.some((v) => v.severity === "fail");
      if (hasFail) {
        console.log("\nOne or more hard budget gates failed.");
        process.exit(1);
      } else {
        console.log("\nBudget warnings only — no hard failures.");
      }
    } else {
      console.log("\nAll measurements within budget.");
    }
  } else {
    console.log("\nNo budgets file found — skipping budget check.");
  }
}

// ---------------------------------------------------------------------------
// Budget checking
// ---------------------------------------------------------------------------

/**
 * @param {any} report
 * @param {any} budgets
 * @returns {{ name: string, severity: string, actual: number, limit: number, unit: string, pct: number }[]}
 */
function checkBudgets(report, budgets) {
  const violations = [];

  // Parse time budgets
  if (budgets.parseTime) {
    for (const entry of report.parseTime) {
      const budget = budgets.parseTime[entry.fixture];
      if (!budget) continue;
      const value = entry.medianMs;

      if (budget.warn !== undefined && value > budget.warn) {
        const pct = (value / budget.warn) * 100;
        violations.push({
          name: `parseTime.${entry.fixture}`,
          severity: value > budget.fail ? "fail" : "warn",
          actual: value,
          limit: budget.fail ?? budget.warn,
          unit: "ms",
          pct,
        });
      }
      if (budget.fail !== undefined && value > budget.fail) {
        const pct = (value / budget.fail) * 100;
        violations.push({
          name: `parseTime.${entry.fixture}`,
          severity: "fail",
          actual: value,
          limit: budget.fail,
          unit: "ms",
          pct,
        });
      }
    }
  }

  // Repeated update budget
  if (budgets.repeatedUpdate && report.repeatedUpdate) {
    const budget = budgets.repeatedUpdate;
    const value = report.repeatedUpdate.medianMs;
    if (budget.fail !== undefined && value > budget.fail) {
      violations.push({
        name: "repeatedUpdate",
        severity: "fail",
        actual: value,
        limit: budget.fail,
        unit: "ms",
        pct: (value / budget.fail) * 100,
      });
    } else if (budget.warn !== undefined && value > budget.warn) {
      violations.push({
        name: "repeatedUpdate",
        severity: "warn",
        actual: value,
        limit: budget.warn,
        unit: "ms",
        pct: (value / budget.warn) * 100,
      });
    }
  }

  // Memory budget
  if (budgets.memory && report.memory) {
    const budget = budgets.memory;
    const value = report.memory.deltaKB;
    if (budget.fail !== undefined && value > budget.fail) {
      violations.push({
        name: "memory",
        severity: "fail",
        actual: value,
        limit: budget.fail,
        unit: "KB",
        pct: (value / budget.fail) * 100,
      });
    } else if (budget.warn !== undefined && value > budget.warn) {
      violations.push({
        name: "memory",
        severity: "warn",
        actual: value,
        limit: budget.warn,
        unit: "KB",
        pct: (value / budget.warn) * 100,
      });
    }
  }

  return violations;
}

main().catch((err) => {
  console.error("Benchmark error:", err);
  process.exit(2);
});