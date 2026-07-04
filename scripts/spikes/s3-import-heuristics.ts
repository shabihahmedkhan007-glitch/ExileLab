// S3 — Import heuristics scorecard (Phase 0 spike, PRODUCT_PLAN §"Phase 0" S3).
//
// Runs a 20-character corpus through the REAL backend pipeline exactly as
// POST /import does — detectSource -> import -> normalize -> ExileLabService
// (main-skill selection, configuration, MockEngine Calculation Result) — and
// scores each import on the three heuristic questions the spike poses:
//
//   1. main skill selected?      (backend summarize(): primary loadout ->
//                                 skills.find(isMainSkill) ?? skills[0], name via
//                                 Display Cache) — was a real main skill resolved,
//                                 and was it IMPORTED (explicit) or INFERRED (default)?
//   2. config sane?             (buildState.configuration well-formed + declared)
//   3. assumptions declared for every default? (RFC-0001 I3/I4 honesty invariant:
//                                 no silent default sentinel anywhere in the snapshot)
//
// It also reads each build's FullDPS from the MockEngine so the ≥90%-sane-FullDPS
// GATE can be exercised end-to-end. That gate CANNOT close on MockEngine numbers —
// the mock derives plausible-shaped magnitudes from build STRUCTURE, not real PoB2
// math — so the gate is reported as gate-status: BLOCKED-ON-S1 (real engine sidecar),
// while the pipeline proof (every import flows through, honesty holds) runs today.
//
// Corpus source: research/fixtures/import-corpus/ if populated with real fixtures;
// otherwise a varied SYNTHETIC 20-build corpus is generated inline (the real
// 20-character corpus is the founder-provided boundary, Compliance Charter §7.5 —
// no network fetches here, ever). The mode used is printed in the header.
//
// Imports the BUILT dist entrypoints by relative path (see s2-roundtrip.ts note):
// the spikes dir is not a workspace package, so bare @exilelab/* specifiers do not
// resolve from here.

import { readdirSync, readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { deflateSync } from "node:zlib";
import { encodePobCode } from "../../packages/build-normalizer/dist/index.js";
import { ExileLabService } from "../../backend/api/dist/index.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const CORPUS_DIR = join(HERE, "..", "..", "research", "fixtures", "import-corpus");

// ---------------------------------------------------------------------------
// Inline synthetic PoB-XML builder (mirrors a Path-of-Building document enough
// for PobCodeImporter to parse class/level/nodes/items/skills/main-group).
// ---------------------------------------------------------------------------
interface PobOpts {
  className?: string;
  ascend?: string;
  level?: number;
  mainSocketGroup?: number;
  nodes?: number[];
  items?: Array<{ slot: string; text: string }>;
  skillGroups?: Array<{ gems: Array<{ name: string; skillId?: string; level?: number }> }>;
  skillSets?: number;
  specs?: number[][];
}

function pobXml(o: PobOpts): string {
  const {
    className,
    ascend,
    level,
    mainSocketGroup,
    nodes = [1, 2, 3],
    items = [],
    skillGroups = [],
    skillSets = 1,
    specs,
  } = o;
  const buildAttrs = [
    level !== undefined ? `level="${level}"` : "",
    className !== undefined ? `className="${className}"` : "",
    ascend !== undefined ? `ascendClassName="${ascend}"` : "",
    mainSocketGroup !== undefined ? `mainSocketGroup="${mainSocketGroup}"` : "",
  ]
    .filter(Boolean)
    .join(" ");
  const slots = items.map((it, i) => `    <Slot itemId="${i + 1}" name="${it.slot}"/>`).join("\n");
  const itemEls = items.map((it, i) => `    <Item id="${i + 1}">${it.text}</Item>`).join("\n");
  const specEls = (specs ?? [nodes]).map((n) => `    <Spec nodes="${n.join(",")}"/>`).join("\n");
  const groups = (gs: PobOpts["skillGroups"]) =>
    (gs ?? [])
      .map(
        (g) =>
          `      <Skill>${g.gems
            .map(
              (gem) =>
                `<Gem nameSpec="${gem.name}"${gem.skillId ? ` skillId="${gem.skillId}"` : ""}${
                  gem.level !== undefined ? ` level="${gem.level}"` : ""
                }/>`,
            )
            .join("")}</Skill>`,
      )
      .join("\n");
  const skillSetEls = Array.from({ length: skillSets })
    .map((_, i) => `    <SkillSet id="${i + 1}">\n${groups(skillGroups)}\n    </SkillSet>`)
    .join("\n");
  return [
    `<?xml version="1.0" encoding="UTF-8"?>`,
    `<PathOfBuilding>`,
    `  <Build ${buildAttrs}><PlayerStat stat="FullDPS" value="0"/></Build>`,
    `  <Tree activeSpec="1">`,
    specEls,
    `  </Tree>`,
    `  <Skills activeSkillSet="1">`,
    skillSetEls,
    `  </Skills>`,
    `  <Items>`,
    slots,
    itemEls,
    `  </Items>`,
    `</PathOfBuilding>`,
  ].join("\n");
}

function pobCode(o: PobOpts): string {
  return encodePobCode(pobXml(o), deflateSync);
}

// ---------------------------------------------------------------------------
// Native ExileLab JSON interchange builder (full-fidelity path — carries config).
// ---------------------------------------------------------------------------
interface NativeOpts {
  className: string;
  ascendancyName?: string;
  level: number;
  nodes?: number[];
  items?: Array<{ slot: string; name: string; rarity?: string; lines?: string[] }>;
  skills?: Array<{ id?: string; isMain?: boolean; gems: Array<{ name: string; skillId?: string; level?: number }> }>;
  configuration?: Record<string, string | number | boolean>;
}

function nativeJson(o: NativeOpts): string {
  return JSON.stringify({
    format: "exilelab-build",
    formatVersion: 1,
    gamePatch: "0.5",
    character: {
      className: o.className,
      ...(o.ascendancyName ? { ascendancyName: o.ascendancyName } : {}),
      level: o.level,
    },
    loadouts: [
      {
        id: "main",
        primary: true,
        allocatedNodeIds: o.nodes ?? [1, 2, 3, 4],
        items: o.items ?? [],
        skills: o.skills ?? [],
        ...(o.configuration ? { configuration: o.configuration } : {}),
      },
    ],
    provenance: { attribution: "Synthetic S3 corpus fixture" },
  });
}

// ---------------------------------------------------------------------------
// The synthetic 20-character corpus. Deliberately varied across sources, classes,
// and the exact heuristic edge each row exercises.
// ---------------------------------------------------------------------------
interface CorpusEntry {
  name: string;
  input: string;
  note: string;
}

function syntheticCorpus(): CorpusEntry[] {
  const c: CorpusEntry[] = [];
  const add = (name: string, input: string, note: string) => c.push({ name, input, note });

  // 1 — canonical full PoB build (explicit main group)
  add(
    "pob-full-twister-huntress",
    pobCode({
      className: "Huntress",
      ascend: "Ritualist",
      level: 92,
      mainSocketGroup: 1,
      nodes: [16, 1, 2, 3, 4, 5, 24, 10],
      items: [
        { slot: "Weapon 1", text: "Rarity: RARE\nStorm's Edge\nSpear\n35% increased Attack Speed" },
        { slot: "Body Armour", text: "Rarity: RARE\nGuardian's Plate\nPlate\n+120 to maximum Life" },
      ],
      skillGroups: [
        { gems: [{ name: "Twister", skillId: "twister", level: 20 }, { name: "Martial Tempo", skillId: "martial-tempo", level: 20 }] },
        { gems: [{ name: "Herald of Ice", skillId: "herald-ice", level: 20 }] },
      ],
    }),
    "explicit main group -> main IMPORTED",
  );

  // 2 — PoB, two skill groups, NO mainSocketGroup -> main inferred (first)
  add(
    "pob-no-main-group-duelist",
    pobCode({
      className: "Duelist",
      level: 55,
      skillGroups: [
        { gems: [{ name: "Boneshatter", skillId: "boneshatter", level: 16 }] },
        { gems: [{ name: "Leap Slam", skillId: "leap-slam", level: 10 }] },
      ],
    }),
    "no main group -> main INFERRED (first)",
  );

  // 3 — PoB, single skill group, no main group -> inferred
  add(
    "pob-single-skill-ranger",
    pobCode({
      className: "Ranger",
      level: 40,
      nodes: [7, 8, 9],
      skillGroups: [{ gems: [{ name: "Lightning Arrow", skillId: "lightning-arrow", level: 12 }] }],
    }),
    "single group -> main INFERRED",
  );

  // 4 — PoB, MISSING className -> class defaulted "Unknown"
  add(
    "pob-missing-class",
    pobCode({
      level: 70,
      mainSocketGroup: 1,
      skillGroups: [{ gems: [{ name: "Spark", skillId: "spark", level: 18 }] }],
    }),
    "no className -> class DEFAULTED, must be declared",
  );

  // 5 — PoB, MISSING level -> level defaulted 1
  add(
    "pob-missing-level",
    pobCode({
      className: "Witch",
      mainSocketGroup: 1,
      skillGroups: [{ gems: [{ name: "Firestorm", skillId: "firestorm", level: 14 }] }],
    }),
    "no level -> level DEFAULTED, must be declared",
  );

  // 6 — PoB, NO skills at all -> no main skill resolvable
  add(
    "pob-no-skills-marauder",
    pobCode({ className: "Marauder", level: 30, nodes: [1, 2, 3, 4, 5], skillGroups: [] }),
    "no skills -> main skill NOT selected (honest null)",
  );

  // 7 — PoB, no items
  add(
    "pob-no-items-sorceress",
    pobCode({
      className: "Sorceress",
      level: 84,
      mainSocketGroup: 1,
      nodes: [10, 20, 30, 40],
      skillGroups: [{ gems: [{ name: "Arc", skillId: "arc", level: 20 }] }],
    }),
    "no items",
  );

  // 8 — PoB, large tree + many supports
  add(
    "pob-large-mercenary",
    pobCode({
      className: "Mercenary",
      ascend: "Witchhunter",
      level: 96,
      mainSocketGroup: 1,
      nodes: Array.from({ length: 90 }, (_, i) => i + 1),
      items: Array.from({ length: 8 }, (_, i) => ({ slot: `Slot ${i + 1}`, text: `Rarity: RARE\nItem ${i + 1}\nBase\n+${i * 8} to maximum Life` })),
      skillGroups: [
        {
          gems: [
            { name: "Galvanic Shards", skillId: "galvanic", level: 20 },
            { name: "Added Lightning", skillId: "add-light", level: 20 },
            { name: "Lightning Penetration", skillId: "light-pen", level: 20 },
            { name: "Elemental Focus", skillId: "ele-focus", level: 20 },
          ],
        },
      ],
    }),
    "large build, 4-link main group",
  );

  // 9 — PoB, XML entities in item text
  add(
    "pob-entities-templar",
    pobCode({
      className: "Templar",
      level: 66,
      mainSocketGroup: 1,
      items: [{ slot: "Amulet", text: "Rarity: RARE\nT&amp;T &lt;Charm&gt;\nAmulet\n+10% &quot;special&quot; damage" }],
      skillGroups: [{ gems: [{ name: "Righteous Fire", skillId: "rf", level: 20 }] }],
    }),
    "entity-encoded item text",
  );

  // 10 — PoB, multi-skillset (activeSkillSet=1)
  add(
    "pob-multi-skillset-monk",
    pobCode({
      className: "Monk",
      level: 78,
      mainSocketGroup: 1,
      skillSets: 2,
      skillGroups: [{ gems: [{ name: "Ice Strike", skillId: "ice-strike", level: 20 }] }],
    }),
    "two skill sets, active=1",
  );

  // 11 — PoB, multi-spec tree
  add(
    "pob-multi-spec-shadow",
    pobCode({
      className: "Shadow",
      level: 88,
      mainSocketGroup: 1,
      specs: [[1, 2, 3, 4], [50, 51, 52, 53, 54]],
      skillGroups: [{ gems: [{ name: "Poisonous Concoction", skillId: "poison-conc", level: 20 }] }],
    }),
    "two specs, active=1",
  );

  // 12 — Native full build WITH configuration -> config IMPORTED
  add(
    "native-full-config-huntress",
    nativeJson({
      className: "Huntress",
      ascendancyName: "Amazon",
      level: 90,
      nodes: [1, 2, 3, 4, 5, 6],
      items: [{ slot: "Weapon 1", name: "Spine Bow", rarity: "rare", lines: ["Adds 50 to 80 Physical Damage"] }],
      skills: [{ id: "g1", isMain: true, gems: [{ name: "Lightning Rod", skillId: "lightning-rod", level: 20 }] }],
      configuration: { "enemy.isBoss": true, enemyLevel: 84 },
    }),
    "native + config -> config IMPORTED",
  );

  // 13 — Native minimal (one skill, no config)
  add(
    "native-minimal-warrior",
    nativeJson({
      className: "Warrior",
      level: 20,
      nodes: [1, 2],
      skills: [{ id: "g1", isMain: true, gems: [{ name: "Perfect Strike", skillId: "perfect-strike", level: 5 }] }],
    }),
    "native minimal, no config -> config DEFAULTED",
  );

  // 14 — Native, two groups, isMain on the SECOND
  add(
    "native-second-main-sorceress",
    nativeJson({
      className: "Sorceress",
      level: 75,
      nodes: [3, 6, 9, 12],
      skills: [
        { id: "g1", gems: [{ name: "Frost Bomb", skillId: "frost-bomb", level: 12 }] },
        { id: "g2", isMain: true, gems: [{ name: "Cold Snap", skillId: "cold-snap", level: 20 }] },
      ],
    }),
    "explicit main on 2nd group -> main IMPORTED (2nd)",
  );

  // 15 — Native, no skills
  add(
    "native-no-skills-druid",
    nativeJson({ className: "Druid", level: 33, nodes: [1, 2, 3] }),
    "native, no skills -> main NOT selected",
  );

  // 16-20 — additional PoB variety across classes/skills
  add(
    "pob-mapper-deadeye",
    pobCode({
      className: "Ranger",
      ascend: "Deadeye",
      level: 91,
      mainSocketGroup: 1,
      nodes: [5, 10, 15, 20, 25, 30],
      skillGroups: [{ gems: [{ name: "Tornado Shot", skillId: "tornado-shot", level: 20 }, { name: "Pierce", skillId: "pierce", level: 20 }] }],
    }),
    "deadeye mapper",
  );
  add(
    "pob-minion-infernalist",
    pobCode({
      className: "Witch",
      ascend: "Infernalist",
      level: 89,
      mainSocketGroup: 1,
      nodes: [2, 4, 6, 8, 10, 12, 14],
      skillGroups: [{ gems: [{ name: "Raise Zombie", skillId: "raise-zombie", level: 20 }, { name: "Minion Damage", skillId: "minion-dmg", level: 20 }] }],
    }),
    "minion build",
  );
  add(
    "pob-totem-hierophant",
    pobCode({
      className: "Templar",
      ascend: "Hierophant",
      level: 87,
      mainSocketGroup: 1,
      skillGroups: [{ gems: [{ name: "Rolling Magma", skillId: "rolling-magma", level: 20 }] }],
    }),
    "totem-ish build",
  );
  add(
    "pob-melee-titan",
    pobCode({
      className: "Warrior",
      ascend: "Titan",
      level: 94,
      mainSocketGroup: 1,
      nodes: [1, 3, 5, 7, 9, 11, 13, 15],
      items: [{ slot: "Weapon 1", text: "Rarity: RARE\nColossus Mace\nMace\n120% increased Physical Damage" }],
      skillGroups: [{ gems: [{ name: "Sunder", skillId: "sunder", level: 20 }, { name: "Melee Physical", skillId: "melee-phys", level: 20 }] }],
    }),
    "melee slam",
  );
  add(
    "pob-caster-chronomancer",
    pobCode({
      className: "Sorceress",
      ascend: "Chronomancer",
      level: 90,
      mainSocketGroup: 1,
      nodes: [4, 8, 12, 16, 20],
      skillGroups: [{ gems: [{ name: "Comet", skillId: "comet", level: 20 }, { name: "Hourglass", skillId: "hourglass", level: 20 }] }],
    }),
    "caster build",
  );

  return c;
}

// ---------------------------------------------------------------------------
// Corpus loading: real fixtures if present, else synthetic.
// ---------------------------------------------------------------------------
function loadCorpus(): { mode: "real-fixtures" | "synthetic-inline"; entries: CorpusEntry[] } {
  if (existsSync(CORPUS_DIR)) {
    // Real build fixtures only — exclude the corpus manifest / any non-build meta
    // file (e.g. manifest.json is a catalogue, not an importable build).
    const files = readdirSync(CORPUS_DIR).filter(
      (f) => /\.(txt|json|pob|code)$/i.test(f) && f.toLowerCase() !== "manifest.json",
    );
    if (files.length > 0) {
      const entries = files.map((f) => ({
        name: f,
        input: readFileSync(join(CORPUS_DIR, f), "utf8").trim(),
        note: "real fixture",
      }));
      return { mode: "real-fixtures", entries };
    }
  }
  return { mode: "synthetic-inline", entries: syntheticCorpus() };
}

// ---------------------------------------------------------------------------
// Per-import scoring.
// ---------------------------------------------------------------------------
interface AssumptionView {
  path: string;
  origin: "imported" | "inferred" | "defaulted";
  note?: string;
}

interface Row {
  idx: number;
  name: string;
  source: string;
  className: string;
  level: number;
  mainSkill: string | null;
  mainOrigin: "imported" | "inferred" | "n/a";
  configEntries: number;
  configSane: boolean;
  honest: boolean;
  honestMisses: string[];
  fullDPS: number;
  dpsSane: boolean;
  error?: string;
}

/**
 * Honesty invariant (RFC-0001 I3/I4): every DEFAULT SENTINEL present in the
 * normalized snapshot must carry a declared assumption. Source-agnostic — works for
 * synthetic and real fixtures alike.
 */
function honestyCheck(
  snapshot: { buildState: { character: { class: string }; configuration: readonly unknown[] }; metadata: { patchVersion: string } },
  assumptions: AssumptionView[],
): { ok: boolean; misses: string[] } {
  const paths = assumptions.map((a) => a.path);
  const has = (pred: (p: string) => boolean, origin?: AssumptionView["origin"]) =>
    assumptions.some((a) => pred(a.path) && (origin === undefined || a.origin === origin));
  const misses: string[] = [];

  if (assumptions.length === 0) misses.push("no assumptions declared at all");
  // Every assumption is well-formed.
  for (const a of assumptions) {
    if (!a.path || !["imported", "inferred", "defaulted"].includes(a.origin)) {
      misses.push(`malformed assumption ${JSON.stringify(a)}`);
    }
  }
  // Default sentinels must be declared.
  if (snapshot.buildState.character.class === "Unknown" && !has((p) => p.includes("className") || p.includes("class"), "defaulted")) {
    misses.push("class defaulted to 'Unknown' but not declared");
  }
  if (snapshot.metadata.patchVersion === "unknown" && !has((p) => p.includes("gamePatch"))) {
    misses.push("patch defaulted to 'unknown' but not declared");
  }
  if (snapshot.buildState.configuration.length === 0 && !paths.includes("configuration")) {
    misses.push("empty configuration but no 'configuration' assumption");
  }
  return { ok: misses.length === 0, misses };
}

/** Config sanity: well-formed entries + a declared configuration assumption. */
function configSanity(configuration: Array<{ key: string; value: unknown }>, assumptions: AssumptionView[]): boolean {
  const declared = assumptions.some((a) => a.path === "configuration");
  const wellFormed = configuration.every(
    (e) =>
      typeof e.key === "string" &&
      e.key.trim().length > 0 &&
      (typeof e.value === "string" || typeof e.value === "boolean" || (typeof e.value === "number" && Number.isFinite(e.value))),
  );
  return declared && wellFormed;
}

async function scoreEntry(svc: ExileLabService, entry: CorpusEntry, idx: number): Promise<Row> {
  try {
    const imp = await svc.importBuild(entry.input);
    const detail = await svc.getBuild(imp.buildId);
    const assumptions = imp.assumptions as AssumptionView[];
    const configuration = detail.snapshot.buildState.configuration as Array<{ key: string; value: unknown }>;

    // Main-skill origin: the normalizer declares isMain as imported (explicit) or
    // inferred (first-group default); absence of any .isMain assumption => no skills.
    let mainOrigin: Row["mainOrigin"] = "n/a";
    const isMainA = assumptions.find((a) => a.path.endsWith(".isMain") || a.path.endsWith("isMain"));
    if (isMainA) mainOrigin = isMainA.origin === "imported" ? "imported" : "inferred";

    const honest = honestyCheck(detail.snapshot, assumptions);
    const fullDPS = detail.calculation.metrics.fullDPS ?? 0;

    return {
      idx,
      name: entry.name,
      source: imp.provenance.source,
      className: imp.summary.class,
      level: imp.summary.level,
      mainSkill: imp.summary.mainSkill,
      mainOrigin,
      configEntries: configuration.length,
      configSane: configSanity(configuration, assumptions),
      honest: honest.ok,
      honestMisses: honest.misses,
      fullDPS,
      dpsSane: Number.isFinite(fullDPS) && fullDPS > 0,
    };
  } catch (err) {
    return {
      idx,
      name: entry.name,
      source: "ERROR",
      className: "-",
      level: 0,
      mainSkill: null,
      mainOrigin: "n/a",
      configEntries: 0,
      configSane: false,
      honest: false,
      honestMisses: [`import threw ${(err as Error).name}: ${(err as Error).message}`],
      fullDPS: 0,
      dpsSane: false,
      error: (err as Error).message,
    };
  }
}

// ---------------------------------------------------------------------------
// Table rendering.
// ---------------------------------------------------------------------------
function pad(s: string, w: number): string {
  return s.length >= w ? s.slice(0, w) : s + " ".repeat(w - s.length);
}

function renderTable(rows: Row[]): string {
  const head = [
    pad("#", 3),
    pad("fixture / name", 28),
    pad("source", 11),
    pad("class", 10),
    pad("lvl", 4),
    pad("main skill", 18),
    pad("main", 9),
    pad("cfg#", 5),
    pad("cfg", 4),
    pad("honest", 7),
    pad("fullDPS", 10),
    pad("dps", 4),
  ].join(" ");
  const sep = "-".repeat(head.length);
  const body = rows
    .map((r) =>
      [
        pad(String(r.idx), 3),
        pad(r.name.replace(/\.(json|txt|pob|code)$/i, ""), 28),
        pad(r.source, 11),
        pad(r.className, 10),
        pad(String(r.level), 4),
        pad(r.mainSkill ?? "(none)", 18),
        pad(r.mainOrigin, 9),
        pad(String(r.configEntries), 5),
        pad(r.configSane ? "ok" : "BAD", 4),
        pad(r.honest ? "ok" : "BAD", 7),
        pad(r.fullDPS.toLocaleString("en-US"), 10),
        pad(r.dpsSane ? "ok" : "0", 4),
      ].join(" "),
    )
    .join("\n");
  return `${head}\n${sep}\n${body}`;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main(): Promise<number> {
  const { mode, entries } = loadCorpus();

  console.log("=".repeat(90));
  console.log("S3 — Import heuristics scorecard (importAny -> normalize -> backend main-skill/config)");
  console.log("=".repeat(90));
  console.log(`corpus mode : ${mode}`);
  console.log(`corpus size : ${entries.length} characters`);
  console.log(`engine      : MockEngine (deterministic S1 stand-in) — FullDPS is STRUCTURE-derived, not PoB2 math`);
  console.log("");

  const svc = new ExileLabService();
  const rows: Row[] = [];
  for (let i = 0; i < entries.length; i++) {
    rows.push(await scoreEntry(svc, entries[i]!, i + 1));
  }

  console.log(renderTable(rows));

  // -- Aggregates ----------------------------------------------------------
  const n = rows.length;
  const crashed = rows.filter((r) => r.error !== undefined).length;
  const mainSelected = rows.filter((r) => r.mainSkill !== null).length;
  const mainImported = rows.filter((r) => r.mainOrigin === "imported").length;
  const mainInferred = rows.filter((r) => r.mainOrigin === "inferred").length;
  const configSane = rows.filter((r) => r.configSane).length;
  const honest = rows.filter((r) => r.honest).length;
  const dpsSane = rows.filter((r) => r.dpsSane).length;
  const pct = (k: number) => `${k}/${n} (${Math.round((k / n) * 1000) / 10}%)`;

  console.log("\n" + "-".repeat(90));
  console.log("AGGREGATES");
  console.log(`  imports without crash        : ${pct(n - crashed)}`);
  console.log(`  main skill selected          : ${pct(mainSelected)}  (imported ${mainImported}, inferred ${mainInferred})`);
  console.log(`  configuration sane (declared+well-formed): ${pct(configSane)}`);
  console.log(`  assumptions declared for every default   : ${pct(honest)}`);
  console.log(`  FullDPS sane (>0, finite)    : ${pct(dpsSane)}`);

  // Honesty misses detail (should be empty).
  const misses = rows.filter((r) => !r.honest);
  if (misses.length > 0) {
    console.log("\n  HONESTY MISSES:");
    for (const r of misses) console.log(`    #${r.idx} ${r.name}: ${r.honestMisses.join("; ")}`);
  }

  // -- Gate verdict --------------------------------------------------------
  const DPS_GATE = 0.9;
  const dpsRate = dpsSane / n;
  console.log("\n" + "-".repeat(90));
  console.log("GATE — ≥90% sane FullDPS (PRODUCT_PLAN Phase 0 S3)");
  console.log(`  MockEngine FullDPS-sane rate : ${Math.round(dpsRate * 1000) / 10}% (threshold ${DPS_GATE * 100}%)`);
  console.log(`  gate-status                  : BLOCKED-ON-S1`);
  console.log(`  reason                       : the gate measures whether REAL PoB2 FullDPS defaults are sane;`);
  console.log(`                                 MockEngine derives magnitudes from build STRUCTURE, not engine math,`);
  console.log(`                                 so this % is a PIPELINE PROOF only. It cannot close the gate until the`);
  console.log(`                                 real LuaJIT sidecar (S1 / engine-adapter, ADR-001) produces the numbers.`);

  // -- Harness pass/fail (pipeline proof) ----------------------------------
  // The harness is GREEN when the pipeline is sound TODAY: nothing crashed, the
  // honesty invariant holds for every import, and configuration is well-formed &
  // declared for every import. Main-skill selection and FullDPS sanity are REPORTED
  // (main can legitimately be null for a skill-less build; FullDPS is gated on S1).
  const harnessOk = crashed === 0 && honest === n && configSane === n;
  console.log("\n" + "=".repeat(90));
  console.log(`S3 VERDICT: ${harnessOk ? "GREEN" : "RED"} (pipeline proof)  ` +
    `— ${n - crashed}/${n} imported, honesty ${honest}/${n}, config ${configSane}/${n}, ` +
    `main-selected ${mainSelected}/${n}, dps-sane ${dpsSane}/${n} [gate BLOCKED-ON-S1]`);
  console.log("BOUNDARY: real ≥90%-sane-FullDPS gate needs the S1 engine sidecar; MockEngine proves the");
  console.log("import->normalize->heuristic->engine pipeline is sound and honest end to end.");
  console.log("=".repeat(90));

  return harnessOk ? 0 : 1;
}

main().then((code) => process.exit(code));
