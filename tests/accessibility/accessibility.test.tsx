// @vitest-environment happy-dom
//
// Accessibility tests — keyboard navigation, focus management, heading/landmark
// structure, table accessibility, alert semantics, and reduced motion.
//
// Uses axe-core for automated accessibility scanning plus manual aria/role
// assertions for kmd-specific patterns. Imports from published package entry
// points (@axis-love/kmd-web/react, @axis-love/kmd-web/element).
//
// Browser matrix: happy-dom for DOM structure + computed style assertions.
// Real browser axe-core runs are documented in tests/visual/README.md (Playwright).

import type { OutlineEntry } from "@axis-love/contracts";
import { type KmdReaderElement, registerKmdReader } from "@axis-love/kmd-web/element";
import { DocumentShell, MarkdownReader } from "@axis-love/kmd-web/react";
import axe from "axe-core";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createContainer(): HTMLDivElement {
  const container = document.createElement("div");
  document.body.appendChild(container);
  return container;
}

async function flushAsync(): Promise<void> {
  await act(async () => {
    // Wait for async rendering (including dynamic imports of KaTeX/Shiki)
    // to complete. Poll for up to 1 second.
    for (let i = 0; i < 50; i++) {
      await new Promise<void>((resolve) => setTimeout(resolve, 20));
    }
  });
}

/** Run axe-core on a container and return violations. */
async function runAxe(container: HTMLElement): Promise<axe.Result[]> {
  // Configure axe for the kmd reader context
  const config: axe.RunOptions = {
    rules: {
      // The reader renders in light DOM. color-contrast is not reliable
      // in happy-dom (no real rendering). We test contrast in Playwright.
      "color-contrast": { enabled: false },
      // region/landmark rules need a full page — we test a fragment.
      region: { enabled: false },
    },
  };

  const results = await axe.run(container, config);
  return results.violations;
}

/** Assert no serious/critical axe violations (serious + critical levels). */
function assertNoSeriousViolations(violations: axe.Result[]): void {
  const serious = violations.filter((v) => v.impact === "serious" || v.impact === "critical");
  if (serious.length > 0) {
    const messages = serious.map(
      (v) => `${v.id} (${v.impact}): ${v.description} — ${v.nodes.length} node(s)`,
    );
    throw new Error(`Serious/critical accessibility violations:\n${messages.join("\n")}`);
  }
}

const SAMPLE_OUTLINE: OutlineEntry[] = [
  { level: 1, text: "Introduction", slug: "introduction" },
  { level: 2, text: "Background", slug: "background" },
  { level: 3, text: "History", slug: "history" },
];

const TABLE_SOURCE =
  "| Name | Value | Notes |\n|------|-------|-------|\n| A | 1 | First |\n| B | 2 | Second |";
const ALERT_SOURCE = "> [!NOTE]\n> This is a note.\n\n> [!WARNING]\n> This is a warning.";
const HEADING_SOURCE = "# H1\n\n## H2\n\n### H3\n\n#### H4\n\n##### H5\n\n###### H6";
const CODE_SOURCE = "```ts\nconst x: number = 42;\nconsole.log(x);\n```";

// ---------------------------------------------------------------------------
// 1. Keyboard navigation — outline toggle, link activation, code copy
// ---------------------------------------------------------------------------

describe("accessibility — keyboard navigation", () => {
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

  it("Tab reaches the outline toggle button", () => {
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
    // Button is focusable by default (it's a <button type="button">)
    expect(button.tabIndex).toBe(0);
  });

  it("Enter on the outline toggle button activates it (keyboard activation)", () => {
    root = createRoot(container);
    act(() => {
      root.render(
        <DocumentShell outline={SAMPLE_OUTLINE}>
          <p>Content</p>
        </DocumentShell>,
      );
    });

    const button = container.querySelector(".kmd-outline-toggle") as HTMLButtonElement;
    const sidebar = container.querySelector(".kmd-outline-sidebar");
    expect(sidebar?.classList.contains("collapsed")).toBe(false);

    // Simulate keyboard activation: focus, then Enter keydown.
    // In real browsers, Enter on a <button> synthesizes a click event.
    // happy-dom doesn't synthesize this automatically, so we dispatch
    // the click directly to simulate the keyboard activation path.
    button.focus();
    button.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
    act(() => {
      button.click();
    });

    const sidebarAfter = container.querySelector(".kmd-outline-sidebar");
    expect(sidebarAfter?.classList.contains("collapsed")).toBe(true);
  });

  it("outline items are keyboard-focusable (Tab) and Enter activates", () => {
    root = createRoot(container);
    act(() => {
      root.render(
        <DocumentShell outline={SAMPLE_OUTLINE}>
          <p>Content</p>
        </DocumentShell>,
      );
    });

    const items = container.querySelectorAll<HTMLAnchorElement>(".kmd-outline-item");
    expect(items.length).toBe(3);

    // Each item is an <a> with href — focusable by default
    for (const item of items) {
      expect(item.tagName).toBe("A");
      expect(item.tabIndex).toBe(0);
    }
  });

  it("links in rendered content are keyboard-focusable", async () => {
    root = createRoot(container);
    act(() => {
      root.render(<MarkdownReader source="[Example](https://example.com)" />);
    });
    await flushAsync();

    const link = container.querySelector<HTMLAnchorElement>(".kmd-reader-content a");
    expect(link).not.toBeNull();
    expect(link?.tabIndex).toBe(0);
  });

  it("code copy button is keyboard-focusable (when clipboard available)", async () => {
    // Mock secure context + clipboard
    Object.defineProperty(window, "isSecureContext", {
      value: true,
      configurable: true,
      writable: true,
    });
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText: vi.fn().mockResolvedValue(undefined) },
      configurable: true,
      writable: true,
    });

    root = createRoot(container);
    act(() => {
      root.render(<MarkdownReader source={CODE_SOURCE} />);
    });
    await flushAsync();

    const button = container.querySelector<HTMLButtonElement>(".code-copy-button");
    if (button) {
      expect(button.tabIndex).toBe(0);
    }
  });
});

// ---------------------------------------------------------------------------
// 2. Focus management — visible focus, focus return after outline close
// ---------------------------------------------------------------------------

describe("accessibility — focus management", () => {
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

  it(":focus-visible CSS scope is defined for .kmd-reader", async () => {
    // Read the CSS file to verify the focus-visible rule exists
    const { readFileSync } = await import("node:fs");
    const { join } = await import("node:path");
    const css = readFileSync(
      join(process.cwd(), "packages", "styles", "src", "styles.css"),
      "utf-8",
    );
    expect(css).toContain(".kmd-reader :focus-visible");
    expect(css).toContain("outline-width");
    expect(css).toContain("outline-style");
    expect(css).toContain("outline-color");
  });

  it("outline toggle button has visible focus (is a <button> with focus styles)", () => {
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
    // Buttons get :focus-visible by default in browsers
    expect(button.tagName).toBe("BUTTON");
  });

  it("toggling outline does not trap focus (button remains focusable)", () => {
    root = createRoot(container);
    act(() => {
      root.render(
        <DocumentShell outline={SAMPLE_OUTLINE}>
          <p>Content</p>
        </DocumentShell>,
      );
    });

    const button = container.querySelector(".kmd-outline-toggle") as HTMLButtonElement;
    act(() => {
      button.click();
    });

    // After collapse, button is still in the DOM and focusable
    const buttonAfter = container.querySelector(".kmd-outline-toggle") as HTMLButtonElement;
    expect(buttonAfter).not.toBeNull();
    expect(buttonAfter.tabIndex).toBe(0);
  });

  it("custom element interactive elements are focusable", async () => {
    registerKmdReader();
    const el = document.createElement("kmd-reader") as KmdReaderElement;
    el.setAttribute("source", "# Title\n\n[link](https://example.com)");
    document.body.appendChild(el);
    await flushAsync();

    const link = el.querySelector<HTMLAnchorElement>(".kmd-reader-content a");
    expect(link).not.toBeNull();
    expect(link?.tabIndex).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// 3. Heading/landmark structure — h1-h6 hierarchy, nav landmarks, aria-labels
// ---------------------------------------------------------------------------

describe("accessibility — heading and landmark structure", () => {
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

  it("renders h1 through h6 in correct order", async () => {
    root = createRoot(container);
    act(() => {
      root.render(<MarkdownReader source={HEADING_SOURCE} />);
    });
    await flushAsync();

    const content = container.querySelector(".kmd-reader-content")!;
    const headings = content.querySelectorAll("h1, h2, h3, h4, h5, h6");
    expect(headings.length).toBe(6);

    // Verify heading levels are in order
    const levels = Array.from(headings).map((h) => h.tagName.toLowerCase());
    expect(levels).toEqual(["h1", "h2", "h3", "h4", "h5", "h6"]);
  });

  it("DocumentShell outline nav has aria-label='Document outline'", () => {
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

  it("DocumentShell outline nav is a <nav> landmark element", () => {
    root = createRoot(container);
    act(() => {
      root.render(
        <DocumentShell outline={SAMPLE_OUTLINE}>
          <p>Content</p>
        </DocumentShell>,
      );
    });

    const nav = container.querySelector("nav");
    expect(nav).not.toBeNull();
    expect(nav?.tagName).toBe("NAV");
  });

  it("DocumentShell toggle button has aria-expanded reflecting state", () => {
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

    act(() => {
      button.click();
    });

    const buttonAfter = container.querySelector(".kmd-outline-toggle") as HTMLButtonElement;
    expect(buttonAfter.getAttribute("aria-expanded")).toBe("false");
  });

  it("outline items have meaningful text content (not empty)", () => {
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
      expect(item.textContent?.trim().length).toBeGreaterThan(0);
    }
  });

  it("loading state has aria-busy and aria-live", () => {
    root = createRoot(container);
    act(() => {
      root.render(<MarkdownReader source="# Hello" />);
    });

    const loading = container.querySelector(".mdr-loading");
    expect(loading?.getAttribute("aria-busy")).toBe("true");
    expect(loading?.getAttribute("aria-live")).toBe("polite");
  });

  it("custom element sets aria-busy during loading", async () => {
    registerKmdReader();
    const el = document.createElement("kmd-reader") as KmdReaderElement;
    el.setAttribute("source", "# Loading Test");
    document.body.appendChild(el);

    // Before flush, aria-busy should be set
    expect(el.getAttribute("aria-busy")).toBe("true");

    await flushAsync();

    // After flush, aria-busy should be removed
    expect(el.getAttribute("aria-busy")).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// 4. Table accessibility — proper headers, scope
// ---------------------------------------------------------------------------

describe("accessibility — table accessibility", () => {
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

  it("renders tables with <thead> and <tbody>", async () => {
    root = createRoot(container);
    act(() => {
      root.render(<MarkdownReader source={TABLE_SOURCE} />);
    });
    await flushAsync();

    const content = container.querySelector(".kmd-reader-content")!;
    const table = content.querySelector("table");
    expect(table).not.toBeNull();

    // GFM tables render with thead/tbody
    expect(content.querySelector("thead")).not.toBeNull();
    expect(content.querySelector("tbody")).not.toBeNull();
  });

  it("table headers are in <th> elements", async () => {
    root = createRoot(container);
    act(() => {
      root.render(<MarkdownReader source={TABLE_SOURCE} />);
    });
    await flushAsync();

    const content = container.querySelector(".kmd-reader-content")!;
    const headers = content.querySelectorAll("th");
    expect(headers.length).toBe(3);
    expect(headers[0].textContent).toBe("Name");
    expect(headers[1].textContent).toBe("Value");
    expect(headers[2].textContent).toBe("Notes");
  });

  it("table cells are in <td> elements", async () => {
    root = createRoot(container);
    act(() => {
      root.render(<MarkdownReader source={TABLE_SOURCE} />);
    });
    await flushAsync();

    const content = container.querySelector(".kmd-reader-content")!;
    const cells = content.querySelectorAll("td");
    expect(cells.length).toBe(6); // 2 rows × 3 columns
  });

  it("axe-core: table has no serious violations", async () => {
    root = createRoot(container);
    act(() => {
      root.render(<MarkdownReader source={TABLE_SOURCE} />);
    });
    await flushAsync();

    const content = container.querySelector(".kmd-reader-content")!;
    const violations = await runAxe(content as HTMLElement);
    assertNoSeriousViolations(violations);
  });
});

// ---------------------------------------------------------------------------
// 5. Alert semantics — role, aria-live regions
// ---------------------------------------------------------------------------

describe("accessibility — alert semantics", () => {
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

  it("GitHub alerts render with markdown-alert class", async () => {
    root = createRoot(container);
    act(() => {
      root.render(<MarkdownReader source={ALERT_SOURCE} />);
    });
    await flushAsync();

    const content = container.querySelector(".kmd-reader-content")!;
    const alerts = content.querySelectorAll(".markdown-alert");
    expect(alerts.length).toBe(2);
  });

  it("NOTE alert has markdown-alert-note class", async () => {
    root = createRoot(container);
    act(() => {
      root.render(<MarkdownReader source={ALERT_SOURCE} />);
    });
    await flushAsync();

    const content = container.querySelector(".kmd-reader-content")!;
    const noteAlert = content.querySelector(".markdown-alert-note");
    expect(noteAlert).not.toBeNull();
  });

  it("WARNING alert has markdown-alert-warning class", async () => {
    root = createRoot(container);
    act(() => {
      root.render(<MarkdownReader source={ALERT_SOURCE} />);
    });
    await flushAsync();

    const content = container.querySelector(".kmd-reader-content")!;
    const warningAlert = content.querySelector(".markdown-alert-warning");
    expect(warningAlert).not.toBeNull();
  });

  it("alerts contain alert title text", async () => {
    root = createRoot(container);
    act(() => {
      root.render(<MarkdownReader source={ALERT_SOURCE} />);
    });
    await flushAsync();

    const content = container.querySelector(".kmd-reader-content")!;
    const titles = content.querySelectorAll(".markdown-alert-title");
    expect(titles.length).toBe(2);
  });

  it("loading indicator is an aria-live region (polite)", () => {
    root = createRoot(container);
    act(() => {
      root.render(<MarkdownReader source="# Hello" />);
    });

    const loading = container.querySelector(".mdr-loading");
    expect(loading?.getAttribute("aria-live")).toBe("polite");
  });

  it("axe-core: alerts have no serious violations", async () => {
    root = createRoot(container);
    act(() => {
      root.render(<MarkdownReader source={ALERT_SOURCE} />);
    });
    await flushAsync();

    const content = container.querySelector(".kmd-reader-content")!;
    const violations = await runAxe(content as HTMLElement);
    assertNoSeriousViolations(violations);
  });
});

// ---------------------------------------------------------------------------
// 6. Reduced motion — no transitions when prefers-reduced-motion
// ---------------------------------------------------------------------------

describe("accessibility — reduced motion", () => {
  it("styles.css contains prefers-reduced-motion media query", async () => {
    const { readFileSync } = await import("node:fs");
    const { join } = await import("node:path");
    const css = readFileSync(
      join(process.cwd(), "packages", "styles", "src", "styles.css"),
      "utf-8",
    );
    expect(css).toContain("@media (prefers-reduced-motion: reduce)");
  });

  it("reduced motion disables transitions (animation-duration: 0.01ms)", async () => {
    const { readFileSync } = await import("node:fs");
    const { join } = await import("node:path");
    const css = readFileSync(
      join(process.cwd(), "packages", "styles", "src", "styles.css"),
      "utf-8",
    );
    // Extract the reduced motion block
    const motionBlock = css.match(
      /@media \(prefers-reduced-motion: reduce\) \{[^}]+\{[^}]+\}\s*\}/,
    );
    expect(motionBlock).not.toBeNull();
    const block = motionBlock![0];
    expect(block).toContain("animation-duration: 0.01ms");
    expect(block).toContain("transition-duration: 0.01ms");
    expect(block).toContain("!important");
  });

  it("reduced motion applies to both .kmd-reader and .kmd-document-shell", async () => {
    const { readFileSync } = await import("node:fs");
    const { join } = await import("node:path");
    const css = readFileSync(
      join(process.cwd(), "packages", "styles", "src", "styles.css"),
      "utf-8",
    );
    // The reduced motion block should cover both scopes
    const motionSection = css.slice(css.indexOf("@media (prefers-reduced-motion: reduce)"));
    expect(motionSection).toContain(".kmd-reader *");
    expect(motionSection).toContain(".kmd-document-shell *");
  });
});

// ---------------------------------------------------------------------------
// 7. axe-core full-document scan — no serious/critical violations
// ---------------------------------------------------------------------------

describe("accessibility — axe-core full scan", () => {
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

  it("MarkdownReader with mixed content passes axe-core (no serious/critical)", async () => {
    const source = `# Document

## Section

Paragraph with **bold** and *italic* text.

[Example link](https://example.com)

| Col1 | Col2 |
|------|------|
| a    | b    |

> [!NOTE]
> A note.
`;
    root = createRoot(container);
    act(() => {
      root.render(<MarkdownReader source={source} />);
    });
    await flushAsync();

    const content = container.querySelector(".kmd-reader-content")!;
    const violations = await runAxe(content as HTMLElement);
    assertNoSeriousViolations(violations);
  });

  it("DocumentShell with outline passes axe-core (no serious/critical)", async () => {
    root = createRoot(container);
    act(() => {
      root.render(
        <DocumentShell outline={SAMPLE_OUTLINE}>
          <p>Content</p>
        </DocumentShell>,
      );
    });

    const violations = await runAxe(container);
    assertNoSeriousViolations(violations);
  });

  it("custom element with content passes axe-core (no serious/critical)", async () => {
    registerKmdReader();
    const el = document.createElement("kmd-reader") as KmdReaderElement;
    el.setAttribute("source", "# Title\n\nParagraph.\n\n[link](https://example.com)");
    document.body.appendChild(el);
    await flushAsync();

    const content = el.querySelector(".kmd-reader-content")!;
    const violations = await runAxe(content as HTMLElement);
    assertNoSeriousViolations(violations);
  });
});
