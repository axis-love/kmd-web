import { describe, expect, it } from "vitest";
import * as pkg from "./index";

describe("@axis-love/mermaid", () => {
  it("should export a module", () => {
    expect(pkg).toBeDefined();
  });
});
