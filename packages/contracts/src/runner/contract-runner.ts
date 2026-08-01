// @axis-love/contracts — cross-platform conformance contract runner
//
// The contract runner loads fixture observations and checks a renderer's
// RenderResult against the expected normalized observations. It is the
// single source of truth for conformance: both the JavaScript core
// renderer and native (Unity) bridges use the same observations.
//
// Key design: the runner does NOT compare byte-identical HTML. Instead it
// checks semantic observations — presence/absence of elements, outline
// structure, feature detection flags, link classifications, diagnostics,
// and metadata. This allows native renderers to produce different HTML
// structures while conforming to the same behavioral contract.
//
// Native consumers implement the ContractRenderer interface (a thin bridge
// to their rendering pipeline) and call `runConformance` with the same
// fixture and observation data. See NATIVE_CONFORMANCE.md for guidance.

import type {
  AssertionResult,
  ContractRenderer,
  ContractRunResult,
  FixtureAssertionResult,
  FixtureObservation,
} from "../conformance";
import type { DiagnosticSeverity, RenderResult } from "../render";

// ---------------------------------------------------------------------------
// Severity ordering for minSeverity checks
// ---------------------------------------------------------------------------

const SEVERITY_ORDER: Readonly<Record<DiagnosticSeverity, number>> = {
  info: 0,
  warning: 1,
  error: 2,
};

// ---------------------------------------------------------------------------
// Assertion helpers
// ---------------------------------------------------------------------------

function checkHtml(result: RenderResult, observation: FixtureObservation): AssertionResult[] {
  const assertions: AssertionResult[] = [];
  const html = observation.html;
  if (!html) return assertions;

  const output = result.html;

  for (const expected of html.mustContain) {
    assertions.push({
      name: `html.mustContain:${expected}`,
      passed: output.includes(expected),
      message: `HTML must contain "${expected}" but it was not found`,
      severity: "error",
    });
  }

  for (const forbidden of html.mustNotContain) {
    assertions.push({
      name: `html.mustNotContain:${forbidden}`,
      passed: !output.includes(forbidden),
      message: `HTML must not contain "${forbidden}" but it was found`,
      severity: "error",
    });
  }

  if (html.shouldContain) {
    for (const recommended of html.shouldContain) {
      assertions.push({
        name: `html.shouldContain:${recommended}`,
        passed: output.includes(recommended),
        message: `HTML should contain "${recommended}" but it was not found`,
        severity: "warning",
      });
    }
  }

  return assertions;
}

function checkOutline(result: RenderResult, observation: FixtureObservation): AssertionResult[] {
  const assertions: AssertionResult[] = [];
  const outlineObs = observation.outline;
  if (!outlineObs) return assertions;

  const expected = outlineObs.entries;
  const actual = result.outline;

  assertions.push({
    name: "outline.length",
    passed: actual.length === expected.length,
    message: `Outline length: expected ${expected.length}, got ${actual.length}`,
    severity: "error",
  });

  const minLen = Math.min(actual.length, expected.length);
  for (let i = 0; i < minLen; i++) {
    const exp = expected[i];
    const act = actual[i];
    if (!exp || !act) continue;

    assertions.push({
      name: `outline[${i}].level`,
      passed: act.level === exp.level,
      message: `Outline[${i}] level: expected ${exp.level}, got ${act.level}`,
      severity: "error",
    });

    assertions.push({
      name: `outline[${i}].text`,
      passed: act.text === exp.text,
      message: `Outline[${i}] text: expected "${exp.text}", got "${act.text}"`,
      severity: "error",
    });

    assertions.push({
      name: `outline[${i}].slug`,
      passed: act.slug === exp.slug,
      message: `Outline[${i}] slug: expected "${exp.slug}", got "${act.slug}"`,
      severity: "error",
    });
  }

  return assertions;
}

function checkDiagnostics(
  result: RenderResult,
  observation: FixtureObservation,
): AssertionResult[] {
  const assertions: AssertionResult[] = [];
  const diagObs = observation.diagnostics;
  if (!diagObs) return assertions;

  const diags = result.diagnostics;
  const codes = diags.map((d) => d.code).filter((c): c is string => c !== undefined);

  if (diagObs.mustIncludeCodes) {
    for (const code of diagObs.mustIncludeCodes) {
      assertions.push({
        name: `diagnostics.mustIncludeCode:${code}`,
        passed: codes.includes(code),
        message: `Expected diagnostic with code "${code}" but none was found`,
        severity: "error",
      });
    }
  }

  if (diagObs.mustNotIncludeCodes) {
    for (const code of diagObs.mustNotIncludeCodes) {
      assertions.push({
        name: `diagnostics.mustNotIncludeCode:${code}`,
        passed: !codes.includes(code),
        message: `Unexpected diagnostic with code "${code}" was found`,
        severity: "error",
      });
    }
  }

  if (diagObs.minSeverity) {
    const threshold = SEVERITY_ORDER[diagObs.minSeverity];
    const hasSevere = diags.some((d) => SEVERITY_ORDER[d.severity] >= threshold);
    assertions.push({
      name: `diagnostics.minSeverity:${diagObs.minSeverity}`,
      passed: hasSevere,
      message: `Expected at least one diagnostic with severity >= "${diagObs.minSeverity}"`,
      severity: "error",
    });
  }

  return assertions;
}

function checkAssets(result: RenderResult, observation: FixtureObservation): AssertionResult[] {
  const assertions: AssertionResult[] = [];
  const assetObs = observation.assets;
  if (!assetObs) return assertions;

  const assets = result.assets;
  const urls = assets.map((a) => a.url);

  if (assetObs.count !== undefined) {
    assertions.push({
      name: "assets.count",
      passed: assets.length === assetObs.count,
      message: `Asset count: expected ${assetObs.count}, got ${assets.length}`,
      severity: "error",
    });
  }

  if (assetObs.mustIncludeUrls) {
    for (const url of assetObs.mustIncludeUrls) {
      assertions.push({
        name: `assets.mustIncludeUrl:${url}`,
        passed: urls.includes(url),
        message: `Expected asset URL "${url}" but it was not found`,
        severity: "error",
      });
    }
  }

  if (assetObs.mustNotIncludeUrls) {
    for (const url of assetObs.mustNotIncludeUrls) {
      assertions.push({
        name: `assets.mustNotIncludeUrl:${url}`,
        passed: !urls.includes(url),
        message: `Unexpected asset URL "${url}" was found`,
        severity: "error",
      });
    }
  }

  if (assetObs.mustIncludeTypes) {
    const types = assets.map((a) => a.type);
    for (const type of assetObs.mustIncludeTypes) {
      assertions.push({
        name: `assets.mustIncludeType:${type}`,
        passed: types.includes(type),
        message: `Expected asset type "${type}" but it was not found`,
        severity: "error",
      });
    }
  }

  return assertions;
}

function checkMetadata(result: RenderResult, observation: FixtureObservation): AssertionResult[] {
  const assertions: AssertionResult[] = [];
  const metaObs = observation.metadata;
  if (!metaObs) return assertions;

  const meta = result.metadata;

  if (metaObs.title !== undefined) {
    if (metaObs.title === null) {
      assertions.push({
        name: "metadata.title.absent",
        passed: meta.title === undefined || meta.title === null,
        message: "Expected no title but one was found",
        severity: "error",
      });
    } else {
      assertions.push({
        name: "metadata.title",
        passed: meta.title === metaObs.title,
        message: `Title: expected "${metaObs.title}", got "${meta.title ?? "undefined"}"`,
        severity: "error",
      });
    }
  }

  if (metaObs.description !== undefined) {
    if (metaObs.description === null) {
      assertions.push({
        name: "metadata.description.absent",
        passed: meta.description === undefined || meta.description === null,
        message: "Expected no description but one was found",
        severity: "error",
      });
    } else {
      assertions.push({
        name: "metadata.description",
        passed: meta.description === metaObs.description,
        message: `Description: expected "${metaObs.description}", got "${meta.description ?? "undefined"}"`,
        severity: "error",
      });
    }
  }

  if (metaObs.lang !== undefined) {
    if (metaObs.lang === null) {
      assertions.push({
        name: "metadata.lang.absent",
        passed: meta.lang === undefined || meta.lang === null,
        message: "Expected no lang but one was found",
        severity: "error",
      });
    } else {
      assertions.push({
        name: "metadata.lang",
        passed: meta.lang === metaObs.lang,
        message: `Lang: expected "${metaObs.lang}", got "${meta.lang ?? "undefined"}"`,
        severity: "error",
      });
    }
  }

  return assertions;
}

function checkFeatures(result: RenderResult, observation: FixtureObservation): AssertionResult[] {
  const assertions: AssertionResult[] = [];
  const featObs = observation.detectedFeatures;
  if (!featObs) return assertions;

  const features = result.detectedFeatures;

  const checks: ReadonlyArray<readonly [keyof typeof featObs, boolean]> = [
    ["hasMath", features.hasMath],
    ["hasMermaid", features.hasMermaid],
    ["hasDesignDoc", features.hasDesignDoc],
    ["hasCodeHighlighting", features.hasCodeHighlighting],
    ["hasTables", features.hasTables],
    ["hasTaskLists", features.hasTaskLists],
    ["hasFootnotes", features.hasFootnotes],
    ["hasAlerts", features.hasAlerts],
  ];

  for (const [key, actual] of checks) {
    const expected = featObs[key];
    if (expected === undefined) continue;
    assertions.push({
      name: `detectedFeatures.${key}`,
      passed: actual === expected,
      message: `Feature ${key}: expected ${expected}, got ${actual}`,
      severity: "error",
    });
  }

  return assertions;
}

// ---------------------------------------------------------------------------
// Main runner
// ---------------------------------------------------------------------------

/**
 * Run conformance checks for a single fixture.
 *
 * @param renderer — the renderer adapter to test.
 * @param source — the fixture Markdown source.
 * @param observation — the expected observations.
 * @returns the assertion results for this fixture.
 */
export async function runFixture(
  renderer: ContractRenderer,
  source: string,
  observation: FixtureObservation,
): Promise<FixtureAssertionResult> {
  const start = performance.now();
  const result = await renderer.render(source);
  const assertions: AssertionResult[] = [];

  assertions.push(...checkHtml(result, observation));
  assertions.push(...checkOutline(result, observation));
  assertions.push(...checkDiagnostics(result, observation));
  assertions.push(...checkAssets(result, observation));
  assertions.push(...checkMetadata(result, observation));
  assertions.push(...checkFeatures(result, observation));

  const durationMs = performance.now() - start;

  const passed = assertions.every((a) => a.passed);

  return {
    fixture: observation.fixture,
    passed,
    assertions,
    durationMs,
  };
}

/**
 * Run conformance checks for all fixtures.
 *
 * @param renderer — the renderer adapter to test.
 * @param sources — map of fixture path to Markdown source string.
 * @param observations — array of expected observations.
 * @returns the complete run result.
 */
export async function runConformance(
  renderer: ContractRenderer,
  sources: ReadonlyMap<string, string>,
  observations: readonly FixtureObservation[],
): Promise<ContractRunResult> {
  const start = performance.now();
  const results: FixtureAssertionResult[] = [];
  let skipped = 0;

  for (const obs of observations) {
    const source = sources.get(obs.fixture);
    if (source === undefined) {
      skipped++;
      results.push({
        fixture: obs.fixture,
        passed: false,
        assertions: [
          {
            name: "fixture.source",
            passed: false,
            message: `Source not found for fixture: ${obs.fixture}`,
            severity: "error",
          },
        ],
        durationMs: 0,
      });
      continue;
    }

    const result = await runFixture(renderer, source, obs);
    results.push(result);
  }

  const durationMs = performance.now() - start;
  const passed = results.filter((r) => r.passed).length;
  const failed = results.length - passed - skipped;

  return {
    totalFixtures: results.length,
    passed,
    failed,
    skipped,
    results,
    durationMs,
    schemaVersion: "1.0.0",
  };
}

/**
 * Format a contract run result as a human-readable summary.
 *
 * Useful for CI output and Flow completion notes.
 */
export function formatRunSummary(run: ContractRunResult): string {
  const lines: string[] = [
    `Conformance run: ${run.passed}/${run.totalFixtures} passed, ${run.failed} failed, ${run.skipped} skipped`,
    `Schema version: ${run.schemaVersion}`,
    `Duration: ${run.durationMs.toFixed(1)}ms`,
    "",
  ];

  for (const result of run.results) {
    const status = result.passed ? "PASS" : "FAIL";
    lines.push(`[${status}] ${result.fixture} (${result.durationMs.toFixed(1)}ms)`);

    if (!result.passed) {
      for (const assertion of result.assertions) {
        if (!assertion.passed) {
          lines.push(
            `  ${assertion.severity.toUpperCase()}: ${assertion.name} — ${assertion.message}`,
          );
        }
      }
    }
  }

  return lines.join("\n");
}
