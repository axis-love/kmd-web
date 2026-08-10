// @vitest-environment happy-dom
import type { DetectedFeatures } from "@axis-love/contracts";
import { describe, expect, it, vi } from "vitest";
import { FeatureCoordinator } from "./feature-coordination";

// Keep the real mermaid library out of this worker: importing it costs tens of
// seconds of transform under full-suite load, and the dispose test below only
// exercises the watcher lifecycle, not diagram drawing.
vi.mock("mermaid", () => ({
  default: {
    initialize: () => {},
    render: async () => ({ svg: "<svg>rendered</svg>" }),
  },
}));

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
    expect(highlightResult?.error).toBe("no unhighlighted code blocks");
  });

  // KWEB-039: the highlighting pass used to import the package, do nothing
  // with it, and still report applied:true. It must either change the DOM or
  // report applied:false with a diagnostic.

  it("highlighting pass actually highlights blocks that fell through", async () => {
    const coordinator = new FeatureCoordinator();
    const container = document.createElement("div");
    container.innerHTML = '<pre><code class="language-ts">const answer = 42;</code></pre>';

    const results = await coordinator.enhance(container, {
      ...NO_FEATURES,
      hasCodeHighlighting: true,
    });

    const highlightResult = results.find((r) => r.feature === "highlighting");
    expect(highlightResult?.applied).toBe(true);
    // applied:true means the DOM really changed...
    expect(container.querySelector("pre")?.classList.contains("shiki-code-block")).toBe(true);
    expect(container.querySelectorAll("span.shiki-token").length).toBeGreaterThan(1);
    // ...and the host is handed the CSS those token classes need.
    expect(highlightResult?.css ?? "").toMatch(/\.shiki-c[a-z0-9]+\{color:/);
  });

  it("highlighting pass reports applied:false for already-highlighted blocks", async () => {
    const coordinator = new FeatureCoordinator();
    const container = document.createElement("div");
    container.innerHTML =
      '<pre class="shiki-code-block"><code class="language-ts">const answer = 42;</code></pre>';

    const results = await coordinator.enhance(container, {
      ...NO_FEATURES,
      hasCodeHighlighting: true,
    });

    const highlightResult = results.find((r) => r.feature === "highlighting");
    expect(highlightResult?.applied).toBe(false);
    expect(highlightResult?.error).toBe("no unhighlighted code blocks");
    expect(highlightResult?.css).toBeUndefined();
  });

  it("highlighting pass reports applied:false for blocks it never highlights", async () => {
    const coordinator = new FeatureCoordinator();
    const container = document.createElement("div");
    container.innerHTML = '<pre><code class="language-mermaid">graph TD;</code></pre>';

    const results = await coordinator.enhance(container, {
      ...NO_FEATURES,
      hasCodeHighlighting: true,
    });

    const highlightResult = results.find((r) => r.feature === "highlighting");
    expect(highlightResult?.applied).toBe(false);
    expect(highlightResult?.error).toBe("no unhighlighted code blocks");
    expect(container.querySelector("pre")?.classList.contains("shiki-code-block")).toBe(false);
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

  it("dispose stops the theme watcher the mermaid pass installed", async () => {
    const { resetMermaidState, watchMermaidTheme } = await import("@axis-love/mermaid");
    resetMermaidState();
    try {
      const coordinator = new FeatureCoordinator({ mermaidTimeoutMs: 200 });
      const container = document.createElement("div");
      const encoded = Buffer.from("flowchart TD\n  A --> B", "utf-8").toString("base64");
      container.innerHTML =
        `<div class="mermaid-placeholder" data-mermaid-source="${encoded}">` +
        '<div class="mermaid-render-target"></div></div>';
      document.body.appendChild(container);

      // The diagram itself may fail to draw in the test DOM — irrelevant here;
      // the watcher is installed before any diagram renders.
      await coordinator.enhance(container, { ...NO_FEATURES, hasMermaid: true });

      // watchMermaidTheme is idempotent per container, so getting the same
      // disposer back proves the pass's watcher is still active.
      const disposer = watchMermaidTheme(container);
      expect(watchMermaidTheme(container)).toBe(disposer);

      coordinator.dispose(container);

      // A fresh disposer means the old watcher was torn down.
      const fresh = watchMermaidTheme(container);
      expect(fresh).not.toBe(disposer);
      fresh();
      container.remove();
    } finally {
      resetMermaidState();
    }
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
