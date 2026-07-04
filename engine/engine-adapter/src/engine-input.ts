// @exilelab/engine-adapter — the explicit translation layer (RFC-0001 AD-6 / §5.2).
//
// The canonical BuildSnapshot NEVER depends on the engine's document format.
// This module defines the engine-SIDE input type (`EngineBuildInput`) separately
// and maps a canonical snapshot into it. When the real PoB2 LuaJIT sidecar lands
// (ADR-001), this is the seam it slots behind: the sidecar consumes an
// `EngineBuildInput`, not a `BuildSnapshot`, so the canonical model stays
// independent of PoB's document shape and the conformance suite holds the
// translation honest.

import type { BuildSnapshot, LoadoutContext } from '@exilelab/core';

/** One equipped item as the engine consumes it (mod text preserved for calc). */
export interface EngineItem {
  readonly slot: string;
  /** Game-data reference for the base/unique item, or null for an empty slot. */
  readonly itemRef: string | null;
  readonly rarity: string | null;
  /** Rolled modifier lines the engine parses into stats. */
  readonly modifiers: readonly string[];
}

/** One skill/support group as the engine consumes it. */
export interface EngineSkillGroup {
  /** True for the build's designated main skill. */
  readonly isMain: boolean;
  /** Active skill gem reference, or null for an empty group. */
  readonly skillGemRef: string | null;
  /** Linked support gem references. */
  readonly supports: readonly string[];
}

/** One Loadout Context flattened for the engine (weapon-set + tree config). */
export interface EngineLoadout {
  readonly id: string;
  /** True for the loadout the engine calculates by default (the primary). */
  readonly isActive: boolean;
  /** Allocated passive node ids. */
  readonly allocatedNodes: readonly number[];
  /** Number of chosen mastery effects. */
  readonly masteryCount: number;
  readonly items: readonly EngineItem[];
  readonly skillGroups: readonly EngineSkillGroup[];
}

/**
 * What the calculation engine consumes — ExileLab's engine-side input contract,
 * deliberately distinct from `BuildSnapshot`. It drops everything the engine
 * does not need (Canonical Identity, Metadata, Provenance, Assumptions,
 * DisplayCache), flattens `configuration` into a map, and marks the active
 * Loadout Context. A real PoB2 adapter would render this into PoB's build table;
 * the MockEngine derives plausible stats from it.
 */
export interface EngineBuildInput {
  /** The canonical snapshot identity this input was translated from (traceability only). */
  readonly sourceSnapshotId: string;
  /** Game patch the referenced game data belongs to (I5/I6). */
  readonly patchVersion: string;
  readonly character: {
    readonly className: string;
    readonly ascendancy: string | null;
    readonly level: number;
  };
  /** The Loadout Context the engine calculates by default (primary, or first). */
  readonly activeLoadout: EngineLoadout;
  /** All Loadout Contexts (AD-5); consumers must not assume exactly one. */
  readonly loadouts: readonly EngineLoadout[];
  /** Calculation-context configuration, flattened from the canonical array. */
  readonly config: Readonly<Record<string, string | number | boolean>>;
}

function translateLoadout(lc: LoadoutContext, active: boolean): EngineLoadout {
  return {
    id: lc.contextId,
    isActive: active,
    allocatedNodes: [...lc.passiveTree.allocatedNodes],
    masteryCount: lc.passiveTree.masteryEffects.length,
    items: lc.equipment.map((e) => ({
      slot: e.slot,
      itemRef: e.itemRef,
      rarity: e.rarity,
      modifiers: [...e.modifiers],
    })),
    skillGroups: lc.skills.map((s) => ({
      isMain: s.isMainSkill,
      skillGemRef: s.skillGemRef,
      supports: [...s.supports],
    })),
  };
}

/**
 * Translate a canonical {@link BuildSnapshot} into the engine-side
 * {@link EngineBuildInput} (RFC-0001 AD-6). Pure and deterministic: the same
 * snapshot always produces the same input. The primary Loadout Context becomes
 * the active loadout (falling back to the first if none is flagged — schema
 * guarantees exactly one primary, but consumers must not assume it, AD-5).
 */
export function translateSnapshot(snapshot: BuildSnapshot): EngineBuildInput {
  const contexts = snapshot.buildState.loadoutContexts;
  const primary = contexts.find((c) => c.primary) ?? contexts[0];

  const config: Record<string, string | number | boolean> = {};
  for (const entry of snapshot.buildState.configuration) {
    config[entry.key] = entry.value;
  }

  return {
    sourceSnapshotId: snapshot.identity,
    patchVersion: snapshot.metadata.patchVersion,
    character: {
      className: snapshot.buildState.character.class,
      ascendancy: snapshot.buildState.character.ascendancy,
      level: snapshot.buildState.character.level,
    },
    activeLoadout: translateLoadout(
      primary!,
      true,
    ),
    loadouts: contexts.map((c) => translateLoadout(c, c === primary)),
    config,
  };
}
