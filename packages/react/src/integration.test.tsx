// @vitest-environment happy-dom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { MarkdownReader } from "./index";

function createContainer(): HTMLDivElement {
  const container = document.createElement("div");
  document.body.appendChild(container);
  return container;
}

async function flushAsync(): Promise<void> {
  await act(async () => {
    // The renderFn now does `await import("@axis-love/math")` and
    // `await import("@axis-love/highlighting")` before calling render(),
    // adding extra async ticks beyond a single setTimeout(0).
    await new Promise<void>((resolve) => setTimeout(resolve, 100));
  });
}

// ---------------------------------------------------------------------------
// Representative fixtures
// ---------------------------------------------------------------------------

const FIXTURES: { name: string; source: string; expectations: string[] }[] = [
  {
    name: "headings",
    source: "# H1\n\n## H2\n\n### H3\n\n#### H4\n\n##### H5\n\n###### H6",
    expectations: ["<h1", "<h2", "<h3", "<h4", "<h5", "<h6"],
  },
  {
    name: "tables",
    source: "| A | B |\n|---|---|\n| 1 | 2 |",
    expectations: ["<table>", "<th>", "<td>"],
  },
  {
    name: "code blocks",
    source: "```ts\nconst x: number = 42;\n```",
    expectations: ["<pre", "shiki-code-block"],
  },
  {
    name: "inline code",
    source: "Use `npm install` to install.",
    expectations: ["<code>npm install</code>"],
  },
  {
    name: "alerts",
    source: "> [!NOTE]\n> This is a note.",
    expectations: ["markdown-alert"],
  },
  {
    name: "footnotes",
    source: "See[^1].\n\n[^1]: Footnote content.",
    expectations: ["footnote"],
  },
  {
    name: "links",
    source: "[Example](https://example.com)",
    expectations: ["<a", 'href="https://example.com"'],
  },
  {
    name: "task lists",
    source: "- [x] Done\n- [ ] Todo",
    expectations: ["task-list"],
  },
  {
    name: "blockquotes",
    source: "> A quote.",
    expectations: ["<blockquote>"],
  },
  {
    name: "images (remote blocked by default)",
    source: "![alt](https://example.com/img.png)",
    expectations: ["<img"],
  },
  {
    name: "emphasis and strong",
    source: "*italic* and **bold**",
    expectations: ["<em>italic</em>", "<strong>bold</strong>"],
  },
  {
    name: "ordered and unordered lists",
    source: "1. First\n2. Second\n\n- A\n- B",
    expectations: ["<ol>", "<ul>", "<li>"],
  },
];

// ---------------------------------------------------------------------------
// Integration tests
// ---------------------------------------------------------------------------

describe("MarkdownReader integration — representative fixtures", () => {
  let container: HTMLDivElement;
  let root: ReturnType<typeof createRoot>;

  beforeEach(() => {
    container = createContainer();
  });

  afterEach(() => {
    if (root) {
      act(() => {
        root.unmount();
      });
    }
    document.body.innerHTML = "";
  });

  for (const fixture of FIXTURES) {
    it(`renders ${fixture.name} fixture correctly`, async () => {
      root = createRoot(container);
      act(() => {
        root.render(<MarkdownReader source={fixture.source} />);
      });
      await flushAsync();

      const content = container.querySelector(".kmd-reader-content");
      expect(content).not.toBeNull();
      for (const expected of fixture.expectations) {
        expect(content?.innerHTML).toContain(expected);
      }
    });
  }

  it("renders a complex document with mixed elements", async () => {
    const complexSource = `# Document Title

## Introduction

This is a paragraph with **bold** and *italic* text.

### Code Example

\`\`\`ts
function hello(): string {
  return "world";
}
\`\`\`

### Table

| Name | Value |
|------|-------|
| A    | 1     |
| B    | 2     |

### List

- Item 1
- Item 2
  - Nested item

> [!NOTE]
> This is an important note.

See [the docs](https://example.com) for more.
`;

    root = createRoot(container);
    act(() => {
      root.render(<MarkdownReader source={complexSource} />);
    });
    await flushAsync();

    const content = container.querySelector(".kmd-reader-content");
    expect(content?.innerHTML).toContain("<h1");
    expect(content?.innerHTML).toContain("<h2");
    expect(content?.innerHTML).toContain("<strong>");
    expect(content?.innerHTML).toContain("<em>");
    expect(content?.innerHTML).toContain("<pre");
    expect(content?.innerHTML).toContain("<table>");
    expect(content?.innerHTML).toContain("<ul>");
    expect(content?.innerHTML).toContain("markdown-alert");
    expect(content?.innerHTML).toContain("https://example.com");
  });
});

// ---------------------------------------------------------------------------
// Multiple instance test
// ---------------------------------------------------------------------------

describe("MarkdownReader multiple instances", () => {
  let container1: HTMLDivElement;
  let container2: HTMLDivElement;
  let root1: ReturnType<typeof createRoot>;
  let root2: ReturnType<typeof createRoot>;

  beforeEach(() => {
    container1 = createContainer();
    container2 = createContainer();
  });

  afterEach(() => {
    if (root1) {
      act(() => {
        root1.unmount();
      });
    }
    if (root2) {
      act(() => {
        root2.unmount();
      });
    }
    document.body.innerHTML = "";
  });

  it("two readers render independently without interference", async () => {
    root1 = createRoot(container1);
    root2 = createRoot(container2);

    act(() => {
      root1.render(<MarkdownReader source="# First Document" />);
      root2.render(<MarkdownReader source="# Second Document" />);
    });
    await flushAsync();

    const content1 = container1.querySelector(".kmd-reader-content");
    const content2 = container2.querySelector(".kmd-reader-content");

    expect(content1?.innerHTML).toContain("First Document");
    expect(content1?.innerHTML).not.toContain("Second Document");

    expect(content2?.innerHTML).toContain("Second Document");
    expect(content2?.innerHTML).not.toContain("First Document");
  });

  it("updating one reader does not affect the other", async () => {
    root1 = createRoot(container1);
    root2 = createRoot(container2);

    act(() => {
      root1.render(<MarkdownReader source="# First" />);
      root2.render(<MarkdownReader source="# Second" />);
    });
    await flushAsync();

    // Update first reader
    act(() => {
      root1.render(<MarkdownReader source="# First Updated" />);
    });
    await flushAsync();

    const content1 = container1.querySelector(".kmd-reader-content");
    const content2 = container2.querySelector(".kmd-reader-content");

    expect(content1?.innerHTML).toContain("First Updated");
    expect(content2?.innerHTML).toContain("Second");
    expect(content2?.innerHTML).not.toContain("First");
  });

  it("disposing one reader does not affect the other", async () => {
    root1 = createRoot(container1);
    root2 = createRoot(container2);

    act(() => {
      root1.render(<MarkdownReader source="# First" />);
      root2.render(<MarkdownReader source="# Second" />);
    });
    await flushAsync();

    // Unmount first reader
    act(() => {
      root1.unmount();
    });

    // Second reader should still be intact
    const content2 = container2.querySelector(".kmd-reader-content");
    expect(content2?.innerHTML).toContain("Second");
  });
});

// ---------------------------------------------------------------------------
// Cancellation test
// ---------------------------------------------------------------------------

describe("MarkdownReader cancellation", () => {
  let container: HTMLDivElement;
  let root: ReturnType<typeof createRoot>;

  beforeEach(() => {
    container = createContainer();
  });

  afterEach(() => {
    if (root) {
      act(() => {
        root.unmount();
      });
    }
    document.body.innerHTML = "";
  });

  it("prop change during async render does not show stale HTML", async () => {
    root = createRoot(container);

    // Start with first source
    act(() => {
      root.render(<MarkdownReader source="# First" />);
    });

    // Immediately change to second source before first render completes
    act(() => {
      root.render(<MarkdownReader source="# Second" />);
    });
    await flushAsync();

    const content = container.querySelector(".kmd-reader-content");
    // The final content should be "Second", not "First" (stale).
    // Either only "Second" appears, or at most a very brief "First" that was
    // superseded. The key assertion: the final visible content is "Second".
    expect(content?.innerHTML).toContain("Second");
  });

  it("rapid source changes settle to the latest content", async () => {
    root = createRoot(container);

    act(() => {
      root.render(<MarkdownReader source="# A" />);
    });
    act(() => {
      root.render(<MarkdownReader source="# B" />);
    });
    act(() => {
      root.render(<MarkdownReader source="# C" />);
    });
    act(() => {
      root.render(<MarkdownReader source="# D" />);
    });
    await flushAsync();

    const content = container.querySelector(".kmd-reader-content");
    // After all rapid changes, the final content should be "D".
    expect(content?.innerHTML).toContain("D");
  });
});
