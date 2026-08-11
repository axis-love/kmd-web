// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DesignThemeController, type DesignThemeInfo } from "./design-theme";
import { BrowserReader } from "./reader-runtime";

// A design source the pipeline reliably extracts (table extractor),
// authored dark (near-black background).
const DESIGN_MD = [
  "# Test Design",
  "",
  "## Colors",
  "",
  "| Token | Value |",
  "|---|---|",
  "| color-background | #101418 |",
  "| color-text | #e8ecf1 |",
  "| color-accent | #ff6b35 |",
  "",
].join("\n");

// A different valid design source (authored light).
const OTHER_DESIGN_MD = [
  "# Other Design",
  "",
  "## Colors",
  "",
  "| Token | Value |",
  "|---|---|",
  "| color-background | #faf6ef |",
  "| color-text | #221d16 |",
  "",
].join("\n");

const PLAIN_MD = "# Just a document\n\nNo design tokens here at all.\n";

function styleElements(): HTMLStyleElement[] {
  return [...document.head.querySelectorAll<HTMLStyleElement>("style[data-kmd-design-theme]")];
}

describe("DesignThemeController", () => {
  let root: HTMLElement;

  beforeEach(() => {
    root = document.createElement("div");
    document.body.appendChild(root);
  });

  afterEach(() => {
    document.body.innerHTML = "";
    for (const el of styleElements()) el.remove();
  });

  it("applies a scope attribute and injects scoped CSS for a valid design source", async () => {
    const infos: DesignThemeInfo[] = [];
    const controller = new DesignThemeController(root, (i) => infos.push(i));

    await controller.apply(DESIGN_MD);

    expect(infos).toHaveLength(1);
    expect(infos[0]!.applied).toBe(true);

    const scopeId = root.getAttribute("data-kmd-design");
    expect(scopeId).toBeTruthy();

    const styles = styleElements();
    expect(styles).toHaveLength(1);
    const css = styles[0]!.textContent!;
    // Dark default block + explicit light selectors + system fallback.
    expect(css).toContain(`[data-kmd-design="${scopeId}"] {`);
    expect(css).toContain(`[data-kmd-theme="light"] [data-kmd-design="${scopeId}"]`);
    expect(css).toContain("@media (prefers-color-scheme: light)");
    expect(css).toContain("--kmd-color-neutral: #101418;");
    // Host page outside the scope is untouched.
    expect(css).not.toMatch(/(^|\n)\s*:root\s*\{/);

    controller.dispose();
  });

  it("removes overrides when applying undefined, and reports blank sources", async () => {
    const infos: DesignThemeInfo[] = [];
    const controller = new DesignThemeController(root, (i) => infos.push(i));

    await controller.apply(DESIGN_MD);
    expect(root.hasAttribute("data-kmd-design")).toBe(true);

    await controller.apply(undefined);
    expect(root.hasAttribute("data-kmd-design")).toBe(false);
    expect(styleElements()).toHaveLength(0);
    // Removal via undefined does not add a diagnostic report.
    expect(infos).toHaveLength(1);

    await controller.apply("   ");
    expect(infos).toHaveLength(2);
    expect(infos[1]!.applied).toBe(false);
    expect(infos[1]!.diagnostics.some((d) => d.severity === "info")).toBe(true);

    controller.dispose();
  });

  it("falls back to defaults with diagnostics for a non-design document", async () => {
    const infos: DesignThemeInfo[] = [];
    const controller = new DesignThemeController(root, (i) => infos.push(i));

    await controller.apply(PLAIN_MD);

    expect(infos).toHaveLength(1);
    expect(infos[0]!.applied).toBe(false);
    expect(infos[0]!.diagnostics.length).toBeGreaterThan(0);
    expect(root.hasAttribute("data-kmd-design")).toBe(false);
    expect(styleElements()).toHaveLength(0);

    controller.dispose();
  });

  it("swaps scope and style when the design source changes (invalidation)", async () => {
    const controller = new DesignThemeController(root);

    await controller.apply(DESIGN_MD);
    const firstScope = root.getAttribute("data-kmd-design")!;

    await controller.apply(OTHER_DESIGN_MD);
    const secondScope = root.getAttribute("data-kmd-design")!;

    expect(secondScope).not.toBe(firstScope);
    const styles = styleElements();
    expect(styles).toHaveLength(1);
    expect(styles[0]!.getAttribute("data-kmd-design-theme")).toBe(secondScope);

    controller.dispose();
    expect(styleElements()).toHaveLength(0);
  });

  it("is a no-op when applying the identical source twice", async () => {
    const infos: DesignThemeInfo[] = [];
    const controller = new DesignThemeController(root, (i) => infos.push(i));

    await controller.apply(DESIGN_MD);
    await controller.apply(DESIGN_MD);

    expect(infos).toHaveLength(1);
    expect(styleElements()).toHaveLength(1);

    controller.dispose();
  });

  it("shares one style element across controllers using the same source", async () => {
    const rootB = document.createElement("div");
    document.body.appendChild(rootB);

    const a = new DesignThemeController(root);
    const b = new DesignThemeController(rootB);

    await a.apply(DESIGN_MD);
    await b.apply(DESIGN_MD);
    expect(styleElements()).toHaveLength(1);
    expect(root.getAttribute("data-kmd-design")).toBe(rootB.getAttribute("data-kmd-design"));

    a.dispose();
    // Still referenced by b.
    expect(styleElements()).toHaveLength(1);
    b.dispose();
    expect(styleElements()).toHaveLength(0);
  });
});

describe("BrowserReader design theming", () => {
  let container: HTMLElement;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
  });

  afterEach(() => {
    document.body.innerHTML = "";
    for (const el of styleElements()) el.remove();
  });

  it("applies the design theme from the constructor option and cleans up on dispose", async () => {
    const onDesignTheme = vi.fn();
    const reader = new BrowserReader({ container, designSource: DESIGN_MD, onDesignTheme });

    await vi.waitFor(() => {
      expect(onDesignTheme).toHaveBeenCalledTimes(1);
    });
    expect(onDesignTheme.mock.calls[0]![0].applied).toBe(true);
    expect(container.hasAttribute("data-kmd-design")).toBe(true);
    expect(styleElements()).toHaveLength(1);

    reader.dispose();
    expect(container.hasAttribute("data-kmd-design")).toBe(false);
    expect(styleElements()).toHaveLength(0);
  });

  it("still renders the document when the design source is not a design doc", async () => {
    const onDesignTheme = vi.fn();
    const reader = new BrowserReader({ container, onDesignTheme });

    await reader.setDesignSource(PLAIN_MD);
    await reader.update("# Hello");

    expect(container.innerHTML).toContain("<h1");
    expect(onDesignTheme).toHaveBeenCalledTimes(1);
    expect(onDesignTheme.mock.calls[0]![0].applied).toBe(false);
    expect(styleElements()).toHaveLength(0);

    reader.dispose();
  });

  it("applies overrides to the designThemeRoot when provided", async () => {
    const wrapper = document.createElement("div");
    wrapper.appendChild(container);
    document.body.appendChild(wrapper);

    const reader = new BrowserReader({ container, designThemeRoot: wrapper });
    await reader.setDesignSource(DESIGN_MD);

    expect(wrapper.hasAttribute("data-kmd-design")).toBe(true);
    expect(container.hasAttribute("data-kmd-design")).toBe(false);

    reader.dispose();
    expect(wrapper.hasAttribute("data-kmd-design")).toBe(false);
  });

  it("supports removing the theme at runtime via setDesignSource(undefined)", async () => {
    const reader = new BrowserReader({ container });

    await reader.setDesignSource(DESIGN_MD);
    expect(container.hasAttribute("data-kmd-design")).toBe(true);

    await reader.setDesignSource(undefined);
    expect(container.hasAttribute("data-kmd-design")).toBe(false);
    expect(styleElements()).toHaveLength(0);

    reader.dispose();
  });
});
