// @exilelab/core — canonicalization + Canonical Identity (RFC-0001 I2, risk R4).
//
// Canonicalization is a first-class responsibility (I2): identical canonical
// build state MUST yield identical identity regardless of source, import time,
// key ordering, or the ordering of any order-insensitive array.
//
// CANONICALIZATION RULES (documented contract):
//   1. Build state ONLY. Metadata and DisplayCache never enter the hash (I2).
//   2. Order-insensitive arrays are normalized to a deterministic order before
//      hashing (see normalizeBuildState): loadout contexts by contextId;
//      allocated nodes ascending; mastery effects by (nodeId, effectId);
//      equipment by slot and each item's modifiers lexically; skills by setupId
//      and each setup's supports lexically; configuration by key; assumptions by
//      (path, origin) — though assumptions are EXCLUDED from identity (rule 6).
//      Operation/loadout *semantics* that depend on order are
//      NOT normalized (there are none in build state — mutation operation order
//      is handled separately in mutation identity).
//   3. Object keys are sorted recursively; `undefined` values are dropped so an
//      absent optional and an explicit `undefined` hash identically.
//   4. Non-finite numbers are rejected (they cannot round-trip deterministically).
//   5. The identity is the lowercase sha256 hex digest of the UTF-8 canonical
//      JSON string.
//   6. Assumptions do NOT participate in identity: RFC-0001 §5.3 classifies
//      them as snapshot context (about the import, not the build), so the same
//      build state with different fidelity annotations hashes identically (I2).

import { createHash } from 'node:crypto';
import type { BuildState } from './types.js';

function cmpStr(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

/**
 * Deterministic JSON serialization with recursively sorted object keys and
 * dropped `undefined` values. Array order is PRESERVED (callers normalize
 * order-insensitive arrays first).
 */
export function stableStringify(value: unknown): string {
  if (value === null) return 'null';
  const t = typeof value;
  if (t === 'string' || t === 'boolean') return JSON.stringify(value);
  if (t === 'number') {
    if (!Number.isFinite(value as number)) {
      throw new Error('Cannot canonicalize a non-finite number in build state');
    }
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    const parts = value.map((v) => stableStringify(v === undefined ? null : v));
    return `[${parts.join(',')}]`;
  }
  if (t === 'object') {
    const obj = value as Record<string, unknown>;
    const keys = Object.keys(obj)
      .filter((k) => obj[k] !== undefined)
      .sort(cmpStr);
    const parts = keys.map((k) => `${JSON.stringify(k)}:${stableStringify(obj[k])}`);
    return `{${parts.join(',')}}`;
  }
  throw new Error(`Cannot canonicalize value of type ${t}`);
}

/** Lowercase sha256 hex digest of a UTF-8 string. */
export function sha256Hex(input: string): string {
  return createHash('sha256').update(input, 'utf8').digest('hex');
}

/**
 * Produce a normalized deep copy of build state with every order-insensitive
 * array sorted into canonical order. Operates on a structuredClone so a frozen
 * (immutable) input snapshot is never mutated (I1).
 */
export function normalizeBuildState(buildState: BuildState): BuildState {
  const bs = structuredClone(buildState) as {
    character: BuildState['character'];
    loadoutContexts: Array<{
      contextId: string;
      primary: boolean;
      passiveTree: { allocatedNodes: number[]; masteryEffects: Array<{ nodeId: number; effectId: number }> };
      equipment: Array<{ slot: string; itemRef: string | null; rarity: string | null; modifiers: string[] }>;
      skills: Array<{ setupId: string; isMainSkill: boolean; skillGemRef: string | null; socket: string | null; supports: string[] }>;
    }>;
    configuration: Array<{ key: string; value: string | number | boolean }>;
    assumptions: Array<{ path: string; origin: string; note?: string }>;
  };

  bs.configuration.sort((a, b) => cmpStr(a.key, b.key));
  bs.assumptions.sort((a, b) => cmpStr(a.path, b.path) || cmpStr(a.origin, b.origin));
  bs.loadoutContexts.sort((a, b) => cmpStr(a.contextId, b.contextId));

  for (const lc of bs.loadoutContexts) {
    lc.passiveTree.allocatedNodes.sort((a, b) => a - b);
    lc.passiveTree.masteryEffects.sort((a, b) => a.nodeId - b.nodeId || a.effectId - b.effectId);
    lc.equipment.sort((a, b) => cmpStr(a.slot, b.slot));
    for (const item of lc.equipment) item.modifiers.sort(cmpStr);
    lc.skills.sort((a, b) => cmpStr(a.setupId, b.setupId));
    for (const setup of lc.skills) setup.supports.sort(cmpStr);
  }

  return bs as BuildState;
}

/**
 * Canonical Identity of a build state (RFC-0001 I2): the sha256 hex of its
 * canonical serialization. Metadata and DisplayCache are excluded by
 * construction — this function only ever sees build state — and Assumptions
 * are excluded here: RFC-0001 §5.3 classifies them as snapshot context (facts
 * about the IMPORT, not the build). Identical build state imported through
 * different sources (different assumption origins) MUST yield the same
 * identity (I2).
 */
export function computeBuildStateIdentity(buildState: BuildState): string {
  const normalized = normalizeBuildState(buildState);
  const { assumptions: _assumptions, ...identityBearing } = normalized as BuildState & {
    assumptions: unknown;
  };
  return sha256Hex(stableStringify(identityBearing));
}
