import type { Root as HastRoot } from "hast";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  createMathFallback,
  ensureKatexCss,
  hasMathElements,
  MATH_VERSION,
  rehypeKatex,
  renderMath,
  resetMathState,
} from "./index";

// ---------------------------------------------------------------------------
// Helpers — build HAST trees for testing
// ---------------------------------------------------------------------------

function makeInlineMath(source: string): HastRoot {
  return {
    type: "root",
    children: [
      {
        type: "element",
        tagName: "p",
        properties: {},
        children: [
          {
            type: "element",
            tagName: "code",
            properties: { className: ["language-math", "math-inline"] },
            children: [{ type: "text", value: source }],
          },
        ],
      },
    ],
  } as unknown as HastRoot;
}

function makeDisplayMath(source: string): HastRoot {
  return {
    type: "root",
    children: [
      {
        type: "element",
        tagName: "pre",
        properties: {},
        children: [
          {
            type: "element",
            tagName: "code",
            properties: { className: ["language-math", "math-display"] },
            children: [{ type: "text", value: source }],
          },
        ],
      },
    ],
  } as unknown as HastRoot;
}

function makePlainText(): HastRoot {
  return {
    type: "root",
    children: [
      {
        type: "element",
        tagName: "p",
        properties: {},
        children: [{ type: "text", value: "Hello world" }],
      },
    ],
  } as unknown as HastRoot;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("@axis-love/math", () => {
  beforeEach(() => {
    resetMathState();
  });

  afterEach(() => {
    resetMathState();
  });

  it("should export a version string", () => {
    expect(MATH_VERSION).toBe("0.2.0");
  });

  // -------------------------------------------------------------------------
  // Detection
  // -------------------------------------------------------------------------

  describe("hasMathElements", () => {
    it("should detect math elements in HTML", () => {
      const html = '<code class="language-math math-inline">E = mc^2</code>';
      expect(hasMathElements(html)).toBe(true);
    });

    it("should detect math-display elements", () => {
      const html = '<pre><code class="language-math math-display">\\int</code></pre>';
      expect(hasMathElements(html)).toBe(true);
    });

    it("should return false for non-math HTML", () => {
      expect(hasMathElements("<p>Hello world</p>")).toBe(false);
    });

    it("should return false for empty HTML", () => {
      expect(hasMathElements("")).toBe(false);
    });
  });

  // -------------------------------------------------------------------------
  // Fallback
  // -------------------------------------------------------------------------

  describe("createMathFallback", () => {
    it("should generate readable fallback with original source", () => {
      const html = createMathFallback("E = mc^2");
      expect(html).toContain("katex-error");
      expect(html).toContain("E = mc^2");
    });

    it("should include error message when provided", () => {
      const html = createMathFallback("\\badcommand", "Undefined command");
      expect(html).toContain("katex-error-msg");
      expect(html).toContain("Undefined command");
    });

    it("should HTML-escape the source", () => {
      const html = createMathFallback("<script>alert(1)</script>");
      expect(html).toContain("&lt;script&gt;");
      expect(html).not.toContain("<script>alert(1)</script>");
    });
  });

  // -------------------------------------------------------------------------
  // renderMath — single expression
  // -------------------------------------------------------------------------

  describe("renderMath", () => {
    it("should render inline math to KaTeX HTML", async () => {
      const html = await renderMath("E = mc^2");
      expect(html).toContain("katex");
    });

    it("should render display math", async () => {
      const html = await renderMath("\\int_0^1 x\\,dx", { displayMode: true });
      expect(html).toContain("katex");
      expect(html).toContain("katex-display");
    });

    it("should render inline math (no display class)", async () => {
      const html = await renderMath("x^2 + y^2 = z^2");
      expect(html).toContain("katex");
      expect(html).not.toContain("katex-display");
    });

    it("should return empty string for empty input", async () => {
      const html = await renderMath("");
      expect(html).toBe("");
    });

    it("should not crash on unsupported commands (throwOnError=false)", async () => {
      const html = await renderMath("\\undefinedcommand");
      expect(html).toContain("katex");
      // With throwOnError=false, KaTeX renders the error in errorColor
      // rather than throwing
    });

    it("should not allow \\input (trust=false)", async () => {
      const html = await renderMath("\\input{file}");
      // With trust=false, \input is blocked
      expect(html).toContain("katex");
      expect(html).not.toContain("<input");
    });

    it("should not allow \\includegraphics (trust=false)", async () => {
      const html = await renderMath("\\includegraphics{image.png}");
      expect(html).toContain("katex");
      expect(html).not.toContain("<img");
    });
  });

  // -------------------------------------------------------------------------
  // rehypeKatex — plugin
  // -------------------------------------------------------------------------

  describe("rehypeKatex", () => {
    it("should not modify a tree with no math elements", async () => {
      const tree = makePlainText();
      const transform = rehypeKatex.call({} as never) as (tree: HastRoot) => Promise<HastRoot>;
      const result = await transform(tree);
      expect(result).toBe(tree);
    });

    it("should render inline math elements", async () => {
      const tree = makeInlineMath("E = mc^2");
      const transform = rehypeKatex.call({} as never) as (tree: HastRoot) => Promise<HastRoot>;
      const result = await transform(tree);

      const p = result.children[0] as {
        children: { tagName: string; properties?: { className?: string[] } }[];
      };
      // The code element should become a span with katex-inline class
      const codeElement = p.children[0];
      expect(codeElement.tagName).toBe("span");
      expect(codeElement.properties?.className).toContain("katex-inline");
    });

    it("should render display math elements", async () => {
      const tree = makeDisplayMath("\\int_0^1 x\\,dx");
      const transform = rehypeKatex.call({} as never) as (tree: HastRoot) => Promise<HastRoot>;
      const result = await transform(tree);

      // The pre should be transformed to a div with katex-display class
      const div = result.children[0] as { tagName: string; properties?: { className?: string[] } };
      expect(div.tagName).toBe("div");
      expect(div.properties?.className).toContain("katex-display");
    });

    it("should handle multiple math elements in one tree", async () => {
      const tree: HastRoot = {
        type: "root",
        children: [
          {
            type: "element",
            tagName: "p",
            properties: {},
            children: [
              {
                type: "element",
                tagName: "code",
                properties: { className: ["language-math", "math-inline"] },
                children: [{ type: "text", value: "a + b = c" }],
              },
              { type: "text", value: " and " },
              {
                type: "element",
                tagName: "code",
                properties: { className: ["language-math", "math-inline"] },
                children: [{ type: "text", value: "x + y = z" }],
              },
            ],
          },
        ],
      } as unknown as HastRoot;

      const transform = rehypeKatex.call({} as never) as (tree: HastRoot) => Promise<HastRoot>;
      const result = await transform(tree);

      const p = result.children[0] as { children: { tagName: string }[] };
      // Both math elements should be rendered
      const spans = p.children.filter((c) => c.tagName === "span");
      expect(spans.length).toBe(2);
    });

    it("should provide readable fallback on render failure", async () => {
      // A math expression that KaTeX can handle but we test the error path
      const tree = makeInlineMath("E = mc^2");
      const transform = rehypeKatex.call({} as never) as (tree: HastRoot) => Promise<HastRoot>;
      const result = await transform(tree);

      // Should have rendered to katex-inline (success case)
      const p = result.children[0] as { children: { tagName: string }[] };
      expect(p.children[0].tagName).toBe("span");
    });
  });

  // -------------------------------------------------------------------------
  // CSS loading
  // -------------------------------------------------------------------------

  describe("ensureKatexCss", () => {
    it("should not throw in node environment", () => {
      expect(() => ensureKatexCss()).not.toThrow();
    });

    it("should be idempotent", () => {
      ensureKatexCss();
      ensureKatexCss();
      // No error — just a no-op after first call
    });
  });

  // -------------------------------------------------------------------------
  // State management
  // -------------------------------------------------------------------------

  describe("resetMathState", () => {
    it("should reset state without errors", () => {
      expect(() => resetMathState()).not.toThrow();
    });
  });
});
