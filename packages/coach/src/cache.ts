// Narration cache (trust contract item 5: "Every narration is cached by content
// hash"). The store is INJECTABLE so a deployment can back it with Redis
// (PRD §9.2) — the default is a per-process in-memory map.
//
// IMPORTANT: the cache stores POST-guardrail results only. A narration that
// failed validation is never cached, so a rejected request degrades every time
// (there is no poisoned cache entry to serve).

import type { NarrationResult } from './types.js';

/** Injectable narration store, keyed by inputHash. */
export interface NarrationCache {
  get(inputHash: string): NarrationResult | undefined | Promise<NarrationResult | undefined>;
  set(inputHash: string, result: NarrationResult): void | Promise<void>;
}

/** Default per-process in-memory cache. */
export class InMemoryNarrationCache implements NarrationCache {
  private readonly store = new Map<string, NarrationResult>();

  get(inputHash: string): NarrationResult | undefined {
    return this.store.get(inputHash);
  }

  set(inputHash: string, result: NarrationResult): void {
    this.store.set(inputHash, result);
  }

  /** Number of cached narrations (test/observability helper). */
  get size(): number {
    return this.store.size;
  }
}
