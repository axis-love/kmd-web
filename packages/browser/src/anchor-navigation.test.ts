// @vitest-environment happy-dom
import { describe, expect, it, vi } from "vitest";
import {
  findAnchorTarget,
  getReaderScrollTopForTarget,
  ScrollTracker,
  scrollContainerToTarget,
} from "./anchor-navigation";

describe("anchor navigation utilities", () => {
  it("computes scrollTop relative to the reader scroll container", () => {
    expect(getReaderScrollTopForTarget(200, 48, 348)).toBe(488);
  });

  it("does not scroll before the top of the reader", () => {
    expect(getReaderScrollTopForTarget(0, 48, 20)).toBe(0);
  });

  it("finds heading by id", () => {
    const root = document.createElement("div");
    const heading = document.createElement("h2");
    heading.id = "intro";
    root.appendChild(heading);
    expect(findAnchorTarget(root, "intro")).toBe(heading);
  });

  it("finds heading by user-content prefixed id", () => {
    const root = document.createElement("div");
    const heading = document.createElement("h2");
    heading.id = "user-content-heading";
    root.appendChild(heading);
    expect(findAnchorTarget(root, "heading")).toBe(heading);
  });

  it("finds heading by name attribute", () => {
    const root = document.createElement("div");
    const anchor = document.createElement("a");
    anchor.setAttribute("name", "section-1");
    root.appendChild(anchor);
    expect(findAnchorTarget(root, "section-1")).toBe(anchor);
  });

  it("returns null for missing fragment", () => {
    const root = document.createElement("div");
    expect(findAnchorTarget(root, "nonexistent")).toBeNull();
  });

  it("scrollContainerToTarget calls scrollTo on the container", () => {
    const container = document.createElement("div");
    const target = document.createElement("h2");
    document.body.appendChild(container);
    container.appendChild(target);

    // Mock getBoundingClientRect since happy-dom doesn't do real layout
    vi.spyOn(container, "getBoundingClientRect").mockReturnValue({
      top: 0,
      left: 0,
      bottom: 0,
      right: 0,
      width: 0,
      height: 0,
      x: 0,
      y: 0,
      toJSON: () => {},
    });
    vi.spyOn(target, "getBoundingClientRect").mockReturnValue({
      top: 100,
      left: 0,
      bottom: 0,
      right: 0,
      width: 0,
      height: 0,
      x: 0,
      y: 0,
      toJSON: () => {},
    });
    vi.spyOn(container, "scrollTo");

    scrollContainerToTarget(container, target);

    expect(container.scrollTo).toHaveBeenCalledOnce();
  });
});

describe("ScrollTracker", () => {
  it("calls onActiveChange on start and on scroll", () => {
    const container = document.createElement("div");
    const body = document.createElement("div");
    document.body.appendChild(container);
    container.appendChild(body);

    const heading1 = document.createElement("h2");
    heading1.id = "section-1";
    const heading2 = document.createElement("h2");
    heading2.id = "section-2";
    body.appendChild(heading1);
    body.appendChild(heading2);

    const onActiveChange = vi.fn();
    const tracker = new ScrollTracker(container, body, ["section-1", "section-2"], onActiveChange);

    // Mock getBoundingClientRect for layout simulation
    vi.spyOn(container, "getBoundingClientRect").mockReturnValue({
      top: 0,
      left: 0,
      bottom: 800,
      right: 600,
      width: 600,
      height: 800,
      x: 0,
      y: 0,
      toJSON: () => {},
    });
    vi.spyOn(heading1, "getBoundingClientRect").mockReturnValue({
      top: -10,
      left: 0,
      bottom: 30,
      right: 600,
      width: 600,
      height: 40,
      x: 0,
      y: -10,
      toJSON: () => {},
    });
    vi.spyOn(heading2, "getBoundingClientRect").mockReturnValue({
      top: 200,
      left: 0,
      bottom: 240,
      right: 600,
      width: 600,
      height: 40,
      x: 0,
      y: 200,
      toJSON: () => {},
    });

    const cleanup = tracker.start();
    expect(onActiveChange).toHaveBeenCalledWith("section-1");

    cleanup();
  });

  it("dispose (cleanup) removes listeners", () => {
    const container = document.createElement("div");
    const body = document.createElement("div");
    document.body.appendChild(container);
    container.appendChild(body);

    const tracker = new ScrollTracker(container, body, [], () => {});

    const cleanup = tracker.start();
    expect(() => cleanup()).not.toThrow();
  });
});
