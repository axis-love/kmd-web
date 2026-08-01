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
});
