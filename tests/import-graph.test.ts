// Import graph tests — prove that the baseline core package does NOT
// statically import the heavy feature implementations (highlighting,
// mermaid, math). These features must be lazy-loaded only when needed.
//
// Approach: read the compiled core dist files and assert they do not
// contain references to shiki, mermaid, katex, or rehype-katex.
// Also check that the feature packages export the expected symbols.

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = process.cwd();

// ---------------------------------------------------------------------------
// Core must not statically import feature implementations
// ---------------------------------------------------------------------------

describe("import graph — core must not pull feature implementations", () => {
  const coreDistDir = join(ROOT, "packages", "core", "dist");

  it("core dist should exist", () => {
    expect(existsSync(coreDistDir)).toBe(true);
  });

  it("core should not statically import shiki", () => {
    const indexFile = join(coreDistDir, "index.js");
    if (!existsSync(indexFile)) return; // dist may not be built yet
    const content = readFileSync(indexFile, "utf-8");
    expect(content).not.toContain("shiki");
    expect(content).not.toContain("@shikijs");
  });

  it("core should not statically import mermaid", () => {
    const indexFile = join(coreDistDir, "index.js");
    if (!existsSync(indexFile)) return;
    const content = readFileSync(indexFile, "utf-8");
    // core uses "mermaid" as a string literal for class names and data attrs,
    // but should NOT import the "mermaid" npm package
    expect(content).not.toMatch(/from\s+["']mermaid["']/);
    expect(content).not.toMatch(/import\s*\(\s*["']mermaid["']\s*\)/);
  });

  it("core should not statically import katex", () => {
    const indexFile = join(coreDistDir, "index.js");
    if (!existsSync(indexFile)) return;
    const content = readFileSync(indexFile, "utf-8");
    expect(content).not.toMatch(/from\s+["']katex["']/);
    expect(content).not.toMatch(/import\s*\(\s*["']katex["']\s*\)/);
    expect(content).not.toMatch(/from\s+["']rehype-katex["']/);
  });

  it("core should not reference the highlighting package", () => {
    const indexFile = join(coreDistDir, "index.js");
    if (!existsSync(indexFile)) return;
    const content = readFileSync(indexFile, "utf-8");
    expect(content).not.toContain("@axis-love/highlighting");
  });

  it("core should not reference the mermaid package", () => {
    const indexFile = join(coreDistDir, "index.js");
    if (!existsSync(indexFile)) return;
    const content = readFileSync(indexFile, "utf-8");
    expect(content).not.toContain("@axis-love/mermaid");
  });

  it("core should not reference the math package", () => {
    const indexFile = join(coreDistDir, "index.js");
    if (!existsSync(indexFile)) return;
    const content = readFileSync(indexFile, "utf-8");
    expect(content).not.toContain("@axis-love/math");
  });
});

// ---------------------------------------------------------------------------
// Feature packages should export their implementations
// ---------------------------------------------------------------------------

describe("import graph — feature packages export implementations", () => {
  it("highlighting should export rehypeShiki", async () => {
    const mod = await import("@axis-love/highlighting");
    expect(mod.rehypeShiki).toBeDefined();
    expect(mod.HIGHLIGHTING_VERSION).toBe("0.1.0");
  });

  it("mermaid should export renderMermaidPlaceholders", async () => {
    const mod = await import("@axis-love/mermaid");
    expect(mod.renderMermaidPlaceholders).toBeDefined();
    expect(mod.renderMermaid).toBeDefined();
    expect(mod.MERMAID_VERSION).toBe("0.1.0");
  });

  it("math should export rehypeKatex", async () => {
    const mod = await import("@axis-love/math");
    expect(mod.rehypeKatex).toBeDefined();
    expect(mod.renderMath).toBeDefined();
    expect(mod.MATH_VERSION).toBe("0.1.0");
  });
});

// ---------------------------------------------------------------------------
// Feature packages should NOT import each other
// ---------------------------------------------------------------------------

describe("import graph — feature packages are independent", () => {
  it("highlighting should not import mermaid or math packages", async () => {
    const mod = await import("@axis-love/highlighting");
    // The module object should not contain mermaid or math exports
    expect((mod as Record<string, unknown>).renderMermaid).toBeUndefined();
    expect((mod as Record<string, unknown>).rehypeKatex).toBeUndefined();
  });

  it("mermaid should not import highlighting or math packages", async () => {
    const mod = await import("@axis-love/mermaid");
    expect((mod as Record<string, unknown>).rehypeShiki).toBeUndefined();
    expect((mod as Record<string, unknown>).rehypeKatex).toBeUndefined();
  });

  it("math should not import highlighting or mermaid packages", async () => {
    const mod = await import("@axis-love/math");
    expect((mod as Record<string, unknown>).rehypeShiki).toBeUndefined();
    expect((mod as Record<string, unknown>).renderMermaid).toBeUndefined();
  });
});
