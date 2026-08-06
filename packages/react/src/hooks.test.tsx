// @vitest-environment happy-dom

import type { OutlineEntry } from "@axis-love/contracts";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it } from "vitest";
import { useMarkdownReader, useOutline, useScrollTracking } from "./index";

// ---------------------------------------------------------------------------
// Test harness: a component that calls the hook and exposes the result
// via a ref that the test can read after async effects flush.
// ---------------------------------------------------------------------------

let lastHookResult: unknown = null;

function renderHook<T>(hook: () => T): {
  root: ReturnType<typeof createRoot>;
  getResult: () => T;
} {
  const container = document.createElement("div");
  document.body.appendChild(container);

  function Harness() {
    lastHookResult = hook();
    return null;
  }

  const root = createRoot(container);
  act(() => {
    root.render(<Harness />);
  });

  return {
    root,
    getResult: () => lastHookResult as T,
  };
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
// useMarkdownReader
// ---------------------------------------------------------------------------

describe("useMarkdownReader", () => {
  let root: ReturnType<typeof createRoot> | null = null;

  afterEach(() => {
    if (root) {
      act(() => {
        root?.unmount();
      });
      root = null;
    }
    document.body.innerHTML = "";
  });

  it("returns initial state with isLoading true for non-empty source", () => {
    const hook = renderHook(() => useMarkdownReader("# Hello"));
    root = hook.root;

    const result = hook.getResult();
    expect(result.isLoading).toBe(true);
    expect(result.html).toBe("");
    expect(result.outline).toEqual([]);
    expect(result.error).toBeNull();
  });

  it("returns isLoading false for empty source", () => {
    const hook = renderHook(() => useMarkdownReader(""));
    root = hook.root;

    const result = hook.getResult();
    expect(result.isLoading).toBe(false);
  });

  it("renders markdown and updates state", async () => {
    const hook = renderHook(() => useMarkdownReader("# Hello World"));
    root = hook.root;

    await flushAsync();

    const result = hook.getResult();
    expect(result.html).toContain("<h1>");
    expect(result.outline).toHaveLength(1);
    expect(result.outline[0].text).toBe("Hello World");
    expect(result.isLoading).toBe(false);
    expect(result.error).toBeNull();
  });

  it("cleans up on unmount without errors", async () => {
    const hook = renderHook(() => useMarkdownReader("# Hello"));
    root = hook.root;

    await flushAsync();

    // Should not throw on unmount
    act(() => {
      root?.unmount();
    });
  });
});

// ---------------------------------------------------------------------------
// useScrollTracking
// ---------------------------------------------------------------------------

describe("useScrollTracking", () => {
  let root: ReturnType<typeof createRoot> | null = null;

  afterEach(() => {
    if (root) {
      act(() => {
        root?.unmount();
      });
      root = null;
    }
    document.body.innerHTML = "";
  });

  it("returns undefined when outline is empty", () => {
    const containerRef = { current: document.createElement("div") };
    const bodyRef = { current: document.createElement("div") };
    const hook = renderHook(() => useScrollTracking(containerRef, bodyRef, []));
    root = hook.root;

    const result = hook.getResult();
    expect(result).toBeUndefined();
  });

  it("returns a slug when tracking is active", async () => {
    const scrollContainer = document.createElement("div");
    scrollContainer.style.height = "200px";
    scrollContainer.style.overflowY = "auto";
    const body = document.createElement("div");
    scrollContainer.appendChild(body);
    document.body.appendChild(scrollContainer);

    const containerRef = { current: scrollContainer };
    const bodyRef = { current: body };
    const outline: OutlineEntry[] = [
      { level: 1, text: "Title", slug: "title" },
      { level: 2, text: "Section", slug: "section" },
    ];

    const hook = renderHook(() => useScrollTracking(containerRef, bodyRef, outline));
    root = hook.root;

    await flushAsync();

    const result = hook.getResult();
    expect(result).toBe("title");
  });
});

// ---------------------------------------------------------------------------
// useOutline
// ---------------------------------------------------------------------------

describe("useOutline", () => {
  let root: ReturnType<typeof createRoot> | null = null;

  afterEach(() => {
    if (root) {
      act(() => {
        root?.unmount();
      });
      root = null;
    }
    document.body.innerHTML = "";
  });

  it("returns initial visible state and toggle function", () => {
    const hook = renderHook(() => useOutline([], true));
    root = hook.root;
    const [visible, toggle, setVisible] = hook.getResult() as [
      boolean,
      () => void,
      (v: boolean) => void,
    ];

    expect(visible).toBe(true);
    expect(typeof toggle).toBe("function");
    expect(typeof setVisible).toBe("function");
  });

  it("toggle flips the visibility", () => {
    const hook = renderHook(() => useOutline([], true));
    root = hook.root;
    const [, toggle] = hook.getResult() as [boolean, () => void, (v: boolean) => void];

    act(() => {
      toggle();
    });

    const [visible] = hook.getResult() as [boolean, () => void, (v: boolean) => void];
    expect(visible).toBe(false);
  });

  it("setVisible directly sets visibility", () => {
    const hook = renderHook(() => useOutline([], false));
    root = hook.root;
    const [, , setVisible] = hook.getResult() as [boolean, () => void, (v: boolean) => void];

    act(() => {
      setVisible(true);
    });

    const [visible] = hook.getResult() as [boolean, () => void, (v: boolean) => void];
    expect(visible).toBe(true);
  });
});
