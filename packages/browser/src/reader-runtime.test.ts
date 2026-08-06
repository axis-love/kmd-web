// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type {
  AssetResolver,
  ClipboardProvider,
  HostCapabilities,
  LinkHandler,
  WorkerFactory,
} from "./index";
import { BrowserReader } from "./reader-runtime";

describe("BrowserReader lifecycle", () => {
  let container: HTMLElement;
  let scrollContainer: HTMLElement;

  beforeEach(() => {
    scrollContainer = document.createElement("div");
    container = document.createElement("div");
    scrollContainer.appendChild(container);
    document.body.appendChild(scrollContainer);
  });

  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("renders markdown and sets container innerHTML", async () => {
    const reader = new BrowserReader({ container });
    await reader.update("# Hello");
    expect(container.innerHTML).toContain("<h1");
    expect(container.innerHTML).toContain("Hello");
    reader.dispose();
  });

  it("morphs DOM on second update instead of full replacement", async () => {
    const reader = new BrowserReader({ container });
    await reader.update("# First");
    const firstH1 = container.querySelector("h1");
    expect(firstH1).not.toBeNull();

    await reader.update("# First\n\nParagraph");
    // First h1 should still be in the DOM (morphed, not replaced)
    const h1AfterMorph = container.querySelector("h1");
    expect(h1AfterMorph).toBe(firstH1);
    expect(container.innerHTML).toContain("Paragraph");

    reader.dispose();
  });

  it("calls onOutlineChange with the outline", async () => {
    const onOutlineChange = vi.fn();
    const reader = new BrowserReader({ container, onOutlineChange });
    await reader.update("# Title\n\n## Section");
    expect(onOutlineChange).toHaveBeenCalledTimes(1);
    const outline = onOutlineChange.mock.calls[0][0];
    expect(outline).toHaveLength(2);
    expect(outline[0].text).toBe("Title");
    expect(outline[1].text).toBe("Section");
    reader.dispose();
  });

  it("calls onRendered after successful render", async () => {
    const onRendered = vi.fn();
    const reader = new BrowserReader({ container, onRendered });
    await reader.update("# Hello");
    expect(onRendered).toHaveBeenCalledTimes(1);
    expect(onRendered.mock.calls[0][0].html).toContain("<h1");
    reader.dispose();
  });

  it("calls onError on render failure", async () => {
    const onError = vi.fn();
    const reader = new BrowserReader({
      container,
      onError,
      renderOptions: { maxSourceSize: 10 },
    });
    try {
      await reader.update("x".repeat(20));
      // Should either throw or call onError
    } catch {
      // Expected
    }
    expect(onError).toHaveBeenCalledTimes(1);
    reader.dispose();
  });

  it("dispose prevents further updates", async () => {
    const reader = new BrowserReader({ container });
    reader.dispose();
    await expect(reader.update("# Hello")).rejects.toThrow("disposed");
  });

  it("dispose cleans up resources (no leaks)", async () => {
    const reader = new BrowserReader({ container });
    await reader.update("# Hello");
    reader.dispose();
    // After dispose, result should be null
    expect(reader.result).toBeNull();
  });

  it("supports multiple readers on same page independently", async () => {
    const container2 = document.createElement("div");
    scrollContainer.appendChild(container2);

    const reader1 = new BrowserReader({ container });
    const reader2 = new BrowserReader({ container: container2 });

    await reader1.update("# Document A");
    await reader2.update("# Document B");

    expect(container.innerHTML).toContain("Document A");
    expect(container2.innerHTML).toContain("Document B");

    // Disposing one doesn't affect the other
    reader1.dispose();
    expect(container.innerHTML).toContain("Document A");
    expect(container2.innerHTML).toContain("Document B");

    reader2.dispose();
  });

  it("uses ClipboardProvider from host capabilities", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    const clipboardProvider: ClipboardProvider = { writeText };
    const onCopy = vi.fn();
    const caps: HostCapabilities = { clipboardProvider };

    const reader = new BrowserReader({ container, capabilities: caps, onCopy });
    await reader.update("```ts\nconst x = 1;\n```");

    // Copy button should be present (clipboard available)
    const button = container.querySelector(".code-copy-button");
    if (button) {
      button.click();
      // copy() is async — flush microtasks before asserting
      await Promise.resolve();
      expect(writeText).toHaveBeenCalled();
      expect(onCopy).toHaveBeenCalledWith("Copied to clipboard");
    }

    reader.dispose();
  });

  it("uses LinkHandler from host capabilities", async () => {
    const openExternal = vi.fn().mockResolvedValue(undefined);
    const openDocument = vi.fn().mockResolvedValue(undefined);
    const linkHandler: LinkHandler = { openExternal, openDocument };
    const caps: HostCapabilities = { linkHandler };

    const reader = new BrowserReader({ container, capabilities: caps });
    await reader.update("[link](https://example.com)");

    const link = container.querySelector("a");
    expect(link).not.toBeNull();
    (link as HTMLAnchorElement)?.click();

    expect(openExternal).toHaveBeenCalledTimes(1);

    reader.dispose();
  });

  it("uses AssetResolver from host capabilities", async () => {
    const resolveAsset = vi.fn().mockResolvedValue({
      url: "blob:http://localhost/img",
      originalUrl: "cat.png",
    });
    const assetResolver: AssetResolver = { resolveAsset };
    const caps: HostCapabilities = { assetResolver };

    const reader = new BrowserReader({ container, capabilities: caps });
    await reader.update("![cat](cat.png)");

    expect(resolveAsset).toHaveBeenCalledTimes(1);
    expect(resolveAsset).toHaveBeenCalledWith(
      expect.objectContaining({ url: "cat.png", type: "image" }),
    );

    reader.dispose();
  });

  it("gracefully degrades without any host capabilities", async () => {
    // No capabilities at all — should still render
    const reader = new BrowserReader({ container });
    await reader.update("# Hello\n\n[link](https://example.com)");

    expect(container.innerHTML).toContain("<h1");
    expect(container.innerHTML).toContain("Hello");
    // Link should be present with rel="noopener noreferrer"
    const link = container.querySelector("a");
    expect(link).not.toBeNull();
    expect(link?.getAttribute("rel")).toContain("noopener");
    expect(link?.getAttribute("rel")).toContain("noreferrer");

    reader.dispose();
  });

  it("blocked URLs never reach handlers", async () => {
    const openExternal = vi.fn().mockResolvedValue(undefined);
    const openDocument = vi.fn().mockResolvedValue(undefined);
    const linkHandler: LinkHandler = { openExternal, openDocument };
    const caps: HostCapabilities = { linkHandler };

    const reader = new BrowserReader({ container, capabilities: caps });
    await reader.update("[xss](javascript:alert(1))");

    // The link should have been stripped by core's URL policy
    // (no <a> element in the output)
    const link = container.querySelector("a");
    expect(link).toBeNull();

    reader.dispose();
  });

  it("scrollToFragment scrolls to target element", async () => {
    const reader = new BrowserReader({
      container,
      scrollContainer,
    });
    await reader.update("# Title\n\n## Section {#section}");

    // Mock getBoundingClientRect
    vi.spyOn(scrollContainer, "getBoundingClientRect").mockReturnValue({
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
    const target = container.querySelector("[id]") as HTMLElement;
    if (target) {
      vi.spyOn(target, "getBoundingClientRect").mockReturnValue({
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
      vi.spyOn(scrollContainer, "scrollTo");

      reader.scrollToFragment(target.id);
      expect(scrollContainer.scrollTo).toHaveBeenCalledOnce();
    }

    reader.dispose();
  });

  it("scrollToFragment handles fragment IDs with CSS metacharacters without throwing", async () => {
    const reader = new BrowserReader({
      container,
      scrollContainer,
    });
    await reader.update("# Title");

    // Fragment IDs with CSS metacharacters should not throw or cause
    // selector injection. findAnchorTarget iterates elements safely.
    expect(() => {
      reader.scrollToFragment("foo.bar");
      reader.scrollToFragment("foo#bar");
      reader.scrollToFragment("foo[bar]");
      reader.scrollToFragment("foo]bar[");
      reader.scrollToFragment("'; DROP TABLE--");
    }).not.toThrow();

    reader.dispose();
  });

  it("uses WorkerFactory when supplied", async () => {
    // We can't easily test the actual worker here, but we can verify
    // that a reader with a WorkerFactory doesn't break for small docs
    // (which use main-thread regardless)
    const workerFactory: WorkerFactory = {
      createWorker: () => ({
        postMessage: vi.fn(),
        addEventListener: vi.fn(),
        terminate: vi.fn(),
      }),
    };
    const caps: HostCapabilities = { workerFactory };

    const reader = new BrowserReader({ container, capabilities: caps });
    await reader.update("# Hello");
    expect(container.innerHTML).toContain("Hello");
    reader.dispose();
  });
});
