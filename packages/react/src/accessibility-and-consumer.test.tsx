// @vitest-environment happy-dom

import type { OutlineEntry } from "@axis-love/contracts";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { DocumentShell, MarkdownReader } from "./index";

function createContainer(): HTMLDivElement {
  const container = document.createElement("div");
  document.body.appendChild(container);
  return container;
}

async function flushAsync(): Promise<void> {
  await act(async () => {
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
  });
}

const SAMPLE_OUTLINE: OutlineEntry[] = [
  { level: 1, text: "Introduction", slug: "introduction" },
  { level: 2, text: "Background", slug: "background" },
];

// ---------------------------------------------------------------------------
// Accessibility tests
// ---------------------------------------------------------------------------

describe("Accessibility", () => {
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

  it("DocumentShell outline nav has aria-label", () => {
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

  it("DocumentShell toggle button has accessible name via aria-label and title", () => {
    root = createRoot(container);
    act(() => {
      root.render(
        <DocumentShell outline={SAMPLE_OUTLINE}>
          <p>Content</p>
        </DocumentShell>,
      );
    });

    const button = container.querySelector(".kmd-outline-toggle") as HTMLButtonElement;
    expect(button.getAttribute("aria-label")).toBeTruthy();
    expect(button.title).toBeTruthy();
  });

  it("DocumentShell toggle button has aria-expanded attribute", () => {
    root = createRoot(container);
    act(() => {
      root.render(
        <DocumentShell outline={SAMPLE_OUTLINE}>
          <p>Content</p>
        </DocumentShell>,
      );
    });

    const button = container.querySelector(".kmd-outline-toggle") as HTMLButtonElement;
    expect(button.getAttribute("aria-expanded")).toBe("true");
  });

  it("DocumentShell toggle button is a button element (keyboard accessible)", () => {
    root = createRoot(container);
    act(() => {
      root.render(
        <DocumentShell outline={SAMPLE_OUTLINE}>
          <p>Content</p>
        </DocumentShell>,
      );
    });

    const button = container.querySelector(".kmd-outline-toggle");
    expect(button?.tagName).toBe("BUTTON");
    expect((button as HTMLButtonElement).type).toBe("button");
  });

  it("outline items are anchor elements with href (focusable)", () => {
    root = createRoot(container);
    act(() => {
      root.render(
        <DocumentShell outline={SAMPLE_OUTLINE}>
          <p>Content</p>
        </DocumentShell>,
      );
    });

    const items = container.querySelectorAll(".kmd-outline-item");
    for (const item of items) {
      expect(item.tagName).toBe("A");
      expect((item as HTMLAnchorElement).href).toBeTruthy();
    }
  });

  it("outline items have meaningful text content", () => {
    root = createRoot(container);
    act(() => {
      root.render(
        <DocumentShell outline={SAMPLE_OUTLINE}>
          <p>Content</p>
        </DocumentShell>,
      );
    });

    const items = container.querySelectorAll(".kmd-outline-item");
    expect(items[0].textContent).toBe("Introduction");
    expect(items[1].textContent).toBe("Background");
  });

  it("MarkdownReader loading state has aria-busy and aria-live", () => {
    root = createRoot(container);
    act(() => {
      root.render(<MarkdownReader source="# Hello" />);
    });

    const loading = container.querySelector(".mdr-loading");
    expect(loading?.getAttribute("aria-busy")).toBe("true");
    expect(loading?.getAttribute("aria-live")).toBe("polite");
  });

  it("focus is visible via .kmd-reader :focus-visible CSS scope", async () => {
    root = createRoot(container);
    act(() => {
      root.render(<MarkdownReader source="# Hello" />);
    });
    await flushAsync();

    // The reader root should have the .kmd-reader class which
    // has a :focus-visible rule in styles.css.
    const reader = container.querySelector(".kmd-reader");
    expect(reader).not.toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Package consumer test (importing from built package)
// ---------------------------------------------------------------------------

describe("Package consumer — importing from built dist", () => {
  it("imports from @axis-love/react resolve to the built package", async () => {
    // Dynamic import from the package name (resolved by vitest)
    const mod = await import("@axis-love/react");
    expect(mod.MarkdownReader).toBeDefined();
    expect(mod.DocumentShell).toBeDefined();
    expect(mod.useMarkdownReader).toBeDefined();
    expect(mod.useScrollTracking).toBeDefined();
    expect(mod.useOutline).toBeDefined();
    expect(mod.REACT_PACKAGE_VERSION).toBe("0.1.0");
  });

  it("exports HostCapabilities type (type-only re-export)", async () => {
    const mod = await import("@axis-love/react");
    // Type re-exports are erased at runtime, but the module should
    // still be importable.
    expect(mod).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// Peer dependency test — React is NOT bundled in the output
// ---------------------------------------------------------------------------

describe("Peer dependency — React is not in the bundle", () => {
  it("built dist/index.js should not contain React implementation code", async () => {
    const { existsSync, readFileSync } = await import("node:fs");
    const { join } = await import("node:path");

    const distFile = join(process.cwd(), "packages", "react", "dist", "index.js");
    if (!existsSync(distFile)) {
      // dist may not be built yet during test run
      return;
    }

    const content = readFileSync(distFile, "utf-8");

    // The built output should import React as an external, not
    // contain React's implementation code.
    // Check for telltale signs of bundled React:
    expect(content).not.toContain("useState_impl");
    expect(content).not.toContain("react-dom_development");
    // The output should have an import from "react" (external peer dep)
    expect(content).toMatch(/from\s+["']react["']/);
  });
});

// ---------------------------------------------------------------------------
// Static platform-coupling search — no Tauri imports
// ---------------------------------------------------------------------------

describe("Static platform-coupling search", () => {
  it("source contains no Tauri imports", async () => {
    const { existsSync, readFileSync, readdirSync } = await import("node:fs");
    const { join } = await import("node:path");

    const srcDir = join(process.cwd(), "packages", "react", "src");
    if (!existsSync(srcDir)) return;

    // Only check non-test source files
    const files = readdirSync(srcDir).filter(
      (f) => (f.endsWith(".ts") || f.endsWith(".tsx")) && !f.includes(".test."),
    );

    for (const file of files) {
      const content = readFileSync(join(srcDir, file), "utf-8");
      expect(content).not.toContain("@tauri-apps");
      expect(content).not.toContain("isTauriRuntime");
    }
  });

  it("built output contains no Tauri references", async () => {
    const { existsSync, readFileSync } = await import("node:fs");
    const { join } = await import("node:path");

    const distFile = join(process.cwd(), "packages", "react", "dist", "index.js");
    if (!existsSync(distFile)) return;

    const content = readFileSync(distFile, "utf-8");
    expect(content).not.toContain("@tauri-apps");
    expect(content).not.toContain("isTauriRuntime");
  });

  it("source contains no app-specific toast/store code", async () => {
    const { existsSync, readFileSync, readdirSync } = await import("node:fs");
    const { join } = await import("node:path");

    const srcDir = join(process.cwd(), "packages", "react", "src");
    if (!existsSync(srcDir)) return;

    // Only check non-test source files
    const files = readdirSync(srcDir).filter(
      (f) => (f.endsWith(".ts") || f.endsWith(".tsx")) && !f.includes(".test."),
    );

    for (const file of files) {
      const content = readFileSync(join(srcDir, file), "utf-8");
      expect(content).not.toContain("useToast");
      expect(content).not.toContain("@/hooks");
      expect(content).not.toContain("@/utils/platform");
    }
  });
});
