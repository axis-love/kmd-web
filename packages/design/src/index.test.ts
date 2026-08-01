import { describe, expect, it } from "vitest";
import * as pkg from "./index";

describe("@axis-love/design", () => {
  it("should export a module", () => {
    expect(pkg).toBeDefined();
  });
});
