// Tests for the conformance contract system.
//
// These tests verify:
// 1. The manifest.json is valid and matches the expected schema.
// 2. Every fixture has a corresponding observation file.
// 3. Every observation file matches a fixture.
// 4. The contract runner correctly passes and fails assertions.
// 5. The manifest covers all required feature categories and security policies.

import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import type { ConformanceManifest, ContractRenderer, FixtureObservation } from "./conformance";
import { MANIFEST_SCHEMA_VERSION } from "./conformance";
import type { RenderOptions } from "./options";
import type { RenderResult } from "./render";
import { formatRunSummary, runFixture } from "./runner/contract-runner";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const pkgDir = dirname(fileURLToPath(import.meta.url)).replace("/src", "");
const fixturesDir = join(pkgDir, "fixtures");
const observationsDir = join(pkgDir, "observations");
const manifestPath = join(pkgDir, "manifest.json");

function readJson<T>(path: string): T {
  return JSON.parse(readFileSync(path, "utf-8")) as T;
}

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

function readFixtureFiles(category: string): string[] {
  const dir = join(fixturesDir, category);
  if (!existsSync(dir)) return [];
  return listFilesRecursive(dir, category);
}

function readObservationFiles(category: string): string[] {
  const dir = join(observationsDir, category);
  if (!existsSync(dir)) return [];
  return listFilesRecursive(dir, category);
}

// ---------------------------------------------------------------------------
// Mock renderer for runner tests
// ---------------------------------------------------------------------------

function createMockRenderer(result: Partial<RenderResult>): ContractRenderer {
  const fullResult: RenderResult = {
    html: "",
    outline: [],
    diagnostics: [],
    assets: [],
    links: [],
    metadata: {},
    detectedFeatures: {
      hasMath: false,
      hasMermaid: false,
      hasDesignDoc: false,
      hasCodeHighlighting: false,
      hasTables: false,
      hasTaskLists: false,
      hasFootnotes: false,
      hasAlerts: false,
    },
    rendererVersion: "0.1.0",
    ...result,
  };
  return {
    async render(_source: string, _options?: RenderOptions): Promise<RenderResult> {
      return fullResult;
    },
  };
}

// ---------------------------------------------------------------------------
// Manifest validation
// ---------------------------------------------------------------------------

describe("conformance manifest", () => {
  const manifest = readJson<ConformanceManifest>(manifestPath);

  it("has the correct schema version", () => {
    expect(manifest.schemaVersion).toBe(MANIFEST_SCHEMA_VERSION);
  });

  it("has the correct contracts version", () => {
    expect(manifest.contractsVersion).toBe("0.1.0");
  });

  it("lists at least 2 platforms", () => {
    expect(manifest.platforms.length).toBeGreaterThanOrEqual(2);
    expect(manifest.platforms).toContain("kmd-web");
    expect(manifest.platforms).toContain("kmd-unity");
  });

  it("has at least 20 fixtures", () => {
    expect(manifest.fixtures.length).toBeGreaterThanOrEqual(20);
  });

  it("has at least 10 assertion groups", () => {
    expect(manifest.assertionGroups.length).toBeGreaterThanOrEqual(10);
  });

  it("every fixture has valid category and applicability", () => {
    for (const fixture of manifest.fixtures) {
      expect(["markdown", "security", "features"]).toContain(fixture.category);
      expect(["required", "optional", "not-applicable"]).toContain(fixture.applicability);
      expect(fixture.platforms.length).toBeGreaterThan(0);
      expect(fixture.features.length).toBeGreaterThan(0);
    }
  });

  it("every fixture file exists on disk", () => {
    for (const fixture of manifest.fixtures) {
      const path = join(fixturesDir, fixture.fixture);
      expect(existsSync(path), `Fixture not found: ${fixture.fixture}`).toBe(true);
    }
  });

  it("every assertion group fixture exists in the manifest fixture list", () => {
    const fixturePaths = new Set(manifest.fixtures.map((f) => f.fixture));
    for (const group of manifest.assertionGroups) {
      for (const fixture of group.fixtures) {
        expect(
          fixturePaths.has(fixture),
          `Group "${group.name}" references unknown fixture: ${fixture}`,
        ).toBe(true);
      }
    }
  });

  it("covers all required reader features", () => {
    const allFeatures = new Set(manifest.fixtures.flatMap((f) => f.features));
    const requiredFeatures = [
      "paragraphs",
      "inline-styles",
      "headings",
      "lists",
      "blockquotes",
      "links",
      "images",
      "code",
      "tables",
      "task-lists",
      "footnotes",
      "alerts",
      "front-matter",
      "mermaid",
      "math",
      "design-md",
      "syntax-highlighting",
    ];
    for (const feature of requiredFeatures) {
      expect(allFeatures.has(feature), `Missing required feature: ${feature}`).toBe(true);
    }
  });

  it("covers all security policies from the security spec", () => {
    const securityFixtures = manifest.fixtures.filter((f) => f.security);
    const allSecurityFeatures = new Set(securityFixtures.flatMap((f) => f.features));
    const requiredSecurityFeatures = ["sanitization", "url-policy"];
    for (const feature of requiredSecurityFeatures) {
      expect(
        allSecurityFeatures.has(feature),
        `Missing required security feature: ${feature}`,
      ).toBe(true);
    }
  });
});

// ---------------------------------------------------------------------------
// Fixture / observation pairing
// ---------------------------------------------------------------------------

describe("fixture and observation pairing", () => {
  const categories = ["markdown", "security", "features"];

  for (const category of categories) {
    it(`every ${category} fixture has a matching observation`, () => {
      const fixtures = readFixtureFiles(category);
      const observations = readObservationFiles(category);

      for (const fixture of fixtures) {
        const obsName = fixture.replace(/\.md$/, ".json");
        expect(observations.includes(obsName), `No observation for fixture: ${fixture}`).toBe(true);
      }
    });

    it(`every ${category} observation has a matching fixture`, () => {
      const fixtures = readFixtureFiles(category);
      const observations = readObservationFiles(category);

      for (const obs of observations) {
        const fixtureName = obs.replace(/\.json$/, ".md");
        expect(fixtures.includes(fixtureName), `No fixture for observation: ${obs}`).toBe(true);
      }
    });

    it(`every ${category} observation file is valid JSON with required fields`, () => {
      const observations = readObservationFiles(category);
      for (const obs of observations) {
        const data = readJson<FixtureObservation>(join(observationsDir, obs));
        expect(data.fixture, `${obs} missing fixture field`).toBeDefined();
        expect(data.category, `${obs} missing category field`).toBe(category);
        expect(data.description, `${obs} missing description`).toBeTruthy();
      }
    });
  }
});

// ---------------------------------------------------------------------------
// Contract runner tests
// ---------------------------------------------------------------------------

describe("contract runner", () => {
  it("passes when all assertions are satisfied", async () => {
    const renderer = createMockRenderer({
      html: "<h1>Title</h1><p>Hello world</p>",
      outline: [{ level: 1, text: "Title", slug: "title" }],
    });
    const observation: FixtureObservation = {
      fixture: "test.md",
      category: "markdown",
      description: "test",
      html: {
        mustContain: ["<h1>", "Hello world"],
        mustNotContain: ["<script"],
      },
      outline: {
        entries: [{ level: 1, text: "Title", slug: "title" }],
      },
    };

    const result = await runFixture(renderer, "# Title\n\nHello world", observation);
    expect(result.passed).toBe(true);
    expect(result.assertions.every((a) => a.passed)).toBe(true);
  });

  it("fails when mustContain is missing", async () => {
    const renderer = createMockRenderer({
      html: "<p>Hello</p>",
    });
    const observation: FixtureObservation = {
      fixture: "test.md",
      category: "markdown",
      description: "test",
      html: {
        mustContain: ["<h1>"],
        mustNotContain: [],
      },
    };

    const result = await runFixture(renderer, "Hello", observation);
    expect(result.passed).toBe(false);
    const fail = result.assertions.find((a) => !a.passed);
    expect(fail).toBeDefined();
    expect(fail?.name).toContain("mustContain");
  });

  it("fails when mustNotContain is present", async () => {
    const renderer = createMockRenderer({
      html: "<p>text</p><script>alert(1)</script>",
    });
    const observation: FixtureObservation = {
      fixture: "test.md",
      category: "security",
      description: "test",
      html: {
        mustContain: ["<p>"],
        mustNotContain: ["<script"],
      },
    };

    const result = await runFixture(renderer, "text", observation);
    expect(result.passed).toBe(false);
    const fail = result.assertions.find((a) => !a.passed);
    expect(fail?.name).toContain("mustNotContain");
  });

  it("checks detected feature flags", async () => {
    const renderer = createMockRenderer({
      detectedFeatures: {
        hasMath: true,
        hasMermaid: false,
        hasDesignDoc: false,
        hasCodeHighlighting: false,
        hasTables: false,
        hasTaskLists: false,
        hasFootnotes: false,
        hasAlerts: false,
      },
    });
    const observation: FixtureObservation = {
      fixture: "test.md",
      category: "features",
      description: "test",
      detectedFeatures: {
        hasMath: true,
        hasMermaid: false,
      },
    };

    const result = await runFixture(renderer, "$E=mc^2$", observation);
    expect(result.passed).toBe(true);
  });

  it("fails when feature flag mismatch", async () => {
    const renderer = createMockRenderer({
      detectedFeatures: {
        hasMath: false,
        hasMermaid: true,
        hasDesignDoc: false,
        hasCodeHighlighting: false,
        hasTables: false,
        hasTaskLists: false,
        hasFootnotes: false,
        hasAlerts: false,
      },
    });
    const observation: FixtureObservation = {
      fixture: "test.md",
      category: "features",
      description: "test",
      detectedFeatures: {
        hasMath: true,
        hasMermaid: false,
      },
    };

    const result = await runFixture(renderer, "test", observation);
    expect(result.passed).toBe(false);
  });

  it("checks outline entries with slug deduplication", async () => {
    const renderer = createMockRenderer({
      outline: [
        { level: 2, text: "Duplicate", slug: "duplicate" },
        { level: 2, text: "Duplicate", slug: "duplicate-2" },
      ],
    });
    const observation: FixtureObservation = {
      fixture: "test.md",
      category: "markdown",
      description: "test",
      outline: {
        entries: [
          { level: 2, text: "Duplicate", slug: "duplicate" },
          { level: 2, text: "Duplicate", slug: "duplicate-2" },
        ],
      },
    };

    const result = await runFixture(renderer, "test", observation);
    expect(result.passed).toBe(true);
  });

  it("checks metadata extraction", async () => {
    const renderer = createMockRenderer({
      metadata: { title: "Test", description: "A test", lang: "en" },
    });
    const observation: FixtureObservation = {
      fixture: "test.md",
      category: "features",
      description: "test",
      metadata: {
        title: "Test",
        description: "A test",
        lang: "en",
      },
    };

    const result = await runFixture(renderer, "test", observation);
    expect(result.passed).toBe(true);
  });

  it("checks diagnostic codes", async () => {
    const renderer = createMockRenderer({
      diagnostics: [{ severity: "warning", message: "Unsafe URL", code: "unsafe-url" }],
    });
    const observation: FixtureObservation = {
      fixture: "test.md",
      category: "security",
      description: "test",
      diagnostics: {
        mustIncludeCodes: ["unsafe-url"],
        mustNotIncludeCodes: ["parse-error"],
        minSeverity: "warning",
      },
    };

    const result = await runFixture(renderer, "test", observation);
    expect(result.passed).toBe(true);
  });

  it("checks link classifications", async () => {
    const renderer = createMockRenderer({
      links: [
        { kind: "external", rawUrl: "https://example.com", resolvedUrl: "https://example.com" },
        { kind: "blocked", rawUrl: "javascript:alert(1)", reason: "unsafe-url" },
      ],
    });
    const observation: FixtureObservation = {
      fixture: "test.md",
      category: "security",
      description: "test",
      links: {
        classifications: [
          { url: "https://example.com", kind: "external" },
          { url: "javascript:alert(1)", kind: "blocked" },
        ],
      },
    };

    const result = await runFixture(renderer, "test", observation);
    expect(result.passed).toBe(true);
  });

  it("fails when link classification kind mismatches", async () => {
    const renderer = createMockRenderer({
      links: [
        { kind: "external", rawUrl: "https://example.com", resolvedUrl: "https://example.com" },
      ],
    });
    const observation: FixtureObservation = {
      fixture: "test.md",
      category: "security",
      description: "test",
      links: {
        classifications: [{ url: "https://example.com", kind: "blocked" }],
      },
    };

    const result = await runFixture(renderer, "test", observation);
    expect(result.passed).toBe(false);
    const fail = result.assertions.find((a) => !a.passed);
    expect(fail?.name).toContain("links.classification");
  });

  it("fails when link URL not found in classifications", async () => {
    const renderer = createMockRenderer({
      links: [],
    });
    const observation: FixtureObservation = {
      fixture: "test.md",
      category: "security",
      description: "test",
      links: {
        classifications: [{ url: "javascript:alert(1)", kind: "blocked" }],
      },
    };

    const result = await runFixture(renderer, "test", observation);
    expect(result.passed).toBe(false);
    const fail = result.assertions.find((a) => !a.passed);
    expect(fail?.name).toContain("links.classification");
  });

  it("formatRunSummary produces readable output", async () => {
    const renderer = createMockRenderer({
      html: "<p>ok</p>",
    });
    const observation: FixtureObservation = {
      fixture: "test.md",
      category: "markdown",
      description: "test",
      html: { mustContain: ["<p>"], mustNotContain: ["<script"] },
    };

    const result = await runFixture(renderer, "test", observation);
    const summary = formatRunSummary({
      totalFixtures: 1,
      passed: 1,
      failed: 0,
      skipped: 0,
      results: [result],
      durationMs: 10,
      schemaVersion: "1.0.0",
    });
    expect(summary).toContain("PASS");
    expect(summary).toContain("test.md");
  });
});
