import type { RenderResult } from "@axis-love/contracts";
import { beforeEach, describe, expect, it } from "vitest";
import { ParseCache } from "./parse-cache";

function makeResult(html: string): RenderResult {
  return {
    html,
    outline: [],
    diagnostics: [],
    assets: [],
    links: [],
    metadata: {},
    detectedFeatures: {
      hasMath: false,
      hasMermaid: false,
      hasDesignDoc: false,
      hasCodeHighlighting: false,
      hasTables: false,
      hasTaskLists: false,
      hasFootnotes: false,
      hasAlerts: false,
    },
    rendererVersion: "0.2.0",
  };
}

describe("ParseCache", () => {
  let cache: ParseCache;

  beforeEach(() => {
    cache = new ParseCache({ maxSize: 8 });
  });

  it("returns undefined for cache misses", () => {
    expect(cache.get("hello")).toBeUndefined();
  });

  it("returns cached result for cache hits", () => {
    const result = makeResult("<p>hello</p>");
    cache.set("hello", result);
    expect(cache.get("hello")).toBe(result);
  });

  it("evicts the least recently used entry after maxSize", () => {
    const first = makeResult("<p>first</p>");
    cache.set("first", first);

    for (let i = 1; i <= 8; i++) {
      cache.set(`entry-${i}`, makeResult(`<p>entry ${i}</p>`));
    }

    expect(cache.get("first")).toBeUndefined();
  });

  it("promotes accessed entries to most-recent", () => {
    const first = makeResult("<p>first</p>");
    cache.set("first", first);

    for (let i = 1; i <= 7; i++) {
      cache.set(`entry-${i}`, makeResult(`<p>entry ${i}</p>`));
    }

    // Access "first" to promote it
    cache.get("first");

    cache.set("entry-8", makeResult("<p>entry 8</p>"));

    expect(cache.get("first")).toBe(first);
  });

  it("overwrites existing entries", () => {
    const original = makeResult("<p>original</p>");
    const updated = makeResult("<p>updated</p>");
    cache.set("key", original);
    cache.set("key", updated);
    expect(cache.get("key")).toBe(updated);
  });

  it("clear removes all entries", () => {
    cache.set("a", makeResult("a"));
    cache.set("b", makeResult("b"));
    cache.clear();
    expect(cache.get("a")).toBeUndefined();
    expect(cache.get("b")).toBeUndefined();
    expect(cache.size).toBe(0);
  });

  it("evict removes a specific entry", () => {
    cache.set("target", makeResult("target"));
    cache.set("keep", makeResult("keep"));
    cache.evict("target");
    expect(cache.get("target")).toBeUndefined();
    expect(cache.get("keep")).not.toBeUndefined();
  });

  it("evict is a no-op for missing keys", () => {
    cache.set("a", makeResult("a"));
    cache.evict("nonexistent");
    expect(cache.get("a")).not.toBeUndefined();
  });

  it("caches with different options separately", () => {
    const resultA = makeResult("<p>a</p>");
    const resultB = makeResult("<p>b</p>");
    cache.set("source", resultA, { timeoutMs: 1000 });
    cache.set("source", resultB, { timeoutMs: 2000 });
    expect(cache.get("source", { timeoutMs: 1000 })).toBe(resultA);
    expect(cache.get("source", { timeoutMs: 2000 })).toBe(resultB);
  });

  it("supports custom maxSize", () => {
    const small = new ParseCache({ maxSize: 2 });
    small.set("a", makeResult("a"));
    small.set("b", makeResult("b"));
    small.set("c", makeResult("c"));
    expect(small.get("a")).toBeUndefined();
    expect(small.get("b")).not.toBeUndefined();
    expect(small.get("c")).not.toBeUndefined();
  });

  it("independent caches don't interfere", () => {
    const cacheA = new ParseCache();
    const cacheB = new ParseCache();
    const resultA = makeResult("<p>a</p>");
    const resultB = makeResult("<p>b</p>");
    cacheA.set("key", resultA);
    cacheB.set("key", resultB);
    expect(cacheA.get("key")).toBe(resultA);
    expect(cacheB.get("key")).toBe(resultB);
  });
});
