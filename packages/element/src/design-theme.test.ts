// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { KmdDesignThemeDetail, KmdReaderElement } from "./index";
import { registerKmdReader } from "./index";

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

vi.setConfig({ testTimeout: 30_000 });

async function waitFor(condition: () => boolean): Promise<void> {
  const deadline = Date.now() + 20_000;
  for (;;) {
    await new Promise<void>((resolve) => setTimeout(resolve, 25));
    if (condition()) return;
    if (Date.now() > deadline) return;
  }
}

describe("<kmd-reader> design-source", () => {
  beforeEach(() => {
    registerKmdReader();
  });

  afterEach(() => {
    document.body.innerHTML = "";
    for (const el of document.head.querySelectorAll("style[data-kmd-design-theme]")) {
      el.remove();
    }
  });

  it("applies the custom theme scoped to the element and emits kmd:design-theme", async () => {
    const el = document.createElement("kmd-reader") as KmdReaderElement;
    const events: KmdDesignThemeDetail[] = [];
    el.addEventListener("kmd:design-theme", (e) => {
      events.push((e as CustomEvent<KmdDesignThemeDetail>).detail);
    });
    el.source = "# Hello";
    document.body.appendChild(el);

    el.designSource = DESIGN_MD;

    await waitFor(() => events.length > 0);
    expect(events[0]!.info.applied).toBe(true);
    expect(el.hasAttribute("data-kmd-design")).toBe(true);
    expect(el.getAttribute("design-source")).toBe(DESIGN_MD);
    expect(document.head.querySelector("style[data-kmd-design-theme]")).not.toBeNull();

    // Clearing the property removes the overrides.
    el.designSource = undefined;
    await waitFor(() => !el.hasAttribute("data-kmd-design"));
    expect(el.hasAttribute("data-kmd-design")).toBe(false);
    expect(el.hasAttribute("design-source")).toBe(false);
    expect(document.head.querySelector("style[data-kmd-design-theme]")).toBeNull();

    el.remove();
  });

  it("accepts the design-source attribute and cleans up on disconnect", async () => {
    const el = document.createElement("kmd-reader") as KmdReaderElement;
    el.source = "# Hello";
    document.body.appendChild(el);

    el.setAttribute("design-source", DESIGN_MD);

    await waitFor(() => el.hasAttribute("data-kmd-design"));
    expect(el.hasAttribute("data-kmd-design")).toBe(true);
    expect(el.designSource).toBe(DESIGN_MD);

    el.remove();
    await waitFor(() => document.head.querySelector("style[data-kmd-design-theme]") === null);
    expect(document.head.querySelector("style[data-kmd-design-theme]")).toBeNull();
  });

  it("reports applied: false for a non-design document and keeps rendering", async () => {
    const el = document.createElement("kmd-reader") as KmdReaderElement;
    const events: KmdDesignThemeDetail[] = [];
    el.addEventListener("kmd:design-theme", (e) => {
      events.push((e as CustomEvent<KmdDesignThemeDetail>).detail);
    });
    el.source = "# Hello";
    document.body.appendChild(el);

    el.designSource = "# Plain document\n\nNothing designy.\n";

    await waitFor(() => events.length > 0);
    expect(events[0]!.info.applied).toBe(false);
    expect(events[0]!.info.diagnostics.length).toBeGreaterThan(0);
    expect(el.hasAttribute("data-kmd-design")).toBe(false);

    await waitFor(() => (el.querySelector(".kmd-reader-content")?.innerHTML ?? "") !== "");
    expect(el.querySelector(".kmd-reader-content")?.innerHTML).toContain("<h1");
    expect(el.querySelector(".mdr-error")?.hasAttribute("hidden")).toBe(true);

    el.remove();
  });
});
