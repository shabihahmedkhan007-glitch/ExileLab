// Content-hash of a NarrationInput, keyed to the model.
//
// Every narration is cached by content hash (trust contract item 5). We reuse
// core's deterministic canonicalizer so the hash is STABLE under object-key
// reordering (stableStringify sorts keys) — two structurally-identical inputs
// produce the same cache key regardless of how they were assembled.

import { sha256Hex, stableStringify } from '@exilelab/core';
import type { NarrationInput } from './types.js';

/** A NUL byte can never occur inside stableStringify's JSON, so it delimits (input, model) unambiguously. */
const SEPARATOR = String.fromCharCode(0);

/** inputHash = sha256(stableStringify(input) + NUL + model). */
export function computeInputHash(input: NarrationInput, model: string): string {
  return sha256Hex(stableStringify(input) + SEPARATOR + model);
}
