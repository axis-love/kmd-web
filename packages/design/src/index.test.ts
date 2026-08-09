import { beforeEach, describe, expect, it } from "vitest";
import {
  type ColorToken,
  clearDesignPipelineCache,
  type DesignDocument,
  type DesignSpec,
  detectDesignDocument,
  detectDesignDocumentCheap,
  emptyDesignDocument,
  emptyDesignSpec,
  enrichSpec,
  hasDesignTokens,
  mergeSpecs,
  resolveSpec,
  runDesignPipeline,
  runDesignPipelineCached,
  type StageFn,
  scanDesignDoc,
} from "./index.js";

// ---------------------------------------------------------------------------
// Pipeline smoke tests
// ---------------------------------------------------------------------------

describe("runDesignPipeline", () => {
  it("returns empty DesignDocument for empty input", () => {
    const doc = runDesignPipeline("");

    expect(doc.spec.colors).toEqual({});
    expect(doc.spec.typography).toEqual({});
    expect(doc.spec.spacing).toEqual({});
    expect(doc.spec.radii).toEqual({});
    expect(doc.spec.layout).toEqual({});
    expect(doc.spec.raw).toEqual({});
    expect(doc.diagnostics.filter((d) => d.severity === "error")).toHaveLength(0);
    expect(doc.detection.score).toBe(0);
    expect(doc.detection.signals).toEqual([]);
    expect(doc.meta.sourceLength).toBe(0);
    expect(doc.meta.name).toBe("");
    expect(doc.meta.description).toBe("");
  });

  it("returns non-zero sourceLength for non-empty input", () => {
    const doc = runDesignPipeline("some content");
    expect(doc.meta.sourceLength).toBe("some content".length);
  });

  it("extracts YAML frontmatter colors", () => {
    const content = `---
name: Test
colors:
  primary: "#ff0000"
  secondary: "#00ff00"
---
# Test
`;
    const doc = runDesignPipeline(content);
    expect(doc.spec.colorTokens).toHaveLength(2);
    expect(doc.spec.colorTokens![0]!.name).toBe("primary");
    expect(doc.spec.colorTokens![0]!.value).toBe("#ff0000");
    expect(doc.spec.colors.primary).toBe("#ff0000");
    expect(doc.spec.colors.secondary).toBe("#00ff00");
    expect(doc.meta.name).toBe("Test");
  });

  it("extracts prose-style color tokens", () => {
    const content = `# Design System

## Colors

- **Primary**: (#ff0000) — Brand color
- **Secondary**: (#00ff00) — Accent color
`;
    const doc = runDesignPipeline(content);
    expect(doc.spec.colorTokens).toBeDefined();
    expect(doc.spec.colorTokens!.length).toBeGreaterThanOrEqual(2);
    const primary = doc.spec.colorTokens!.find((t) => t.name === "Primary");
    expect(primary).toBeDefined();
    expect(primary!.value).toBe("#ff0000");
  });

  it("extracts CSS custom properties", () => {
    const content = `# Design

\`\`\`css
:root {
  --color-primary: #ff0000;
  --color-secondary: #00ff00;
  --spacing-md: 16px;
  --radius-lg: 12px;
}
\`\`\`
`;
    const doc = runDesignPipeline(content);
    expect(doc.spec.colorTokens).toBeDefined();
    expect(doc.spec.colorTokens!.length).toBeGreaterThanOrEqual(2);
    const primary = doc.spec.colorTokens!.find(
      (t) => t.name === "primary" || t.name === "color-primary",
    );
    expect(primary).toBeDefined();
    expect(primary!.value).toBe("#ff0000");
  });

  it("extracts table-based tokens", () => {
    const content = `# Design

## Colors

| Name | Value | Description |
|------|-------|-------------|
| Primary | #ff0000 | Brand color |
| Secondary | #00ff00 | Accent |
`;
    const doc = runDesignPipeline(content);
    expect(doc.spec.colorTokens).toBeDefined();
    expect(doc.spec.colorTokens!.length).toBeGreaterThanOrEqual(2);
  });

  it("resolves var() references", () => {
    const content = `---
colors:
  primary: "#ff0000"
  link: "var(--primary)"
---
# Test
`;
    const doc = runDesignPipeline(content);
    const link = doc.spec.colorTokens!.find((t) => t.name === "link");
    expect(link).toBeDefined();
    // var(--primary) should resolve to #ff0000 via the colors group
    expect(link!.value).toContain("ff0000");
  });

  it("enriches color tokens with roles and groups", () => {
    const content = `---
colors:
  primary: "#3b82f6"
  background: "#ffffff"
  text: "#000000"
  border: "#e5e7eb"
---
# Test
`;
    const doc = runDesignPipeline(content);
    const primary = doc.spec.colorTokens!.find((t) => t.name === "primary");
    expect(primary).toBeDefined();
    expect(primary!.role).toBeDefined();
    expect(primary!.group).toBeDefined();
  });

  it("detects design document with headings", () => {
    const content = `# Design System

## Colors

## Typography

## Spacing

## Radius
`;
    const doc = runDesignPipeline(content);
    expect(doc.detection.score).toBeGreaterThan(0);
    expect(doc.detection.signals.length).toBeGreaterThan(0);
  });

  it("captures pipeline stage errors as diagnostics", () => {
    const stages: StageFn[] = [
      () => {
        throw new Error("boom");
      },
    ];
    const doc = runDesignPipeline("test", stages);
    expect(doc.diagnostics).toHaveLength(1);
    expect(doc.diagnostics[0]!.severity).toBe("error");
    expect(doc.diagnostics[0]!.message).toContain("boom");
  });

  it("continues when a stage throws", () => {
    const order: string[] = [];
    const stages: StageFn[] = [
      (doc) => {
        order.push("a");
        void doc;
      },
      () => {
        throw new Error("boom");
      },
      (doc) => {
        order.push("c");
        void doc;
      },
    ];
    const doc = runDesignPipeline("test", stages);
    expect(order).toEqual(["a", "c"]);
    expect(doc.diagnostics).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// Cache tests
// ---------------------------------------------------------------------------

describe("runDesignPipelineCached", () => {
  beforeEach(() => {
    clearDesignPipelineCache();
  });

  it("returns the same object for cache hits", () => {
    const content = `---
name: Cache Hit
colors:
  primary: "#ff0000"
---
# Cache Hit
`;
    const first = runDesignPipelineCached(content);
    const second = runDesignPipelineCached(content);
    expect(second).toBe(first);
  });

  it("runs the pipeline for cache misses", () => {
    const first = runDesignPipelineCached(`---
name: First
colors:
  a: "#ff0000"
---
# First
`);
    const second = runDesignPipelineCached(`---
name: Second
colors:
  b: "#00ff00"
---
# Second
`);
    expect(second).not.toBe(first);
  });

  it("evicts LRU after 3 entries", () => {
    const firstContent = `---
name: Design 0
colors:
  a: "#ff0000"
---
# Design 0
`;
    const first = runDesignPipelineCached(firstContent);
    for (let i = 1; i <= 3; i++) {
      runDesignPipelineCached(`---
name: Design ${i}
colors:
  b: "#00ff00"
---
# Design ${i}
`);
    }
    // first should have been evicted
    expect(runDesignPipelineCached(firstContent)).not.toBe(first);
  });
});

// ---------------------------------------------------------------------------
// Detection tests
// ---------------------------------------------------------------------------

describe("detectDesignDocumentCheap", () => {
  it("adds +5 for DESIGN.md filename", () => {
    const content = "# Hello\n\nSome text.\n";
    const withoutFilename = detectDesignDocumentCheap(content);
    const withFilename = detectDesignDocumentCheap(content, "my-DESIGN.md");
    expect(withFilename.score).toBe(withoutFilename.score + 5);
  });

  it("returns threshold of 5", () => {
    const result = detectDesignDocumentCheap("# Hello\n");
    expect(result.threshold).toBe(5);
  });

  it("scores 0 for empty content", () => {
    const result = detectDesignDocumentCheap("", "README.md");
    expect(result.score).toBe(0);
    expect(result.signals).toEqual([]);
  });

  it("detects YAML design keys", () => {
    const content = `---
colors:
  primary: "#ff0000"
typography:
  body: "Inter"
spacing:
  md: "16px"
---
# Design
`;
    const result = detectDesignDocumentCheap(content);
    expect(result.score).toBeGreaterThan(0);
  });
});

describe("detectDesignDocument", () => {
  it("scores above threshold for design content with filename", () => {
    const content = `---
colors:
  primary: "#ff0000"
  secondary: "#00ff00"
  tertiary: "#0000ff"
typography:
  body: "Inter"
  heading: "Poppins"
  mono: "JetBrains Mono"
---
# Design System
`;
    const result = detectDesignDocument(content, "DESIGN.md");
    expect(result.score).toBeGreaterThan(result.threshold);
  });

  it("scores below threshold for plain README", () => {
    const content = "# README\n\nThis is a regular project.\n";
    const result = detectDesignDocument(content, "README.md");
    expect(result.score).toBeLessThan(result.threshold);
  });
});

// ---------------------------------------------------------------------------
// Design-doc validation tests
// ---------------------------------------------------------------------------

describe("scanDesignDoc", () => {
  it("emits warning for invalid color values", () => {
    const content = `# Design

## Color

color-primary: "#ff0000"
color-bad: "not-a-color"
color-ref: "var(--color-undefined)"
`;
    const diagnostics = scanDesignDoc(content);
    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0]!.severity).toBe("warning");
    expect(diagnostics[0]!.code).toBe("design-validation");
    expect(diagnostics[0]!.message).toContain("not-a-color");
  });

  it("emits no diagnostics for valid color values", () => {
    const content = `# Design

## Color

color-primary: "#ff0000"
color-link: "var(--color-primary)"
color-surface: "rgb(34, 36, 40)"
`;
    const diagnostics = scanDesignDoc(content);
    expect(diagnostics).toHaveLength(0);
  });

  it("skips frontmatter", () => {
    const content = `---
title: Design
color-x: "not-a-color"
---

# Design

color-primary: "#ff0000"
`;
    const diagnostics = scanDesignDoc(content);
    expect(diagnostics).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// hasDesignTokens tests
// ---------------------------------------------------------------------------

describe("hasDesignTokens", () => {
  it("returns true for YAML with design keys", () => {
    const content = `---
colors:
  primary: "#ff0000"
typography:
  body: "Inter"
---
# Design
`;
    expect(hasDesignTokens(content)).toBe(true);
  });

  it("returns true for CSS custom properties", () => {
    const content = `# Design

\`\`\`css
:root {
  --color-primary: #ff0000;
  --color-secondary: #00ff00;
  --color-tertiary: #0000ff;
}
\`\`\`
`;
    expect(hasDesignTokens(content)).toBe(true);
  });

  it("returns false for plain markdown", () => {
    expect(hasDesignTokens("# Hello\n\nSome text.\n")).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// mergeSpecs tests
// ---------------------------------------------------------------------------

describe("mergeSpecs", () => {
  it("deduplicates tokens by name with extractor precedence", () => {
    const yamlToken: ColorToken = {
      name: "primary",
      value: "#ff0000",
      provenance: { extractor: "yaml" },
    };
    const cssToken: ColorToken = {
      name: "primary",
      value: "#00ff00",
      provenance: { extractor: "css" },
    };

    const partial1: DesignSpec = {
      ...emptyDesignSpec(),
      colorTokens: [yamlToken],
    };
    const partial2: DesignSpec = {
      ...emptyDesignSpec(),
      colorTokens: [cssToken],
    };

    const { spec } = mergeSpecs([partial1, partial2]);
    expect(spec.colorTokens).toHaveLength(1);
    // yaml has higher precedence than css (higher index in EXTRACTOR_PRECEDENCE)
    expect(spec.colorTokens![0]!.value).toBe("#ff0000");
  });

  it("emits conflict diagnostics for differing values", () => {
    const yamlToken: ColorToken = {
      name: "primary",
      value: "#ff0000",
      provenance: { extractor: "yaml" },
    };
    const cssToken: ColorToken = {
      name: "primary",
      value: "#00ff00",
      provenance: { extractor: "css" },
    };

    const { diagnostics } = mergeSpecs([
      { ...emptyDesignSpec(), colorTokens: [yamlToken] },
      { ...emptyDesignSpec(), colorTokens: [cssToken] },
    ]);
    expect(diagnostics.length).toBeGreaterThanOrEqual(1);
    expect(diagnostics[0]!.severity).toBe("warning");
    expect(diagnostics[0]!.message).toContain("conflicting");
  });
});

// ---------------------------------------------------------------------------
// Export helpers tests
// ---------------------------------------------------------------------------

describe("export helpers", () => {
  it("suggestDesignExportFilename strips .md and adds .html", async () => {
    const mod = await import("./index.js");
    expect(mod.suggestDesignExportFilename("apple-DESIGN.md")).toBe("apple-DESIGN.html");
    expect(mod.suggestDesignExportFilename(null)).toBe("design-mode.html");
  });

  it("ensureHtmlFilename adds .html if missing", async () => {
    const mod = await import("./index.js");
    expect(mod.ensureHtmlFilename("design")).toBe("design.html");
    expect(mod.ensureHtmlFilename("design.html")).toBe("design.html");
  });

  it("escapeHtml escapes special characters", async () => {
    const mod = await import("./index.js");
    expect(mod.escapeHtml("<script>alert('xss')</script>")).toBe(
      "&lt;script&gt;alert(&#039;xss&#039;)&lt;/script&gt;",
    );
  });
});

// ---------------------------------------------------------------------------
// Design IR helper tests
// ---------------------------------------------------------------------------

describe("IR helpers", () => {
  it("emptyDesignSpec returns all empty collections", () => {
    const spec = emptyDesignSpec();
    expect(spec.colors).toEqual({});
    expect(spec.typography).toEqual({});
    expect(spec.spacing).toEqual({});
    expect(spec.radii).toEqual({});
    expect(spec.layout).toEqual({});
    expect(spec.colorTokens).toEqual([]);
    expect(spec.typographyTokens).toEqual([]);
  });

  it("emptyDesignDocument returns empty doc with sourceLength", () => {
    const doc = emptyDesignDocument("test content");
    expect(doc.spec.colors).toEqual({});
    expect(doc.diagnostics).toEqual([]);
    expect(doc.detection.score).toBe(0);
    expect(doc.meta.sourceLength).toBe("test content".length);
    expect(doc._sourceContent).toBe("test content");
  });
});

// ---------------------------------------------------------------------------
// Design package version test
// ---------------------------------------------------------------------------

describe("DESIGN_VERSION", () => {
  it("should be defined", async () => {
    const mod = await import("./index.js");
    expect(mod.DESIGN_VERSION).toBe("0.1.0-rc.1");
  });
});

// ---------------------------------------------------------------------------
// Design-doc validation on conformance fixtures (KWEB-010)
// ---------------------------------------------------------------------------

describe("scanDesignDoc on conformance fixtures", () => {
  it("emits warnings for design-md-invalid fixture", async () => {
    const { readFileSync } = await import("node:fs");
    const { join } = await import("node:path");
    const fixturePath = join(
      process.cwd(),
      "packages",
      "contracts",
      "fixtures",
      "features",
      "design-md-invalid.md",
    );
    const source = readFileSync(fixturePath, "utf-8");
    const diagnostics = scanDesignDoc(source);
    // The fixture has "not-a-color" as a color value → should produce a warning
    expect(diagnostics.length).toBeGreaterThanOrEqual(1);
    expect(diagnostics[0]!.severity).toBe("warning");
    expect(diagnostics[0]!.code).toBe("design-validation");
    expect(diagnostics.some((d) => d.message.includes("not-a-color"))).toBe(true);
  });

  it("emits no warnings for design-md-valid fixture", async () => {
    const { readFileSync } = await import("node:fs");
    const { join } = await import("node:path");
    const fixturePath = join(
      process.cwd(),
      "packages",
      "contracts",
      "fixtures",
      "features",
      "design-md-valid.md",
    );
    const source = readFileSync(fixturePath, "utf-8");
    const diagnostics = scanDesignDoc(source);
    expect(diagnostics).toHaveLength(0);
  });
});
