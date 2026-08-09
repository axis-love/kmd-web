import type { Root as HastRoot } from "hast";
import rehypeStringify from "rehype-stringify";
import { unified } from "unified";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { disposeHighlighter, getLoadedLanguages, HIGHLIGHTING_VERSION, rehypeShiki } from "./index";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function highlightHtml(source: string): Promise<string> {
  const remarkParse = (await import("remark-parse")).default;
  const remarkRehype = (await import("remark-rehype")).default;
  const result = await unified()
    .use(remarkParse)
    .use(remarkRehype)
    .use(rehypeShiki)
    .use(rehypeStringify)
    .process(source);
  return String(result);
}

function makeHastCodeBlock(lang: string, code: string): HastRoot {
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
            properties: { className: [`language-${lang}`] },
            children: [{ type: "text", value: code }],
          },
        ],
      },
    ],
  } as unknown as HastRoot;
}

function getPre(result: HastRoot): {
  tagName: string;
  className: string[];
  dataLanguage: string;
} {
  const pre = result.children[0] as unknown as {
    tagName: string;
    properties?: { className?: string[]; dataLanguage?: string };
  };
  return {
    tagName: pre.tagName,
    className: pre.properties?.className ?? [],
    dataLanguage: pre.properties?.dataLanguage ?? "",
  };
}

function runShiki(tree: HastRoot): Promise<HastRoot> {
  return (rehypeShiki.call({} as never) as (tree: HastRoot) => Promise<HastRoot>)(tree);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("@axis-love/highlighting", () => {
  beforeEach(() => disposeHighlighter());
  afterEach(() => disposeHighlighter());

  it("should export a version string", () => {
    expect(HIGHLIGHTING_VERSION).toBe("0.1.0-rc.1");
  });

  // --- Disabled state ---

  it("should not modify a tree with no code blocks", async () => {
    const tree = {
      type: "root",
      children: [{ type: "text", value: "Hello" }],
    } as unknown as HastRoot;
    const result = await runShiki(tree);
    expect(result).toBe(tree);
  });

  it("should skip mermaid blocks", async () => {
    const result = await runShiki(makeHastCodeBlock("mermaid", "flowchart TD\n  A --> B"));
    const pre = getPre(result);
    expect(pre.tagName).toBe("pre");
    expect(pre.className).not.toContain("shiki-code-block");
  });

  it("should skip plain text blocks", async () => {
    const result = await runShiki(makeHastCodeBlock("text", "just text"));
    const pre = getPre(result);
    expect(pre.tagName).toBe("pre");
    expect(pre.className).not.toContain("shiki-code-block");
  });

  // --- Success state ---

  it("should highlight TypeScript code blocks", async () => {
    const result = await runShiki(makeHastCodeBlock("typescript", "const x: number = 42;"));
    const pre = getPre(result);
    expect(pre.className).toContain("shiki-code-block");
    expect(pre.dataLanguage).toBe("typescript");
  });

  it("should highlight JavaScript code blocks (alias js)", async () => {
    const result = await runShiki(makeHastCodeBlock("js", "const x = 42;"));
    const pre = getPre(result);
    expect(pre.className).toContain("shiki-code-block");
    expect(["javascript", "js"]).toContain(pre.dataLanguage);
  });

  it("should highlight Python code blocks", async () => {
    const result = await runShiki(makeHastCodeBlock("python", "x = 42"));
    const pre = getPre(result);
    expect(pre.className).toContain("shiki-code-block");
    expect(pre.dataLanguage).toBe("python");
  });

  it("should highlight Rust code blocks", async () => {
    const result = await runShiki(makeHastCodeBlock("rust", "fn main() {}"));
    const pre = getPre(result);
    expect(pre.className).toContain("shiki-code-block");
    expect(pre.dataLanguage).toBe("rust");
  });

  it("should load languages lazily (not all at once)", async () => {
    disposeHighlighter();
    expect(getLoadedLanguages().has("typescript")).toBe(false);
    await runShiki(makeHastCodeBlock("typescript", "const x = 1;"));
    expect(getLoadedLanguages().has("typescript")).toBe(true);
    expect(getLoadedLanguages().has("python")).toBe(false);
  });

  it("should handle multiple code blocks with different languages", async () => {
    const tree = {
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
              properties: { className: ["language-typescript"] },
              children: [{ type: "text", value: "const x = 1;" }],
            },
          ],
        },
        {
          type: "element",
          tagName: "pre",
          properties: {},
          children: [
            {
              type: "element",
              tagName: "code",
              properties: { className: ["language-python"] },
              children: [{ type: "text", value: "x = 1" }],
            },
          ],
        },
      ],
    } as unknown as HastRoot;

    const result = await runShiki(tree);
    const pre1 = result.children[0] as unknown as { properties?: { dataLanguage?: string } };
    const pre2 = result.children[1] as unknown as { properties?: { dataLanguage?: string } };
    expect(pre1.properties?.dataLanguage).toBe("typescript");
    expect(pre2.properties?.dataLanguage).toBe("python");
  });

  // --- Error/fallback state ---

  it("should fall back to plaintext for unknown languages", async () => {
    const result = await runShiki(makeHastCodeBlock("nonexistent-lang", "some code"));
    const pre = getPre(result);
    expect(pre.className).toContain("shiki-code-block");
    expect(pre.dataLanguage).toBe("plaintext");
  });

  // --- Pipeline integration ---

  it("should work in a full unified pipeline", async () => {
    const html = await highlightHtml("```typescript\nconst x = 42;\n```");
    expect(html).toContain("shiki-code-block");
  });

  it("should leave mermaid blocks unhighlighted in pipeline", async () => {
    const html = await highlightHtml("```mermaid\nflowchart TD\n  A --> B\n```");
    expect(html).not.toContain("shiki-code-block");
  });

  // --- Lifecycle ---

  it("should dispose highlighter and clear loaded languages", async () => {
    await runShiki(makeHastCodeBlock("typescript", "const x = 1;"));
    expect(getLoadedLanguages().has("typescript")).toBe(true);
    disposeHighlighter();
    expect(getLoadedLanguages().has("typescript")).toBe(false);
    expect(getLoadedLanguages().has("plaintext")).toBe(true);
  });
});
