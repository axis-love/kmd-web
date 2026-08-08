// Worker-path parity tests (KWEB-039).
//
// Documents at or above the bridge's 4096-char threshold render in a worker.
// Rehype plugin functions cannot be structured-cloned, so the worker entry has
// to inject the feature packages itself — these tests pin that the worker path
// produces the same highlighted code and rendered math as the main thread.

import type { RenderOptions, RenderResult } from "@axis-love/contracts";
import { describe, expect, it, vi } from "vitest";
import { loadFeatureRehypePlugins, renderWithFeaturePlugins } from "./feature-plugins";
import type { WorkerFactory, WorkerRenderRequest, WorkerRenderResponse } from "./index";
import { WorkerBridge } from "./worker-bridge";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

/** Filler that pushes the document over the bridge's main-thread threshold. */
const FILLER = Array.from(
  { length: 40 },
  (_, i) => `Paragraph ${i} — ${"the quick brown fox jumps over the lazy dog. ".repeat(3)}`,
).join("\n\n");

/** A realistic large document: code fences plus block and inline math. */
const LARGE_DOC = [
  "# Worker path",
  "",
  "```ts",
  "const answer: number = 42;",
  "```",
  "",
  "Inline $E = mc^2$ math.",
  "",
  "$$",
  "\\frac{1}{2}",
  "$$",
  "",
  FILLER,
].join("\n");

// ---------------------------------------------------------------------------
// Assertions shared by both render paths
// ---------------------------------------------------------------------------

function expectHighlightedCode(result: RenderResult): void {
  expect(result.html).toContain("shiki-code-block");
  expect(result.html).toContain("shiki-token");
  expect(result.codeHighlightCss ?? "").toMatch(/\.shiki-c[a-z0-9]+\{color:/);
}

function expectRenderedMath(result: RenderResult): void {
  // KaTeX output — the katex wrapper plus MathML from output:"htmlAndMathml".
  expect(result.html).toContain("katex");
  expect(result.html).toContain("<math");
  // The raw math placeholders core emits must be gone.
  expect(result.html).not.toContain("language-math");
}

// ---------------------------------------------------------------------------
// A worker that behaves exactly like a host's worker entry module
// ---------------------------------------------------------------------------

/**
 * Stands in for the host's render worker (e.g. kmd's `parse-worker.ts`): it
 * speaks the WorkerBridge protocol, renders through `renderWithFeaturePlugins`,
 * and posts the result back through `structuredClone` so anything that cannot
 * cross a real worker boundary fails here too.
 */
function createFeatureWorkerFactory(): WorkerFactory {
  return {
    createWorker() {
      const listeners = new Map<string, ((e: unknown) => void)[]>();
      return {
        postMessage(message: WorkerRenderRequest) {
          void (async () => {
            let response: WorkerRenderResponse;
            try {
              const result = await renderWithFeaturePlugins(
                message.source,
                message.options as RenderOptions | undefined,
              );
              response = { type: "result", id: message.id, result };
            } catch (err) {
              response = {
                type: "error",
                id: message.id,
                error: err instanceof Error ? err.message : String(err),
              };
            }
            const cloned = structuredClone(response);
            for (const listener of listeners.get("message") ?? []) {
              listener({ data: cloned });
            }
          })();
        },
        addEventListener(type: string, listener: (e: never) => void) {
          if (!listeners.has(type)) listeners.set(type, []);
          listeners.get(type)?.push(listener as (e: unknown) => void);
        },
        terminate() {},
      } as unknown as ReturnType<WorkerFactory["createWorker"]>;
    },
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("loadFeatureRehypePlugins", () => {
  it("injects both math and highlighting by default", async () => {
    const { plugins } = await loadFeatureRehypePlugins();
    expect(plugins).toHaveLength(2);
  });

  it("honors disabled feature flags", async () => {
    const { plugins } = await loadFeatureRehypePlugins({
      features: { math: false, codeHighlighting: false },
    });
    expect(plugins).toHaveLength(0);
  });

  it("injects only highlighting when math is disabled", async () => {
    const { plugins } = await loadFeatureRehypePlugins({ features: { math: false } });
    expect(plugins).toHaveLength(1);
  });
});

describe("renderWithFeaturePlugins", () => {
  it("highlights code and renders math", async () => {
    const result = await renderWithFeaturePlugins(LARGE_DOC);
    expectHighlightedCode(result);
    expectRenderedMath(result);
  });

  it("skips highlighting when codeHighlighting is disabled", async () => {
    const result = await renderWithFeaturePlugins(LARGE_DOC, {
      features: { codeHighlighting: false },
    });
    expect(result.html).not.toContain("shiki-code-block");
    expect(result.codeHighlightCss).toBeUndefined();
  });

  it("leaves math unrendered when math is disabled", async () => {
    const result = await renderWithFeaturePlugins(LARGE_DOC, { features: { math: false } });
    expect(result.html).toContain("language-math");
    expect(result.html).not.toContain("<math");
  });
});

describe("worker path (documents over the main-thread threshold)", () => {
  it("the fixture is large enough to route through the worker", () => {
    expect(LARGE_DOC.length).toBeGreaterThan(4096);
  });

  it("renders code with Shiki highlighting through the worker", async () => {
    const renderFn = vi.fn(async (): Promise<RenderResult> => {
      throw new Error("main-thread renderFn must not be used for large documents");
    });
    const bridge = new WorkerBridge({ workerFactory: createFeatureWorkerFactory(), renderFn });

    const result = await bridge.render(LARGE_DOC);

    expectHighlightedCode(result);
    expect(renderFn).not.toHaveBeenCalled();
    bridge.dispose();
  });

  it("renders math with KaTeX through the worker", async () => {
    const renderFn = vi.fn(async (): Promise<RenderResult> => {
      throw new Error("main-thread renderFn must not be used for large documents");
    });
    const bridge = new WorkerBridge({ workerFactory: createFeatureWorkerFactory(), renderFn });

    const result = await bridge.render(LARGE_DOC);

    expectRenderedMath(result);
    expect(renderFn).not.toHaveBeenCalled();
    bridge.dispose();
  });

  it("produces the same HTML as the main-thread path", async () => {
    const bridge = new WorkerBridge({
      workerFactory: createFeatureWorkerFactory(),
      renderFn: renderWithFeaturePlugins,
    });

    const viaWorker = await bridge.render(LARGE_DOC);
    const viaMainThread = await renderWithFeaturePlugins(LARGE_DOC);

    expect(viaWorker.html).toBe(viaMainThread.html);
    expect(viaWorker.codeHighlightCss).toBe(viaMainThread.codeHighlightCss);
    bridge.dispose();
  });
});
