// @vitest-environment happy-dom

import type { DesignThemeInfo } from "@axis-love/browser";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MarkdownReader } from "./index";

const DESIGN_MD = [
  "# Test Design",
  "",
  "## Colors",
  "",
  "| Token | Value |",
  "|---|---|",
  "| color-background | #101418 |",
  "| color-text | #e8ecf1 |",
  "",
].join("\n");

function createContainer(): HTMLDivElement {
  const container = document.createElement("div");
  document.body.appendChild(container);
  return container;
}

async function waitFor(condition: () => boolean): Promise<void> {
  const deadline = Date.now() + 20_000;
  for (;;) {
    await act(async () => {
      await new Promise<void>((resolve) => setTimeout(resolve, 25));
    });
    if (condition()) return;
    if (Date.now() > deadline) return;
  }
}

vi.setConfig({ testTimeout: 30_000 });

describe("MarkdownReader designSource", () => {
  let container: HTMLDivElement;
  let root: ReturnType<typeof createRoot>;

  beforeEach(() => {
    container = createContainer();
  });

  afterEach(() => {
    act(() => {
      root?.unmount();
    });
    document.body.innerHTML = "";
    for (const el of document.head.querySelectorAll("style[data-kmd-design-theme]")) {
      el.remove();
    }
  });

  it("applies the custom theme to the reader root and removes it on prop clear", async () => {
    const infos: DesignThemeInfo[] = [];
    root = createRoot(container);

    act(() => {
      root.render(
        <MarkdownReader
          source="# Hello"
          designSource={DESIGN_MD}
          onDesignTheme={(i) => infos.push(i)}
        />,
      );
    });

    await waitFor(() => infos.length > 0);
    expect(infos[0]!.applied).toBe(true);

    const readerRoot = container.querySelector(".kmd-reader");
    expect(readerRoot?.hasAttribute("data-kmd-design")).toBe(true);
    expect(document.head.querySelector("style[data-kmd-design-theme]")).not.toBeNull();

    // Clearing the prop removes the overrides; the document keeps rendering.
    act(() => {
      root.render(<MarkdownReader source="# Hello" onDesignTheme={(i) => infos.push(i)} />);
    });
    await waitFor(() => readerRoot?.hasAttribute("data-kmd-design") === false);
    expect(readerRoot?.hasAttribute("data-kmd-design")).toBe(false);
    expect(document.head.querySelector("style[data-kmd-design-theme]")).toBeNull();
  });

  it("reports applied: false for a non-design document without entering the error state", async () => {
    const infos: DesignThemeInfo[] = [];
    root = createRoot(container);

    act(() => {
      root.render(
        <MarkdownReader
          source="# Hello"
          designSource={"# Plain document\n\nNothing designy.\n"}
          onDesignTheme={(i) => infos.push(i)}
        />,
      );
    });

    await waitFor(() => infos.length > 0);
    expect(infos[0]!.applied).toBe(false);
    expect(infos[0]!.diagnostics.length).toBeGreaterThan(0);

    await waitFor(() => (container.querySelector(".kmd-reader-content")?.innerHTML ?? "") !== "");
    expect(container.querySelector(".mdr-error")).toBeNull();
    expect(container.querySelector(".kmd-reader-content")?.innerHTML).toContain("<h1");
  });
});
