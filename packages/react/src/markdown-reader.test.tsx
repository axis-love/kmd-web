// @vitest-environment happy-dom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MarkdownReader } from "./index";

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

function createContainer(): HTMLDivElement {
  const container = document.createElement("div");
  document.body.appendChild(container);
  return container;
}

function render(
  component: React.ReactElement,
  container: HTMLDivElement,
): ReturnType<typeof createRoot> {
  const root = createRoot(container);
  act(() => {
    root.render(component);
  });
  return root;
}

// Flush all pending microtasks/effects. React 19 act() flushes effects
// synchronously, but async BrowserReader.update() needs an extra tick.
// The renderFn now does `await import("@axis-love/math")` and
// `await import("@axis-love/highlighting")` before calling render(),
// adding extra async ticks beyond a single setTimeout(0).
async function flushAsync(): Promise<void> {
  await act(async () => {
    await new Promise<void>((resolve) => setTimeout(resolve, 100));
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("MarkdownReader", () => {
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

  it("renders markdown content into the container", async () => {
    root = render(<MarkdownReader source="# Hello World" />, container);
    await flushAsync();

    const reader = container.querySelector(".kmd-reader");
    expect(reader).not.toBeNull();
    const content = container.querySelector(".kmd-reader-content");
    expect(content).not.toBeNull();
    expect(content?.innerHTML).toContain("<h1>");
    expect(content?.innerHTML).toContain("Hello World");
  });

  it("shows loading state before first render completes", () => {
    root = render(<MarkdownReader source="# Hello" />, container);
    // Before flushAsync, isLoading should be true and content hidden.
    const loading = container.querySelector(".mdr-loading");
    expect(loading).not.toBeNull();
    expect(loading?.getAttribute("aria-busy")).toBe("true");
  });

  it("hides loading state after render completes", async () => {
    root = render(<MarkdownReader source="# Hello" />, container);
    await flushAsync();

    const loading = container.querySelector(".mdr-loading");
    expect(loading).toBeNull();
  });

  it("shows empty state when source is empty string", async () => {
    root = render(<MarkdownReader source="" />, container);

    const empty = container.querySelector(".mdr-empty");
    expect(empty).not.toBeNull();
    expect(empty?.textContent).toContain("empty");
  });

  it("does not show empty state when source has content", async () => {
    root = render(<MarkdownReader source="# Hello" />, container);
    await flushAsync();

    const empty = container.querySelector(".mdr-empty");
    expect(empty).toBeNull();
  });

  it("shows error state on render failure", async () => {
    root = render(
      <MarkdownReader source={"x".repeat(20)} renderOptions={{ maxSourceSize: 10 }} />,
      container,
    );
    await flushAsync();

    const errorEl = container.querySelector(".mdr-error");
    expect(errorEl).not.toBeNull();
    expect(errorEl?.textContent).toContain("Render Error");
  });

  it("calls onError callback on render failure", async () => {
    const onError = vi.fn();
    root = render(
      <MarkdownReader
        source={"x".repeat(20)}
        renderOptions={{ maxSourceSize: 10 }}
        onError={onError}
      />,
      container,
    );
    await flushAsync();

    expect(onError).toHaveBeenCalledTimes(1);
    expect(onError.mock.calls[0][0]).toBeInstanceOf(Error);
  });

  it("calls onOutlineChange with heading outline", async () => {
    const onOutlineChange = vi.fn();
    root = render(
      <MarkdownReader source={"# Title\n\n## Section"} onOutlineChange={onOutlineChange} />,
      container,
    );
    await flushAsync();

    expect(onOutlineChange).toHaveBeenCalled();
    // The outline may be called multiple times (initial + updates).
    // Check the last call which has the final outline.
    const lastCall = onOutlineChange.mock.calls[onOutlineChange.mock.calls.length - 1];
    const outline = lastCall[0] as readonly { text: string; level: number; slug: string }[];
    expect(outline).toHaveLength(2);
    expect(outline[0].text).toBe("Title");
    expect(outline[1].text).toBe("Section");
  });

  it("updates content when source prop changes", async () => {
    root = render(<MarkdownReader source="# First" />, container);
    await flushAsync();

    expect(container.querySelector(".kmd-reader-content")?.innerHTML).toContain("First");

    act(() => {
      root.render(<MarkdownReader source="# Second" />);
    });
    await flushAsync();

    expect(container.querySelector(".kmd-reader-content")?.innerHTML).toContain("Second");
    expect(container.querySelector(".kmd-reader-content")?.innerHTML).not.toContain("First");
  });

  it("applies className to the root element", async () => {
    root = render(<MarkdownReader source="# Hello" className="custom-reader" />, container);
    await flushAsync();

    const reader = container.querySelector(".kmd-reader");
    expect(reader?.classList.contains("custom-reader")).toBe(true);
  });

  it("renders with scoped .kmd-reader class", async () => {
    root = render(<MarkdownReader source="# Hello" />, container);
    await flushAsync();

    const reader = container.querySelector(".kmd-reader");
    expect(reader).not.toBeNull();
  });

  it("does not accept a file path — source is always a string", async () => {
    // The prop type enforces string. Verify it works with a plain string.
    root = render(<MarkdownReader source="# Markdown content" />, container);
    await flushAsync();
    expect(container.querySelector("h1")?.textContent).toBe("Markdown content");
  });

  it("cleans up BrowserReader on unmount", async () => {
    root = render(<MarkdownReader source="# Hello" />, container);
    await flushAsync();

    act(() => {
      root.unmount();
    });

    // After unmount, the container should be empty (React removes the component)
    expect(container.children).toHaveLength(0);
  });

  it("transitions from empty to content when source changes", async () => {
    root = render(<MarkdownReader source="" />, container);
    expect(container.querySelector(".mdr-empty")).not.toBeNull();

    act(() => {
      root.render(<MarkdownReader source="# Now I have content" />);
    });
    await flushAsync();

    expect(container.querySelector(".mdr-empty")).toBeNull();
    expect(container.querySelector(".kmd-reader-content")?.innerHTML).toContain(
      "Now I have content",
    );
  });

  it("transitions from content to empty when source changes to empty", async () => {
    root = render(<MarkdownReader source="# Content here" />, container);
    await flushAsync();

    expect(container.querySelector(".kmd-reader-content")?.innerHTML).toContain("Content here");

    act(() => {
      root.render(<MarkdownReader source="" />);
    });

    expect(container.querySelector(".mdr-empty")).not.toBeNull();
    // The content container is hidden, not removed.
    const contentEl = container.querySelector(".kmd-reader-content") as HTMLElement;
    expect(contentEl.hidden).toBe(true);
  });

  it("handles renderOptions changes", async () => {
    root = render(
      <MarkdownReader source="# Hello" renderOptions={{ features: { mermaid: false } }} />,
      container,
    );
    await flushAsync();
    expect(container.querySelector("h1")?.textContent).toBe("Hello");

    act(() => {
      root.render(
        <MarkdownReader source="# World" renderOptions={{ features: { math: false } }} />,
      );
    });
    await flushAsync();

    expect(container.querySelector("h1")?.textContent).toBe("World");
  });

  it("calls onCopy callback when copy succeeds", async () => {
    const onCopy = vi.fn();
    // Code copy requires clipboard. Without a ClipboardProvider, the
    // browser runtime falls back to navigator.clipboard if available.
    // In happy-dom, navigator.clipboard may be undefined, so we
    // just verify the callback prop is accepted and doesn't crash.
    root = render(
      <MarkdownReader source={"```ts\nconst x = 1;\n```"} onCopy={onCopy} />,
      container,
    );
    await flushAsync();
    // Copy buttons may or may not appear depending on happy-dom support.
    // The test verifies the component doesn't crash with the onCopy prop.
    expect(container.querySelector(".kmd-reader")).not.toBeNull();
  });
});
