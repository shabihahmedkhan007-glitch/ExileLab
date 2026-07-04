/**
 * make-pob-code.ts — emit source (b) of the archetype-3-sources corpus: the SAME
 * Twister Huntress build as a-maxroll-native.json, encoded as a Path-of-Building
 * -style share code (url-safe base64 of a zlib-deflated XML document).
 *
 * SYNTHETIC: the PoB XML below is hand-authored to mirror build (a) — it is NOT a
 * real pobb.in / desktop-PoB2 export and was never fetched from anywhere. It only
 * has to be a valid, decodable share code that the PobCodeImporter can parse
 * (class, level, allocated nodes, items+slots, skills with a main group), so that
 * S6 can normalize source (a) and source (b) and confirm they describe one build.
 *
 * Uses the real encodePobCode helper + node:zlib deflateSync (task requirement).
 * No network. Run with:  pnpm exec tsx research/fixtures/scripts/make-pob-code.ts
 */

import { deflateSync } from "node:zlib";
import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { encodePobCode } from "../../../packages/build-normalizer/src/index.ts";

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = join(HERE, "..", "archetype-3-sources", "b-pob-share-code.txt");

// Same 100 allocated nodes as a-maxroll-native.json (source (a)).
const NODES = [1075, 1320, 1485, 1966, 2432, 3091, 4784, 5034, 8341, 8389, 9514, 11857, 12368, 12585, 12703, 14463, 15604, 15862, 16933, 16938, 17145, 17229, 17350, 17735, 18071, 19400, 19691, 19722, 20483, 21013, 21696, 21906, 22430, 24483, 25125, 26269, 28193, 28196, 28483, 28579, 29009, 30394, 30423, 30593, 31317, 31348, 31877, 33320, 35198, 35367, 35496, 36446, 37185, 39707, 40234, 40260, 41097, 41695, 41715, 43751, 44364, 44733, 45043, 47244, 47808, 48021, 48410, 48469, 49355, 49658, 49815, 50109, 50249, 50388, 50447, 50847, 51149, 52068, 53480, 54062, 55090, 55562, 56713, 56737, 56870, 56878, 57204, 57371, 58606, 59102, 59266, 59296, 59302, 59583, 60819, 60862, 61580, 61894, 63689, 63814];

/** One PoB <Item> element: id + free-text block (Rarity / name / base / mods). */
function item(id: number, name: string, base: string, rarity: string, mods: string[]): string {
  const text = [`Rarity: ${rarity}`, name, base, ...mods].join("\n");
  return `    <Item id="${id}">\n${text}\n    </Item>`;
}

// Item slots mirror source (a). PoB maps slot name -> item id via <Slot>.
const items: Array<{ id: number; slot: string; name: string; base: string; rarity: string; mods: string[] }> = [
  { id: 1, slot: "Weapon 1", name: "Whirlwind Lance", base: "Spear", rarity: "Rare", mods: ["Adds 32 to 58 Physical Damage", "+18% Attack Speed", "+120 to Accuracy Rating"] },
  { id: 2, slot: "Weapon 2", name: "Ironwood Buckler", base: "Buckler", rarity: "Rare", mods: ["+22% Block Chance", "+40 to maximum Life"] },
  { id: 3, slot: "Helmet", name: "Hunter Hood", base: "Leather Hood", rarity: "Rare", mods: ["+72 to maximum Life", "+38% to Cold Resistance"] },
  { id: 4, slot: "Body Armour", name: "Assassin's Garb", base: "Evasion Chest", rarity: "Rare", mods: ["+95 to maximum Life", "+44% to Fire Resistance", "+320 to Evasion Rating"] },
  { id: 5, slot: "Gloves", name: "Wrapped Mitts", base: "Evasion Gloves", rarity: "Rare", mods: ["+16% Attack Speed", "+31% to Lightning Resistance"] },
  { id: 6, slot: "Boots", name: "Stealth Boots", base: "Evasion Boots", rarity: "Rare", mods: ["+30% Movement Speed", "+64 to maximum Life"] },
  { id: 7, slot: "Belt", name: "Rugged Belt", base: "Heavy Belt", rarity: "Rare", mods: ["+88 to maximum Life", "+15% to Chaos Resistance"] },
  { id: 8, slot: "Amulet", name: "Stellar Amulet", base: "Amulet", rarity: "Rare", mods: ["+35 to all Attributes", "+22% Critical Damage Bonus", "+12% Attack Speed"] },
  { id: 9, slot: "Ring 1", name: "Topaz Ring", base: "Topaz Ring", rarity: "Rare", mods: ["+31% to Lightning Resistance", "+52 to maximum Life"] },
  { id: 10, slot: "Ring 2", name: "Two-Stone Ring", base: "Two-Stone Ring", rarity: "Rare", mods: ["+29% to Fire Resistance", "+27% to Cold Resistance"] },
];

const itemXml = items.map((it) => item(it.id, it.name, it.base, it.rarity, it.mods)).join("\n");
const slotXml = items.map((it) => `      <Slot name="${it.slot}" itemId="${it.id}"/>`).join("\n");

// mainSocketGroup="1" ⇒ the first <Skill> group is the main (Twister), matching (a).
const xml = `<?xml version="1.0" encoding="UTF-8"?>
<PathOfBuilding>
  <Build level="91" className="Huntress" ascendClassName="Amazon" mainSocketGroup="1">
    <PlayerStat stat="Life" value="3500"/>
  </Build>
  <Skills activeSkillSet="1">
    <SkillSet id="1">
      <Skill>
        <Gem nameSpec="Twister" skillId="Twister" level="20" quality="20"/>
        <Gem nameSpec="Scattershot" skillId="SupportScattershot" level="20" quality="0"/>
        <Gem nameSpec="Martial Tempo" skillId="SupportMartialTempo" level="20" quality="0"/>
        <Gem nameSpec="Primal Armament" skillId="SupportPrimalArmament" level="20" quality="0"/>
        <Gem nameSpec="Fork" skillId="SupportFork" level="20" quality="0"/>
      </Skill>
      <Skill>
        <Gem nameSpec="Herald of Thunder" skillId="HeraldOfThunder" level="20" quality="0"/>
      </Skill>
      <Skill>
        <Gem nameSpec="Grace" skillId="Grace" level="20" quality="0"/>
      </Skill>
      <Skill>
        <Gem nameSpec="Blink" skillId="Blink" level="14" quality="0"/>
      </Skill>
    </SkillSet>
  </Skills>
  <Tree activeSpec="1">
    <Spec title="Twister Mapping" nodes="${NODES.join(",")}">
      <URL>https://example.invalid/synthetic-tree</URL>
    </Spec>
  </Tree>
  <Items activeItemSet="1">
${itemXml}
    <ItemSet id="1">
${slotXml}
    </ItemSet>
  </Items>
</PathOfBuilding>`;

const code = encodePobCode(xml, (buf) => deflateSync(buf));

const header =
  "# SYNTHETIC PoB-style share code — source (b) of archetype-3-sources (Twister Huntress).\n" +
  "# Generated by research/fixtures/scripts/make-pob-code.ts (encodePobCode + node:zlib deflate).\n" +
  "# NOT a real pobb.in/PoB2 export; mirrors a-maxroll-native.json. The single line below IS the code.\n";
writeFileSync(OUT, header + code + "\n", "utf8");
console.log("wrote archetype-3-sources/b-pob-share-code.txt (", code.length, "chars )");
