// @vitest-environment happy-dom
import { describe, expect, it, vi } from "vitest";
import { CodeCopyEnhancer } from "./code-copy";
import type { ClipboardProvider } from "./index";

describe("CodeCopyEnhancer", () => {
  it("reports clipboardAvailable true when ClipboardProvider is supplied", () => {
    const provider: ClipboardProvider = { writeText: vi.fn().mockResolvedValue(undefined) };
    const enhancer = new CodeCopyEnhancer({ clipboardProvider: provider });
    expect(enhancer.clipboardAvailable).toBe(true);
  });

  it("uses ClipboardProvider when supplied", async () => {
    const onCopy = vi.fn();
    const writeText = vi.fn().mockResolvedValue(undefined);
    const provider: ClipboardProvider = { writeText };
    const enhancer = new CodeCopyEnhancer({ clipboardProvider: provider, onCopy });

    const container = document.createElement("div");
    container.innerHTML =
      '<pre><code class="language-ts">const x = 1;</code><button class="code-copy-button">Copy</button></pre>';
    document.body.appendChild(container);

    enhancer.attach(container);

    const button = container.querySelector(".code-copy-button") as HTMLElement;
    button.click();

    // copy() is async — flush microtasks before asserting
    await Promise.resolve();

    expect(writeText).toHaveBeenCalledWith("const x = 1;");
    expect(onCopy).toHaveBeenCalledWith("Copied to clipboard");

    enhancer.detach(container);
  });

  it("hides copy controls when clipboard is unavailable", () => {
    const enhancer = new CodeCopyEnhancer();

    const container = document.createElement("div");
    container.innerHTML =
      '<pre><code>code</code><button class="code-copy-button">Copy</button></pre>';
    document.body.appendChild(container);

    enhancer.attach(container);

    expect(container.querySelector(".code-copy-button")).toBeNull();
  });

  it("detach removes click handler", () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    const provider: ClipboardProvider = { writeText };
    const enhancer = new CodeCopyEnhancer({ clipboardProvider: provider });

    const container = document.createElement("div");
    container.innerHTML =
      '<pre><code>code</code><button class="code-copy-button">Copy</button></pre>';
    document.body.appendChild(container);

    enhancer.attach(container);
    enhancer.detach(container);

    const button = container.querySelector(".code-copy-button") as HTMLElement;
    button.click();

    expect(writeText).not.toHaveBeenCalled();
  });

  it("attach is idempotent (no duplicate handlers)", () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    const provider: ClipboardProvider = { writeText };
    const enhancer = new CodeCopyEnhancer({ clipboardProvider: provider });

    const container = document.createElement("div");
    container.innerHTML =
      '<pre><code>code</code><button class="code-copy-button">Copy</button></pre>';
    document.body.appendChild(container);

    enhancer.attach(container);
    enhancer.attach(container); // second attach should replace, not duplicate

    const button = container.querySelector(".code-copy-button") as HTMLElement;
    button.click();

    expect(writeText).toHaveBeenCalledTimes(1);

    enhancer.detach(container);
  });
});
