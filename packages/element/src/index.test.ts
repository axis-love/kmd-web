import { describe, expect, it } from "vitest";
import * as pkg from "./index";

describe("@axis-love/element", () => {
  it("should export a module", () => {
    expect(pkg).toBeDefined();
  });
});
