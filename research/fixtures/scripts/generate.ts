/**
 * generate.ts — deterministic generator for the ExileLab SYNTHETIC fixture corpus.
 *
 * WHAT THIS IS: a reproducible builder for the benchmark-builds/ and import-corpus/
 * fixtures. Every value here is INVENTED for testing — no real player data, no
 * network fetch, nothing scraped from Maxroll/poe.ninja/pobb.in/GGG. Item names,
 * mods, node ids and gem levels are game-PLAUSIBLE placeholders, not real PoE2 data.
 *
 * Output is the ExileLab native-JSON interchange format (see
 * packages/build-normalizer/src/importers/native-json.ts). Run with:
 *     pnpm exec tsx research/fixtures/scripts/generate.ts
 * Re-running is idempotent: the same seed produces byte-identical files.
 *
 * The archetype-3-sources/ corpus (Twister Huntress) is produced by
 * make-pob-code.ts + the checked-in a/c native files, not here.
 */

import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const FIXTURES = join(HERE, "..");
const GAME_PATCH = "poe2-0.3.0"; // synthetic target patch for the whole corpus

// --- Deterministic PRNG (mulberry32) so node lists are stable across runs ----
function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A plausible allocated-node id list: `count` unique ids in [1000, 65000), sorted. */
function nodes(seed: number, count: number): number[] {
  const r = rng(seed);
  const set = new Set<number>();
  while (set.size < count) set.add(1000 + Math.floor(r() * 64000));
  return [...set].sort((x, y) => x - y);
}

// --- Native-JSON typed helpers (shape mirrors nativeInterchangeSchema) --------
type Gem = { name: string; skillId?: string; level?: number; quality?: number };
type SkillGroup = { id?: string; isMain?: boolean; gems?: Gem[] };
type Item = { id?: string; slot: string; name: string; rarity?: string; lines?: string[] };
type Loadout = {
  id?: string;
  name?: string;
  primary?: boolean;
  allocatedNodeIds?: number[];
  items?: Item[];
  skills?: SkillGroup[];
  configuration?: Record<string, string | number | boolean>;
  resources?: Record<string, string | number | boolean>;
};
type NativeBuild = {
  format: "exilelab-build";
  formatVersion: number;
  gamePatch: string;
  character: { className: string; ascendancyName?: string; level: number };
  loadouts: Loadout[];
  provenance?: { reference?: string; attribution?: string };
  metadata?: { labels?: string[]; league?: string };
};

const SYNTH = "SYNTHETIC-FIXTURE"; // stamped into every file's labels + attribution

function build(partial: Omit<NativeBuild, "format" | "formatVersion" | "gamePatch">): NativeBuild {
  const labels = partial.metadata?.labels ?? [];
  return {
    format: "exilelab-build",
    formatVersion: 1,
    gamePatch: GAME_PATCH,
    ...partial,
    provenance: {
      attribution: SYNTH,
      ...partial.provenance,
    },
    metadata: {
      league: "Synthetic League",
      ...partial.metadata,
      labels: labels.includes(SYNTH) ? labels : [SYNTH, ...labels],
    },
  };
}

// A reusable "full gear" set. `k` seeds unique-ish names so builds don't collide.
function fullGear(k: string, defense: "armour" | "es" | "evasion" = "armour"): Item[] {
  const base =
    defense === "es"
      ? { helm: "Hubris Circlet", body: "Vaal Regalia", glove: "Sorcerer Gloves", boot: "Arcanist Slippers" }
      : defense === "evasion"
        ? { helm: "Hunter Hood", body: "Assassin's Garb", glove: "Wrapped Mitts", boot: "Stealth Boots" }
        : { helm: "Barbute Helmet", body: "Glorious Plate", glove: "Gauntlets", boot: "Greaves" };
  const resLine = defense === "es" ? "+18% to Energy Shield" : "+80 to maximum Life";
  return [
    { id: `${k}-w1`, slot: "Weapon 1", name: `${k} Warmonger`, rarity: "Rare", lines: ["Adds 20 to 40 Physical Damage", "+12% Attack Speed"] },
    { id: `${k}-w2`, slot: "Weapon 2", name: `${k} Bulwark`, rarity: "Rare", lines: ["+320 to Armour", "+30% Block Chance"] },
    { id: `${k}-helm`, slot: "Helmet", name: base.helm, rarity: "Rare", lines: [resLine, "+35% to Cold Resistance"] },
    { id: `${k}-body`, slot: "Body Armour", name: base.body, rarity: "Rare", lines: [resLine, "+42% to Fire Resistance"] },
    { id: `${k}-glove`, slot: "Gloves", name: base.glove, rarity: "Rare", lines: ["+15% Attack Speed", "+28% to Lightning Resistance"] },
    { id: `${k}-boot`, slot: "Boots", name: base.boot, rarity: "Rare", lines: ["+25% Movement Speed", "+60 to maximum Life"] },
    { id: `${k}-belt`, slot: "Belt", name: "Heavy Belt", rarity: "Rare", lines: ["+90 to maximum Life", "+18% to Chaos Resistance"] },
    { id: `${k}-amu`, slot: "Amulet", name: "Stellar Amulet", rarity: "Rare", lines: ["+40 to all Attributes", "+18% Critical Damage Bonus"] },
    { id: `${k}-r1`, slot: "Ring 1", name: "Sapphire Ring", rarity: "Rare", lines: ["+30% to Cold Resistance", "+55 to maximum Life"] },
    { id: `${k}-r2`, slot: "Ring 2", name: "Ruby Ring", rarity: "Rare", lines: ["+30% to Fire Resistance", "+12 to Strength"] },
  ];
}

// --- Benchmark trio (PRD §9.3: melee / minion / DoT) -------------------------

const meleeAttacker: NativeBuild = build({
  character: { className: "Warrior", ascendancyName: "Titan", level: 94 },
  loadouts: [
    {
      id: "main",
      name: "Slam Set",
      primary: true,
      allocatedNodeIds: nodes(101, 112),
      items: fullGear("Mace", "armour"),
      skills: [
        {
          id: "sg-main",
          isMain: true,
          gems: [
            { name: "Boneshatter", skillId: "Boneshatter", level: 20, quality: 20 },
            { name: "Melee Physical Damage", skillId: "SupportMeleePhysical", level: 20, quality: 20 },
            { name: "Brutality", skillId: "SupportBrutality", level: 20, quality: 0 },
            { name: "Fist of War", skillId: "SupportFistOfWar", level: 20, quality: 0 },
            { name: "Rage", skillId: "SupportRage", level: 20, quality: 0 },
          ],
        },
        {
          id: "sg-secondary",
          gems: [{ name: "Hammer of the Gods", skillId: "HammerOfTheGods", level: 20, quality: 0 }],
        },
        {
          id: "sg-move",
          gems: [{ name: "Leap Slam", skillId: "LeapSlam", level: 12, quality: 0 }],
        },
        {
          id: "sg-buffs",
          gems: [
            { name: "Herald of Ash", skillId: "HeraldOfAsh", level: 20, quality: 0 },
            { name: "War Banner", skillId: "WarBanner", level: 20, quality: 0 },
          ],
        },
      ],
      configuration: { enemyIsBoss: true, useFistOfWar: true, rageStacks: 30 },
      resources: { spirit: 100, spiritReserved: 60, life: 4800, mana: 120 },
    },
  ],
  provenance: { reference: "synthetic/melee-attacker" },
  metadata: { labels: ["benchmark", "melee", "attack"] },
});

const minionBuild: NativeBuild = build({
  character: { className: "Witch", ascendancyName: "Infernalist", level: 93 },
  loadouts: [
    {
      id: "main",
      name: "Skeleton Army",
      primary: true,
      allocatedNodeIds: nodes(202, 108),
      items: fullGear("Bone", "es"),
      skills: [
        {
          id: "sg-main",
          isMain: true,
          gems: [
            { name: "Summon Skeletal Warriors", skillId: "SummonSkeletalWarriors", level: 20, quality: 20 },
            { name: "Minion Damage", skillId: "SupportMinionDamage", level: 20, quality: 20 },
            { name: "Melee Physical Damage", skillId: "SupportMeleePhysical", level: 20, quality: 0 },
            { name: "Feeding Frenzy", skillId: "SupportFeedingFrenzy", level: 20, quality: 0 },
            { name: "Minion Instability", skillId: "SupportMinionInstability", level: 20, quality: 0 },
          ],
        },
        {
          id: "sg-snipers",
          gems: [
            { name: "Summon Skeletal Snipers", skillId: "SummonSkeletalSnipers", level: 20, quality: 0 },
            { name: "Elemental Army", skillId: "SupportElementalArmy", level: 20, quality: 0 },
          ],
        },
        {
          id: "sg-reaper",
          gems: [{ name: "Summon Reaper", skillId: "SummonReaper", level: 20, quality: 0 }],
        },
        {
          id: "sg-curse",
          gems: [{ name: "Despair", skillId: "Despair", level: 20, quality: 0 }],
        },
        {
          id: "sg-buffs",
          gems: [
            { name: "Grim Feast", skillId: "GrimFeast", level: 20, quality: 0 },
            { name: "Clarity", skillId: "Clarity", level: 20, quality: 0 },
          ],
        },
      ],
      configuration: { enemyIsBoss: true, minionCount: 12, aliveMinions: true },
      resources: { spirit: 200, spiritReserved: 180, energyShield: 3200, mana: 90 },
    },
  ],
  provenance: { reference: "synthetic/minion-build" },
  metadata: { labels: ["benchmark", "minion", "summoner"] },
});

const dotCaster: NativeBuild = build({
  character: { className: "Witch", ascendancyName: "Blood Mage", level: 92 },
  loadouts: [
    {
      id: "main",
      name: "Chaos DoT",
      primary: true,
      allocatedNodeIds: nodes(303, 104),
      items: fullGear("Wither", "es"),
      skills: [
        {
          id: "sg-main",
          isMain: true,
          gems: [
            { name: "Essence Drain", skillId: "EssenceDrain", level: 20, quality: 20 },
            { name: "Swift Affliction", skillId: "SupportSwiftAffliction", level: 20, quality: 20 },
            { name: "Deadly Poison", skillId: "SupportDeadlyPoison", level: 20, quality: 0 },
            { name: "Void Manipulation", skillId: "SupportVoidManipulation", level: 20, quality: 0 },
            { name: "Controlled Destruction", skillId: "SupportControlledDestruction", level: 20, quality: 0 },
          ],
        },
        {
          id: "sg-contagion",
          gems: [
            { name: "Contagion", skillId: "Contagion", level: 20, quality: 20 },
            { name: "Increased Duration", skillId: "SupportIncreasedDuration", level: 20, quality: 0 },
          ],
        },
        {
          id: "sg-move",
          gems: [{ name: "Blink", skillId: "Blink", level: 12, quality: 0 }],
        },
        {
          id: "sg-buffs",
          gems: [
            { name: "Malevolence", skillId: "Malevolence", level: 20, quality: 0 },
            { name: "Despair", skillId: "Despair", level: 20, quality: 0 },
          ],
        },
      ],
      configuration: { enemyIsBoss: true, wearsOffAfter: false, contagionSpread: true },
      resources: { spirit: 150, spiritReserved: 120, energyShield: 4100, mana: 60 },
    },
  ],
  provenance: { reference: "synthetic/dot-caster" },
  metadata: { labels: ["benchmark", "dot", "chaos", "caster"] },
});

// --- Import corpus: 20 varied characters + edge cases ------------------------

type CorpusEntry = { file: string; edgeCase: string; description: string; build: NativeBuild };

function corpus(): CorpusEntry[] {
  const e: CorpusEntry[] = [];
  const add = (file: string, edgeCase: string, description: string, b: NativeBuild) =>
    e.push({ file, edgeCase, description, build: b });

  // 01 — canonical happy path (fully specified attack build)
  add("char-01-happy-path.json", "none (control)", "Fully specified attack build; every field present.",
    build({
      character: { className: "Ranger", ascendancyName: "Deadeye", level: 90 },
      loadouts: [{
        id: "main", primary: true, allocatedNodeIds: nodes(1, 105), items: fullGear("Bow", "evasion"),
        skills: [{ id: "sg", isMain: true, gems: [
          { name: "Lightning Arrow", skillId: "LightningArrow", level: 20, quality: 20 },
          { name: "Added Cold Damage", skillId: "SupportAddedCold", level: 20, quality: 0 },
          { name: "Martial Tempo", skillId: "SupportMartialTempo", level: 20, quality: 0 },
        ] }],
        configuration: { enemyIsBoss: false }, resources: { spirit: 100, life: 3600 },
      }],
    }));

  // 02 — NO main skill flagged (S3 heuristic must pick one)
  add("char-02-no-main-skill.json", "no main skill flagged", "Two skill groups, neither isMain=true. Heuristic must infer the main.",
    build({
      character: { className: "Monk", ascendancyName: "Invoker", level: 84 },
      loadouts: [{
        id: "main", primary: true, allocatedNodeIds: nodes(2, 96), items: fullGear("Quarterstaff", "evasion"),
        skills: [
          { id: "sg-a", gems: [{ name: "Falling Thunder", skillId: "FallingThunder", level: 18 }] },
          { id: "sg-b", gems: [{ name: "Tempest Bell", skillId: "TempestBell", level: 18 }] },
        ],
      }],
    }));

  // 03 — empty gear slots (no items at all)
  add("char-03-empty-gear.json", "empty gear", "Naked character: loadout has no items array. Config defaults must not crash.",
    build({
      character: { className: "Sorceress", ascendancyName: "Stormweaver", level: 72 },
      loadouts: [{ id: "main", primary: true, allocatedNodeIds: nodes(3, 78),
        skills: [{ id: "sg", isMain: true, gems: [{ name: "Spark", skillId: "Spark", level: 16 }] }] }],
    }));

  // 04 — multi-loadout (weapon-set swap), no explicit primary
  add("char-04-multi-loadout.json", "multi-loadout, no primary flag", "Two loadouts (bow set / melee set), neither flagged primary. Normalizer must pick exactly one.",
    build({
      character: { className: "Huntress", ascendancyName: "Amazon", level: 88 },
      loadouts: [
        { id: "set-a-spear", allocatedNodeIds: nodes(41, 100), items: fullGear("Spear", "evasion"),
          skills: [{ id: "sg", isMain: true, gems: [{ name: "Lightning Spear", skillId: "LightningSpear", level: 20 }] }] },
        { id: "set-b-bow", allocatedNodeIds: nodes(42, 100), items: fullGear("Bow", "evasion"),
          skills: [{ id: "sg", isMain: true, gems: [{ name: "Rain of Arrows", skillId: "RainOfArrows", level: 20 }] }] },
      ],
    }));

  // 05 — spirit-heavy (many reserved auras/heralds)
  add("char-05-spirit-heavy.json", "spirit-heavy", "Five persistent buffs reserving nearly all Spirit — tests resource/spirit handling.",
    build({
      character: { className: "Warrior", ascendancyName: "Warbringer", level: 91 },
      loadouts: [{
        id: "main", primary: true, allocatedNodeIds: nodes(5, 110), items: fullGear("Totem", "armour"),
        skills: [
          { id: "sg-main", isMain: true, gems: [{ name: "Sunder", skillId: "Sunder", level: 20, quality: 20 }] },
          { id: "sg-h1", gems: [{ name: "Herald of Ash", skillId: "HeraldOfAsh", level: 20 }] },
          { id: "sg-h2", gems: [{ name: "Herald of Ice", skillId: "HeraldOfIce", level: 20 }] },
          { id: "sg-h3", gems: [{ name: "Herald of Thunder", skillId: "HeraldOfThunder", level: 20 }] },
          { id: "sg-a1", gems: [{ name: "War Banner", skillId: "WarBanner", level: 20 }] },
          { id: "sg-a2", gems: [{ name: "Dread Banner", skillId: "DreadBanner", level: 20 }] },
        ],
        resources: { spirit: 260, spiritReserved: 250, life: 5200 },
      }],
    }));

  // 06 — ES-only (Chaos Inoculation style: no life pool)
  add("char-06-es-only.json", "ES-only (CI)", "Energy-shield-only defensive layer, zero life. Defense-archetype detection edge.",
    build({
      character: { className: "Witch", ascendancyName: "Blood Mage", level: 89 },
      loadouts: [{
        id: "main", primary: true, allocatedNodeIds: nodes(6, 102), items: fullGear("Aegis", "es"),
        skills: [{ id: "sg", isMain: true, gems: [
          { name: "Arc", skillId: "Arc", level: 20, quality: 20 },
          { name: "Lightning Penetration", skillId: "SupportLightningPen", level: 20 },
        ] }],
        configuration: { chaosInoculation: true }, resources: { energyShield: 7800, life: 1, mana: 200 },
      }],
    }));

  // 07 — low level (early game, no ascendancy yet)
  add("char-07-low-level.json", "level 30, no ascendancy", "Fresh level-30 character with no ascendancy chosen and sparse tree.",
    build({
      character: { className: "Mercenary", level: 30 },
      loadouts: [{ id: "main", primary: true, allocatedNodeIds: nodes(7, 34),
        items: [{ slot: "Weapon 1", name: "Crossbow", rarity: "Magic", lines: ["Adds 5 to 10 Physical Damage"] }],
        skills: [{ id: "sg", isMain: true, gems: [{ name: "Galvanic Shards", skillId: "GalvanicShards", level: 8 }] }] }],
    }));

  // 08 — very high level, dense tree
  add("char-08-high-level.json", "level 95, dense tree", "Endgame level-95 character with a large allocated tree.",
    build({
      character: { className: "Monk", ascendancyName: "Acolyte of Chayula", level: 95 },
      loadouts: [{ id: "main", primary: true, allocatedNodeIds: nodes(8, 122), items: fullGear("Staff", "es"),
        skills: [{ id: "sg", isMain: true, gems: [
          { name: "Ice Strike", skillId: "IceStrike", level: 20, quality: 20 },
          { name: "Martial Tempo", skillId: "SupportMartialTempo", level: 20 },
          { name: "Cold Penetration", skillId: "SupportColdPen", level: 20 },
        ] }],
        configuration: { enemyIsBoss: true, powerCharges: 3 } }],
    }));

  // 09 — gems with NO skillId (only display names) — ref falls back to name
  add("char-09-gems-no-skillid.json", "gems without skillId", "Gems carry display names but no skillId; refs must fall back to names.",
    build({
      character: { className: "Sorceress", ascendancyName: "Chronomancer", level: 80 },
      loadouts: [{ id: "main", primary: true, allocatedNodeIds: nodes(9, 88), items: fullGear("Wand", "es"),
        skills: [{ id: "sg", isMain: true, gems: [
          { name: "Frostbolt" }, { name: "Frost Nexus" }, { name: "Cold Penetration" },
        ] }] }],
    }));

  // 10 — items with no rarity / no mod lines
  add("char-10-items-no-rarity.json", "items missing rarity/mods", "Equipment names only, no rarity and no modifier lines.",
    build({
      character: { className: "Ranger", ascendancyName: "Pathfinder", level: 76 },
      loadouts: [{ id: "main", primary: true, allocatedNodeIds: nodes(10, 82),
        items: [
          { slot: "Weapon 1", name: "Iron Bow" },
          { slot: "Body Armour", name: "Leather Vest" },
          { slot: "Boots", name: "Rawhide Boots" },
        ],
        skills: [{ id: "sg", isMain: true, gems: [{ name: "Poisonous Concoction", skillId: "PoisonousConcoction", level: 18 }] }] }],
    }));

  // 11 — no configuration block at all
  add("char-11-no-config.json", "no configuration", "Loadout has no configuration map; calc-context defaults apply.",
    build({
      character: { className: "Warrior", ascendancyName: "Titan", level: 85 },
      loadouts: [{ id: "main", primary: true, allocatedNodeIds: nodes(11, 98), items: fullGear("Axe", "armour"),
        skills: [{ id: "sg", isMain: true, gems: [{ name: "Earthshatter", skillId: "Earthshatter", level: 20 }] }] }],
    }));

  // 12 — empty skills array (geared but no gems socketed)
  add("char-12-no-skills.json", "no skills", "Fully geared but zero skill groups — no main skill can exist.",
    build({
      character: { className: "Mercenary", ascendancyName: "Witchhunter", level: 68 },
      loadouts: [{ id: "main", primary: true, allocatedNodeIds: nodes(12, 70), items: fullGear("Crossbow", "armour"), skills: [] }],
    }));

  // 13 — multiple groups flagged isMain (ambiguous) — normalizer takes first
  add("char-13-multi-main.json", "multiple main skills flagged", "Two groups both isMain=true. Ambiguous main; first wins per normalizer.",
    build({
      character: { className: "Huntress", ascendancyName: "Ritualist", level: 87 },
      loadouts: [{ id: "main", primary: true, allocatedNodeIds: nodes(13, 100), items: fullGear("Spear", "evasion"),
        skills: [
          { id: "sg-a", isMain: true, gems: [{ name: "Spear Throw", skillId: "SpearThrow", level: 20 }] },
          { id: "sg-b", isMain: true, gems: [{ name: "Whirling Assault", skillId: "WhirlingAssault", level: 20 }] },
        ] }],
    }));

  // 14 — huge support link (6-link equivalent, stress the setup mapping)
  add("char-14-six-link.json", "max-link main skill", "Main group with six gems (active + five supports).",
    build({
      character: { className: "Witch", ascendancyName: "Infernalist", level: 90 },
      loadouts: [{ id: "main", primary: true, allocatedNodeIds: nodes(14, 106), items: fullGear("Sceptre", "es"),
        skills: [{ id: "sg", isMain: true, gems: [
          { name: "Fireball", skillId: "Fireball", level: 20, quality: 20 },
          { name: "Fire Penetration", skillId: "SupportFirePen", level: 20 },
          { name: "Controlled Destruction", skillId: "SupportControlledDestruction", level: 20 },
          { name: "Elemental Focus", skillId: "SupportElementalFocus", level: 20 },
          { name: "Concentrated Effect", skillId: "SupportConcentratedEffect", level: 20 },
          { name: "Ignite Proliferation", skillId: "SupportIgniteProliferation", level: 20 },
        ] }] }],
    }));

  // 15 — duplicate node ids (dirty source) — canonicalization must cope
  add("char-15-duplicate-nodes.json", "duplicate allocated node ids", "allocatedNodeIds contains duplicates; canonical sort must still validate.",
    build({
      character: { className: "Monk", ascendancyName: "Invoker", level: 83 },
      loadouts: [{ id: "main", primary: true,
        allocatedNodeIds: [1200, 1200, 3400, 3400, 5600, 7800, 5600, 9000, 12000, 12000],
        items: fullGear("Staff", "evasion"),
        skills: [{ id: "sg", isMain: true, gems: [{ name: "Tempest Flurry", skillId: "TempestFlurry", level: 20 }] }] }],
    }));

  // 16 — minimal: character + one bare loadout id only
  add("char-16-minimal.json", "minimal loadout", "Only character + a bare loadout id. Everything else defaults.",
    build({
      character: { className: "Druid", ascendancyName: "Bloodletter", level: 55 },
      loadouts: [{ id: "main", primary: true }],
    }));

  // 17 — spear "attack-as-movement" archetype seed (context-detector case)
  add("char-17-attack-as-movement.json", "attack-as-movement (context)", "Spear build that moves by attacking — the archetype the context detector must not shame for low move speed.",
    build({
      character: { className: "Huntress", ascendancyName: "Amazon", level: 89 },
      loadouts: [{ id: "main", primary: true, allocatedNodeIds: nodes(17, 101), items: fullGear("Spear", "evasion"),
        skills: [
          { id: "sg", isMain: true, gems: [
            { name: "Twister", skillId: "Twister", level: 20, quality: 20 },
            { name: "Scattershot", skillId: "SupportScattershot", level: 20 },
            { name: "Martial Tempo", skillId: "SupportMartialTempo", level: 20 },
          ] },
          { id: "sg-buff", gems: [{ name: "Herald of Thunder", skillId: "HeraldOfThunder", level: 20 }] },
        ],
        configuration: { enemyIsBoss: false, movesByAttacking: true },
        resources: { spirit: 100, spiritReserved: 50, life: 3400 } }],
    }));

  // 18 — trap/mine-style delayed damage (config-dependent)
  add("char-18-config-dependent.json", "config-dependent damage", "Delayed/placed damage whose DPS depends heavily on configuration flags.",
    build({
      character: { className: "Mercenary", ascendancyName: "Gemling Legionnaire", level: 86 },
      loadouts: [{ id: "main", primary: true, allocatedNodeIds: nodes(18, 99), items: fullGear("Crossbow", "armour"),
        skills: [{ id: "sg", isMain: true, gems: [
          { name: "Explosive Grenade", skillId: "ExplosiveGrenade", level: 20, quality: 20 },
          { name: "Scattershot", skillId: "SupportScattershot", level: 20 },
        ] }],
        configuration: { enemyIsBoss: true, detonateAllStacks: true, fuseStacks: 5, enemyShocked: true } }],
    }));

  // 19 — mana-stacking caster (resource-sustain edge)
  add("char-19-mana-stacker.json", "mana-heavy resource pattern", "Caster with a very large mana pool and heavy reservation — resource-sustain axis edge.",
    build({
      character: { className: "Sorceress", ascendancyName: "Stormweaver", level: 92 },
      loadouts: [{ id: "main", primary: true, allocatedNodeIds: nodes(19, 111), items: fullGear("Wand", "es"),
        skills: [
          { id: "sg", isMain: true, gems: [
            { name: "Lightning Conduit", skillId: "LightningConduit", level: 20, quality: 20 },
            { name: "Lightning Penetration", skillId: "SupportLightningPen", level: 20 },
          ] },
          { id: "sg-aura", gems: [{ name: "Clarity", skillId: "Clarity", level: 20 }] },
        ],
        resources: { mana: 3200, manaReserved: 900, energyShield: 2600, spirit: 120 } }],
    }));

  // 20 — full multi-loadout with explicit primary + secondary + config on both
  add("char-20-full-multiloadout.json", "explicit multi-loadout", "Two fully-specified loadouts with an explicit primary — the well-formed multi-context case.",
    build({
      character: { className: "Warrior", ascendancyName: "Titan", level: 93 },
      loadouts: [
        { id: "boss-set", name: "Single Target", primary: true, allocatedNodeIds: nodes(201, 114), items: fullGear("Mace", "armour"),
          skills: [{ id: "sg", isMain: true, gems: [
            { name: "Perfect Strike", skillId: "PerfectStrike", level: 20, quality: 20 },
            { name: "Fist of War", skillId: "SupportFistOfWar", level: 20 },
          ] }], configuration: { enemyIsBoss: true } },
        { id: "map-set", name: "Clear", allocatedNodeIds: nodes(202, 114), items: fullGear("Mace", "armour"),
          skills: [{ id: "sg", isMain: true, gems: [
            { name: "Sunder", skillId: "Sunder", level: 20, quality: 20 },
            { name: "Ancestral Urgency", skillId: "SupportAncestralUrgency", level: 20 },
          ] }], configuration: { enemyIsBoss: false } },
      ],
    }));

  return e;
}

// --- Write everything --------------------------------------------------------

function writeJson(rel: string, data: unknown): void {
  const abs = join(FIXTURES, rel);
  mkdirSync(dirname(abs), { recursive: true });
  writeFileSync(abs, JSON.stringify(data, null, 2) + "\n", "utf8");
  console.log("wrote", rel);
}

writeJson("benchmark-builds/melee-attacker.json", meleeAttacker);
writeJson("benchmark-builds/minion-build.json", minionBuild);
writeJson("benchmark-builds/dot-caster.json", dotCaster);

const entries = corpus();
for (const c of entries) writeJson(`import-corpus/${c.file}`, c.build);

const manifest = {
  _synthetic: true,
  _note:
    "SYNTHETIC test corpus for the S3 import-heuristics spike. No real player data. " +
    "Every build is game-plausible but invented; item names/mods/node ids are placeholders.",
  gamePatch: GAME_PATCH,
  count: entries.length,
  characters: entries.map((c) => ({
    file: c.file,
    className: c.build.character.className,
    ascendancyName: c.build.character.ascendancyName ?? null,
    level: c.build.character.level,
    loadouts: c.build.loadouts.length,
    edgeCase: c.edgeCase,
    description: c.description,
  })),
};
writeJson("import-corpus/manifest.json", manifest);

console.log(`\nDone. 3 benchmark builds + ${entries.length} corpus characters + manifest.`);
