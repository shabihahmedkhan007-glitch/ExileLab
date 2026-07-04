// A local, ExileLab-owned sample payload for the paste box's "try a sample"
// affordance (the native exilelab-build interchange format — no external
// platform involved, fully compliant). Mirrors backend/api/src/fixtures.ts.

export const SAMPLE_BUILD = JSON.stringify({
  format: "exilelab-build",
  formatVersion: 1,
  gamePatch: "0.5",
  character: { className: "Huntress", ascendancyName: "Ritualist", level: 92 },
  loadouts: [
    {
      id: "main",
      name: "Mapping",
      primary: true,
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
  metadata: { labels: ["League Start"], league: "Standard" },
});
