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
} from "../conformance.js";
import type { DiagnosticSeverity, RenderResult } from "../render.js";

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

// ---------------------------------------------------------------------------
// Structural HTML scanning
// ---------------------------------------------------------------------------
//
// Security assertions must check STRUCTURE (which elements and attributes
// exist), not raw substrings: a fixture's legitimate prose may mention
// dangerous strings ("javascript: links are blocked"), and substring
// assertions either false-fail on that prose or — worse — get "fixed" by
// cosmetically mutating the output. The scanner below extracts start tags
// and their attributes from serialized HTML so observations can assert on
// element names, attribute names, and URL schemes.
//
// It is deliberately a scanner, not a full HTML parser: renderer output is
// well-formed serialized HTML, and the scanner only needs to be accurate
// enough to enumerate tags and attributes. Raw-text element bodies
// (script/style) may confuse attribute scanning, but those elements are
// forbidden in security fixtures anyway, so the forbiddenElements
// assertion fails regardless.

/** A start tag found in the HTML: lowercase name plus attribute map. */
interface ScannedTag {
  readonly name: string;
  /** Attribute name (lowercase) → raw attribute value (entities intact). */
  readonly attrs: ReadonlyMap<string, string>;
}

/** Attributes whose values are URLs and must obey the scheme policy. */
const URL_ATTRIBUTES = new Set([
  "href",
  "src",
  "data",
  "poster",
  "action",
  "formaction",
  "xlink:href",
]);

function stripComments(html: string): string {
  return html.replace(/<!--[\s\S]*?(?:-->|$)/g, "");
}

/**
 * Scan serialized HTML and enumerate every start tag with its attributes.
 *
 * Handles double-quoted, single-quoted, and unquoted attribute values.
 * Tag matching is quote-aware, so a `>` inside a quoted attribute value
 * does not terminate the tag early.
 */
export function scanHtml(html: string): readonly ScannedTag[] {
  const tags: ScannedTag[] = [];
  const withoutComments = stripComments(html);
  // Start tag: `<name` followed by attributes (quoted values may contain
  // `<`/`>`), optionally self-closing. End tags, doctypes, and processing
  // instructions are skipped by requiring a leading letter.
  const tagRe = /<([a-zA-Z][a-zA-Z0-9:-]*)((?:[^>"']|"[^"]*"|'[^']*')*?)\s*\/?>/g;

  let tagMatch = tagRe.exec(withoutComments);
  while (tagMatch !== null) {
    const name = (tagMatch[1] ?? "").toLowerCase();
    const attrText = tagMatch[2] ?? "";
    const attrs = new Map<string, string>();

    const attrRe =
      /([a-zA-Z_:][a-zA-Z0-9_:.-]*)\s*(?:=\s*("([^"]*)"|'([^']*)'|[^\s"'>]+))?/g;
    let attrMatch = attrRe.exec(attrText);
    while (attrMatch !== null) {
      const attrName = (attrMatch[1] ?? "").toLowerCase();
      // Group 3 = double-quoted, 4 = single-quoted, 5 = unquoted.
      const value = attrMatch[3] ?? attrMatch[4] ?? attrMatch[5] ?? "";
      if (attrName && !attrs.has(attrName)) {
        attrs.set(attrName, value);
      }
      attrMatch = attrRe.exec(attrText);
    }

    tags.push({ name, attrs });
    tagMatch = tagRe.exec(withoutComments);
  }

  return tags;
}

const NAMED_ENTITIES: Readonly<Record<string, string>> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: "\u00A0",
  tab: "\t",
  newline: "\n",
};

/** Decode HTML entities (numeric + common named) in an attribute value. */
export function decodeHtmlEntities(value: string): string {
  return value.replace(/&(#x[0-9a-fA-F]+|#\d+|[a-zA-Z][a-zA-Z0-9]*);/g, (match, body: string) => {
    if (body.startsWith("#x") || body.startsWith("#X")) {
      const code = Number.parseInt(body.slice(2), 16);
      return Number.isFinite(code) && code > 0 ? String.fromCodePoint(code) : match;
    }
    if (body.startsWith("#")) {
      const code = Number.parseInt(body.slice(1), 10);
      return Number.isFinite(code) && code > 0 ? String.fromCodePoint(code) : match;
    }
    return NAMED_ENTITIES[body.toLowerCase()] ?? match;
  });
}

function decodePercentOnce(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

/**
 * Extract the scheme of a URL attribute value the way a browser would:
 * strip control characters, decode entities and up to two rounds of
 * percent-encoding, then read the segment before the first colon.
 *
 * Returns the lowercase scheme, or null when the value has no scheme
 * (relative paths, fragments, protocol-relative URLs).
 */
export function extractUrlScheme(value: string): string | null {
  // Browsers ignore control characters when resolving schemes.
  // biome-ignore lint/suspicious/noControlCharactersInRegex: intentional — mirrors browser URL parsing for scheme detection
  const stripped = decodeHtmlEntities(value).replace(/[\u0000-\u001F\u007F]/g, "");

  const candidates = [stripped, decodePercentOnce(stripped)];
  const twice = decodePercentOnce(candidates[1] ?? stripped);
  if (twice !== (candidates[1] ?? stripped)) candidates.push(twice);

  for (const candidate of candidates) {
    const colonIdx = candidate.indexOf(":");
    if (colonIdx === -1) continue;
    const scheme = candidate.slice(0, colonIdx).toLowerCase();
    // Browsers also strip whitespace inside the scheme portion.
    const clean = scheme.replace(/\s/g, "");
    if (clean.length > 0 && /^[a-z][a-z0-9+.-]*$/.test(clean)) {
      return clean;
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// Structural assertion checks
// ---------------------------------------------------------------------------

function checkHtmlStructure(
  result: RenderResult,
  observation: FixtureObservation,
): AssertionResult[] {
  const assertions: AssertionResult[] = [];
  const html = observation.html;
  if (
    !html ||
    (!html.forbiddenElements?.length &&
      !html.forbiddenAttributes?.length &&
      !html.forbidEventHandlerAttributes &&
      !html.forbiddenUrlSchemes?.length)
  ) {
    return assertions;
  }

  const tags = scanHtml(result.html);

  for (const forbidden of html.forbiddenElements ?? []) {
    const target = forbidden.toLowerCase();
    const found = tags.some((tag) => tag.name === target);
    assertions.push({
      name: `html.forbiddenElement:${forbidden}`,
      passed: !found,
      message: `Element <${forbidden}> must not appear in the rendered HTML but was found`,
      severity: "error",
    });
  }

  for (const forbidden of html.forbiddenAttributes ?? []) {
    const target = forbidden.toLowerCase();
    const found = tags.some((tag) => tag.attrs.has(target));
    assertions.push({
      name: `html.forbiddenAttribute:${forbidden}`,
      passed: !found,
      message: `Attribute "${forbidden}" must not appear on any element but was found`,
      severity: "error",
    });
  }

  if (html.forbidEventHandlerAttributes) {
    const offenders = tags.flatMap((tag) =>
      [...tag.attrs.keys()].filter((name) => name.startsWith("on")),
    );
    assertions.push({
      name: "html.forbidEventHandlerAttributes",
      passed: offenders.length === 0,
      message: `Event-handler attributes must not appear but found: ${[...new Set(offenders)].join(", ")}`,
      severity: "error",
    });
  }

  for (const scheme of html.forbiddenUrlSchemes ?? []) {
    const target = scheme.toLowerCase();
    const offenders: string[] = [];
    for (const tag of tags) {
      for (const [attrName, rawValue] of tag.attrs) {
        if (attrName === "srcset") {
          // srcset is a comma-separated list of "url descriptor" pairs.
          for (const candidate of rawValue.split(",")) {
            const url = candidate.trim().split(/\s+/)[0] ?? "";
            if (url && extractUrlScheme(url) === target) {
              offenders.push(`<${tag.name}> srcset="${url}"`);
            }
          }
          continue;
        }
        if (!URL_ATTRIBUTES.has(attrName)) continue;
        if (extractUrlScheme(rawValue) === target) {
          offenders.push(`<${tag.name}> ${attrName}="${rawValue}"`);
        }
      }
    }
    assertions.push({
      name: `html.forbiddenUrlScheme:${scheme}`,
      passed: offenders.length === 0,
      message: `URLs with scheme "${scheme}:" must not appear but found: ${offenders.join("; ")}`,
      severity: "error",
    });
  }

  return assertions;
}

function checkHtml(result: RenderResult, observation: FixtureObservation): AssertionResult[] {
  const assertions: AssertionResult[] = [];
  const html = observation.html;
  if (!html) return assertions;

  const output = result.html;

  for (const expected of html.mustContain ?? []) {
    assertions.push({
      name: `html.mustContain:${expected}`,
      passed: output.includes(expected),
      message: `HTML must contain "${expected}" but it was not found`,
      severity: "error",
    });
  }

  for (const forbidden of html.mustNotContain ?? []) {
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

  assertions.push(...checkHtmlStructure(result, observation));

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

function checkLinks(result: RenderResult, observation: FixtureObservation): AssertionResult[] {
  const assertions: AssertionResult[] = [];
  const linkObs = observation.links;
  if (!linkObs) return assertions;

  const links = result.links;

  for (const expected of linkObs.classifications) {
    const match = links.find((l) => l.rawUrl === expected.url);
    if (!match) {
      assertions.push({
        name: `links.classification:${expected.url}`,
        passed: false,
        message: `Expected link classification for "${expected.url}" but no link with that URL was found`,
        severity: "error",
      });
      continue;
    }

    assertions.push({
      name: `links.classification:${expected.url}.kind`,
      passed: match.kind === expected.kind,
      message: `Link "${expected.url}" kind: expected "${expected.kind}", got "${match.kind}"`,
      severity: "error",
    });

    if (expected.resolvedUrl !== undefined) {
      assertions.push({
        name: `links.classification:${expected.url}.resolvedUrl`,
        passed: match.resolvedUrl === expected.resolvedUrl,
        message: `Link "${expected.url}" resolvedUrl: expected "${expected.resolvedUrl}", got "${match.resolvedUrl ?? "undefined"}"`,
        severity: "error",
      });
    }
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
  assertions.push(...checkLinks(result, observation));
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
