// @vitest-environment happy-dom

import type { AssetReference } from "@axis-love/contracts";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AssetLifecycle } from "./asset-lifecycle";
import type { AssetResolver } from "./index";

describe("AssetLifecycle", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });
  it("reports resolverAvailable false when no resolver supplied", () => {
    const lifecycle = new AssetLifecycle();
    expect(lifecycle.resolverAvailable).toBe(false);
  });

  it("reports resolverAvailable true when resolver supplied", () => {
    const resolver: AssetResolver = { resolveAsset: vi.fn() };
    const lifecycle = new AssetLifecycle({ assetResolver: resolver });
    expect(lifecycle.resolverAvailable).toBe(true);
  });

  it("resolves assets and sets src on matching img elements", async () => {
    const resolveAsset = vi.fn().mockResolvedValue({
      url: "blob:http://localhost/abc",
      originalUrl: "cat.png",
    });
    const resolver: AssetResolver = { resolveAsset };

    const lifecycle = new AssetLifecycle({ assetResolver: resolver });

    const container = document.createElement("div");
    container.innerHTML = '<img src="cat.png" alt="cat">';
    document.body.appendChild(container);

    const assets: AssetReference[] = [{ url: "cat.png", type: "image", alt: "cat" }];

    await lifecycle.resolveAssets(container, assets);

    const img = container.querySelector("img");
    expect(img?.getAttribute("src")).toBe("blob:http://localhost/abc");
    expect(img?.getAttribute("data-kmd-raw-src")).toBe("cat.png");
    expect(resolveAsset).toHaveBeenCalledWith(
      expect.objectContaining({ url: "cat.png", type: "image" }),
    );
    expect(lifecycle.activeCount).toBe(1);
  });

  it("skips already-resolved URLs (http, https, data, blob)", async () => {
    const resolveAsset = vi.fn();
    const resolver: AssetResolver = { resolveAsset };

    const lifecycle = new AssetLifecycle({ assetResolver: resolver });

    const container = document.createElement("div");
    container.innerHTML = `
      <img src="https://example.com/img.png">
      <img src="http://example.com/img.png">
      <img src="data:image/png;base64,AAA">
      <img src="blob:http://localhost/abc">
    `;
    document.body.appendChild(container);

    await lifecycle.resolveAssets(container, []);

    expect(resolveAsset).not.toHaveBeenCalled();
  });

  it("skips already-tracked assets", async () => {
    const resolveAsset = vi.fn().mockResolvedValue({
      url: "blob:http://localhost/abc",
      originalUrl: "cat.png",
    });
    const resolver: AssetResolver = { resolveAsset };
    const lifecycle = new AssetLifecycle({ assetResolver: resolver });

    const container = document.createElement("div");
    container.innerHTML = '<img src="cat.png" alt="cat">';
    document.body.appendChild(container);

    const assets: AssetReference[] = [{ url: "cat.png", type: "image", alt: "cat" }];

    await lifecycle.resolveAssets(container, assets);
    await lifecycle.resolveAssets(container, assets);

    expect(resolveAsset).toHaveBeenCalledTimes(1);
  });

  it("revokeAll revokes tracked blob URLs", async () => {
    const resolveAsset = vi.fn().mockResolvedValue({
      url: "blob:http://localhost/abc",
      originalUrl: "cat.png",
    });
    const resolver: AssetResolver = { resolveAsset };
    const lifecycle = new AssetLifecycle({ assetResolver: resolver });

    const container = document.createElement("div");
    container.innerHTML = '<img src="cat.png" alt="cat">';
    document.body.appendChild(container);

    await lifecycle.resolveAssets(container, [{ url: "cat.png", type: "image" }]);

    const revokeSpy = vi.spyOn(URL, "revokeObjectURL");
    lifecycle.revokeAll();
    expect(revokeSpy).toHaveBeenCalledWith("blob:http://localhost/abc");
    expect(lifecycle.activeCount).toBe(0);
  });

  it("revokeAll does not revoke data: URLs", async () => {
    const resolveAsset = vi.fn().mockResolvedValue({
      url: "data:image/png;base64,AAA",
      originalUrl: "cat.png",
    });
    const resolver: AssetResolver = { resolveAsset };
    const lifecycle = new AssetLifecycle({ assetResolver: resolver });

    const container = document.createElement("div");
    container.innerHTML = '<img src="cat.png" alt="cat">';
    document.body.appendChild(container);

    await lifecycle.resolveAssets(container, [{ url: "cat.png", type: "image" }]);

    // Verify the tracked URL is actually a data: URL
    expect(lifecycle.activeCount).toBe(1);

    const revokeSpy = vi.spyOn(URL, "revokeObjectURL");
    lifecycle.revokeAll();
    expect(revokeSpy).not.toHaveBeenCalled();
  });

  it("leaves original src when resolution fails", async () => {
    const resolveAsset = vi.fn().mockRejectedValue(new Error("not found"));
    const resolver: AssetResolver = { resolveAsset };
    const lifecycle = new AssetLifecycle({ assetResolver: resolver });

    const container = document.createElement("div");
    container.innerHTML = '<img src="cat.png" alt="cat">';
    document.body.appendChild(container);

    await lifecycle.resolveAssets(container, [{ url: "cat.png", type: "image" }]);

    const img = container.querySelector("img");
    expect(img?.getAttribute("src")).toBe("cat.png");
    expect(img?.getAttribute("data-kmd-raw-src")).toBeNull();
  });

  it("no-op when no resolver supplied", async () => {
    const lifecycle = new AssetLifecycle();

    const container = document.createElement("div");
    container.innerHTML = '<img src="cat.png" alt="cat">';
    document.body.appendChild(container);

    await lifecycle.resolveAssets(container, [{ url: "cat.png", type: "image" }]);

    expect(lifecycle.activeCount).toBe(0);
  });

  it("no leaked object URLs after revokeAll", async () => {
    const resolveAsset = vi.fn().mockResolvedValue({
      url: "blob:http://localhost/abc",
      originalUrl: "cat.png",
    });
    const resolver: AssetResolver = { resolveAsset };
    const lifecycle = new AssetLifecycle({ assetResolver: resolver });

    const container = document.createElement("div");
    container.innerHTML = '<img src="cat.png" alt="cat">';
    document.body.appendChild(container);

    await lifecycle.resolveAssets(container, [{ url: "cat.png", type: "image" }]);
    expect(lifecycle.activeCount).toBe(1);

    lifecycle.revokeAll();
    expect(lifecycle.activeCount).toBe(0);

    // Re-resolving should work again after revokeAll — reset the img src
    // so the lifecycle sees it as unresolved
    const img = container.querySelector("img");
    img?.removeAttribute("data-kmd-raw-src");
    img?.setAttribute("src", "cat.png");

    await lifecycle.resolveAssets(container, [{ url: "cat.png", type: "image" }]);
    expect(lifecycle.activeCount).toBe(1);

    lifecycle.revokeAll();
    expect(lifecycle.activeCount).toBe(0);
  });
});
