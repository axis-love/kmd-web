// @vitest-environment happy-dom

import type { OutlineEntry } from "@axis-love/contracts";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DocumentShell } from "./index";

function createContainer(): HTMLDivElement {
  const container = document.createElement("div");
  document.body.appendChild(container);
  return container;
}

const SAMPLE_OUTLINE: OutlineEntry[] = [
  { level: 1, text: "Introduction", slug: "introduction" },
  { level: 2, text: "Background", slug: "background" },
  { level: 3, text: "History", slug: "history" },
  { level: 4, text: "Origins", slug: "origins" },
];

describe("DocumentShell", () => {
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

  it("renders the outline sidebar with items", () => {
    root = createRoot(container);
    act(() => {
      root.render(
        <DocumentShell outline={SAMPLE_OUTLINE}>
          <p>Content</p>
        </DocumentShell>,
      );
    });

    const sidebar = container.querySelector(".kmd-outline-sidebar");
    expect(sidebar).not.toBeNull();

    const items = container.querySelectorAll(".kmd-outline-item");
    expect(items).toHaveLength(4);
    expect(items[0].textContent).toBe("Introduction");
  });

  it("renders children in the content area", () => {
    root = createRoot(container);
    act(() => {
      root.render(
        <DocumentShell outline={SAMPLE_OUTLINE}>
          <p className="test-content">Hello content</p>
        </DocumentShell>,
      );
    });

    const content = container.querySelector(".kmd-content");
    expect(content).not.toBeNull();
    expect(content?.querySelector(".test-content")?.textContent).toBe("Hello content");
  });

  it("has aria-label on the outline nav", () => {
    root = createRoot(container);
    act(() => {
      root.render(
        <DocumentShell outline={SAMPLE_OUTLINE}>
          <p>Content</p>
        </DocumentShell>,
      );
    });

    const nav = container.querySelector("nav");
    expect(nav?.getAttribute("aria-label")).toBe("Document outline");
  });

  it("toggle button has accessible title and aria-label", () => {
    root = createRoot(container);
    act(() => {
      root.render(
        <DocumentShell outline={SAMPLE_OUTLINE}>
          <p>Content</p>
        </DocumentShell>,
      );
    });

    const button = container.querySelector(".kmd-outline-toggle") as HTMLButtonElement;
    expect(button).not.toBeNull();
    expect(button.title).toBe("Hide outline");
    expect(button.getAttribute("aria-label")).toBe("Hide outline");
    expect(button.getAttribute("aria-expanded")).toBe("true");
  });

  it("toggles outline visibility on button click", () => {
    root = createRoot(container);
    act(() => {
      root.render(
        <DocumentShell outline={SAMPLE_OUTLINE}>
          <p>Content</p>
        </DocumentShell>,
      );
    });

    const sidebar = container.querySelector(".kmd-outline-sidebar");
    expect(sidebar?.classList.contains("collapsed")).toBe(false);

    const button = container.querySelector(".kmd-outline-toggle") as HTMLButtonElement;
    act(() => {
      button.click();
    });

    const sidebarAfter = container.querySelector(".kmd-outline-sidebar");
    expect(sidebarAfter?.classList.contains("collapsed")).toBe(true);

    const buttonAfter = container.querySelector(".kmd-outline-toggle") as HTMLButtonElement;
    expect(buttonAfter.title).toBe("Show outline");
    expect(buttonAfter.getAttribute("aria-expanded")).toBe("false");
  });

  it("highlights active heading with .active class", () => {
    root = createRoot(container);
    act(() => {
      root.render(
        <DocumentShell outline={SAMPLE_OUTLINE} activeId="background">
          <p>Content</p>
        </DocumentShell>,
      );
    });

    const activeItem = container.querySelector(".kmd-outline-item.active");
    expect(activeItem?.textContent).toBe("Background");
  });

  it("renders outline items with data-depth attribute", () => {
    root = createRoot(container);
    act(() => {
      root.render(
        <DocumentShell outline={SAMPLE_OUTLINE}>
          <p>Content</p>
        </DocumentShell>,
      );
    });

    const items = container.querySelectorAll(".kmd-outline-item");
    expect(items[0].getAttribute("data-depth")).toBe("0");
    expect(items[1].getAttribute("data-depth")).toBe("1");
    expect(items[2].getAttribute("data-depth")).toBe("2");
    expect(items[3].getAttribute("data-depth")).toBe("3");
  });

  it("calls onAnchorClick when an outline item is clicked", () => {
    const onAnchorClick = vi.fn();
    root = createRoot(container);
    act(() => {
      root.render(
        <DocumentShell outline={SAMPLE_OUTLINE} onAnchorClick={onAnchorClick}>
          <p>Content</p>
        </DocumentShell>,
      );
    });

    const firstItem = container.querySelectorAll(".kmd-outline-item")[0] as HTMLAnchorElement;
    act(() => {
      firstItem.click();
    });

    expect(onAnchorClick).toHaveBeenCalledWith("introduction");
  });

  it("outline item links have href with fragment", () => {
    root = createRoot(container);
    act(() => {
      root.render(
        <DocumentShell outline={SAMPLE_OUTLINE}>
          <p>Content</p>
        </DocumentShell>,
      );
    });

    const firstItem = container.querySelectorAll(".kmd-outline-item")[0] as HTMLAnchorElement;
    expect(firstItem.getAttribute("href")).toBe("#introduction");
  });

  it("clicking an outline item prevents default navigation", () => {
    root = createRoot(container);
    act(() => {
      root.render(
        <DocumentShell outline={SAMPLE_OUTLINE}>
          <p>Content</p>
        </DocumentShell>,
      );
    });

    const firstItem = container.querySelectorAll(".kmd-outline-item")[0] as HTMLAnchorElement;
    let defaultPrevented = false;
    act(() => {
      const event = new MouseEvent("click", { bubbles: true, cancelable: true });
      firstItem.dispatchEvent(event);
      defaultPrevented = event.defaultPrevented;
    });

    expect(defaultPrevented).toBe(true);
  });

  it("renders with .kmd-document-shell root class", () => {
    root = createRoot(container);
    act(() => {
      root.render(
        <DocumentShell outline={SAMPLE_OUTLINE}>
          <p>Content</p>
        </DocumentShell>,
      );
    });

    const shell = container.querySelector(".kmd-document-shell");
    expect(shell).not.toBeNull();
  });

  it("applies custom className", () => {
    root = createRoot(container);
    act(() => {
      root.render(
        <DocumentShell outline={SAMPLE_OUTLINE} className="my-shell">
          <p>Content</p>
        </DocumentShell>,
      );
    });

    const shell = container.querySelector(".kmd-document-shell");
    expect(shell?.classList.contains("my-shell")).toBe(true);
  });

  it("renders empty outline without crashing", () => {
    root = createRoot(container);
    act(() => {
      root.render(
        <DocumentShell outline={[]}>
          <p>Content</p>
        </DocumentShell>,
      );
    });

    const items = container.querySelectorAll(".kmd-outline-item");
    expect(items).toHaveLength(0);
  });

  // -------------------------------------------------------------------------
  // Outline visibility — controlled / uncontrolled (KWEB-052)
  // -------------------------------------------------------------------------

  it("starts visible when neither visibility prop is given", () => {
    root = createRoot(container);
    act(() => {
      root.render(
        <DocumentShell outline={SAMPLE_OUTLINE}>
          <p>Content</p>
        </DocumentShell>,
      );
    });

    const sidebar = container.querySelector(".kmd-outline-sidebar");
    expect(sidebar?.classList.contains("collapsed")).toBe(false);
  });

  it("honours defaultOutlineVisible={false} as the uncontrolled initial value", () => {
    root = createRoot(container);
    act(() => {
      root.render(
        <DocumentShell outline={SAMPLE_OUTLINE} defaultOutlineVisible={false}>
          <p>Content</p>
        </DocumentShell>,
      );
    });

    const sidebar = container.querySelector(".kmd-outline-sidebar");
    expect(sidebar?.classList.contains("collapsed")).toBe(true);

    const button = container.querySelector(".kmd-outline-toggle") as HTMLButtonElement;
    expect(button.getAttribute("aria-expanded")).toBe("false");
    expect(button.title).toBe("Show outline");
  });

  it("toggles from a false default back to visible in uncontrolled mode", () => {
    root = createRoot(container);
    act(() => {
      root.render(
        <DocumentShell outline={SAMPLE_OUTLINE} defaultOutlineVisible={false}>
          <p>Content</p>
        </DocumentShell>,
      );
    });

    const button = container.querySelector(".kmd-outline-toggle") as HTMLButtonElement;
    act(() => {
      button.click();
    });

    const sidebar = container.querySelector(".kmd-outline-sidebar");
    expect(sidebar?.classList.contains("collapsed")).toBe(false);
  });

  it("reports toggles through onOutlineVisibleChange in uncontrolled mode", () => {
    const onOutlineVisibleChange = vi.fn();
    root = createRoot(container);
    act(() => {
      root.render(
        <DocumentShell outline={SAMPLE_OUTLINE} onOutlineVisibleChange={onOutlineVisibleChange}>
          <p>Content</p>
        </DocumentShell>,
      );
    });

    const button = container.querySelector(".kmd-outline-toggle") as HTMLButtonElement;
    act(() => {
      button.click();
    });

    expect(onOutlineVisibleChange).toHaveBeenCalledTimes(1);
    expect(onOutlineVisibleChange).toHaveBeenLastCalledWith(false);
    // The internal state still moved — uncontrolled mode keeps working.
    expect(container.querySelector(".kmd-outline-sidebar")?.classList.contains("collapsed")).toBe(
      true,
    );

    act(() => {
      (container.querySelector(".kmd-outline-toggle") as HTMLButtonElement).click();
    });
    expect(onOutlineVisibleChange).toHaveBeenLastCalledWith(true);
  });

  it("renders the outlineVisible prop in controlled mode", () => {
    root = createRoot(container);
    act(() => {
      root.render(
        <DocumentShell outline={SAMPLE_OUTLINE} outlineVisible={false}>
          <p>Content</p>
        </DocumentShell>,
      );
    });

    const sidebar = container.querySelector(".kmd-outline-sidebar");
    expect(sidebar?.classList.contains("collapsed")).toBe(true);

    act(() => {
      root.render(
        <DocumentShell outline={SAMPLE_OUTLINE} outlineVisible={true}>
          <p>Content</p>
        </DocumentShell>,
      );
    });

    expect(container.querySelector(".kmd-outline-sidebar")?.classList.contains("collapsed")).toBe(
      false,
    );
  });

  it("does not change visibility on its own in controlled mode", () => {
    const onOutlineVisibleChange = vi.fn();
    root = createRoot(container);
    act(() => {
      root.render(
        <DocumentShell
          outline={SAMPLE_OUTLINE}
          outlineVisible={true}
          onOutlineVisibleChange={onOutlineVisibleChange}
        >
          <p>Content</p>
        </DocumentShell>,
      );
    });

    const button = container.querySelector(".kmd-outline-toggle") as HTMLButtonElement;
    act(() => {
      button.click();
    });

    expect(onOutlineVisibleChange).toHaveBeenCalledWith(false);
    // Still visible — the host owns the value and has not changed it.
    expect(container.querySelector(".kmd-outline-sidebar")?.classList.contains("collapsed")).toBe(
      false,
    );
  });

  it("controlled mode overrides defaultOutlineVisible", () => {
    root = createRoot(container);
    act(() => {
      root.render(
        <DocumentShell outline={SAMPLE_OUTLINE} defaultOutlineVisible={true} outlineVisible={false}>
          <p>Content</p>
        </DocumentShell>,
      );
    });

    expect(container.querySelector(".kmd-outline-sidebar")?.classList.contains("collapsed")).toBe(
      true,
    );
  });

  it("outline item links are keyboard-focusable", () => {
    root = createRoot(container);
    act(() => {
      root.render(
        <DocumentShell outline={SAMPLE_OUTLINE}>
          <p>Content</p>
        </DocumentShell>,
      );
    });

    const firstItem = container.querySelectorAll(".kmd-outline-item")[0] as HTMLAnchorElement;
    // Anchor elements with href are inherently focusable.
    expect(firstItem.tagName).toBe("A");
    expect(firstItem.href).toContain("#introduction");
  });
});
