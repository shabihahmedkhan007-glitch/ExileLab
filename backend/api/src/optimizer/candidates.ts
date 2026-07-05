// Candidate generator (v0).
//
// The Upgrade Planner will eventually generate BuildMutations from a real search
// over tree paths, gear, and gem links (RFC-0001 §8.2, future BuildMutation RFC).
// This v0 samples a small, FIXED, deterministic panel of representative changes —
// a few passive allocations that each emphasize one Preference Axis, plus two
// gear swaps (one glass-cannon, one premium weapon) that trade axes against each
// other and carry a Divine cost. It is intentionally simple and labelled v0; its
// only contract is: deterministic, valid mutations against the given base.

import { createBuildMutation } from "@exilelab/core";
import type {
  BuildMutation,
  BuildSnapshot as CoreSnapshot,
  MutationOperation,
} from "@exilelab/core";

/** A generated candidate: the mutation plus display metadata for the UI (UX §4.2). */
export interface Candidate {
  mutation: BuildMutation;
  /** Human-readable, coach-voice change description (never shames — UX §9). */
  description: string;
}
// NOTE: candidates carry NO price. Pricing happens exclusively through the
// PriceProvider seam (src/prices/) so every cost shown or scored is subject to
// the kill-switch and the synthetic-price disclaimer — a hardcoded Divine
// figure here would be an invented number influencing the Weighted Score.

/** Node ids chosen so (id mod 8) targets a specific metric family in MockEngine. */
const AXIS_NODES: ReadonlyArray<{ nodeId: number; description: string }> = [
  { nodeId: 800, description: "Allocate a damage passive cluster (raw DPS)." },
  { nodeId: 801, description: "Allocate a life/defence passive (effective HP)." },
  { nodeId: 802, description: "Allocate a movement-speed passive." },
  { nodeId: 803, description: "Allocate an attack-speed passive." },
  { nodeId: 806, description: "Allocate a mana-sustain passive." },
];

/**
 * Generate the v0 candidate panel for a base snapshot. Every mutation references
 * the base by its Canonical Identity (AD-2) and targets the PRIMARY loadout.
 */
export function generateCandidates(base: CoreSnapshot): Candidate[] {
  const primary =
    base.buildState.loadoutContexts.find((l) => l.primary) ??
    base.buildState.loadoutContexts[0];
  if (primary === undefined) return [];
  const loadoutContextId = primary.contextId;
  const allocated = new Set(primary.passiveTree.allocatedNodes);

  const candidates: Candidate[] = [];

  for (const { nodeId, description } of AXIS_NODES) {
    if (allocated.has(nodeId)) continue;
    candidates.push(
      makeCandidate(
        base.identity,
        [{ kind: "allocatePassiveNode", loadoutContextId, nodeId }],
        description,
      ),
    );
  }

  // Glass-cannon swap: a big-damage chest, paid for by respeccing defensive
  // passives into it — exercises the belowFloor cut under survivability-floored
  // presets. NOTE (v0 engine model): the engine-adapter MockEngine derives EHP
  // from allocated defensive nodes + equipped gear, and does NOT parse per-mod
  // strings like "60% reduced maximum Life". So the survivability sacrifice is
  // expressed STRUCTURALLY — the offensive chest plus deallocating a cluster of
  // defensive passives — which the mock reflects as a genuine EHP drop below the
  // hardcore floor. When the real PoB2 sidecar lands (engine-adapter, ADR-001) the
  // life-reduction mod is parsed directly and this structural stand-in is no longer
  // needed. The respecced nodes are drawn from the build's own allocated set.
  const bodySlot = primary.equipment.find((e) => /body|chest|armour/i.test(e.slot));
  const defensiveRespec = primary.passiveTree.allocatedNodes.slice(0, 5);
  candidates.push(
    makeCandidate(
      base.identity,
      [
        {
          kind: "swapItem",
          loadoutContextId,
          item: {
            slot: bodySlot?.slot ?? "Body Armour",
            itemRef: "Carnage Heart (glass-cannon chest)",
            rarity: "unique",
            modifiers: [
              "250% increased Physical Damage",
              "60% reduced maximum Life",
            ],
          },
        },
        ...defensiveRespec.map(
          (nodeId): MutationOperation => ({
            kind: "deallocatePassiveNode",
            loadoutContextId,
            nodeId,
          }),
        ),
      ],
      "Swap to a glass-cannon chest — large damage gain, but it cuts your Life.",
    ),
  );

  // Premium weapon upgrade: strong damage, expensive (Currency Efficiency penalty
  // under budget-weighted presets).
  const weaponSlot = primary.equipment.find((e) => /weapon|bow|wand|staff/i.test(e.slot));
  candidates.push(
    makeCandidate(
      base.identity,
      [
        {
          kind: "swapItem",
          loadoutContextId,
          item: {
            slot: weaponSlot?.slot ?? "Weapon 1",
            itemRef: "Top-tier rare weapon",
            rarity: "rare",
            modifiers: [
              "Adds 120 to 260 Physical Damage",
              "60% increased Attack Speed",
              "25% increased Critical Hit Chance",
              "40% increased Damage",
            ],
          },
        },
      ],
      "Upgrade to a top-tier weapon — a big damage jump at a premium price.",
    ),
  );

  return candidates;
}

function makeCandidate(
  baseSnapshotId: string,
  operations: MutationOperation[],
  description: string,
): Candidate {
  return {
    mutation: createBuildMutation({ baseSnapshotId, operations }),
    description,
  };
}
