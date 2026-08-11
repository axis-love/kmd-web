import { describe, expect, it } from "vitest";
import * as pkg from "./index";

describe("@axis-love/react package exports", () => {
  it("should export a module", () => {
    expect(pkg).toBeDefined();
  });

  it("should export MarkdownReader component", () => {
    expect(pkg.MarkdownReader).toBeDefined();
    expect(typeof pkg.MarkdownReader).toBe("function");
  });

  it("should export DocumentShell component", () => {
    expect(pkg.DocumentShell).toBeDefined();
    expect(typeof pkg.DocumentShell).toBe("function");
  });

  it("should export useMarkdownReader hook", () => {
    expect(pkg.useMarkdownReader).toBeDefined();
    expect(typeof pkg.useMarkdownReader).toBe("function");
  });

  it("should export useScrollTracking hook", () => {
    expect(pkg.useScrollTracking).toBeDefined();
    expect(typeof pkg.useScrollTracking).toBe("function");
  });

  it("should export useOutline hook", () => {
    expect(pkg.useOutline).toBeDefined();
    expect(typeof pkg.useOutline).toBe("function");
  });

  it("should export REACT_PACKAGE_VERSION", () => {
    expect(pkg.REACT_PACKAGE_VERSION).toBe("0.1.0");
  });
});

// ---------------------------------------------------------------------------
// SSR safety test
// ---------------------------------------------------------------------------

describe("SSR safety", () => {
  it("module can be imported in Node without window/document", async () => {
    // The module is already imported at the top of this file in a Node
    // environment (vitest uses node by default for non-happy-dom tests).
    // If it imported successfully, SSR safety is verified.
    expect(pkg).toBeDefined();
  });

  it("MarkdownReader is a component (function) that does not crash on import", () => {
    // The component itself should be a function. Calling it directly
    // (without hooks) would fail, but the module-level import should not
    // have any side effects that require DOM.
    expect(typeof pkg.MarkdownReader).toBe("function");
  });
});
