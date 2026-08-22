import type { RenderResult } from "@axis-love/contracts";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { WorkerFactory, WorkerRenderResponse } from "./index";
import { ParseCache } from "./parse-cache";
import { WorkerBridge } from "./worker-bridge";

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

// A minimal worker mock that supports message/error listeners and postMessage
interface MockWorker {
  postMessage: (msg: unknown) => void;
  listeners: Map<string, ((e: unknown) => void)[]>;
  terminate: () => void;
}

function createMockWorkerFactory(onMessage: (msg: { id: number; source: string }) => void): {
  factory: WorkerFactory;
  workers: MockWorker[];
} {
  const workers: MockWorker[] = [];
  const factory: WorkerFactory = {
    createWorker() {
      const listeners = new Map<string, ((e: unknown) => void)[]>();
      const worker: MockWorker = {
        postMessage: (msg) => {
          onMessage(msg as { id: number; source: string });
        },
        listeners,
        terminate: () => {},
      };
      workers.push(worker);
      return {
        postMessage: worker.postMessage,
        addEventListener: (type: string, listener: (e: never) => void) => {
          if (!listeners.has(type)) listeners.set(type, []);
          listeners.get(type)?.push(listener as (e: unknown) => void);
        },
        terminate: worker.terminate,
      };
    },
  };
  return { factory, workers };
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

describe("WorkerBridge", () => {
  let cache: ParseCache;
  const renderFn = vi.fn(
    async (source: string): Promise<RenderResult> => makeResult(`<p>${source}</p>`),
  );

  beforeEach(() => {
    cache = new ParseCache();
    renderFn.mockClear();
  });

  it("renders on main thread when no workerFactory is supplied", async () => {
    const bridge = new WorkerBridge({ renderFn, cache });
    const result = await bridge.render("hello");
    expect(result.html).toBe("<p>hello</p>");
    expect(renderFn).toHaveBeenCalledWith("hello", undefined);
    bridge.dispose();
  });

  it("renders on main thread for small documents even with workerFactory", async () => {
    const { factory } = createMockWorkerFactory(() => {
      // Should not be called for small docs
    });
    const bridge = new WorkerBridge({
      workerFactory: factory,
      renderFn,
      cache,
      mainThreadThreshold: 1000,
    });
    const result = await bridge.render("tiny");
    expect(result.html).toBe("<p>tiny</p>");
    bridge.dispose();
  });

  it("caches results and returns cached on second call", async () => {
    const bridge = new WorkerBridge({ renderFn, cache });
    await bridge.render("hello");
    await bridge.render("hello");
    // renderFn should only be called once (second is cache hit)
    expect(renderFn).toHaveBeenCalledTimes(1);
    bridge.dispose();
  });

  it("falls back to main thread when worker errors", async () => {
    const { factory, workers } = createMockWorkerFactory(() => {});
    const bridge = new WorkerBridge({
      workerFactory: factory,
      renderFn,
      cache,
      mainThreadThreshold: 1,
    });

    // Trigger worker error immediately after first render
    const renderPromise = bridge.render("large document content".repeat(10));

    // Simulate worker error
    await delay(0);
    const errorListeners = workers[0]?.listeners.get("error");
    if (errorListeners) {
      errorListeners[0]({ message: "Worker crashed" } as ErrorEvent);
    }

    const result = await renderPromise;
    // Should have fallen back to main thread — renderFn wraps source in <p>...</p>
    expect(result.html).toContain("large document content");
    expect(result.html).toMatch(/^<p>/);
    bridge.dispose();
  });

  it("discards stale results when a newer request supersedes", async () => {
    const resolvers: Record<string, (result: RenderResult) => void> = {};

    const slowRenderFn = vi.fn((source: string): Promise<RenderResult> => {
      return new Promise<RenderResult>((res) => {
        resolvers[source] = res;
      });
    });

    const bridge = new WorkerBridge({ renderFn: slowRenderFn, cache });

    const firstPromise = bridge.render("first");
    const secondPromise = bridge.render("second");

    // Resolve both — second should win
    resolvers.first?.(makeResult("<p>first</p>"));
    resolvers.second?.(makeResult("<p>second</p>"));

    // First should be superseded (reject), second should resolve
    await expect(firstPromise).rejects.toThrow();
    const result = await secondPromise;
    expect(result.html).toBe("<p>second</p>");

    bridge.dispose();
  });

  it("dispose rejects all pending requests", async () => {
    const resolvers: ((result: RenderResult) => void)[] = [];
    const slowRenderFn = vi.fn(
      (): Promise<RenderResult> =>
        new Promise<RenderResult>((res) => {
          resolvers.push(res);
        }),
    );

    const bridge = new WorkerBridge({ renderFn: slowRenderFn, cache });
    const promise = bridge.render("hello");
    bridge.dispose();

    await expect(promise).rejects.toThrow();
    resolvers[0]?.(makeResult("<p>hello</p>"));
  });

  it("falls back to main thread when worker returns error response", async () => {
    const { factory, workers } = createMockWorkerFactory((msg) => {
      // Simulate worker error response
      const errorResponse: WorkerRenderResponse = {
        type: "error",
        id: msg.id,
        error: "parse failed",
      };
      const msgListeners = workers[0]?.listeners.get("message");
      if (msgListeners) {
        msgListeners[0]({ data: errorResponse } as MessageEvent<WorkerRenderResponse>);
      }
    });

    const bridge = new WorkerBridge({
      workerFactory: factory,
      renderFn,
      cache,
      mainThreadThreshold: 1,
    });

    const result = await bridge.render("large".repeat(10));
    // Should have fallen back to main thread
    expect(result.html).toContain("large");
    bridge.dispose();
  });

  it("uses cache across multiple readers (separate instances)", async () => {
    const sharedCache = new ParseCache();
    const bridge1 = new WorkerBridge({ renderFn, cache: sharedCache });
    const bridge2 = new WorkerBridge({ renderFn, cache: sharedCache });

    await bridge1.render("shared");
    await bridge2.render("shared");

    // renderFn should be called once total (shared cache hit)
    expect(renderFn).toHaveBeenCalledTimes(1);

    bridge1.dispose();
    bridge2.dispose();
  });
});
