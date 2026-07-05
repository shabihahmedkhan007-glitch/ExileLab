// A native ExileLab interchange (JSON) build fixture — a Twister Huntress
// speed-mapper. Used by the integration tests and available to the frontend as a
// deterministic "try it" payload. It is the ExileLab-owned format (no external
// platform involved), so importing it is fully compliant.

import type { NativeInterchange } from "@exilelab/build-normalizer";

export const TWISTER_HUNTRESS: NativeInterchange = {
  format: "exilelab-build",
  formatVersion: 1,
  gamePatch: "0.5",
  character: {
    className: "Huntress",
    ascendancyName: "Ritualist",
    level: 92,
  },
  loadouts: [
    {
      id: "main",
      name: "Mapping",
      primary: true,
      // Node ids chosen to spread across the mock engine's metric families.
      allocatedNodeIds: [16, 1, 2, 3, 4, 5, 6, 24, 10, 11],
      items: [
        {
          slot: "Weapon 1",
          name: "Storm's Edge",
          rarity: "rare",
          lines: ["Adds 40 to 90 Physical Damage", "35% increased Attack Speed"],
        },
        {
          slot: "Body Armour",
          name: "Guardian's Plate",
          rarity: "rare",
          lines: [
            "+120 to maximum Life",
            "+35% to Fire Resistance",
            "+220 to Evasion Rating",
          ],
        },
        {
          slot: "Boots",
          name: "Swiftstep Greaves",
          rarity: "rare",
          lines: ["30% increased Movement Speed", "+40 to maximum Life"],
        },
        {
          slot: "Ring 1",
          name: "Band of Warding",
          rarity: "rare",
          lines: ["+30% to Chaos Resistance", "+25% to Cold Resistance"],
        },
        {
          slot: "Amulet",
          name: "Sage's Pendant",
          rarity: "rare",
          lines: ["+18% increased Spell Damage"],
        },
      ],
      skills: [
        {
          id: "g1",
          isMain: true,
          gems: [
            { name: "Twister", skillId: "twister", level: 20, quality: 20 },
            { name: "Martial Tempo", skillId: "martial-tempo", level: 20 },
          ],
        },
      ],
      configuration: { enemyLevel: 84, bossFight: false },
      resources: { unreservedMana: 450 },
    },
  ],
  provenance: {
    reference: "pobb.in/example-twister",
    attribution: "Based on a community Twister Huntress speed-mapping guide",
  },
  metadata: {
    labels: ["League Start"],
    league: "Standard",
  },
};

/** The fixture serialized as a paste-box payload (what POST /import receives). */
export function twisterHuntressJson(): string {
  return JSON.stringify(TWISTER_HUNTRESS);
}

/**
 * A SECOND, distinct Twister Huntress — a boss-farming variant of the same
 * archetype. Different allocated nodes and gear (more damage, no chaos ring, an
 * extra support) so it has a DIFFERENT Canonical Identity and a non-empty diff
 * against {@link TWISTER_HUNTRESS}. Used by the Compare tests as the "public
 * build" the user compares against. Native ExileLab format — fully compliant.
 */
export const TWISTER_HUNTRESS_BOSS: NativeInterchange = {
  format: "exilelab-build",
  formatVersion: 1,
  gamePatch: "0.5",
  character: {
    className: "Huntress",
    ascendancyName: "Ritualist",
    level: 92,
  },
  loadouts: [
    {
      id: "main",
      name: "Bossing",
      primary: true,
      // Overlaps the base build on some nodes, diverges on others (diff has both
      // onlyInUser and onlyInOther members).
      allocatedNodeIds: [16, 1, 2, 3, 4, 40, 41, 42, 24, 10],
      items: [
        {
          slot: "Weapon 1",
          name: "Voidfang Spire",
          rarity: "rare",
          lines: [
            "Adds 80 to 140 Physical Damage",
            "45% increased Attack Speed",
            "30% increased Critical Hit Chance",
          ],
        },
        {
          slot: "Body Armour",
          name: "Bulwark of the Deep",
          rarity: "rare",
          lines: [
            "+160 to maximum Life",
            "+42% to Fire Resistance",
            "+38% to Chaos Resistance",
            "+300 to Armour",
          ],
        },
        {
          slot: "Boots",
          name: "Ironstride Sabatons",
          rarity: "rare",
          lines: ["20% increased Movement Speed", "+70 to maximum Life"],
        },
        {
          slot: "Amulet",
          name: "Choker of Ruin",
          rarity: "rare",
          lines: ["+28% increased Spell Damage", "+35 to maximum Life"],
        },
      ],
      skills: [
        {
          id: "g1",
          isMain: true,
          gems: [
            { name: "Twister", skillId: "twister", level: 20, quality: 20 },
            { name: "Martial Tempo", skillId: "martial-tempo", level: 20 },
            { name: "Brutality", skillId: "brutality", level: 20 },
          ],
        },
      ],
      configuration: { enemyLevel: 84, bossFight: true },
      resources: { unreservedMana: 450 },
    },
  ],
  provenance: {
    reference: "pobb.in/example-twister-boss",
    attribution: "Based on a community Twister Huntress boss-farming guide",
  },
  metadata: {
    labels: ["Boss Farming"],
    league: "Standard",
  },
};

/** The boss variant serialized as a paste-box payload. */
export function twisterHuntressBossJson(): string {
  return JSON.stringify(TWISTER_HUNTRESS_BOSS);
}
