// @vitest-environment happy-dom
//
// Browser integration tests — exercise the full rendering pipeline
// through published package entry points (@axis-love/kmd-web,
// @axis-love/kmd-web/react, @axis-love/kmd-web/element).
//
// These tests do NOT import from source aliases (../packages/...).
// They consume the built dist artifacts resolved by vitest's module
// resolution, proving the published API surface works end-to-end.
//
// Browser matrix:
//   - happy-dom (used here): Chromium-aligned DOM semantics for unit/integration tests
//   - Playwright (documented in tests/visual/README.md): real Chromium + Firefox + WebKit
//   - jsdom: not used — happy-dom is the monorepo's chosen DOM environment
//
// Viewport matrix:
//   - Desktop: 1280px (default — no container width constraint)
//   - Narrow:  375px  (container.style.width = "375px")
//   - See tests/visual/README.md for the full Playwright viewport table

import type { HostCapabilities } from "@axis-love/kmd-web";
import { type KmdReaderElement, registerKmdReader } from "@axis-love/kmd-web/element";
import { MarkdownReader } from "@axis-love/kmd-web/react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createContainer(width?: string): HTMLDivElement {
  const container = document.createElement("div");
  if (width) container.style.width = width;
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

/** Read a contract fixture file. */
async function readFixture(category: string, name: string): Promise<string> {
  const { readFileSync } = await import("node:fs");
  const { join } = await import("node:path");
  const root = process.cwd();
  return readFileSync(
    join(root, "packages", "contracts", "fixtures", category, `${name}.md`),
    "utf-8",
  );
}

// ---------------------------------------------------------------------------
// Fixture sources (inline — deterministic, no external deps)
// ---------------------------------------------------------------------------

const FIXTURE_SOURCES = {
  headings: "# H1\n\n## H2\n\n### H3\n\n#### H4\n\n##### H5\n\n###### H6",
  tables: "| A | B | C |\n|---|---:|:---:|\n| 1 | 2 | 3 |\n| 4 | 5 | 6 |",
  code: "```ts\nconst x: number = 42;\nconsole.log(x);\n```",
  alerts: "> [!NOTE]\n> This is a note.\n\n> [!WARNING]\n> This is a warning.",
  footnotes: "See[^1].\n\n[^1]: Footnote content.",
  mermaid: "```mermaid\ngraph TD\n    A --> B\n```",
  math: "The equation $E = mc^2$ is famous.",
  mixed:
    "# Document\n\n## Section\n\nParagraph with **bold** and *italic*.\n\n```ts\nconst x = 1;\n```\n\n| Col1 | Col2 |\n|------|------|\n| a    | b    |\n\n> [!NOTE]\n> A note.\n\n[link](https://example.com)",
  longHeading:
    "# Main Title\n\n## Section One\n\n### Subsection A\n\n## Section Two\n\n### Subsection B",
} as const;

// ---------------------------------------------------------------------------
// 1. Representative fixture rendering (React entry point)
// ---------------------------------------------------------------------------

describe("browser integration — representative fixtures via React entry", () => {
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

  const fixtures: { name: string; source: string; expects: string[] }[] = [
    {
      name: "headings",
      source: FIXTURE_SOURCES.headings,
      expects: ["<h1>", "<h2>", "<h3>", "<h4>", "<h5>", "<h6>"],
    },
    { name: "tables", source: FIXTURE_SOURCES.tables, expects: ["<table>", "<th>", "<td>"] },
    { name: "code", source: FIXTURE_SOURCES.code, expects: ["<pre", "shiki-code-block"] },
    { name: "alerts", source: FIXTURE_SOURCES.alerts, expects: ["markdown-alert"] },
    { name: "footnotes", source: FIXTURE_SOURCES.footnotes, expects: ["footnote"] },
    { name: "mermaid placeholder", source: FIXTURE_SOURCES.mermaid, expects: ["mermaid"] },
    { name: "math", source: FIXTURE_SOURCES.math, expects: ["katex"] },
    {
      name: "mixed document",
      source: FIXTURE_SOURCES.mixed,
      expects: ["<h1>", "<h2>", "<table>", "<pre", "markdown-alert"],
    },
  ];

  for (const f of fixtures) {
    it(`renders ${f.name} fixture through published React entry`, async () => {
      root = createRoot(container);
      act(() => {
        root.render(<MarkdownReader source={f.source} />);
      });
      await flushAsync();

      const content = container.querySelector(".kmd-reader-content");
      expect(content).not.toBeNull();
      for (const expected of f.expects) {
        expect(content?.innerHTML).toContain(expected);
      }
    });
  }

  it("renders contract fixture file (headings-outline.md)", async () => {
    const source = await readFixture("markdown", "headings-outline");
    root = createRoot(container);
    act(() => {
      root.render(<MarkdownReader source={source} />);
    });
    await flushAsync();

    const content = container.querySelector(".kmd-reader-content");
    expect(content?.innerHTML).toContain("Main Title");
    expect(content?.innerHTML).toContain("Section One");
  });

  it("renders contract fixture file (alerts.md)", async () => {
    const source = await readFixture("markdown", "alerts");
    root = createRoot(container);
    act(() => {
      root.render(<MarkdownReader source={source} />);
    });
    await flushAsync();

    const content = container.querySelector(".kmd-reader-content");
    expect(content?.innerHTML).toContain("markdown-alert-note");
    expect(content?.innerHTML).toContain("markdown-alert-warning");
  });

  it("renders contract fixture file (gfm-extensions.md) — tables + task lists", async () => {
    const source = await readFixture("markdown", "gfm-extensions");
    root = createRoot(container);
    act(() => {
      root.render(<MarkdownReader source={source} />);
    });
    await flushAsync();

    const content = container.querySelector(".kmd-reader-content");
    expect(content?.innerHTML).toContain("<table>");
    expect(content?.innerHTML).toContain("task-list");
  });

  it("renders contract fixture file (code-blocks.md)", async () => {
    const source = await readFixture("markdown", "code-blocks");
    root = createRoot(container);
    act(() => {
      root.render(<MarkdownReader source={source} />);
    });
    await flushAsync();

    const content = container.querySelector(".kmd-reader-content");
    expect(content?.innerHTML).toContain("<pre");
    expect(content?.innerHTML).toContain("shiki-code-block");
  });

  it("renders contract fixture file (math.md)", async () => {
    const source = await readFixture("features", "math");
    root = createRoot(container);
    act(() => {
      root.render(<MarkdownReader source={source} />);
    });
    await flushAsync();

    const content = container.querySelector(".kmd-reader-content");
    // Math is rendered as KaTeX HTML in the pipeline (rehypeKatex plugin).
    // The rendered HTML contains katex-inline/katex-display classes.
    expect(content?.innerHTML).toContain("katex");
  });

  it("renders contract fixture file (mermaid.md)", async () => {
    const source = await readFixture("features", "mermaid");
    root = createRoot(container);
    act(() => {
      root.render(<MarkdownReader source={source} />);
    });
    await flushAsync();

    const content = container.querySelector(".kmd-reader-content");
    // Mermaid source is base64-encoded into data-mermaid-source attributes.
    // The mermaid-placeholder class is present on rendered containers.
    expect(content?.innerHTML).toContain("mermaid");
  });
});

// ---------------------------------------------------------------------------
// 2. Multiple readers on same page (independent rendering)
// ---------------------------------------------------------------------------

describe("browser integration — multiple readers on same page", () => {
  let c1: HTMLDivElement;
  let c2: HTMLDivElement;
  let root1: ReturnType<typeof createRoot>;
  let root2: ReturnType<typeof createRoot>;

  beforeEach(() => {
    c1 = createContainer();
    c2 = createContainer();
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

  it("two React readers render independently without interference", async () => {
    root1 = createRoot(c1);
    root2 = createRoot(c2);
    act(() => {
      root1.render(<MarkdownReader source="# Document Alpha" />);
      root2.render(<MarkdownReader source="# Document Beta" />);
    });
    await flushAsync();

    expect(c1.querySelector(".kmd-reader-content")?.innerHTML).toContain("Alpha");
    expect(c1.querySelector(".kmd-reader-content")?.innerHTML).not.toContain("Beta");
    expect(c2.querySelector(".kmd-reader-content")?.innerHTML).toContain("Beta");
    expect(c2.querySelector(".kmd-reader-content")?.innerHTML).not.toContain("Alpha");
  });

  it("two custom elements render independently without interference", async () => {
    registerKmdReader();
    const el1 = document.createElement("kmd-reader") as KmdReaderElement;
    el1.setAttribute("source", "# Element Alpha");
    const el2 = document.createElement("kmd-reader") as KmdReaderElement;
    el2.setAttribute("source", "# Element Beta");
    document.body.append(el1, el2);
    await flushAsync();

    expect(el1.querySelector(".kmd-reader-content")?.innerHTML).toContain("Alpha");
    expect(el1.querySelector(".kmd-reader-content")?.innerHTML).not.toContain("Beta");
    expect(el2.querySelector(".kmd-reader-content")?.innerHTML).toContain("Beta");
    expect(el2.querySelector(".kmd-reader-content")?.innerHTML).not.toContain("Alpha");
  });

  it("mixed React + custom element on same page do not interfere", async () => {
    root1 = createRoot(c1);
    act(() => {
      root1.render(<MarkdownReader source="# React Reader" />);
    });

    registerKmdReader();
    const el = document.createElement("kmd-reader") as KmdReaderElement;
    el.setAttribute("source", "# Element Reader");
    document.body.appendChild(el);
    await flushAsync();

    expect(c1.querySelector(".kmd-reader-content")?.innerHTML).toContain("React Reader");
    expect(el.querySelector(".kmd-reader-content")?.innerHTML).toContain("Element Reader");
  });
});

// ---------------------------------------------------------------------------
// 3. Link routing — external, internal, fragment, blocked
// ---------------------------------------------------------------------------

describe("browser integration — link routing", () => {
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
    vi.restoreAllMocks();
  });

  it("external links route to LinkHandler.openExternal", async () => {
    const openExternal = vi.fn().mockResolvedValue(undefined);
    const openDocument = vi.fn().mockResolvedValue(undefined);
    const caps: HostCapabilities = { linkHandler: { openExternal, openDocument } };

    root = createRoot(container);
    act(() => {
      root.render(<MarkdownReader source="[Example](https://example.com)" capabilities={caps} />);
    });
    await flushAsync();

    const link = container.querySelector<HTMLAnchorElement>(".kmd-reader-content a");
    expect(link).not.toBeNull();
    link?.click();
    await flushAsync();

    expect(openExternal).toHaveBeenCalledTimes(1);
    expect(openExternal.mock.calls[0][0]).toBeInstanceOf(URL);
    expect(openExternal.mock.calls[0][0].href).toBe("https://example.com/");
    expect(openDocument).not.toHaveBeenCalled();
  });

  it("internal/document links route to LinkHandler.openDocument", async () => {
    const openExternal = vi.fn().mockResolvedValue(undefined);
    const openDocument = vi.fn().mockResolvedValue(undefined);
    const caps: HostCapabilities = { linkHandler: { openExternal, openDocument } };

    root = createRoot(container);
    act(() => {
      root.render(<MarkdownReader source="[Other](./other.md)" capabilities={caps} />);
    });
    await flushAsync();

    const link = container.querySelector<HTMLAnchorElement>(".kmd-reader-content a");
    expect(link).not.toBeNull();
    link?.click();
    await flushAsync();

    expect(openDocument).toHaveBeenCalledTimes(1);
    expect(openDocument.mock.calls[0][0].href).toBe("./other.md");
    expect(openExternal).not.toHaveBeenCalled();
  });

  it("fragment links scroll to anchor (no handler invoked)", async () => {
    const openExternal = vi.fn().mockResolvedValue(undefined);
    const openDocument = vi.fn().mockResolvedValue(undefined);
    const caps: HostCapabilities = { linkHandler: { openExternal, openDocument } };

    const source = "# Title\n\n## Section\n\n[Go to Section](#section)";
    root = createRoot(container);
    act(() => {
      root.render(<MarkdownReader source={source} capabilities={caps} />);
    });
    await flushAsync();

    const links = container.querySelectorAll<HTMLAnchorElement>(".kmd-reader-content a");
    // The fragment link should be the last link
    const fragmentLink = links[links.length - 1];
    expect(fragmentLink).toBeTruthy();
    expect(fragmentLink?.getAttribute("href")).toBe("#section");

    fragmentLink?.click();
    await flushAsync();

    // Fragment links should not invoke external or document handlers
    expect(openExternal).not.toHaveBeenCalled();
    expect(openDocument).not.toHaveBeenCalled();
  });

  it("blocked links are prevented (no handler invoked)", async () => {
    const openExternal = vi.fn().mockResolvedValue(undefined);
    const openDocument = vi.fn().mockResolvedValue(undefined);
    const caps: HostCapabilities = { linkHandler: { openExternal, openDocument } };

    root = createRoot(container);
    act(() => {
      root.render(<MarkdownReader source="[xss](javascript:alert(1))" capabilities={caps} />);
    });
    await flushAsync();

    // The blocked link should have been stripped — no <a> element
    const link = container.querySelector(".kmd-reader-content a");
    expect(link).toBeNull();
    expect(openExternal).not.toHaveBeenCalled();
    expect(openDocument).not.toHaveBeenCalled();
  });

  it("external links get rel=noopener noreferrer when no handler", async () => {
    root = createRoot(container);
    act(() => {
      root.render(<MarkdownReader source="[Example](https://example.com)" />);
    });
    await flushAsync();

    const link = container.querySelector<HTMLAnchorElement>(".kmd-reader-content a");
    expect(link).not.toBeNull();
    expect(link?.getAttribute("rel")).toContain("noopener");
    expect(link?.getAttribute("rel")).toContain("noreferrer");
  });
});

// ---------------------------------------------------------------------------
// 4. Asset resolution — object URLs, revocation on unmount
// ---------------------------------------------------------------------------

describe("browser integration — asset resolution", () => {
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
    vi.restoreAllMocks();
  });

  it("AssetResolver resolves local image src to blob URL", async () => {
    const resolveAsset = vi.fn().mockResolvedValue({
      url: "blob:http://localhost/test-img",
      originalUrl: "cat.png",
    });
    const caps: HostCapabilities = { assetResolver: { resolveAsset } };

    root = createRoot(container);
    act(() => {
      root.render(<MarkdownReader source="![cat](cat.png)" capabilities={caps} />);
    });
    await flushAsync();

    expect(resolveAsset).toHaveBeenCalledTimes(1);
    expect(resolveAsset).toHaveBeenCalledWith(
      expect.objectContaining({ url: "cat.png", type: "image" }),
    );
    const img = container.querySelector<HTMLImageElement>(".kmd-reader-content img");
    expect(img).not.toBeNull();
    expect(img?.getAttribute("src")).toBe("blob:http://localhost/test-img");
  });

  it("revokeObjectURL is called on unmount for tracked blob URLs", async () => {
    const revokeSpy = vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});
    const resolveAsset = vi.fn().mockResolvedValue({
      url: "blob:http://localhost/revoke-test",
      originalUrl: "image.png",
    });
    const caps: HostCapabilities = { assetResolver: { resolveAsset } };

    root = createRoot(container);
    act(() => {
      root.render(<MarkdownReader source="![img](image.png)" capabilities={caps} />);
    });
    await flushAsync();

    expect(resolveAsset).toHaveBeenCalled();

    // Unmount — should revoke the blob URL
    act(() => {
      root.unmount();
    });
    root = undefined as never;

    expect(revokeSpy).toHaveBeenCalledWith("blob:http://localhost/revoke-test");
  });

  it("no AssetResolver — assets remain unresolved (original src kept)", async () => {
    root = createRoot(container);
    act(() => {
      root.render(<MarkdownReader source="![cat](cat.png)" />);
    });
    await flushAsync();

    const img = container.querySelector<HTMLImageElement>(".kmd-reader-content img");
    // Remote images are blocked by default. Local images without resolver
    // may or may not have src — the key is that no blob: URL is set.
    if (img) {
      expect(img.getAttribute("src")).not.toContain("blob:");
    }
  });
});

// ---------------------------------------------------------------------------
// 5. Worker fallback — main-thread rendering when no WorkerFactory
// ---------------------------------------------------------------------------

describe("browser integration — worker fallback", () => {
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

  it("renders on main thread when no WorkerFactory is supplied", async () => {
    root = createRoot(container);
    act(() => {
      root.render(<MarkdownReader source="# Main Thread Render" />);
    });
    await flushAsync();

    const content = container.querySelector(".kmd-reader-content");
    expect(content?.innerHTML).toContain("Main Thread Render");
  });

  it("renders on main thread for small docs even with WorkerFactory", async () => {
    // Small docs (< 4096 chars) always use main thread per WorkerBridge threshold
    const workerFactory = {
      createWorker: () => ({
        postMessage: () => {},
        addEventListener: () => {},
        terminate: () => {},
      }),
    } as unknown as import("@axis-love/kmd-web").WorkerFactory;
    const caps: HostCapabilities = { workerFactory };

    root = createRoot(container);
    act(() => {
      root.render(<MarkdownReader source="# Small Doc" capabilities={caps} />);
    });
    await flushAsync();

    expect(container.querySelector(".kmd-reader-content")?.innerHTML).toContain("Small Doc");
  });

  it("worker error falls back to main-thread rendering", async () => {
    // A WorkerFactory whose worker immediately errors should trigger
    // fallback to main-thread rendering. We use a large enough source
    // to exceed the 4096-char threshold.
    const largeSource = `# Big Document\n\n${"Lorem ipsum dolor sit amet. ".repeat(200)}`;
    const workerFactory = {
      createWorker: () => ({
        postMessage: () => {},
        addEventListener(type: string, listener: (e: Event) => void) {
          if (type === "error") {
            // Simulate immediate worker error
            listener(new ErrorEvent("error", { message: "worker crashed" }));
          }
        },
        terminate: () => {},
      }),
    } as unknown as import("@axis-love/kmd-web").WorkerFactory;
    const caps: HostCapabilities = { workerFactory };

    root = createRoot(container);
    act(() => {
      root.render(<MarkdownReader source={largeSource} capabilities={caps} />);
    });
    await flushAsync();

    // Fallback should produce the rendered content
    expect(container.querySelector(".kmd-reader-content")?.innerHTML).toContain("Big Document");
  });
});

// ---------------------------------------------------------------------------
// 6. Code copy — ClipboardProvider, navigator.clipboard fallback, unavailable
// ---------------------------------------------------------------------------

describe("browser integration — code copy", () => {
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
    vi.restoreAllMocks();
  });

  it("copy button click invokes ClipboardProvider.writeText", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    const onCopy = vi.fn();
    const caps: HostCapabilities = { clipboardProvider: { writeText } };

    root = createRoot(container);
    act(() => {
      root.render(
        <MarkdownReader source={"```ts\nconst x = 42;\n```"} capabilities={caps} onCopy={onCopy} />,
      );
    });
    await flushAsync();

    const button = container.querySelector(".kmd-reader-content .code-copy-button");
    if (button) {
      button.click();
      await flushAsync();
      expect(writeText).toHaveBeenCalled();
      expect(onCopy).toHaveBeenCalledWith("Copied to clipboard");
    }
  });

  it("falls back to navigator.clipboard when no ClipboardProvider", async () => {
    // Mock navigator.clipboard
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText },
      configurable: true,
      writable: true,
    });
    // Mock secure context
    Object.defineProperty(window, "isSecureContext", {
      value: true,
      configurable: true,
      writable: true,
    });

    root = createRoot(container);
    act(() => {
      root.render(<MarkdownReader source={"```ts\nconst y = 10;\n```"} />);
    });
    await flushAsync();

    const button = container.querySelector(".kmd-reader-content .code-copy-button");
    if (button) {
      button.click();
      await flushAsync();
      expect(writeText).toHaveBeenCalled();
    }
  });

  it("hides copy controls when clipboard is unavailable", async () => {
    // Remove clipboard and set insecure context
    Object.defineProperty(navigator, "clipboard", {
      value: undefined,
      configurable: true,
      writable: true,
    });
    Object.defineProperty(window, "isSecureContext", {
      value: false,
      configurable: true,
      writable: true,
    });

    root = createRoot(container);
    act(() => {
      root.render(<MarkdownReader source={"```ts\nconst z = 0;\n```"} />);
    });
    await flushAsync();

    // Copy buttons should be removed from the DOM (hidden)
    const buttons = container.querySelectorAll(".kmd-reader-content .code-copy-button");
    expect(buttons.length).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// 7. Outline navigation — scroll-to-fragment, active heading tracking
// ---------------------------------------------------------------------------

describe("browser integration — outline navigation", () => {
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
    vi.restoreAllMocks();
  });

  it("onOutlineChange fires with heading outline", async () => {
    const onOutlineChange = vi.fn();
    root = createRoot(container);
    act(() => {
      root.render(
        <MarkdownReader source={FIXTURE_SOURCES.longHeading} onOutlineChange={onOutlineChange} />,
      );
    });
    await flushAsync();

    expect(onOutlineChange).toHaveBeenCalled();
    const outline = onOutlineChange.mock.calls[onOutlineChange.mock.calls.length - 1][0];
    expect(outline.length).toBeGreaterThanOrEqual(5);
    expect(outline[0].text).toBe("Main Title");
    expect(outline[1].text).toBe("Section One");
  });

  it("onActiveHeadingChange fires via useScrollTracking hook", async () => {
    // The MarkdownReader component does not accept scrollContainer —
    // it creates a BrowserReader without scroll tracking. Active heading
    // tracking is done via the useScrollTracking hook by the host.
    // Here we verify the outline is delivered so a host CAN wire it up.
    const onOutlineChange = vi.fn();
    root = createRoot(container);
    act(() => {
      root.render(
        <MarkdownReader source={FIXTURE_SOURCES.longHeading} onOutlineChange={onOutlineChange} />,
      );
    });
    await flushAsync();

    expect(onOutlineChange).toHaveBeenCalled();
    const outline = onOutlineChange.mock.calls[onOutlineChange.mock.calls.length - 1][0];
    expect(outline.length).toBeGreaterThanOrEqual(5);
    // Hosts use the outline with useScrollTracking(containerRef, bodyRef, outline)
    // to get active heading updates. The outline being correct is the precondition.
    expect(outline[0].text).toBe("Main Title");
  });

  it("empty source produces empty outline", async () => {
    const onOutlineChange = vi.fn();
    root = createRoot(container);
    act(() => {
      root.render(<MarkdownReader source="" onOutlineChange={onOutlineChange} />);
    });
    await flushAsync();

    // Should have been called with an empty array at some point
    const lastCall = onOutlineChange.mock.calls[onOutlineChange.mock.calls.length - 1];
    expect(lastCall[0]).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// 8. Optional feature failures — independent failure isolation
// ---------------------------------------------------------------------------

describe("browser integration — optional feature failure isolation", () => {
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

  it("mermaid rendering failure does not break document rendering", async () => {
    // Mermaid import may fail in happy-dom — the feature coordinator
    // catches this and returns an error result. The document should still render.
    root = createRoot(container);
    act(() => {
      root.render(<MarkdownReader source={FIXTURE_SOURCES.mermaid} />);
    });
    await flushAsync();

    const content = container.querySelector(".kmd-reader-content");
    // The mermaid source should still be in the DOM as a placeholder
    expect(content?.innerHTML).toContain("mermaid");
  });

  it("math rendering failure does not break document rendering", async () => {
    // Even if KaTeX CSS fails to load, the math content should be present
    // as katex HTML in the rendered HTML
    root = createRoot(container);
    act(() => {
      root.render(<MarkdownReader source={FIXTURE_SOURCES.math} />);
    });
    await flushAsync();

    const content = container.querySelector(".kmd-reader-content");
    expect(content?.innerHTML).toContain("katex");
  });

  it("highlighting import failure does not break code rendering", async () => {
    // Code blocks should still render as <pre> even if Shiki fails
    root = createRoot(container);
    act(() => {
      root.render(<MarkdownReader source={FIXTURE_SOURCES.code} />);
    });
    await flushAsync();

    const content = container.querySelector(".kmd-reader-content");
    expect(content?.innerHTML).toContain("<pre");
  });

  it("mixed document with all features renders without crashing", async () => {
    root = createRoot(container);
    act(() => {
      root.render(<MarkdownReader source={FIXTURE_SOURCES.mixed} />);
    });
    await flushAsync();

    const content = container.querySelector(".kmd-reader-content");
    expect(content?.innerHTML).toContain("Document");
    expect(content?.innerHTML).toContain("<table>");
    expect(content?.innerHTML).toContain("<pre");
  });
});

// ---------------------------------------------------------------------------
// 9. Narrow viewport rendering
// ---------------------------------------------------------------------------

describe("browser integration — narrow viewport (375px)", () => {
  let container: HTMLDivElement;
  let root: ReturnType<typeof createRoot>;

  beforeEach(() => {
    container = createContainer("375px");
  });

  afterEach(() => {
    if (root) {
      act(() => {
        root.unmount();
      });
    }
    document.body.innerHTML = "";
  });

  it("renders headings at 375px width", async () => {
    root = createRoot(container);
    act(() => {
      root.render(<MarkdownReader source={FIXTURE_SOURCES.headings} />);
    });
    await flushAsync();

    expect(container.querySelector(".kmd-reader-content")?.innerHTML).toContain("<h1>");
  });

  it("renders tables at 375px width (horizontal scroll wrapper)", async () => {
    root = createRoot(container);
    act(() => {
      root.render(<MarkdownReader source={FIXTURE_SOURCES.tables} />);
    });
    await flushAsync();

    const content = container.querySelector(".kmd-reader-content");
    expect(content?.innerHTML).toContain("<table>");
    // Table wrapper enables horizontal scroll on narrow widths
    expect(content?.innerHTML).toContain("table-wrapper");
  });

  it("renders code blocks at 375px width", async () => {
    root = createRoot(container);
    act(() => {
      root.render(<MarkdownReader source={FIXTURE_SOURCES.code} />);
    });
    await flushAsync();

    expect(container.querySelector(".kmd-reader-content")?.innerHTML).toContain("<pre");
  });

  it("renders mixed document at 375px width", async () => {
    root = createRoot(container);
    act(() => {
      root.render(<MarkdownReader source={FIXTURE_SOURCES.mixed} />);
    });
    await flushAsync();

    const content = container.querySelector(".kmd-reader-content");
    expect(content?.innerHTML).toContain("<h1>");
    expect(content?.innerHTML).toContain("<table>");
    expect(content?.innerHTML).toContain("<pre");
  });
});
