// Conformance contract suite for @axis-love/core.
//
// Loads all fixtures and observations from @axis-love/contracts,
// runs the core renderer against each fixture, and checks the
// RenderResult against the expected observations using the
// contract runner.

import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type {
  ContractRenderer,
  ContractRunResult,
  FixtureObservation,
  RenderOptions,
  RenderResult,
} from "@axis-love/contracts";
import { formatRunSummary, runConformance, runFixture } from "@axis-love/contracts/runner";
import { describe, expect, it } from "vitest";
import { render } from "./render.js";

// ---------------------------------------------------------------------------
// Renderer adapter
// ---------------------------------------------------------------------------

const coreRenderer: ContractRenderer = {
  async render(source: string, options?: RenderOptions): Promise<RenderResult> {
    return render(source, options);
  },
};

// ---------------------------------------------------------------------------
// Fixture loading
// ---------------------------------------------------------------------------

const contractsDir = dirname(fileURLToPath(import.meta.url)).replace(
  "/packages/core/src",
  "/packages/contracts",
);
const fixturesDir = join(contractsDir, "fixtures");
const observationsDir = join(contractsDir, "observations");

function listFilesRecursive(dir: string, base = ""): string[] {
  const results: string[] = [];
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

function loadObservations(): FixtureObservation[] {
  const observations: FixtureObservation[] = [];
  for (const category of ["markdown", "security", "features"]) {
    const dir = join(observationsDir, category);
    if (!existsSync(dir)) continue;
    for (const file of listFilesRecursive(dir, category)) {
      if (file.endsWith(".json")) {
        const data = JSON.parse(
          readFileSync(join(observationsDir, file), "utf-8"),
        ) as FixtureObservation;
        observations.push(data);
      }
    }
  }
  return observations;
}

function loadSources(observations: readonly FixtureObservation[]): Map<string, string> {
  const sources = new Map<string, string>();
  for (const obs of observations) {
    const fixturePath = join(fixturesDir, obs.fixture);
    if (existsSync(fixturePath)) {
      sources.set(obs.fixture, readFileSync(fixturePath, "utf-8"));
    }
  }
  return sources;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("core conformance suite", () => {
  const observations = loadObservations();
  const sources = loadSources(observations);

  it("has loaded observations", () => {
    expect(observations.length).toBeGreaterThan(0);
  });

  it("has loaded all fixture sources", () => {
    for (const obs of observations) {
      expect(sources.has(obs.fixture), `Missing source for ${obs.fixture}`).toBe(true);
    }
  });

  // Run the full conformance suite
  let runResult: ContractRunResult | null = null;

  it("passes the full conformance suite", async () => {
    runResult = await runConformance(coreRenderer, sources, observations);
    const summary = formatRunSummary(runResult);
    // Log the summary for debugging
    console.info(summary);
    expect(runResult.failed).toBe(0);
  }, 60_000);

  // Per-fixture tests for granular reporting
  for (const obs of observations) {
    const source = sources.get(obs.fixture);
    if (!source) continue;

    it(`${obs.fixture}: ${obs.description}`, async () => {
      const result = await runFixture(coreRenderer, source, obs);
      if (!result.passed) {
        const failures = result.assertions
          .filter((a) => !a.passed)
          .map((a) => `${a.name} — ${a.message}`)
          .join("\n  ");
        throw new Error(`Failures:\n  ${failures}`);
      }
      expect(result.passed).toBe(true);
    }, 10_000);
  }
});
