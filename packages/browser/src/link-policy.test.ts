// @vitest-environment happy-dom
import { describe, expect, it, vi } from "vitest";
import type { LinkHandler } from "./index";
import { LinkPolicy } from "./link-policy";

function setupContainer(html: string): { container: HTMLElement; scroll: HTMLElement } {
  const scroll = document.createElement("div");
  const container = document.createElement("div");
  scroll.appendChild(container);
  document.body.appendChild(scroll);
  container.innerHTML = html;
  return { container, scroll };
}

function clickLink(container: HTMLElement, href: string): MouseEvent {
  const link = container.querySelector(`a[href="${href}"]`);
  if (!link) throw new Error(`Link with href="${href}" not found`);
  const event = new MouseEvent("click", {
    bubbles: true,
    cancelable: true,
  });
  Object.defineProperty(event, "target", { value: link });
  link.dispatchEvent(event);
  return event;
}

describe("LinkPolicy", () => {
  it("blocks javascript: links — prevents default, no handler called", () => {
    const { container, scroll } = setupContainer('<a href="javascript:alert(1)">xss</a>');
    const openExternal = vi.fn();
    const openDocument = vi.fn();
    const handler: LinkHandler = { openExternal, openDocument };

    const policy = new LinkPolicy({
      linkHandler: handler,
      scrollContainer: scroll,
      contentContainer: container,
    });
    policy.attach(container);

    const event = clickLink(container, "javascript:alert(1)");
    expect(event.defaultPrevented).toBe(true);
    expect(openExternal).not.toHaveBeenCalled();
    expect(openDocument).not.toHaveBeenCalled();
  });

  it("routes external links through openExternal", () => {
    const { container, scroll } = setupContainer('<a href="https://example.com">ext</a>');
    const openExternal = vi.fn().mockResolvedValue(undefined);
    const openDocument = vi.fn();
    const handler: LinkHandler = { openExternal, openDocument };

    const policy = new LinkPolicy({
      linkHandler: handler,
      scrollContainer: scroll,
      contentContainer: container,
    });
    policy.attach(container);

    const event = clickLink(container, "https://example.com");
    expect(event.defaultPrevented).toBe(true);
    // openExternal is called asynchronously
    expect(openExternal).toHaveBeenCalledTimes(1);
  });

  it("routes mailto: links through openExternal", () => {
    const { container, scroll } = setupContainer('<a href="mailto:user@example.com">mail</a>');
    const openExternal = vi.fn().mockResolvedValue(undefined);
    const openDocument = vi.fn();
    const handler: LinkHandler = { openExternal, openDocument };

    const policy = new LinkPolicy({
      linkHandler: handler,
      scrollContainer: scroll,
      contentContainer: container,
    });
    policy.attach(container);

    clickLink(container, "mailto:user@example.com");
    expect(openExternal).toHaveBeenCalledTimes(1);
  });

  it("routes document links through openDocument", () => {
    const { container, scroll } = setupContainer('<a href="./other.md">doc</a>');
    const openExternal = vi.fn();
    const openDocument = vi.fn().mockResolvedValue(undefined);
    const handler: LinkHandler = { openExternal, openDocument };

    const policy = new LinkPolicy({
      linkHandler: handler,
      scrollContainer: scroll,
      contentContainer: container,
    });
    policy.attach(container);

    clickLink(container, "./other.md");
    expect(openDocument).toHaveBeenCalledTimes(1);
    expect(openDocument).toHaveBeenCalledWith(expect.objectContaining({ href: "./other.md" }));
  });

  it("scrolls to fragment links", () => {
    const { container, scroll } = setupContainer(
      '<a href="#section">frag</a><h2 id="section">Section</h2>',
    );
    const openExternal = vi.fn();
    const openDocument = vi.fn();
    const handler: LinkHandler = { openExternal, openDocument };

    // Mock getBoundingClientRect for scroll
    vi.spyOn(scroll, "getBoundingClientRect").mockReturnValue({
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
    const heading = container.querySelector("#section") as HTMLElement;
    vi.spyOn(heading, "getBoundingClientRect").mockReturnValue({
      top: 100,
      left: 0,
      bottom: 140,
      right: 600,
      width: 600,
      height: 40,
      x: 0,
      y: 100,
      toJSON: () => {},
    });
    vi.spyOn(scroll, "scrollTo");

    const policy = new LinkPolicy({
      linkHandler: handler,
      scrollContainer: scroll,
      contentContainer: container,
    });
    policy.attach(container);

    const event = clickLink(container, "#section");
    expect(event.defaultPrevented).toBe(true);
    expect(scroll.scrollTo).toHaveBeenCalledOnce();
    expect(openExternal).not.toHaveBeenCalled();
  });

  it("default (no handler): external link opens via window.open", () => {
    const { container, scroll } = setupContainer('<a href="https://example.com">ext</a>');
    vi.spyOn(window, "open").mockReturnValue(null);

    const policy = new LinkPolicy({
      scrollContainer: scroll,
      contentContainer: container,
    });
    policy.attach(container);

    const event = clickLink(container, "https://example.com");
    expect(event.defaultPrevented).toBe(true);
    expect(window.open).toHaveBeenCalledTimes(1);
  });

  it("blocked schemes (vbscript:) never reach handlers", () => {
    const { container, scroll } = setupContainer('<a href="vbscript:MsgBox(1)">vbs</a>');
    const openExternal = vi.fn();
    const openDocument = vi.fn();
    const handler: LinkHandler = { openExternal, openDocument };

    const policy = new LinkPolicy({
      linkHandler: handler,
      scrollContainer: scroll,
      contentContainer: container,
    });
    policy.attach(container);

    const event = clickLink(container, "vbscript:MsgBox(1)");
    expect(event.defaultPrevented).toBe(true);
    expect(openExternal).not.toHaveBeenCalled();
    expect(openDocument).not.toHaveBeenCalled();
  });

  it("detach removes the click handler", () => {
    const { container, scroll } = setupContainer('<a href="https://example.com">ext</a>');
    const openExternal = vi.fn().mockResolvedValue(undefined);
    const handler: LinkHandler = { openExternal, openDocument: vi.fn() };

    const policy = new LinkPolicy({
      linkHandler: handler,
      scrollContainer: scroll,
      contentContainer: container,
    });
    const cleanup = policy.attach(container);

    clickLink(container, "https://example.com");
    expect(openExternal).toHaveBeenCalledTimes(1);

    cleanup();

    clickLink(container, "https://example.com");
    // Should not be called again after detach
    expect(openExternal).toHaveBeenCalledTimes(1);
  });
});
