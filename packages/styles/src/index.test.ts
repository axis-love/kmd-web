import { describe, expect, it } from "vitest";
import * as pkg from "./index";

describe("@axis-love/styles", () => {
  it("should export module with token metadata", () => {
    expect(pkg).toBeDefined();
    expect(pkg.TOKENS_VERSION).toMatch(/^\d+\.\d+\.\d+$/);
    expect(pkg.STYLES_VERSION).toMatch(/^\d+\.\d+\.\d+(-[0-9A-Za-z.-]+)?$/);
    expect(pkg.TOKEN_THEMES).toContain("dark");
    expect(pkg.TOKEN_THEMES).toContain("light");
    expect(pkg.DEFAULT_THEME).toBe("dark");
  });
});
