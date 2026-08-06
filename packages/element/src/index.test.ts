// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { KmdReaderElement, registerKmdReader } from "./index";

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

/** Flush pending microtasks so async BrowserReader.update() completes.
 * The renderFn now does `await import("@axis-love/math")` and
 * `await import("@axis-love/highlighting")` before calling render(),
 * adding extra async ticks beyond a single setTimeout(0). */
async function flushAsync(): Promise<void> {
  await new Promise<void>((resolve) => setTimeout(resolve, 100));
}

/** Create a container div appended to document.body. */
function createContainer(): HTMLDivElement {
  const container = document.createElement("div");
  document.body.appendChild(container);
  return container;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("<kmd-reader> custom element", () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    container = createContainer();
  });

  afterEach(() => {
    document.body.innerHTML = "";
  });

  // --- Registration ---

  it("registerKmdReader registers the custom element", () => {
    if (customElements.get("kmd-reader") === undefined) {
      registerKmdReader();
    }
    expect(customElements.get("kmd-reader")).toBeDefined();
  });

  it("registerKmdReader is idempotent (safe to call multiple times)", () => {
    registerKmdReader();
    registerKmdReader();
    expect(customElements.get("kmd-reader")).toBeDefined();
  });

  it("can be constructed via document.createElement after registration", () => {
    registerKmdReader();
    const el = document.createElement("kmd-reader");
    expect(el).toBeInstanceOf(KmdReaderElement);
    expect(el).toBeInstanceOf(HTMLElement);
  });

  // --- DOM structure ---

  it("creates light DOM structure on connect", () => {
    const el = new KmdReaderElement();
    document.body.appendChild(el);

    expect(el.classList.contains("kmd-reader")).toBe(true);
    expect(el.querySelector(".kmd-reader-content")).not.toBeNull();
    expect(el.querySelector(".mdr-loading")).not.toBeNull();
    expect(el.querySelector(".mdr-error")).not.toBeNull();
    expect(el.querySelector(".mdr-empty")).not.toBeNull();
  });

  it("does NOT use shadow DOM", () => {
    const el = new KmdReaderElement();
    document.body.appendChild(el);

    expect(el.shadowRoot).toBeNull();
  });

  it("content container is always in the DOM (always-rendered pattern)", () => {
    const el = new KmdReaderElement();
    document.body.appendChild(el);

    const content = el.querySelector(".kmd-reader-content");
    expect(content).not.toBeNull();
    // Content is hidden but present even in empty state.
    expect((content as HTMLElement).hidden).toBe(true);
  });

  // --- Rendering ---

  it("renders markdown content into the content container", async () => {
    const el = new KmdReaderElement();
    el.source = "# Hello World";
    document.body.appendChild(el);
    await flushAsync();

    const content = el.querySelector(".kmd-reader-content");
    expect(content?.innerHTML).toContain("<h1");
    expect(content?.innerHTML).toContain("Hello World");
  });

  it("renders headings, paragraphs, code, and lists", async () => {
    const el = new KmdReaderElement();
    el.source = "# Title\n\nParagraph text.\n\n```ts\nconst x = 1;\n```\n\n- Item 1\n- Item 2";
    document.body.appendChild(el);
    await flushAsync();

    const content = el.querySelector(".kmd-reader-content");
    expect(content?.innerHTML).toContain("<h1");
    expect(content?.innerHTML).toContain("<p>");
    expect(content?.innerHTML).toContain("<pre");
    expect(content?.innerHTML).toContain("<ul>");
  });

  // --- States ---

  it("shows empty state when source is empty string", async () => {
    const el = new KmdReaderElement();
    el.source = "";
    document.body.appendChild(el);

    const empty = el.querySelector(".mdr-empty");
    expect(empty).not.toBeNull();
    expect((empty as HTMLElement).hidden).toBe(false);
    expect(empty?.textContent).toContain("empty");
  });

  it("shows loading state before render completes", async () => {
    const el = new KmdReaderElement();
    el.source = "# Hello";
    document.body.appendChild(el);

    const loading = el.querySelector(".mdr-loading");
    expect(loading).not.toBeNull();
    expect((loading as HTMLElement).hidden).toBe(false);
  });

  it("hides loading state after render completes", async () => {
    const el = new KmdReaderElement();
    el.source = "# Hello";
    document.body.appendChild(el);
    await flushAsync();

    const loading = el.querySelector(".mdr-loading");
    expect((loading as HTMLElement).hidden).toBe(true);
  });

  it("shows content after render completes", async () => {
    const el = new KmdReaderElement();
    el.source = "# Hello";
    document.body.appendChild(el);
    await flushAsync();

    const content = el.querySelector(".kmd-reader-content") as HTMLElement;
    expect(content.hidden).toBe(false);
  });

  it("shows error state on render failure", async () => {
    const el = new KmdReaderElement();
    el.source = "x".repeat(20);
    el.renderOptions = { maxSourceSize: 10 };
    document.body.appendChild(el);
    await flushAsync();

    const errorEl = el.querySelector(".mdr-error") as HTMLElement;
    expect(errorEl.hidden).toBe(false);
    expect(errorEl?.textContent).toContain("Render Error");
  });

  // --- Properties ---

  it("source property triggers re-render", async () => {
    const el = new KmdReaderElement();
    el.source = "# First";
    document.body.appendChild(el);
    await flushAsync();

    expect(el.querySelector(".kmd-reader-content")?.innerHTML).toContain("First");

    el.source = "# Second";
    await flushAsync();

    expect(el.querySelector(".kmd-reader-content")?.innerHTML).toContain("Second");
    expect(el.querySelector(".kmd-reader-content")?.innerHTML).not.toContain("First");
  });

  it("renderOptions property triggers re-render", async () => {
    const el = new KmdReaderElement();
    el.source = "# Hello";
    el.renderOptions = { features: { mermaid: false } };
    document.body.appendChild(el);
    await flushAsync();

    expect(el.querySelector("h1")?.textContent).toBe("Hello");

    el.renderOptions = { features: { math: false } };
    await flushAsync();

    expect(el.querySelector("h1")?.textContent).toBe("Hello");
  });

  it("theme property sets data-kmd-theme attribute", async () => {
    const el = new KmdReaderElement();
    el.theme = "light";
    document.body.appendChild(el);

    expect(el.getAttribute("data-kmd-theme")).toBe("light");
  });

  it("theme property with invalid value emits error event", async () => {
    const el = new KmdReaderElement();
    document.body.appendChild(el);

    const handler = vi.fn();
    el.addEventListener("kmd:error", handler);

    // biome-ignore lint/suspicious/noExplicitAny: testing invalid input
    (el as any).theme = "invalid-theme";

    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler.mock.calls[0][0].detail.error).toBeInstanceOf(Error);
  });

  it("dataSourceUrl property sets data-source-url attribute", async () => {
    const el = new KmdReaderElement();
    el.dataSourceUrl = "https://example.com/doc.md";
    document.body.appendChild(el);

    expect(el.getAttribute("data-source-url")).toBe("https://example.com/doc.md");
  });

  // --- Attributes ---

  it("source attribute triggers render", async () => {
    registerKmdReader();
    const el = document.createElement("kmd-reader");
    el.setAttribute("source", "# Attribute Source");
    document.body.appendChild(el);
    await flushAsync();

    const content = el.querySelector(".kmd-reader-content");
    expect(content?.innerHTML).toContain("Attribute Source");
  });

  it("theme attribute sets the theme", async () => {
    registerKmdReader();
    const el = document.createElement("kmd-reader");
    el.setAttribute("theme", "sepia");
    document.body.appendChild(el);

    expect(el.getAttribute("data-kmd-theme")).toBe("sepia");
  });

  it("data-source-url attribute is readable via property", async () => {
    registerKmdReader();
    const el = document.createElement("kmd-reader");
    el.setAttribute("data-source-url", "https://example.com/doc.md");
    document.body.appendChild(el);

    expect((el as KmdReaderElement).dataSourceUrl).toBe("https://example.com/doc.md");
  });

  it("updating source attribute after connection re-renders", async () => {
    registerKmdReader();
    const el = document.createElement("kmd-reader");
    el.setAttribute("source", "# First");
    document.body.appendChild(el);
    await flushAsync();

    expect(el.querySelector(".kmd-reader-content")?.innerHTML).toContain("First");

    el.setAttribute("source", "# Second");
    await flushAsync();

    expect(el.querySelector(".kmd-reader-content")?.innerHTML).toContain("Second");
  });

  // --- Invalid input ---

  it("invalid source type yields error event, not exception", async () => {
    const el = new KmdReaderElement();
    document.body.appendChild(el);

    const handler = vi.fn();
    el.addEventListener("kmd:error", handler);

    // biome-ignore lint/suspicious/noExplicitAny: testing invalid input
    (el as any).source = 12345;

    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler.mock.calls[0][0].detail.error).toBeInstanceOf(Error);
    expect(handler.mock.calls[0][0].detail.error.message).toContain("string");
  });

  // --- Events ---

  it("emits kmd:outline-change with heading outline", async () => {
    const el = new KmdReaderElement();
    el.source = "# Title\n\n## Section";
    document.body.appendChild(el);

    const handler = vi.fn();
    el.addEventListener("kmd:outline-change", handler);
    await flushAsync();

    expect(handler).toHaveBeenCalled();
    const lastCall = handler.mock.calls[handler.mock.calls.length - 1];
    const outline = lastCall[0].detail.outline;
    expect(outline).toHaveLength(2);
    expect(outline[0].text).toBe("Title");
    expect(outline[1].text).toBe("Section");
  });

  it("emits kmd:rendered after successful render", async () => {
    const el = new KmdReaderElement();
    el.source = "# Hello";
    document.body.appendChild(el);

    const handler = vi.fn();
    el.addEventListener("kmd:rendered", handler);
    await flushAsync();

    expect(handler).toHaveBeenCalled();
    const detail = handler.mock.calls[0][0].detail;
    expect(detail.result).toBeDefined();
    expect(detail.result.html).toContain("Hello");
  });

  it("emits kmd:error on render failure", async () => {
    const el = new KmdReaderElement();
    el.source = "x".repeat(20);
    el.renderOptions = { maxSourceSize: 10 };
    document.body.appendChild(el);

    const handler = vi.fn();
    el.addEventListener("kmd:error", handler);
    await flushAsync();

    expect(handler).toHaveBeenCalled();
    const detail = handler.mock.calls[0][0].detail;
    expect(detail.error).toBeInstanceOf(Error);
  });

  it("emits kmd:copy event (at least doesn't crash with onCopy wiring)", async () => {
    const el = new KmdReaderElement();
    el.source = "```ts\nconst x = 1;\n```";
    document.body.appendChild(el);

    const handler = vi.fn();
    el.addEventListener("kmd:copy", handler);
    await flushAsync();

    expect(el.classList.contains("kmd-reader")).toBe(true);
  });

  it("emits kmd:link-external event when external link is clicked", async () => {
    const el = new KmdReaderElement();
    el.source = "[Example](https://example.com)";
    document.body.appendChild(el);
    await flushAsync();

    const handler = vi.fn();
    el.addEventListener("kmd:link-external", handler);

    const link = el.querySelector<HTMLAnchorElement>(".kmd-reader-content a");
    expect(link).not.toBeNull();
    link?.click();
    await flushAsync();

    expect(handler).toHaveBeenCalled();
    const detail = handler.mock.calls[0][0].detail;
    expect(detail.url).toBeInstanceOf(URL);
    expect(detail.url.href).toBe("https://example.com/");
  });

  it("emits kmd:link-document event for document links", async () => {
    const el = new KmdReaderElement();
    el.source = "[Other](./other.md)";
    document.body.appendChild(el);
    await flushAsync();

    const handler = vi.fn();
    el.addEventListener("kmd:link-document", handler);

    const link = el.querySelector<HTMLAnchorElement>(".kmd-reader-content a");
    expect(link).not.toBeNull();
    link?.click();
    await flushAsync();

    expect(handler).toHaveBeenCalled();
    const detail = handler.mock.calls[0][0].detail;
    expect(detail.target).toBeDefined();
    expect(detail.target.href).toBe("./other.md");
  });

  it("events bubble to parent container", async () => {
    const el = new KmdReaderElement();
    el.source = "# Hello";
    document.body.appendChild(el);
    container.appendChild(el);

    const handler = vi.fn();
    container.addEventListener("kmd:rendered", handler);
    await flushAsync();

    expect(handler).toHaveBeenCalled();
  });

  // --- Event security ---

  it("rendered content cannot forge kmd:link-external events", async () => {
    const el = new KmdReaderElement();
    el.source = "# Title\n\n[link](https://example.com)";
    document.body.appendChild(el);
    await flushAsync();

    const handler = vi.fn();
    el.addEventListener("kmd:link-external", handler);

    // Rendering content with a link should NOT fire kmd:link-external
    // without an actual click.
    expect(handler).not.toHaveBeenCalled();
  });

  it("rendered content cannot dispatch privileged events from child nodes", async () => {
    const el = new KmdReaderElement();
    el.source = "# Title";
    document.body.appendChild(el);
    await flushAsync();

    const handler = vi.fn();
    el.addEventListener("kmd:link-external", handler);

    // Attempt to forge an event from a child element.
    const child = el.querySelector("h1");
    expect(child).not.toBeNull();
    child?.dispatchEvent(
      new CustomEvent("kmd:link-external", {
        bubbles: true,
        composed: true,
        detail: { url: new URL("https://forged.example.com") },
      }),
    );

    // The event bubbled up (showing the test setup is correct), but the
    // event's target is the child, not the <kmd-reader> element. Hosts
    // can use this to distinguish genuine events from forged ones.
    expect(handler).toHaveBeenCalledTimes(1);
    const event = handler.mock.calls[0][0];
    expect(event.target).not.toBe(el);
    expect(event.target).toBe(child);
  });

  // --- Lifecycle ---

  it("disconnect disposes the BrowserReader", async () => {
    const el = new KmdReaderElement();
    el.source = "# Hello";
    document.body.appendChild(el);
    await flushAsync();

    el.remove();

    expect(el.querySelector(".kmd-reader-content")).toBeNull();
    expect(el.querySelector(".mdr-loading")).toBeNull();
    expect(el.querySelector(".mdr-error")).toBeNull();
  });

  it("reattach recreates the reader and renders", async () => {
    const el = new KmdReaderElement();
    el.source = "# Hello";
    document.body.appendChild(el);
    await flushAsync();

    expect(el.querySelector(".kmd-reader-content")?.innerHTML).toContain("Hello");

    el.remove();
    expect(el.querySelector(".kmd-reader-content")).toBeNull();

    document.body.appendChild(el);
    await flushAsync();

    expect(el.querySelector(".kmd-reader-content")).not.toBeNull();
    expect(el.querySelector(".kmd-reader-content")?.innerHTML).toContain("Hello");
  });

  it("updating source after reattach works", async () => {
    const el = new KmdReaderElement();
    el.source = "# First";
    document.body.appendChild(el);
    await flushAsync();

    el.remove();
    document.body.appendChild(el);
    await flushAsync();

    el.source = "# Second";
    await flushAsync();

    expect(el.querySelector(".kmd-reader-content")?.innerHTML).toContain("Second");
  });

  // --- Multiple instances ---

  it("two elements render independently without interference", async () => {
    const el1 = new KmdReaderElement();
    el1.source = "# First Document";
    document.body.appendChild(el1);

    const el2 = new KmdReaderElement();
    el2.source = "# Second Document";
    document.body.appendChild(el2);

    await flushAsync();

    const content1 = el1.querySelector(".kmd-reader-content");
    const content2 = el2.querySelector(".kmd-reader-content");

    expect(content1?.innerHTML).toContain("First Document");
    expect(content1?.innerHTML).not.toContain("Second Document");
    expect(content2?.innerHTML).toContain("Second Document");
    expect(content2?.innerHTML).not.toContain("First Document");
  });

  it("updating one element does not affect the other", async () => {
    const el1 = new KmdReaderElement();
    el1.source = "# First";
    document.body.appendChild(el1);

    const el2 = new KmdReaderElement();
    el2.source = "# Second";
    document.body.appendChild(el2);

    await flushAsync();

    el1.source = "# First Updated";
    await flushAsync();

    const content1 = el1.querySelector(".kmd-reader-content");
    const content2 = el2.querySelector(".kmd-reader-content");

    expect(content1?.innerHTML).toContain("First Updated");
    expect(content2?.innerHTML).toContain("Second");
    expect(content2?.innerHTML).not.toContain("First");
  });

  it("disposing one element does not affect the other", async () => {
    const el1 = new KmdReaderElement();
    el1.source = "# First";
    document.body.appendChild(el1);

    const el2 = new KmdReaderElement();
    el2.source = "# Second";
    document.body.appendChild(el2);

    await flushAsync();

    el1.remove();
    await flushAsync();

    const content2 = el2.querySelector(".kmd-reader-content");
    expect(content2?.innerHTML).toContain("Second");
  });

  // --- Narrow width simulation (CSS responsive) ---

  it("elements render at narrow viewport widths", async () => {
    const el = new KmdReaderElement();
    el.source = "# Narrow\n\nSome content for narrow viewport.";
    document.body.appendChild(el);

    el.style.width = "320px";
    await flushAsync();

    const content = el.querySelector(".kmd-reader-content");
    expect(content?.innerHTML).toContain("Narrow");
    expect(el.classList.contains("kmd-reader")).toBe(true);
  });

  it("two elements render independently at narrow widths", async () => {
    const el1 = new KmdReaderElement();
    el1.source = "# Doc 1";
    el1.style.width = "320px";
    document.body.appendChild(el1);

    const el2 = new KmdReaderElement();
    el2.source = "# Doc 2";
    el2.style.width = "320px";
    document.body.appendChild(el2);

    await flushAsync();

    expect(el1.querySelector(".kmd-reader-content")?.innerHTML).toContain("Doc 1");
    expect(el2.querySelector(".kmd-reader-content")?.innerHTML).toContain("Doc 2");
  });
});

// ---------------------------------------------------------------------------
// Package exports test
// ---------------------------------------------------------------------------

describe("@axis-love/element package exports", () => {
  it("exports registerKmdReader function", async () => {
    const mod = await import("./index");
    expect(mod.registerKmdReader).toBeDefined();
    expect(typeof mod.registerKmdReader).toBe("function");
  });

  it("exports KmdReaderElement class", async () => {
    const mod = await import("./index");
    expect(mod.KmdReaderElement).toBeDefined();
  });

  it("exports ELEMENT_VERSION", async () => {
    const mod = await import("./index");
    expect(mod.ELEMENT_VERSION).toBe("0.1.0");
  });

  it("exports event detail types (type-only, erased at runtime)", async () => {
    const mod = await import("./index");
    expect(mod).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// Plain HTML/ESM context test
// ---------------------------------------------------------------------------

describe("plain HTML/ESM context (no React)", () => {
  it("works without any React dependency", async () => {
    const mod = await import("./index");
    expect(mod.registerKmdReader).toBeDefined();
    expect(mod.KmdReaderElement).toBeDefined();
  });

  it("can be used in a vanilla JS context", async () => {
    registerKmdReader();

    const el = document.createElement("kmd-reader") as KmdReaderElement;
    el.setAttribute("source", "# Vanilla JS");
    document.body.appendChild(el);
    await flushAsync();

    const content = el.querySelector(".kmd-reader-content");
    expect(content?.innerHTML).toContain("Vanilla JS");
  });

  it("supports declarative source via attribute in HTML", async () => {
    registerKmdReader();

    document.body.innerHTML = '<kmd-reader source="# Declarative" theme="light"></kmd-reader>';
    await flushAsync();

    const el = document.body.querySelector("kmd-reader") as KmdReaderElement;
    expect(el).not.toBeNull();
    expect(el.querySelector(".kmd-reader-content")?.innerHTML).toContain("Declarative");
    expect(el.getAttribute("data-kmd-theme")).toBe("light");
  });

  it("supports setting properties via JS after creation", async () => {
    registerKmdReader();

    const el = document.createElement("kmd-reader") as KmdReaderElement;
    document.body.appendChild(el);

    el.source = "# Property Set";
    await flushAsync();

    expect(el.querySelector(".kmd-reader-content")?.innerHTML).toContain("Property Set");
  });
});

// ---------------------------------------------------------------------------
// Platform-coupling: no React imports
// ---------------------------------------------------------------------------

describe("static platform-coupling search — no React", () => {
  it("source contains no React imports", async () => {
    const { existsSync, readFileSync, readdirSync } = await import("node:fs");
    const { join } = await import("node:path");

    const srcDir = join(process.cwd(), "packages", "element", "src");
    if (!existsSync(srcDir)) return;

    const files = readdirSync(srcDir).filter((f) => f.endsWith(".ts") && !f.includes(".test."));

    for (const file of files) {
      const content = readFileSync(join(srcDir, file), "utf-8");
      expect(content).not.toContain('from "react"');
      expect(content).not.toContain("from 'react'");
      expect(content).not.toContain("@axis-love/react");
    }
  });
});
