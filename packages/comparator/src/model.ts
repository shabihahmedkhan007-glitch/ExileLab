// Canonical build model contract for the Comparator — now sourced straight from
// @exilelab/core (RFC-0001 landed). There is no package-local mirror anymore.
//
// The Comparator emits candidate changes as core BuildMutations whose operation
// vocabulary is core's MutationOperation, so every candidate is promotable by
// core's promoteMutation — that is the whole contract (RFC-0001 AD-2). This module
// re-exports the canonical types/behaviour and adds one tiny helper the diff needs
// (primary Loadout Context selection), which core intentionally leaves to
// consumers (AD-5: "consumers must not assume exactly one exists").

import type { BuildSnapshot, LoadoutContext } from "@exilelab/core";

export type {
  BuildSnapshot,
  BuildState,
  BuildMutation,
  BuildMutationInput,
  MutationOperation,
  LoadoutContext,
  EquipmentItem,
  SkillSetup,
  ConfigEntry,
  Character,
  Provenance,
} from "@exilelab/core";

export {
  createBuildSnapshot,
  createBuildMutation,
  promoteMutation,
  computeBuildStateIdentity,
} from "@exilelab/core";

/**
 * Resolve the Loadout Context a consumer should operate on: the designated
 * primary, falling back to the first present. Returns undefined when a snapshot
 * carries no loadouts (RFC-0001 AD-5: never assume exactly one exists).
 */
export function getPrimaryLoadout(snapshot: BuildSnapshot): LoadoutContext | undefined {
  const loadouts = snapshot.buildState.loadoutContexts;
  return loadouts.find((l) => l.primary) ?? loadouts[0];
}
