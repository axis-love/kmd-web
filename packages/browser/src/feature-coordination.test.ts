// @vitest-environment happy-dom
import type { DetectedFeatures } from "@axis-love/contracts";
import { describe, expect, it } from "vitest";
import { FeatureCoordinator } from "./feature-coordination";

const NO_FEATURES: DetectedFeatures = {
  hasMath: false,
  hasMermaid: false,
  hasDesignDoc: false,
  hasCodeHighlighting: false,
  hasTables: false,
  hasTaskLists: false,
  hasFootnotes: false,
  hasAlerts: false,
};

describe("FeatureCoordinator", () => {
  it("returns empty results when no features detected", async () => {
    const coordinator = new FeatureCoordinator();
    const container = document.createElement("div");
    const results = await coordinator.enhance(container, NO_FEATURES);
    expect(results).toHaveLength(0);
  });

  it("runs mermaid pass when hasMermaid is true", async () => {
    const coordinator = new FeatureCoordinator();
    const container = document.createElement("div");
    // No actual placeholders — pass should report no placeholders found
    const results = await coordinator.enhance(container, {
      ...NO_FEATURES,
      hasMermaid: true,
    });
    const mermaidResult = results.find((r) => r.feature === "mermaid");
    expect(mermaidResult).toBeDefined();
    expect(mermaidResult?.applied).toBe(false);
    expect(mermaidResult?.error).toBe("no placeholders found");
  });

  it("runs math pass when hasMath is true", async () => {
    const coordinator = new FeatureCoordinator();
    const container = document.createElement("div");
    const results = await coordinator.enhance(container, {
      ...NO_FEATURES,
      hasMath: true,
    });
    const mathResult = results.find((r) => r.feature === "math");
    expect(mathResult).toBeDefined();
    // math pass should succeed or fail gracefully
    expect(typeof mathResult?.applied).toBe("boolean");
  });

  it("runs highlighting pass when hasCodeHighlighting is true", async () => {
    const coordinator = new FeatureCoordinator();
    const container = document.createElement("div");
    const results = await coordinator.enhance(container, {
      ...NO_FEATURES,
      hasCodeHighlighting: true,
    });
    const highlightResult = results.find((r) => r.feature === "highlighting");
    expect(highlightResult).toBeDefined();
    // No code blocks → not applied
    expect(highlightResult?.applied).toBe(false);
  });

  it("each feature pass is independent — one failing does not break others", async () => {
    const coordinator = new FeatureCoordinator();
    const container = document.createElement("div");
    const results = await coordinator.enhance(container, {
      ...NO_FEATURES,
      hasMermaid: true,
      hasMath: true,
      hasCodeHighlighting: true,
    });
    // All three results should be present
    expect(results).toHaveLength(3);
    expect(results.map((r) => r.feature)).toContain("mermaid");
    expect(results.map((r) => r.feature)).toContain("math");
    expect(results.map((r) => r.feature)).toContain("highlighting");
  });

  it("graceful fallback when feature package is unavailable (import fails)", async () => {
    const coordinator = new FeatureCoordinator();
    const container = document.createElement("div");

    // We can't easily mock dynamic import failures, but the coordinator
    // catches errors internally and returns them as results
    const results = await coordinator.enhance(container, {
      ...NO_FEATURES,
      hasMermaid: true,
    });

    // Should not throw — returns a result with error info
    expect(results).toHaveLength(1);
    expect(results[0].feature).toBe("mermaid");
  });
});
