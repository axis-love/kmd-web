import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = process.cwd();

describe("workspace structure", () => {
  it("should have 11 packages via packages/* workspace glob", () => {
    const pkg = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf-8"));
    expect(pkg.workspaces).toEqual(["packages/*"]);
  });

  it("root tsconfig should reference all 11 packages", () => {
    const tsconfig = JSON.parse(readFileSync(join(ROOT, "tsconfig.json"), "utf-8"));
    expect(tsconfig.references).toHaveLength(12);
  });

  // No package declares "composite"/"references", so `tsc --build` compiles the
  // root reference list in ORDER. Every project must appear after everything it
  // imports (including type-only imports of lazily-loaded packages), or the
  // FIRST build of a clean checkout fails with TS2307 — a dirty tree hides the
  // breakage because stale dist/ output still resolves (KWEB-044).
  it("root tsconfig references are ordered dependency-first", () => {
    const tsconfig = JSON.parse(readFileSync(join(ROOT, "tsconfig.json"), "utf-8"));
    const order: string[] = tsconfig.references.map((r: { path: string }) => r.path);
    const mustPrecede: Array<[string, string]> = [
      ["./packages/contracts", "./packages/core"],
      // browser type-checks against the lazily imported feature packages
      ["./packages/highlighting", "./packages/browser"],
      ["./packages/mermaid", "./packages/browser"],
      ["./packages/math", "./packages/browser"],
      ["./packages/core", "./packages/browser"],
      ["./packages/browser", "./packages/react"],
      ["./packages/browser", "./packages/element"],
      ["./packages/react", "./packages/kmd-web"],
      ["./packages/element", "./packages/kmd-web"],
    ];
    for (const [dep, dependent] of mustPrecede) {
      expect(order.indexOf(dep), `${dep} must precede ${dependent}`).toBeGreaterThanOrEqual(0);
      expect(
        order.indexOf(dep),
        `${dep} must precede ${dependent} in root tsconfig references`,
      ).toBeLessThan(order.indexOf(dependent));
    }
    // The test project type-checks against everything — it stays last.
    expect(order[order.length - 1]).toBe("./tsconfig.test.json");
  });
});
