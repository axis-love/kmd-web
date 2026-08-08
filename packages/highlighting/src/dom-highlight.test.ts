// @vitest-environment happy-dom
//
// DOM-side re-highlighting (KWEB-039). The rehype plugin covers the normal
// path; this pass exists for code blocks that reached the DOM unhighlighted
// (a host worker calling core's bare render(), or a stale cached result).

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  CODE_BLOCK_CLASS,
  disposeHighlighter,
  findUnhighlightedCodeBlocks,
  highlightCodeBlocks,
  TOKEN_CLASS,
} from "./index";

function makeContainer(html: string): HTMLElement {
  const container = document.createElement("div");
  container.innerHTML = html;
  return container;
}

const PLAIN_TS_BLOCK = '<pre><code class="language-ts">const answer = 42;</code></pre>';

describe("findUnhighlightedCodeBlocks", () => {
  beforeEach(() => disposeHighlighter());
  afterEach(() => disposeHighlighter());

  it("finds code blocks whose <pre> lacks the highlighted class", () => {
    const container = makeContainer(PLAIN_TS_BLOCK);
    expect(findUnhighlightedCodeBlocks(container)).toHaveLength(1);
  });

  it("ignores blocks the pipeline already highlighted", () => {
    const container = makeContainer(
      `<pre class="${CODE_BLOCK_CLASS}"><code class="language-ts">const answer = 42;</code></pre>`,
    );
    expect(findUnhighlightedCodeBlocks(container)).toHaveLength(0);
  });

  it("ignores code blocks with no language class", () => {
    const container = makeContainer("<pre><code>plain</code></pre>");
    expect(findUnhighlightedCodeBlocks(container)).toHaveLength(0);
  });

  it("ignores languages that belong to another renderer", () => {
    const container = makeContainer(
      '<pre><code class="language-mermaid">graph TD;</code></pre>' +
        '<pre><code class="language-math">E = mc^2</code></pre>' +
        '<pre><code class="language-plaintext">hello</code></pre>',
    );
    expect(findUnhighlightedCodeBlocks(container)).toHaveLength(0);
  });
});

describe("highlightCodeBlocks", () => {
  beforeEach(() => disposeHighlighter());
  afterEach(() => disposeHighlighter());

  it("rewrites plain code blocks into token spans", async () => {
    const container = makeContainer(PLAIN_TS_BLOCK);

    const outcome = await highlightCodeBlocks(container);

    expect(outcome.highlighted).toBe(1);
    expect(outcome.skipped).toBe(0);

    const pre = container.querySelector("pre");
    expect(pre?.classList.contains(CODE_BLOCK_CLASS)).toBe(true);
    // Shiki registers the alias, so the block's own tag is the resolved name.
    expect(pre?.getAttribute("data-language")).toBe("ts");
    expect(container.querySelectorAll(`span.${TOKEN_CLASS}`).length).toBeGreaterThan(1);
    expect(container.querySelectorAll("span.line")).toHaveLength(1);
  });

  it("preserves the code text exactly", async () => {
    const container = makeContainer(
      '<pre><code class="language-ts">const a = 1;\nconst b = 2;</code></pre>',
    );

    await highlightCodeBlocks(container);

    expect(container.querySelector("code")?.textContent).toBe("const a = 1;\nconst b = 2;");
  });

  it("returns CSS that resolves the emitted token classes", async () => {
    const container = makeContainer(PLAIN_TS_BLOCK);

    const outcome = await highlightCodeBlocks(container);

    const tokenClass = [...(container.querySelector(`span.${TOKEN_CLASS}`)?.classList ?? [])].find(
      (c) => c.startsWith("shiki-c"),
    );
    expect(tokenClass).toBeDefined();
    expect(outcome.css).toContain(`.${tokenClass}{color:`);
  });

  it("sets text content rather than parsing markup from the document", async () => {
    const container = makeContainer(
      '<pre><code class="language-ts">const s = "&lt;img src=x onerror=alert(1)&gt;";</code></pre>',
    );

    await highlightCodeBlocks(container);

    expect(container.querySelector("img")).toBeNull();
    expect(container.querySelector("code")?.textContent).toContain("<img src=x onerror=alert(1)>");
  });

  it("is idempotent — a second pass finds nothing to do", async () => {
    const container = makeContainer(PLAIN_TS_BLOCK);

    await highlightCodeBlocks(container);
    const second = await highlightCodeBlocks(container);

    expect(second.highlighted).toBe(0);
    expect(second.skipped).toBe(0);
    expect(second.css).toBe("");
  });

  it("reports nothing highlighted when there are no candidates", async () => {
    const container = makeContainer("<p>no code here</p>");

    const outcome = await highlightCodeBlocks(container);

    expect(outcome).toEqual({ highlighted: 0, skipped: 0, css: "" });
  });

  it("falls back to plaintext for an unknown language", async () => {
    const container = makeContainer(
      '<pre><code class="language-nosuchlang">some text</code></pre>',
    );

    const outcome = await highlightCodeBlocks(container);

    expect(outcome.highlighted).toBe(1);
    expect(container.querySelector("pre")?.getAttribute("data-language")).toBe("plaintext");
    expect(container.querySelector("code")?.textContent).toBe("some text");
  });
});
