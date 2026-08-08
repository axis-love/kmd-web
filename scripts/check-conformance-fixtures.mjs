#!/usr/bin/env node
// CI guard: verify every conformance observation has a matching fixture file,
// and no fixtures are silently skipped by the runner.
//
// This script cross-references:
//  - Every JSON observation in packages/contracts/observations/**/*.json
//  - Every fixture file referenced by observation.fixture
//
// It fails if:
//  1. An observation references a fixture file that does not exist
//  2. A fixture file in packages/contracts/fixtures/ has no observation
//     (orphaned fixture — either intentionally removed or forgotten)
//  3. No observation files exist at all (suite broken)

import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "..");
const contractsDir = join(repoRoot, "packages", "contracts");
const fixturesDir = join(contractsDir, "fixtures");
const observationsDir = join(contractsDir, "observations");

let errors = 0;

function listFilesRecursive(dir, base = "") {
  const results = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const rel = base ? `${base}/${entry.name}` : entry.name;
    if (entry.isDirectory()) {
      results.push(...listFilesRecursive(join(dir, entry.name), rel));
    } else {
      results.push(rel);
    }
  }
  return results;
}

// 1. Load all observations and check their fixture files exist
const observedFixtures = new Set();
const allFixtureFiles = new Set();

// Collect all fixture files
if (existsSync(fixturesDir)) {
  for (const f of listFilesRecursive(fixturesDir)) {
    allFixtureFiles.add(f);
  }
}

// Check each observation's fixture exists
for (const category of ["markdown", "security", "features"]) {
  const dir = join(observationsDir, category);
  if (!existsSync(dir)) continue;

  for (const file of listFilesRecursive(dir, category)) {
    if (!file.endsWith(".json")) continue;
    const obsPath = join(observationsDir, file);
    const obs = JSON.parse(readFileSync(obsPath, "utf-8"));

    if (!obs.fixture) {
      console.error(`ERROR: ${file} has no "fixture" field`);
      errors++;
      continue;
    }

    observedFixtures.add(obs.fixture);

    const fixturePath = join(fixturesDir, obs.fixture);
    if (!existsSync(fixturePath)) {
      console.error(`ERROR: observation ${file} references fixture "${obs.fixture}" but file does not exist at ${fixturePath}`);
      errors++;
    }
  }
}

// 2. Check for orphaned fixtures (no observation references them)
for (const fixture of allFixtureFiles) {
  if (!observedFixtures.has(fixture)) {
    console.error(`ERROR: fixture "${fixture}" has no observation — either add an observation or remove the fixture`);
    errors++;
  }
}

// 3. Check for empty suite
if (observedFixtures.size === 0) {
  console.error("ERROR: no conformance observations found — the suite is empty");
  errors++;
}

if (errors > 0) {
  console.error(`\n${errors} conformance fixture error(s) found.`);
  process.exit(1);
}

console.log(`Conformance fixture guard: OK (${observedFixtures.size} fixtures, all have observations and files exist).`);
