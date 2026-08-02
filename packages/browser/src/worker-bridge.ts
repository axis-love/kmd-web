// @axis-love/browser — worker bridge with main-thread fallback
//
// Coordinates rendering between a Web Worker and the main thread. When a
// WorkerFactory is supplied, rendering is offloaded to a worker for large
// documents. When no factory is supplied, or a worker render fails, the
// bridge falls back to main-thread rendering via the supplied renderFn.
//
// Stale results are discarded: each request gets a monotonically
// increasing ID, and the bridge only delivers results for the latest
// request. Earlier responses are discarded.

import type { RenderOptions, RenderResult } from "@axis-love/contracts";
import type { WorkerFactory, WorkerRenderRequest, WorkerRenderResponse } from "./index.js";
import type { ParseCache } from "./parse-cache.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * A function that renders Markdown on the main thread (typically the
 * `render` function from `@axis-love/core`). Injected to avoid a hard
 * static import of core at the module level — the worker bridge delegates
 * to whichever render function the host provides.
 */
export type RenderFn = (source: string, options?: RenderOptions) => Promise<RenderResult>;

/**
 * Options for creating a worker bridge.
 */
export interface WorkerBridgeOptions {
  /** The host's worker factory, or undefined to always use main thread. */
  readonly workerFactory?: WorkerFactory;
  /** Main-thread render function (required — used for fallback and small docs). */
  readonly renderFn: RenderFn;
  /** Optional cache for render results. */
  readonly cache?: ParseCache;
  /**
   * Documents shorter than this threshold are always rendered on the main
   * thread (worker overhead is not worth it). Default: 4096 chars.
   */
  readonly mainThreadThreshold?: number;
}

// ---------------------------------------------------------------------------
// WorkerBridge
// ---------------------------------------------------------------------------

/**
 * Manages render requests, worker lifecycle, and stale-result tracking.
 *
 * Lifecycle:
 * - `render(source, options)` returns a Promise that resolves with the
 *   RenderResult for the latest request only. If a new request supersedes
 *   an earlier one, the earlier request's result is discarded.
 * - `dispose()` terminates the worker (if any) and rejects all pending
 *   requests. Call this on reader unmount.
 *
 * Stale result handling:
 * - Each request increments an internal counter. The response handler
 *   checks the request ID against the current counter; stale responses
 *   (for superseded requests) are silently discarded.
 * - The returned promise from `render()` resolves only with the result
 *   for the most recent call. If a new call is made before the previous
 *   resolves, the previous promise rejects with a "superseded" error.
 *
 * Worker fallback:
 * - If the WorkerFactory is absent or the worker errors, rendering falls
 *   back to `renderFn` on the main thread.
 * - Small documents (below `mainThreadThreshold`) always use main thread.
 */
export class WorkerBridge {
  private readonly factory: WorkerFactory | undefined;
  private readonly renderFn: RenderFn;
  private readonly cache: ParseCache | undefined;
  private readonly mainThreadThreshold: number;

  private worker: ReturnType<WorkerFactory["createWorker"]> | null = null;
  private nextId = 0;
  private currentRequestId = 0;
  private readonly pending = new Map<number, WorkerBridge.PendingEntry>();
  private readonly mainThreadPending = new Set<(error: Error) => void>();
  private disposed = false;

  constructor(options: WorkerBridgeOptions) {
    this.factory = options.workerFactory;
    this.renderFn = options.renderFn;
    this.cache = options.cache;
    this.mainThreadThreshold = options.mainThreadThreshold ?? 4096;
  }

  /**
   * Render a document. If a previous render is still in-flight, it is
   * cancelled (its promise rejects with "superseded"). Only the result
   * for the latest call is delivered.
   */
  async render(source: string, options?: RenderOptions): Promise<RenderResult> {
    if (this.disposed) throw new Error("WorkerBridge is disposed");

    // Check cache first
    if (this.cache) {
      const cached = this.cache.get(source, options);
      if (cached) return cached;
    }

    const requestId = ++this.currentRequestId;

    // Reject any pending request — it's now stale
    this.rejectPending("superseded");
    this.rejectMainThread("superseded");

    // Small documents always use main thread
    const useWorker = this.factory !== undefined && source.length >= this.mainThreadThreshold;

    let result: RenderResult;
    if (useWorker) {
      result = await this.renderViaWorker(source, options, requestId);
    } else {
      result = await this.renderOnMainThread(source, options, requestId);
    }

    // Cache the result (if cache is configured)
    if (this.cache) {
      this.cache.set(source, result, options);
    }

    return result;
  }

  /** Terminate the worker and reject all pending requests. */
  dispose(): void {
    this.disposed = true;
    this.rejectPending("disposed");
    this.rejectMainThread("disposed");
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
    }
  }

  // -----------------------------------------------------------------------
  // Private
  // -----------------------------------------------------------------------

  private renderOnMainThread(
    source: string,
    options: RenderOptions | undefined,
    requestId: number,
  ): Promise<RenderResult> {
    // Race the renderFn promise against a cancellation promise so
    // dispose() can reject an in-flight main-thread render even when
    // the renderFn itself hasn't settled yet.
    let cancel: (error: Error) => void;
    const cancellation = new Promise<never>((_resolve, reject) => {
      cancel = reject;
      this.mainThreadPending.add(reject);
    });

    const render = this.renderFn(source, options).then((result) => {
      if (requestId !== this.currentRequestId) {
        throw new WorkerBridge.SupersededError();
      }
      return result;
    });

    return Promise.race([render, cancellation]).finally(() => {
      this.mainThreadPending.delete(cancel);
    });
  }

  private renderViaWorker(
    source: string,
    options: RenderOptions | undefined,
    requestId: number,
  ): Promise<RenderResult> {
    const id = ++this.nextId;
    const worker = this.getWorker();

    return new Promise<RenderResult>((resolve, reject) => {
      this.pending.set(id, {
        requestId,
        resolve: (result) => resolve(result),
        reject: (error) => reject(error),
      });

      const message: WorkerRenderRequest = { id, source, options };
      worker.postMessage(message);

      // Fallback: if the worker doesn't respond within a generous timeout,
      // fall back to main-thread rendering. The worker may have crashed
      // silently.
      // (We don't set a strict timeout because core has its own timeoutMs.
      //  The fallback is handled by the worker "error" event instead.)
    }).catch(async (error) => {
      // Worker failed — fall back to main thread
      if (error instanceof WorkerBridge.SupersededError) throw error;
      // Re-render on main thread
      return this.renderOnMainThread(source, options, requestId);
    });
  }

  private getWorker(): NonNullable<typeof this.worker> {
    if (!this.factory) throw new Error("WorkerFactory not configured");
    if (!this.worker) {
      this.worker = this.factory.createWorker();
      this.worker.addEventListener("message", (e: MessageEvent<WorkerRenderResponse>) => {
        this.handleWorkerMessage(e.data);
      });
      this.worker.addEventListener("error", (e: ErrorEvent) => {
        this.handleWorkerError(e);
      });
    }
    return this.worker;
  }

  private handleWorkerMessage(data: WorkerRenderResponse): void {
    if (data.type === "result") {
      const entry = this.pending.get(data.id);
      if (!entry) return; // stale or unknown request
      this.pending.delete(data.id);
      if (entry.requestId === this.currentRequestId) {
        entry.resolve(data.result);
      } else {
        entry.reject(new WorkerBridge.SupersededError());
      }
    } else {
      const entry = this.pending.get(data.id);
      if (!entry) return;
      this.pending.delete(data.id);
      // Error response triggers fallback via the catch in renderViaWorker
      entry.reject(new Error(data.error));
    }
  }

  private handleWorkerError(e: ErrorEvent): void {
    // Reject all pending requests — the worker is dead
    for (const [, entry] of this.pending) {
      entry.reject(new Error(`Worker error: ${e.message}`));
    }
    this.pending.clear();
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
    }
    // The next render call will create a new worker (or fall back to main thread)
  }

  private rejectPending(reason: string): void {
    for (const [, entry] of this.pending) {
      entry.reject(new Error(reason));
    }
    this.pending.clear();
  }

  private rejectMainThread(reason: string): void {
    for (const reject of this.mainThreadPending) {
      reject(new Error(reason));
    }
    this.mainThreadPending.clear();
  }
}

// ---------------------------------------------------------------------------
// Namespace for nested types (keeps the class surface clean)
// ---------------------------------------------------------------------------

export namespace WorkerBridge {
  export interface PendingEntry {
    readonly requestId: number;
    readonly resolve: (result: RenderResult) => void;
    readonly reject: (error: Error) => void;
  }

  export class SupersededError extends Error {
    constructor() {
      super("Request superseded by a newer render");
      this.name = "SupersededError";
    }
  }
}
