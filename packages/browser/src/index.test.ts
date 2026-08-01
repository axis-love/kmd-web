import { describe, expect, it } from "vitest";
import * as pkg from "./index";

describe("@axis-love/browser", () => {
  it("should export a module", () => {
    expect(pkg).toBeDefined();
  });
});
