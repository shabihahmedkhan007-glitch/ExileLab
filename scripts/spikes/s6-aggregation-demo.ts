// S6 — Aggregation feasibility demo (Phase 0 spike, PRODUCT_PLAN §"Phase 0" S6).
//
// The gate S6 exercises (PRODUCT_PLAN Phase 0 S6):
//   "'fetch' the same archetype from 3 sources -> normalize all to one
//    BuildSnapshot shape -> comparator produces a sane tree/gear/gem diff."
//
// This script loads the SAME archetype (a Twister Huntress speed-mapper) from
// THREE synthetic sources standing in for three public platforms:
//
//   (a) a-maxroll-native.json         — ExileLab native JSON  (as-if Maxroll)
//   (b) b-pob-share-code.txt          — PoB-style share code   (as-if pobb.in)
//   (c) c-poeninja-variant-native.json— ExileLab native JSON  (as-if poe.ninja)
//
// (a) and (b) are the SAME build in two DIFFERENT source FORMATS; (c) is a
// deliberate variant differing by exactly: boots + 6 passive nodes + 1 support
// gem (research/fixtures/archetype-3-sources/differences.md). All three are fed
// through the REAL importer boundary (importAny -> normalize) exactly as
// POST /import would, then diffed by the REAL comparator. No network, ever
// (Compliance Charter PRD §7.5) — the PoB code is decoded locally with node:zlib.
//
// What the demo proves, in four sections:
//   1. multi-FORMAT normalization: 2 formats / 3 sources -> one canonical shape.
//   2. sane diff: the (a)->(c) comparator output matches differences.md line-for-line.
//   3. consensus: changes corroborated across sources are community-validated.
//   4. promotability: a diff candidate is a real BuildMutation core promotes.
//
// Imports the BUILT dist entrypoints by relative path (see s2/s3 spikes): the
// spikes dir is not a workspace package, so bare @exilelab/* specifiers do not
// resolve from here. Build first:  pnpm -r build
// Run:  pnpm exec tsx scripts/spikes/s6-aggregation-demo.ts

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import {
  importAny,
  normalize,
  type BuildSnapshot,
} from "../../packages/build-normalizer/dist/index.js";
import {
  compareMany,
  diffSnapshots,
  getPrimaryLoadout,
  promoteMutation,
  changeKey,
  type SnapshotDiff,
  type Candidate,
  type MultiCompareResult,
} from "../../packages/comparator/dist/index.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const SRC_DIR = join(HERE, "..", "..", "research", "fixtures", "archetype-3-sources");

// --- tiny assertion harness --------------------------------------------------
let checks = 0;
const failures: string[] = [];
function check(label: string, ok: boolean, detail = ""): void {
  checks += 1;
  const tag = ok ? "ok  " : "FAIL";
  console.log(`    ${tag} ${label}${detail ? `  (${detail})` : ""}`);
  if (!ok) failures.push(label + (detail ? `: ${detail}` : ""));
}
function eqArr(a: readonly number[], b: readonly number[]): boolean {
  return a.length === b.length && a.every((v, i) => v === b[i]);
}
function hr(title: string): void {
  console.log(`\n${"=".repeat(78)}\n${title}\n${"=".repeat(78)}`);
}

// --- load + normalize the three sources -------------------------------------
// (b) is a .txt with a few '#' header lines; the single non-comment line is the code.
function readPobCode(file: string): string {
  const raw = readFileSync(join(SRC_DIR, file), "utf8");
  return raw.split(/\r?\n/).find((l) => l.trim().length > 0 && !l.startsWith("#")) ?? "";
}

interface Source {
  readonly key: "a" | "b" | "c";
  readonly label: string;
  readonly standIn: string;
  readonly raw: string;
  snapshot: BuildSnapshot;
  importer: string;
}

function load(): Source[] {
  const specs: Array<Omit<Source, "snapshot" | "importer">> = [
    {
      key: "a",
      label: "a-maxroll-native.json",
      standIn: "as-if Maxroll pob endpoint",
      raw: readFileSync(join(SRC_DIR, "a-maxroll-native.json"), "utf8"),
    },
    {
      key: "b",
      label: "b-pob-share-code.txt",
      standIn: "as-if pobb.in / PoB2 share code",
      raw: readPobCode("b-pob-share-code.txt"),
    },
    {
      key: "c",
      label: "c-poeninja-variant-native.json",
      standIn: "as-if poe.ninja top-ladder player",
      raw: readFileSync(join(SRC_DIR, "c-poeninja-variant-native.json"), "utf8"),
    },
  ];
  return specs.map((s) => {
    // importAny routes by format (native JSON vs PoB code) and never touches the
    // network — it decodes/parses the given text only. This IS the multi-format proof.
    const artifact = importAny(s.raw);
    const snapshot = normalize(artifact);
    return { ...s, snapshot, importer: artifact.source };
  });
}

// --- helpers over a normalized snapshot -------------------------------------
function nodesOf(snap: BuildSnapshot): readonly number[] {
  return getPrimaryLoadout(snap)?.passiveTree.allocatedNodes ?? [];
}
function mainSetup(snap: BuildSnapshot) {
  const lo = getPrimaryLoadout(snap);
  return lo?.skills.find((s) => s.isMainSkill) ?? lo?.skills[0];
}
function describeCandidate(c: Candidate): string {
  const op = c.operations[0]!;
  switch (op.kind) {
    case "allocatePassiveNode":
      return `alloc node ${op.nodeId}`;
    case "deallocatePassiveNode":
      return `dealloc node ${op.nodeId}`;
    case "swapItem":
      return `swap ${op.item.slot} -> ${op.item.itemRef ?? "?"} [${op.item.rarity ?? "?"}]`;
    case "changeGem":
      return `set ${op.setupId} skill -> ${op.skillGemRef ?? "∅"}`;
    case "changeSupport":
      return op.addSupportRef !== undefined
        ? `add support ${op.addSupportRef} to ${op.setupId}`
        : `remove support ${op.removeSupportRef} from ${op.setupId}`;
    case "changeConfig":
      return `set config ${op.key} = ${String(op.value)}`;
  }
}

// ============================================================================
console.log("S6 — AGGREGATION FEASIBILITY DEMO");
console.log("Same archetype, 3 synthetic sources, 2 formats -> one canonical BuildSnapshot.");
console.log("No network calls anywhere (Compliance Charter PRD §7.5).");

const sources = load();
const a = sources.find((s) => s.key === "a")!;
const b = sources.find((s) => s.key === "b")!;
const c = sources.find((s) => s.key === "c")!;

// ---------------------------------------------------------------------------
hr("1. MULTI-FORMAT NORMALIZATION — 3 sources / 2 formats -> one shape");
console.log(
  "\n  src  file                                importer     class/asc/lvl        nodes  main-skill",
);
for (const s of sources) {
  const ch = s.snapshot.buildState.character;
  const ms = mainSetup(s.snapshot);
  console.log(
    `  (${s.key})  ${s.label.padEnd(35)} ${s.importer.padEnd(11)} ` +
      `${`${ch.class}/${ch.ascendancy ?? "—"}/${ch.level}`.padEnd(20)} ` +
      `${String(nodesOf(s.snapshot).length).padStart(4)}   ${ms?.skillGemRef ?? "∅"}`,
  );
  console.log(`        stands in for: ${s.standIn};  identity=${s.snapshot.identity.slice(0, 12)}…`);
}

console.log("\n  Assert (a) native JSON and (b) PoB share code normalize to the SAME build state:");
const chA = a.snapshot.buildState.character;
const chB = b.snapshot.buildState.character;
check("(a)≡(b) class", chA.class === chB.class, `${chA.class} vs ${chB.class}`);
check("(a)≡(b) ascendancy", chA.ascendancy === chB.ascendancy, `${chA.ascendancy} vs ${chB.ascendancy}`);
check("(a)≡(b) level", chA.level === chB.level, `${chA.level} vs ${chB.level}`);
check("(a)≡(b) 100 allocated nodes identical", eqArr(nodesOf(a.snapshot), nodesOf(b.snapshot)),
  `${nodesOf(a.snapshot).length} vs ${nodesOf(b.snapshot).length}`);
const msA = mainSetup(a.snapshot);
const msB = mainSetup(b.snapshot);
check("(a)≡(b) main active skill gem", (msA?.skillGemRef ?? null) === (msB?.skillGemRef ?? null),
  `${msA?.skillGemRef} vs ${msB?.skillGemRef}`);
check("(a)≡(b) main support gems", eqArrStr([...(msA?.supports ?? [])].sort(), [...(msB?.supports ?? [])].sort()),
  `[${msA?.supports.join(",")}] vs [${msB?.supports.join(",")}]`);
console.log(
  "\n  Note: their Canonical IDENTITIES differ by design — the two importers legitimately\n" +
    "  synthesize different setup ids / mod-line text (differences.md). Identity byte-equality\n" +
    "  is NOT required; semantic build-state agreement (asserted above) is what S6 consumes.",
);
check("(a) and (b) identities differ (distinct importers, same build)",
  a.snapshot.identity !== b.snapshot.identity);

function eqArrStr(x: readonly string[], y: readonly string[]): boolean {
  return x.length === y.length && x.every((v, i) => v === y[i]);
}

// ---------------------------------------------------------------------------
hr("2. SANE DIFF — (a) baseline -> (c) variant, verified vs differences.md");
console.log("\n  Diffing the primary Loadout Context of (a) against (c).");
const diffAC: SnapshotDiff = diffSnapshots(a.snapshot, c.snapshot);

// -- passive tree --
const EXPECT_ONLY_A = [1075, 1320, 1485, 1966, 2432, 3091]; // removed in (c)
const EXPECT_ONLY_C = [2000, 2100, 2200, 2300, 2400, 2500]; // added in (c)
console.log("\n  Passive tree:");
console.log(`    only in (a)  (drop): [${diffAC.passiveTree.onlyInA.join(", ")}]`);
console.log(`    only in (c)  (add) : [${diffAC.passiveTree.onlyInB.join(", ")}]`);
console.log(`    shared             : ${diffAC.passiveTree.shared.length} nodes`);
check("tree: exactly 6 nodes only in (a)", eqArr(diffAC.passiveTree.onlyInA, EXPECT_ONLY_A),
  `[${diffAC.passiveTree.onlyInA.join(",")}]`);
check("tree: exactly 6 nodes only in (c)", eqArr(diffAC.passiveTree.onlyInB, EXPECT_ONLY_C),
  `[${diffAC.passiveTree.onlyInB.join(",")}]`);
check("tree: 94 shared nodes", diffAC.passiveTree.shared.length === 94);

// -- gear per slot --
console.log("\n  Gear (per slot):");
const changedSlots = diffAC.gear.filter((g) => g.status !== "unchanged");
for (const g of diffAC.gear) {
  const flag = g.status === "unchanged" ? "     " : ` <-- ${g.status}`;
  console.log(`    ${g.slot.padEnd(12)} ${g.status.padEnd(9)}` +
    `${g.a?.itemRef ?? "∅"} -> ${g.b?.itemRef ?? "∅"}${flag}`);
  if (g.status === "changed") {
    console.log(`        + ${g.addedModLines.join(" | ")}`);
    console.log(`        - ${g.removedModLines.join(" | ")}`);
  }
}
const boots = diffAC.gear.find((g) => g.slot === "Boots");
check("gear: exactly one slot changed", changedSlots.length === 1,
  `changed: ${changedSlots.map((g) => g.slot).join(",")}`);
check("gear: the changed slot is Boots", changedSlots[0]?.slot === "Boots");
check("gear: (a) Boots = Stealth Boots", boots?.a?.itemRef === "Stealth Boots");
check("gear: (c) Boots = Seven-League Step", boots?.b?.itemRef === "Seven-League Step");
check("gear: (c) Boots rarity Unique", boots?.b?.rarity === "Unique");
check("gear: Boots gains +45% Movement Speed",
  boots?.addedModLines.includes("+45% Movement Speed") ?? false);
check("gear: Boots gains Tailwind on Kill",
  boots?.addedModLines.includes("10% chance to gain Tailwind on Kill") ?? false);
check("gear: Boots loses +30% Movement Speed",
  boots?.removedModLines.includes("+30% Movement Speed") ?? false);

// -- gems / skills --
console.log("\n  Skills / gems:");
const changedSetups = diffAC.skills.filter((s) => s.status !== "unchanged");
for (const s of diffAC.skills) {
  const supA = s.a ? `[${s.a.skillGemRef}: ${s.a.supports.join(",")}]` : "∅";
  const supB = s.b ? `[${s.b.skillGemRef}: ${s.b.supports.join(",")}]` : "∅";
  console.log(`    ${s.setupId.padEnd(10)} ${s.status.padEnd(9)}${supA} -> ${supB}`);
}
const sgMain = diffAC.skills.find((s) => s.setupId === "sg-main");
check("gems: exactly one setup changed", changedSetups.length === 1,
  `changed: ${changedSetups.map((s) => s.setupId).join(",")}`);
check("gems: the changed setup is the main group (sg-main)", changedSetups[0]?.setupId === "sg-main");
check("gems: active skill unchanged (Twister)",
  (sgMain?.a?.skillGemRef ?? null) === "Twister" && (sgMain?.b?.skillGemRef ?? null) === "Twister");
check("gems: (a) has SupportFork", sgMain?.a?.supports.includes("SupportFork") ?? false);
check("gems: (c) swaps to SupportChain",
  (sgMain?.b?.supports.includes("SupportChain") ?? false) &&
    !(sgMain?.b?.supports.includes("SupportFork") ?? true));

// -- config --
const changedConfig = diffAC.config.filter((c2) => c2.status !== "unchanged");
check("config: unchanged (a==c)", changedConfig.length === 0,
  `changed keys: ${changedConfig.map((k) => k.key).join(",") || "none"}`);

// -- candidate accounting: 6+6 nodes + 1 boots + 2 support atoms = 15 --
const byKind = new Map<string, number>();
for (const cand of diffAC.candidates) {
  const k = cand.operations[0]!.kind;
  byKind.set(k, (byKind.get(k) ?? 0) + 1);
}
console.log("\n  Candidate BuildMutations emitted by the diff (each promotable):");
console.log(`    ${[...byKind.entries()].map(([k, n]) => `${k}×${n}`).join("  ")}`);
console.log(`    total = ${diffAC.candidates.length}`);
check("candidates: 6 allocatePassiveNode", byKind.get("allocatePassiveNode") === 6);
check("candidates: 6 deallocatePassiveNode", byKind.get("deallocatePassiveNode") === 6);
check("candidates: 1 swapItem", byKind.get("swapItem") === 1);
check("candidates: 2 changeSupport (Fork->Chain swap = -Fork +Chain)",
  byKind.get("changeSupport") === 2);
check("candidates: 15 total (matches differences.md: boots + 6 nodes + 1 gem-swap)",
  diffAC.candidates.length === 15);

// ---------------------------------------------------------------------------
hr("3. CONSENSUS — the ladder variant (c) vs 2 mainstream sources (a),(b)");
console.log(
  "\n  A poe.ninja ladder player (c) compares against two aggregated mainstream\n" +
    "  sources of the same archetype: (a) Maxroll-native and (b) PoB-code.\n" +
    "  A change corroborated by >=2 distinct sources is flagged community-validated\n" +
    "  (PRODUCT_PLAN: 'statistically common choices across sources rank higher').",
);
const consensus: MultiCompareResult = compareMany(c.snapshot, [
  { sourceId: "a-maxroll", snapshot: a.snapshot },
  { sourceId: "b-pob", snapshot: b.snapshot },
]);
console.log(`\n  Community-validated changes (corroborated by both a AND b): ${consensus.consensus.length}`);
const nodeConsensus = consensus.consensus.filter(
  (cc) => cc.candidate.operations[0]!.kind.endsWith("PassiveNode"),
);
for (const cc of consensus.consensus) {
  console.log(
    `    [${cc.sourceCount}/2 sources] ${describeCandidate(cc.candidate)}  key=${cc.changeKey}`,
  );
}
check("consensus: all 12 passive-node changes reach community-validation across both formats",
  nodeConsensus.length === 12, `got ${nodeConsensus.length}`);
check("consensus: every consensus change carries sourceCount 2",
  consensus.consensus.every((cc) => cc.sourceCount === 2 && cc.communityValidated));
check("consensus: attribution dropped on consensus candidates (meaningless for shared changes)",
  consensus.consensus.every((cc) => cc.candidate.origin === undefined));

// Honest importer-fidelity finding (a residual, NOT a comparator defect).
const aChanges = new Set(
  consensus.perSource.find((p) => p.sourceId === "a-maxroll")!.diff.candidates.map((x) =>
    changeKey(x.operations[0]!),
  ),
);
const bChanges = new Set(
  consensus.perSource.find((p) => p.sourceId === "b-pob")!.diff.candidates.map((x) =>
    changeKey(x.operations[0]!),
  ),
);
const aBootsKeys = [...aChanges].filter((k) => k.startsWith("gear:") && k.includes(":Boots:"));
const bBootsKeys = [...bChanges].filter((k) => k.startsWith("gear:") && k.includes(":Boots:"));
const bootsDifferentFingerprint =
  aBootsKeys.length === 1 && bBootsKeys.length === 1 && aBootsKeys[0] !== bBootsKeys[0];
const bootsInConsensus = consensus.consensus.some(
  (cc) => cc.changeKey.startsWith("gear:") && cc.changeKey.includes(":Boots:"),
);
const aHasGemSwap = [...aChanges].some((k) => k.startsWith("support:"));
const bHasGemSwap = [...bChanges].some((k) => k.startsWith("support:"));
console.log(
  "\n  RESIDUAL FINDING (importer fidelity, not a comparator bug):\n" +
    "    The boots swap and the Fork->Chain gem swap do NOT reach consensus, for two\n" +
    "    distinct importer-side reasons:\n" +
    `    • boots: a genuine Boots swap appears in BOTH per-source diffs, but under\n` +
    `      DIFFERENT change keys — a's fingerprint ${aBootsKeys[0]?.slice(-8)} vs\n` +
    `      b's ${bBootsKeys[0]?.slice(-8)} — because the PoB importer folds\n` +
    "      Rarity/name/base-type into the item's modifier lines, so the same Stealth\n" +
    "      Boots fingerprints differently. Not co-bucketed -> no consensus.\n" +
    `    • gem: the Fork->Chain support swap appears in native (a) only (present in a=${aHasGemSwap},\n` +
    `      in b=${bHasGemSwap}) — the PoB importer synthesizes group ids (group-1) instead of\n` +
    "      the native setup ids (sg-main), so no changeSupport candidate lines up against (c).\n" +
    "    The comparator is CORRECT in both cases; the gap is importer-side normalization\n" +
    "    (stable setup ids + mod-line parsing) to close before the gate fully shuts.\n" +
    "    Passive-node ids are format-independent, so tree consensus is already robust today.",
);
check("residual: Boots swap present in both sources but different fingerprints -> no consensus",
  bootsDifferentFingerprint && !bootsInConsensus);
check("residual: gem swap present in native (a) only, absent from PoB (b) -> no consensus",
  aHasGemSwap && !bHasGemSwap);

// ---------------------------------------------------------------------------
hr("4. PROMOTABILITY — a diff candidate is a real core BuildMutation");
console.log(
  "\n  Every diff candidate is a promotable core BuildMutation. Promote the headline\n" +
    "  upgrade — adopt (c)'s Seven-League Step boots onto baseline (a) — with core\n" +
    "  promoteMutation, producing a NEW immutable snapshot (base is never mutated).",
);
const bootsCandidate = diffAC.candidates.find(
  (cand) => cand.operations[0]!.kind === "swapItem",
)!;
console.log(`\n    candidate      : ${describeCandidate(bootsCandidate)}`);
console.log(`    baseSnapshotId : ${bootsCandidate.baseSnapshotId.slice(0, 12)}…`);
console.log(`    mutationId     : ${bootsCandidate.mutationId.slice(0, 12)}…`);
const promoted = promoteMutation(a.snapshot, bootsCandidate);
const promotedBoots = getPrimaryLoadout(promoted)?.equipment.find((e) => e.slot === "Boots");
const baseBoots = getPrimaryLoadout(a.snapshot)?.equipment.find((e) => e.slot === "Boots");
console.log(`    base (a) Boots     : ${baseBoots?.itemRef}`);
console.log(`    promoted   Boots   : ${promotedBoots?.itemRef}`);
console.log(`    base identity      : ${a.snapshot.identity.slice(0, 12)}…`);
console.log(`    promoted identity  : ${promoted.identity.slice(0, 12)}…  (source=${promoted.metadata.provenance.source})`);
check("promote: base snapshot unchanged (immutable — still Stealth Boots)",
  baseBoots?.itemRef === "Stealth Boots");
check("promote: promoted snapshot has Seven-League Step boots",
  promotedBoots?.itemRef === "Seven-League Step");
check("promote: promoted identity differs from base (new build state -> new identity)",
  promoted.identity !== a.snapshot.identity);
check("promote: provenance records the promotion (source = promoted-mutation)",
  promoted.metadata.provenance.source === "promoted-mutation");

// Also prove a consensus node candidate promotes (adopt a mainstream node onto c).
const nodeCand = nodeConsensus.find((cc) => cc.candidate.operations[0]!.kind === "allocatePassiveNode");
if (nodeCand) {
  const promotedNode = promoteMutation(c.snapshot, {
    mutationId: nodeCand.candidate.mutationId,
    baseSnapshotId: nodeCand.candidate.baseSnapshotId,
    operations: nodeCand.candidate.operations,
  });
  const op = nodeCand.candidate.operations[0]!;
  const nodeId = op.kind === "allocatePassiveNode" ? op.nodeId : -1;
  check("promote: a consensus node candidate also promotes cleanly onto (c)",
    nodesOf(promotedNode).includes(nodeId) && promotedNode.identity !== c.snapshot.identity,
    `node ${nodeId}`);
}

// ---------------------------------------------------------------------------
hr("SUMMARY");
console.log(`\n  ${checks - failures.length}/${checks} checks passed.`);
if (failures.length > 0) {
  console.log("\n  FAILURES:");
  for (const f of failures) console.log("    - " + f);
  console.log("\nS6 DEMO: FAIL");
  process.exit(1);
}
console.log(
  "\n  PROVEN: 3 sources / 2 formats -> one canonical BuildSnapshot shape; the (a)->(c)\n" +
    "  comparator diff matches differences.md exactly (boots + 6 nodes + 1 gem swap);\n" +
    "  cross-format tree consensus is community-validated; diff candidates promote via\n" +
    "  core promoteMutation. See docs/spikes/s6-aggregation-feasibility.md for the verdict.",
);
console.log("\nS6 DEMO: PASS");
