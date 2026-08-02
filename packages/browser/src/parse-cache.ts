// @axis-love/browser — LRU cache for RenderResults
//
// A simple, optional LRU cache for rendered documents keyed by a hash of
// the source text + relevant render options. Uses Map's insertion-order
// semantics for LRU eviction (delete+re-set on access promotes to most
// recent). No external dependency, no DOM, no timers — purely a data
// structure.

import type { RenderOptions, RenderResult } from "@axis-love/contracts";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Options for creating a parse cache. */
export interface ParseCacheOptions {
  /** Maximum number of entries to retain. Default: 8. */
  readonly maxSize?: number;
}

interface CacheEntry {
  readonly result: RenderResult;
}

// ---------------------------------------------------------------------------
// Hashing
// ---------------------------------------------------------------------------

/**
 * Fast, deterministic hash for cache keys. Not cryptographic — just enough
 * to distinguish different inputs. Combines length + djb2 for collision
 * resistance on typical Markdown content.
 */
function djb2(text: string): string {
  let hash = 5381;
  for (let i = 0; i < text.length; i++) {
    hash = ((hash << 5) + hash + text.charCodeAt(i)) >>> 0;
  }
  return `${text.length}:${hash.toString(16)}`;
}

/**
 * Build a cache key from source text and render options.
 * Only serializable option fields are included (signal is excluded by
 * the RenderOptions type — it's not part of the serializable contract).
 */
function buildKey(source: string, options?: RenderOptions): string {
  if (!options) return djb2(source);
  const optHash = djb2(JSON.stringify(options));
  return `${djb2(source)}|${optHash}`;
}

// ---------------------------------------------------------------------------
// ParseCache
// ---------------------------------------------------------------------------

/**
 * An optional LRU cache for rendered documents.
 *
 * Keyed by a hash of the source text and the serializable render options.
 * When the cache exceeds `maxSize`, the least recently accessed entry is
 * evicted. Accessing an entry promotes it to most-recent.
 *
 * The cache is per-instance so multiple readers maintain independent
 * caches — no cross-reader pollution.
 */
export class ParseCache {
  private readonly map = new Map<string, CacheEntry>();
  private readonly maxSize: number;

  constructor(options?: ParseCacheOptions) {
    this.maxSize = options?.maxSize ?? 8;
  }

  /** Look up a cached render result. Returns undefined on miss. */
  get(source: string, options?: RenderOptions): RenderResult | undefined {
    const key = buildKey(source, options);
    const entry = this.map.get(key);
    if (!entry) return undefined;
    // Promote to most-recent (Map preserves insertion order; delete+set
    // moves the entry to the end, making it the newest).
    this.map.delete(key);
    this.map.set(key, entry);
    return entry.result;
  }

  /** Store a render result in the cache. Evicts LRU if over capacity. */
  set(source: string, result: RenderResult, options?: RenderOptions): void {
    const key = buildKey(source, options);
    // Delete first so the set always moves the entry to the end.
    this.map.delete(key);
    this.map.set(key, { result });

    while (this.map.size > this.maxSize) {
      const oldestKey = this.map.keys().next().value;
      if (oldestKey === undefined) break;
      this.map.delete(oldestKey);
    }
  }

  /** Remove a specific entry from the cache. No-op if not present. */
  evict(source: string, options?: RenderOptions): void {
    this.map.delete(buildKey(source, options));
  }

  /** Remove all entries from the cache. */
  clear(): void {
    this.map.clear();
  }

  /** Current number of cached entries. */
  get size(): number {
    return this.map.size;
  }
}
