import type { RenderResult } from "@axis-love/contracts";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Mock mermaid module — vitest runs in node, mermaid needs DOM
vi.mock("mermaid", () => ({
  default: {
    initialize: () => {},
    render: async () => ({ svg: "<svg>mock</svg>" }),
  },
}));

import {
  createMermaidFallback,
  hasMermaidPlaceholders,
  MERMAID_VERSION,
  renderMermaid,
  renderMermaidPlaceholders,
  resetMermaidState,
} from "./index";

// ---------------------------------------------------------------------------
// Mock DOM helpers (since vitest runs in node environment)
// ---------------------------------------------------------------------------

function makeMockContainer(placeholders: HTMLElement[]): HTMLElement {
  return {
    querySelectorAll: vi.fn((selector: string) => {
      if (selector === ".mermaid-placeholder") return placeholders;
      return [];
    }) as never,
  } as unknown as HTMLElement;
}

function makeMockPlaceholder(encodedSource: string): HTMLElement {
  const target: HTMLElement = {
    className: "mermaid-render-target",
    innerHTML: "",
  } as unknown as HTMLElement;

  return {
    className: "mermaid-placeholder",
    dataset: { mermaidSource: encodedSource, mermaidRendered: undefined },
    querySelector: vi.fn((selector: string) => {
      if (selector === ".mermaid-render-target") return target;
      return null;
    }) as never,
  } as unknown as HTMLElement;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("@axis-love/mermaid", () => {
  beforeEach(() => {
    resetMermaidState();
  });

  afterEach(() => {
    resetMermaidState();
  });

  it("should export a version string", () => {
    expect(MERMAID_VERSION).toBe("0.1.0-rc.1");
  });

  // -------------------------------------------------------------------------
  // Fallback HTML generation
  // -------------------------------------------------------------------------

  describe("createMermaidFallback", () => {
    it("should generate readable fallback with original source", () => {
      const source = "flowchart TD\n  A --> B";
      const html = createMermaidFallback(source);
      expect(html).toContain("mermaid-error");
      expect(html).toContain("flowchart TD");
      expect(html).toContain("A --&gt; B"); // HTML-escaped
    });

    it("should include error message when provided", () => {
      const html = createMermaidFallback("test", "Parse error");
      expect(html).toContain("Parse error");
      expect(html).toContain("mermaid-error-msg");
    });

    it("should handle empty error message", () => {
      const html = createMermaidFallback("test");
      expect(html).toContain("Unknown error");
    });

    it("should HTML-escape the source", () => {
      const html = createMermaidFallback("<script>alert(1)</script>");
      expect(html).toContain("&lt;script&gt;");
      expect(html).not.toContain("<script>alert(1)</script>");
    });

    it("should HTML-escape the error message", () => {
      const html = createMermaidFallback("test", "<img onerror=alert(1)>");
      expect(html).toContain("&lt;img");
      expect(html).not.toContain("<img onerror");
    });
  });

  // -------------------------------------------------------------------------
  // RenderResult detection
  // -------------------------------------------------------------------------

  describe("hasMermaidPlaceholders", () => {
    it("should detect mermaid placeholders in RenderResult HTML", () => {
      const result: Partial<RenderResult> = {
        html: '<div class="mermaid-placeholder" data-mermaid-source="abc"></div>',
      };
      expect(hasMermaidPlaceholders(result as RenderResult)).toBe(true);
    });

    it("should return false when no mermaid placeholders", () => {
      const result: Partial<RenderResult> = {
        html: "<p>Hello world</p>",
      };
      expect(hasMermaidPlaceholders(result as RenderResult)).toBe(false);
    });

    it("should return false for empty HTML", () => {
      const result: Partial<RenderResult> = { html: "" };
      expect(hasMermaidPlaceholders(result as RenderResult)).toBe(false);
    });
  });

  // -------------------------------------------------------------------------
  // renderMermaid — single diagram rendering
  // -------------------------------------------------------------------------

  describe("renderMermaid", () => {
    it("should throw on empty source", async () => {
      await expect(renderMermaid("")).rejects.toThrow("Empty Mermaid source");
    });

    it("should throw on whitespace-only source", async () => {
      await expect(renderMermaid("   ")).rejects.toThrow("Empty Mermaid source");
    });

    it("should render a valid flowchart", async () => {
      const result = await renderMermaid("flowchart TD\n  A --> B");
      expect(result.svg).toContain("<svg");
      expect(result.svg).toContain("</svg>");
    });

    it("should render a valid sequence diagram", async () => {
      const result = await renderMermaid(
        "sequenceDiagram\n  Alice->>Bob: Hello\n  Bob-->>Alice: Hi",
      );
      expect(result.svg).toContain("<svg");
    });

    it("should render a valid pie chart", async () => {
      const result = await renderMermaid('pie title Pets\n  "Dogs" : 50\n  "Cats" : 50');
      expect(result.svg).toContain("<svg");
    });

    it("should throw on invalid mermaid source", async () => {
      // With the mock, render always succeeds. Test the real error path
      // by mocking a render failure.
      const mermaidMod = await import("mermaid");
      const originalRender = (mermaidMod.default as unknown as { render: unknown }).render;
      (mermaidMod.default as unknown as { render: () => Promise<never> }).render = async () => {
        throw new Error("Parse error");
      };
      await expect(renderMermaid("not a valid diagram")).rejects.toThrow();
      // Restore
      (mermaidMod.default as unknown as { render: unknown }).render = originalRender;
    });

    it("should respect custom timeout", async () => {
      // A valid diagram should render within 5 seconds
      const result = await renderMermaid("flowchart TD\n  A --> B", { timeoutMs: 5000 });
      expect(result.svg).toContain("<svg");
    });
  });

  // -------------------------------------------------------------------------
  // renderMermaidPlaceholders — DOM-side rendering
  // -------------------------------------------------------------------------

  describe("renderMermaidPlaceholders", () => {
    it("should do nothing when no placeholders found", async () => {
      const container = makeMockContainer([]);
      await renderMermaidPlaceholders(container);
      // No error thrown — just no-op
      expect(container.querySelectorAll).toHaveBeenCalled();
    });

    it("should render placeholders and set rendered flag", async () => {
      // Base64 of "flowchart TD\n  A --> B"
      const source = "flowchart TD\n  A --> B";
      const encoded = Buffer.from(source, "utf-8").toString("base64");
      const placeholder = makeMockPlaceholder(encoded);

      const container = makeMockContainer([placeholder]);
      await renderMermaidPlaceholders(container);

      // The placeholder should be marked as rendered
      expect(placeholder.dataset.mermaidRendered).toBe("true");
    });

    it("should skip already-rendered placeholders", async () => {
      const source = "flowchart TD\n  A --> B";
      const encoded = Buffer.from(source, "utf-8").toString("base64");
      const placeholder = makeMockPlaceholder(encoded);
      placeholder.dataset.mermaidRendered = "true";

      const container = makeMockContainer([placeholder]);
      await renderMermaidPlaceholders(container);

      // querySelector should NOT have been called (skipped before reaching it)
      expect(placeholder.querySelector).not.toHaveBeenCalled();
    });

    it("should provide fallback for invalid base64", async () => {
      const placeholder = makeMockPlaceholder("!!!invalid base64!!!");
      const container = makeMockContainer([placeholder]);
      await renderMermaidPlaceholders(container);

      const target = (placeholder.querySelector as ReturnType<typeof vi.fn>).mock.results[0]?.value;
      expect(target?.innerHTML).toContain("mermaid-error");
      expect(target?.innerHTML).toContain("Invalid base64 encoding");
    });

    it("should provide fallback for invalid mermaid source", async () => {
      // Mock render to fail for this test
      const mermaidMod = await import("mermaid");
      const originalRender = (mermaidMod.default as unknown as { render: unknown }).render;
      (mermaidMod.default as unknown as { render: () => Promise<never> }).render = async () => {
        throw new Error("Parse error");
      };

      const source = "not a valid diagram";
      const encoded = Buffer.from(source, "utf-8").toString("base64");
      const placeholder = makeMockPlaceholder(encoded);

      const container = makeMockContainer([placeholder]);
      await renderMermaidPlaceholders(container);

      const target = (placeholder.querySelector as ReturnType<typeof vi.fn>).mock.results[0]?.value;
      expect(target?.innerHTML).toContain("mermaid-error");
      expect(target?.innerHTML).toContain("not a valid diagram");

      // Restore
      (mermaidMod.default as unknown as { render: unknown }).render = originalRender;
    });
  });

  // -------------------------------------------------------------------------
  // State management
  // -------------------------------------------------------------------------

  describe("resetMermaidState", () => {
    it("should reset state without errors", () => {
      expect(() => resetMermaidState()).not.toThrow();
    });
  });
});
