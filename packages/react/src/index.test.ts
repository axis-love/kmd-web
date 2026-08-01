import { describe, expect, it } from "vitest";
import * as pkg from "./index";

describe("@axis-love/react", () => {
  it("should export a module", () => {
    expect(pkg).toBeDefined();
  });
});
