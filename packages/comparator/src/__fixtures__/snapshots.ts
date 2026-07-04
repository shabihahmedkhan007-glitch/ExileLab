// Deterministic fixture snapshots for golden diff tests. Two versions of one
// archetype ("Twister Huntress" speed-mapper) plus variants used to exercise
// consensus. Built through @exilelab/core's createBuildSnapshot — build-state only
// (RFC-0001 AD-7), core Canonical Identity, immutable/frozen.

import type { BuildSnapshot } from "../model.js";
import { createBuildSnapshot } from "../model.js";

interface Overrides {
  nodes: number[];
  bodyMods: string[];
  weaponSupports: string[];
  config: Record<string, string | number | boolean>;
}

function base(
  source: string,
  reference: string | undefined,
  attribution: string | undefined,
  overrides: Overrides,
): BuildSnapshot {
  return createBuildSnapshot({
    buildState: {
      character: { class: "Huntress", ascendancy: "Ritualist", level: 92 },
      loadoutContexts: [
        {
          contextId: "primary",
          primary: true,
          passiveTree: { allocatedNodes: overrides.nodes, masteryEffects: [] },
          equipment: [
            {
              slot: "weapon1",
              itemRef: "Spine Spear",
              rarity: "rare",
              modifiers: ["Adds 20 Physical Damage", "25% increased Attack Speed"],
            },
            { slot: "body", itemRef: "Astral Plate", rarity: "rare", modifiers: overrides.bodyMods },
          ],
          skills: [
            {
              setupId: "weapon1",
              isMainSkill: true,
              skillGemRef: "Whirling Assault",
              socket: null,
              supports: overrides.weaponSupports,
            },
            { setupId: "boots", isMainSkill: false, skillGemRef: "Herald of Ash", socket: null, supports: [] },
          ],
        },
      ],
      configuration: Object.entries(overrides.config).map(([key, value]) => ({ key, value })),
      assumptions: [],
    },
    metadata: {
      patchVersion: "0.1.0",
      formatVersion: "1",
      provenance: {
        source,
        importedAt: "2026-01-01T00:00:00.000Z",
        ...(reference !== undefined ? { reference } : {}),
        ...(attribution !== undefined ? { attribution } : {}),
      },
    },
    displayCache: { names: {}, icons: {} },
  });
}

/** The user's build. */
export const userBuild: BuildSnapshot = base("user", undefined, "My Twister Huntress", {
  nodes: [101, 102, 103, 200, 201],
  bodyMods: ["+80 to maximum Life", "30% increased Armour"],
  weaponSupports: ["Martial Tempo", "Primal Armament"],
  config: { enemyLevel: 84, shockedEnemy: false },
});

/** Maxroll's version of the same archetype: extra crit cluster, better body, adds Ancestral Urgency. */
export const maxrollBuild: BuildSnapshot = base("maxroll", "twister-huntress", "Maxroll Twister", {
  nodes: [101, 102, 103, 200, 300, 301], // drops 201, adds 300, 301
  bodyMods: ["+80 to maximum Life", "30% increased Armour", "+25% to Fire Resistance"],
  weaponSupports: ["Martial Tempo", "Ancestral Urgency"], // swaps Primal Armament → Ancestral Urgency
  config: { enemyLevel: 84, shockedEnemy: true }, // shockedEnemy flipped
});

/** Mobalytics version: diverges only in its own unique node — shares none of Maxroll/ninja's changes. */
export const mobalyticsBuild: BuildSnapshot = base("mobalytics", "twister", "Mobalytics Twister", {
  nodes: [101, 102, 103, 200, 201, 500], // user's nodes + one unique node
  bodyMods: ["+80 to maximum Life", "30% increased Armour"], // same as user
  weaponSupports: ["Martial Tempo", "Primal Armament"], // same as user
  config: { enemyLevel: 84, shockedEnemy: false }, // same as user
});

/** poe.ninja top-player version: shares the crit cluster + skill swap with Maxroll (consensus). */
export const ninjaBuild: BuildSnapshot = base("poe.ninja", "char/TopPlayer", "poe.ninja #1", {
  nodes: [101, 102, 103, 200, 300, 301, 400], // shares 300/301, drops 201, adds unique 400
  bodyMods: ["+80 to maximum Life", "30% increased Armour"], // same body as user
  weaponSupports: ["Martial Tempo", "Ancestral Urgency"], // same skill swap as Maxroll
  config: { enemyLevel: 84, shockedEnemy: false }, // same as user
});
