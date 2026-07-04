/**
 * validate.ts — proves every SYNTHETIC fixture imports + normalizes cleanly.
 *
 * For each fixture it runs the REAL importer boundary (detectSource → import →
 * normalize) from @exilelab/build-normalizer and asserts the resulting canonical
 * BuildSnapshot is well-formed (has an identity, ≥1 Loadout Context, exactly one
 * primary — RFC-0001 AD-5/I2). No network, no external platforms.
 *
 * Run:  pnpm exec tsx research/fixtures/scripts/validate.ts
 * Exit code 0 = every fixture passed; non-zero = at least one failed.
 */

import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  detectSource,
  normalize,
  NativeJsonImporter,
  PobCodeImporter,
  type BuildSnapshot,
} from "../../../packages/build-normalizer/src/index.ts";

const HERE = dirname(fileURLToPath(import.meta.url));
const FIXTURES = join(HERE, "..");

let passed = 0;
const failures: string[] = [];

function assertSnapshot(label: string, snap: BuildSnapshot): void {
  if (typeof snap.identity !== "string" || snap.identity.length === 0) {
    throw new Error("snapshot has no Canonical Identity");
  }
  const contexts = snap.buildState.loadoutContexts;
  if (contexts.length < 1) throw new Error("snapshot has zero Loadout Contexts");
  const primaries = contexts.filter((c) => c.primary);
  if (primaries.length !== 1) {
    throw new Error(`expected exactly one primary Loadout Context, got ${primaries.length}`);
  }
}

function check(label: string, input: string, expectImporter: "native-json" | "pob-code"): void {
  try {
    const importer = detectSource(input);
    if (importer === null) throw new Error("detectSource returned null (no importer recognised it)");
    if (importer.source !== expectImporter) {
      throw new Error(`routed to '${importer.source}', expected '${expectImporter}'`);
    }
    const snap = normalize(importer.import(input));
    assertSnapshot(label, snap);
    passed += 1;
    console.log(`  ok  ${label}  [${importer.source}] id=${snap.identity.slice(0, 10)} contexts=${snap.buildState.loadoutContexts.length}`);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    failures.push(`${label}: ${msg}`);
    console.log(`  FAIL ${label}: ${msg}`);
  }
}

function nativeFilesIn(rel: string): string[] {
  return readdirSync(join(FIXTURES, rel))
    .filter((f) => f.endsWith(".json") && f !== "manifest.json")
    .sort()
    .map((f) => `${rel}/${f}`);
}

// --- benchmark-builds (native JSON) ---
console.log("\nbenchmark-builds/");
for (const rel of nativeFilesIn("benchmark-builds")) {
  check(rel, readFileSync(join(FIXTURES, rel), "utf8"), "native-json");
}

// --- import-corpus (native JSON, manifest excluded) ---
console.log("\nimport-corpus/");
for (const rel of nativeFilesIn("import-corpus")) {
  check(rel, readFileSync(join(FIXTURES, rel), "utf8"), "native-json");
}

// --- archetype-3-sources ---
console.log("\narchetype-3-sources/");
check(
  "archetype-3-sources/a-maxroll-native.json",
  readFileSync(join(FIXTURES, "archetype-3-sources/a-maxroll-native.json"), "utf8"),
  "native-json",
);
// (b) is a PoB share code file with a few '#' comment lines; take the code line.
const bRaw = readFileSync(join(FIXTURES, "archetype-3-sources/b-pob-share-code.txt"), "utf8");
const bCode = bRaw.split(/\r?\n/).find((l) => l.trim().length > 0 && !l.startsWith("#")) ?? "";
check("archetype-3-sources/b-pob-share-code.txt", bCode, "pob-code");
check(
  "archetype-3-sources/c-poeninja-variant-native.json",
  readFileSync(join(FIXTURES, "archetype-3-sources/c-poeninja-variant-native.json"), "utf8"),
  "native-json",
);

// --- Cross-source sanity for S6: (a) and (b) should describe the same build ---
console.log("\ncross-source sanity (S6):");
try {
  const a = normalize(new NativeJsonImporter().import(
    readFileSync(join(FIXTURES, "archetype-3-sources/a-maxroll-native.json"), "utf8"),
  ));
  const b = normalize(new PobCodeImporter().import(bCode));
  const c = normalize(new NativeJsonImporter().import(
    readFileSync(join(FIXTURES, "archetype-3-sources/c-poeninja-variant-native.json"), "utf8"),
  ));
  const nodesA = a.buildState.loadoutContexts[0]!.passiveTree.allocatedNodes;
  const nodesB = b.buildState.loadoutContexts[0]!.passiveTree.allocatedNodes;
  const nodesC = c.buildState.loadoutContexts[0]!.passiveTree.allocatedNodes;
  const sameClass = a.buildState.character.class === b.buildState.character.class;
  const sameLevel = a.buildState.character.level === b.buildState.character.level;
  const sameNodesAB = JSON.stringify(nodesA) === JSON.stringify(nodesB);
  const nodeDiffAC = nodesA.filter((n) => !nodesC.includes(n)).length;
  console.log(`  a≈b: class match=${sameClass} level match=${sameLevel} identical-nodes=${sameNodesAB}`);
  console.log(`  a→c intended 6-node divergence: ${nodeDiffAC} nodes only in (a)`);
  if (!sameClass || !sameLevel || !sameNodesAB) {
    failures.push("cross-source: (a) and (b) do not describe the same build");
  }
  if (nodeDiffAC !== 6) {
    failures.push(`cross-source: expected 6 diverging nodes a→c, got ${nodeDiffAC}`);
  }
} catch (err) {
  failures.push(`cross-source sanity: ${err instanceof Error ? err.message : String(err)}`);
}

// --- Summary ---
console.log(`\n${passed} fixtures imported + normalized cleanly; ${failures.length} failure(s).`);
if (failures.length > 0) {
  for (const f of failures) console.log("  - " + f);
  process.exit(1);
}
console.log("ALL FIXTURES PASS.");
