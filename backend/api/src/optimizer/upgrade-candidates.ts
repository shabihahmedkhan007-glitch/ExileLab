// Upgrade-candidate pool for the Upgrades surface (UX §4.5 "the shopping screen").
//
// The Upgrade Finder ranks GEAR changes by Δweighted-score per Divine, so its
// candidate pool is the gear-affecting subset of the tune generator's mutations
// plus a small panel of per-slot item-level variants. Each is a valid core
// BuildMutation (swapItem) against the base's primary loadout, so the
// EngineAdapter can evaluate it and the price layer can quote it. Deterministic
// and labelled v0 — the same posture as optimizer/candidates.ts.

import { createBuildMutation } from "@exilelab/core";
import type {
  BuildMutation,
  BuildSnapshot as CoreSnapshot,
  MutationOperation,
} from "@exilelab/core";
import { generateCandidates } from "./candidates.js";
import type { Candidate } from "./candidates.js";

/** A per-slot item-level upgrade variant (name + plausible rolled mods). */
const ITEM_VARIANTS: ReadonlyArray<{
  slot: string;
  itemRef: string;
  rarity: string;
  modifiers: string[];
  description: string;
}> = [
  {
    slot: "Boots",
    itemRef: "Windrunner Greaves",
    rarity: "rare",
    modifiers: ["35% increased Movement Speed", "+60 to maximum Life", "+28% to Cold Resistance"],
    description: "Upgrade your boots — more movement speed plus life and resists.",
  },
  {
    slot: "Gloves",
    itemRef: "Duelist's Gauntlets",
    rarity: "rare",
    modifiers: ["22% increased Attack Speed", "Adds 15 to 30 Physical Damage", "+45 to maximum Life"],
    description: "Upgrade your gloves — attack speed and added physical damage.",
  },
  {
    slot: "Ring 2",
    itemRef: "Circle of Sustenance",
    rarity: "rare",
    modifiers: ["+40% to Chaos Resistance", "+35% to Lightning Resistance", "+55 to maximum Mana"],
    description: "Add a resist/mana ring — shores up chaos and lightning coverage.",
  },
  {
    slot: "Amulet",
    itemRef: "Pendant of Precision",
    rarity: "rare",
    modifiers: [
      "+30% increased Global Critical Hit Chance",
      "24% increased Damage",
      "+50 to maximum Life",
    ],
    description: "Upgrade your amulet — a rounded damage and life boost.",
  },
];

/**
 * The gear-affecting upgrade pool for a base snapshot: the tune generator's
 * swapItem candidates plus the per-slot item-level variants above. Every mutation
 * targets the PRIMARY loadout and references the base by Canonical Identity (AD-2).
 */
export function generateUpgradeCandidates(base: CoreSnapshot): Candidate[] {
  const primary =
    base.buildState.loadoutContexts.find((l) => l.primary) ??
    base.buildState.loadoutContexts[0];
  if (primary === undefined) return [];
  const loadoutContextId = primary.contextId;

  // Gear-affecting subset of the tune generator (swapItem operations only).
  const fromTune = generateCandidates(base).filter((c) =>
    c.mutation.operations.some((op) => op.kind === "swapItem"),
  );

  const variants: Candidate[] = ITEM_VARIANTS.map((v) => {
    const op: MutationOperation = {
      kind: "swapItem",
      loadoutContextId,
      item: {
        slot: v.slot,
        itemRef: v.itemRef,
        rarity: v.rarity,
        modifiers: v.modifiers,
      },
    };
    const mutation: BuildMutation = createBuildMutation({
      baseSnapshotId: base.identity,
      operations: [op],
    });
    // costDivines here is a placeholder; the Upgrades route re-prices every
    // candidate through the PriceProvider seam (prices/index.ts).
    return { mutation, description: v.description, costDivines: 0 };
  });

  return [...fromTune, ...variants];
}
