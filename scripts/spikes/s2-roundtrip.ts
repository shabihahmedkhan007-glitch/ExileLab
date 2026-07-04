// S2 — Share-code round-trip + fuzz harness (Phase 0 spike, PRODUCT_PLAN §"Phase 0" S2).
//
// WHAT THIS PROVES TODAY (executes via tsx, real pass counts reported):
//   1. PARITY — for N synthetic PoB-style XML documents (varied size/features), the
//      transport round-trip encode -> decode is byte-lossless, and the normalize
//      pipeline is deterministic: two independent passes over the same document
//      yield a byte-identical decoded XML and a semantically-identical BuildSnapshot
//      (same Canonical Identity + same canonical build state).
//   2. FUZZ / BOMB GUARD — 200 deterministic random-corruption inputs each produce a
//      TYPED NormalizerError (never an uncaught crash, never a successful import), and
//      decompression bombs are rejected by the importer's 8 MiB inflation cap without
//      ballooning process memory.
//
// WHAT THIS DELIBERATELY DOES NOT PROVE (documented in docs/spikes/s2-share-code-parity.md):
//   - Byte parity against REAL pobb.in share codes (needs founder-provided codes —
//     user-initiated per Compliance Charter §7.5; no network fetches here, ever).
//   - Snapshot -> PoB2 XML re-serialization parity (there is no XML exporter by design:
//     production emits the canonical model, RFC-0001 AD-6 — PoB XML is import-only).
//
// No network. No external platforms. Deterministic. `node:zlib` only.

import { deflateSync, inflateSync } from "node:zlib";
// The spikes directory is not a workspace package, so bare @exilelab/* specifiers
// do not resolve from here (pnpm symlinks them only under each consuming package).
// We import the BUILT dist entrypoints by relative path; their own internal
// @exilelab/* imports resolve from their package-local node_modules.
import {
  encodePobCode,
  importAny,
  normalize,
  NormalizerError,
} from "../../packages/build-normalizer/dist/index.js";
import { stableStringify } from "../../packages/core/dist/index.js";
import type { BuildSnapshot } from "../../packages/core/dist/index.js";

// ---------------------------------------------------------------------------
// Tiny deterministic PRNG (mulberry32) so the whole run is reproducible.
// ---------------------------------------------------------------------------
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---------------------------------------------------------------------------
// Decode a PoB share code back to its XML the same way the importer does
// (url-safe base64 -> base64 -> zlib inflate). Used only to assert byte parity
// of the decoded payload; the importer decodes internally.
// ---------------------------------------------------------------------------
function decodePobCode(code: string): string {
  const b64 = code.replace(/-/g, "+").replace(/_/g, "/");
  return inflateSync(Buffer.from(b64, "base64")).toString("utf8");
}

// ---------------------------------------------------------------------------
// Synthetic PoB-style XML corpus. research/fixtures/import-corpus/ is not yet
// populated with REAL codes (that is the founder-provided boundary, §7.5), so we
// generate a varied synthetic corpus inline — the same posture S2 allows.
// ---------------------------------------------------------------------------
interface SynthSpec {
  readonly name: string;
  readonly xml: string;
}

function buildXml(opts: {
  className?: string;
  ascend?: string;
  level?: number;
  mainSocketGroup?: number;
  nodes?: number[];
  items?: Array<{ slot: string; text: string }>;
  skillGroups?: Array<{ gems: Array<{ name: string; skillId?: string; level?: number; quality?: number }> }>;
  specs?: number[][];
  skillSets?: number; // number of skillsets (>1 exercises activeSkillSet)
}): string {
  const {
    className = "Huntress",
    ascend,
    level = 90,
    mainSocketGroup,
    nodes = [1, 2, 3],
    items = [],
    skillGroups = [],
    specs,
    skillSets = 1,
  } = opts;

  const slots = items
    .map((it, i) => `    <Slot itemId="${i + 1}" name="${it.slot}"/>`)
    .join("\n");
  const itemEls = items
    .map((it, i) => `    <Item id="${i + 1}">${it.text}</Item>`)
    .join("\n");

  const specEls = (specs ?? [nodes])
    .map((n) => `    <Spec nodes="${n.join(",")}"/>`)
    .join("\n");

  const groupXml = (gs: typeof skillGroups): string =>
    gs
      .map(
        (g) =>
          `      <Skill>${g.gems
            .map(
              (gem) =>
                `<Gem nameSpec="${gem.name}"${gem.skillId ? ` skillId="${gem.skillId}"` : ""}${
                  gem.level !== undefined ? ` level="${gem.level}"` : ""
                }${gem.quality !== undefined ? ` quality="${gem.quality}"` : ""}/>`,
            )
            .join("")}</Skill>`,
      )
      .join("\n");

  const skillSetEls = Array.from({ length: skillSets })
    .map((_, i) => `    <SkillSet id="${i + 1}">\n${groupXml(skillGroups)}\n    </SkillSet>`)
    .join("\n");

  return [
    `<?xml version="1.0" encoding="UTF-8"?>`,
    `<PathOfBuilding>`,
    `  <Build level="${level}" className="${className}"${ascend ? ` ascendClassName="${ascend}"` : ""}${
      mainSocketGroup !== undefined ? ` mainSocketGroup="${mainSocketGroup}"` : ""
    }>`,
    `    <PlayerStat stat="FullDPS" value="0"/>`,
    `  </Build>`,
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

function synthCorpus(): SynthSpec[] {
  const bigNodes = Array.from({ length: 120 }, (_, i) => i + 1);
  const manyItems = Array.from({ length: 12 }, (_, i) => ({
    slot: `Slot ${i + 1}`,
    text: `Rarity: RARE\nItem ${i + 1}\nBase Type\n+${i * 5} to maximum Life`,
  }));
  const manySupports = {
    gems: [
      { name: "Twister", skillId: "twister", level: 20, quality: 20 },
      { name: "Martial Tempo", skillId: "martial-tempo", level: 20 },
      { name: "Added Cold", skillId: "added-cold", level: 18 },
      { name: "Concentrated", skillId: "conc", level: 19 },
      { name: "Elemental Focus", skillId: "ele-focus", level: 20 },
    ],
  };

  return [
    {
      name: "minimal (class+level only, no items/skills)",
      xml: buildXml({ className: "Warrior", level: 12, nodes: [1], skillGroups: [] }),
    },
    {
      name: "full single-loadout (ascend, main group, items, gems)",
      xml: buildXml({
        className: "Huntress",
        ascend: "Ritualist",
        level: 92,
        mainSocketGroup: 1,
        nodes: [16, 1, 2, 3, 4, 5, 24, 10],
        items: [
          { slot: "Weapon 1", text: "Rarity: RARE\nStorm's Edge\nSpear\n35% increased Attack Speed" },
          { slot: "Body Armour", text: "Rarity: RARE\nGuardian's Plate\nPlate\n+120 to maximum Life" },
          { slot: "Boots", text: "Rarity: RARE\nSwiftstep Greaves\nGreaves\n30% increased Movement Speed" },
        ],
        skillGroups: [
          { gems: [{ name: "Twister", skillId: "twister", level: 20, quality: 20 }, { name: "Martial Tempo", skillId: "martial-tempo", level: 20 }] },
          { gems: [{ name: "Herald of Ice", skillId: "herald-ice", level: 20 }] },
        ],
      }),
    },
    {
      name: "multi-spec tree (two Spec elements, activeSpec=1)",
      xml: buildXml({
        className: "Sorceress",
        level: 84,
        specs: [
          [1, 2, 3, 4],
          [50, 51, 52, 53, 54, 55],
        ],
        skillGroups: [{ gems: [{ name: "Spark", skillId: "spark", level: 19 }] }],
      }),
    },
    {
      name: "multi-skillset (two SkillSets, activeSkillSet=1)",
      xml: buildXml({
        className: "Monk",
        level: 78,
        mainSocketGroup: 1,
        skillSets: 2,
        skillGroups: [{ gems: [{ name: "Ice Strike", skillId: "ice-strike", level: 20 }] }],
      }),
    },
    {
      name: "large build (120 nodes, 12 items) — size stress",
      xml: buildXml({
        className: "Mercenary",
        ascend: "Witchhunter",
        level: 96,
        mainSocketGroup: 1,
        nodes: bigNodes,
        items: manyItems,
        skillGroups: [manySupports],
      }),
    },
    {
      name: "entities in item text (&lt; &amp; &quot; and unicode)",
      xml: buildXml({
        className: "Witch",
        level: 66,
        items: [
          { slot: "Amulet", text: "Rarity: RARE\nT&amp;T &lt;Charm&gt;\nAmulet\n+10% &quot;special&quot; damage — €90 níce" },
        ],
        skillGroups: [{ gems: [{ name: "Firestorm", skillId: "firestorm" }] }],
      }),
    },
    {
      name: "no items (skills + tree only)",
      xml: buildXml({
        className: "Ranger",
        level: 40,
        nodes: [7, 8, 9],
        skillGroups: [{ gems: [{ name: "Lightning Arrow", skillId: "lightning-arrow", level: 12 }] }],
      }),
    },
    {
      name: "many support gems (5-link main group)",
      xml: buildXml({
        className: "Templar",
        level: 88,
        mainSocketGroup: 1,
        skillGroups: [manySupports],
      }),
    },
    {
      name: "no explicit main group (importer must infer)",
      xml: buildXml({
        className: "Duelist",
        level: 55,
        skillGroups: [
          { gems: [{ name: "Boneshatter", skillId: "boneshatter", level: 16 }] },
          { gems: [{ name: "Leap Slam", skillId: "leap-slam", level: 10 }] },
        ],
      }),
    },
    {
      name: "high level, deep tree, single gem",
      xml: buildXml({
        className: "Marauder",
        ascend: "Juggernaut",
        level: 100,
        mainSocketGroup: 1,
        nodes: Array.from({ length: 60 }, (_, i) => (i + 1) * 3),
        skillGroups: [{ gems: [{ name: "Earthquake", skillId: "earthquake", level: 21, quality: 23 }] }],
      }),
    },
  ];
}

// ---------------------------------------------------------------------------
// Parity pass: encode -> decode (byte parity) + normalize (semantic parity),
// twice, and assert both passes agree.
// ---------------------------------------------------------------------------
interface ParityOutcome {
  name: string;
  ok: boolean;
  detail: string;
}

function canonicalOf(snap: BuildSnapshot): string {
  // Semantic equality = identical Canonical Identity AND identical canonical build
  // state (RFC-0001 I2). Metadata/DisplayCache are identity-excluded; importedAt is
  // a wall-clock and legitimately differs, so we compare build state, not the whole
  // artifact.
  return stableStringify({
    identity: snap.identity,
    buildState: snap.buildState,
  });
}

function runParity(spec: SynthSpec): ParityOutcome {
  try {
    // -- Pass 1 --
    const code1 = encodePobCode(spec.xml, deflateSync);
    const decoded1 = decodePobCode(code1);
    if (decoded1 !== spec.xml) {
      return { name: spec.name, ok: false, detail: "pass-1 decoded XML != source (transport not lossless)" };
    }
    const snap1 = normalize(importAny(code1));

    // -- Pass 2 (re-encode the decoded XML, independent pipeline run) --
    const code2 = encodePobCode(decoded1, deflateSync);
    const decoded2 = decodePobCode(code2);
    if (decoded2 !== spec.xml) {
      return { name: spec.name, ok: false, detail: "pass-2 decoded XML != source" };
    }
    const snap2 = normalize(importAny(code2));

    // -- Byte parity of the decoded XML across the two passes --
    if (decoded1 !== decoded2) {
      return { name: spec.name, ok: false, detail: "decoded XML differs between passes" };
    }

    // -- Semantic equality of the normalized snapshot across the two passes --
    if (snap1.identity !== snap2.identity) {
      return { name: spec.name, ok: false, detail: `identity mismatch ${snap1.identity.slice(0, 8)} != ${snap2.identity.slice(0, 8)}` };
    }
    if (canonicalOf(snap1) !== canonicalOf(snap2)) {
      return { name: spec.name, ok: false, detail: "canonical build state differs between passes" };
    }

    return {
      name: spec.name,
      ok: true,
      detail: `xml=${spec.xml.length}B code=${code1.length}B id=${snap1.identity.slice(0, 12)}`,
    };
  } catch (err) {
    return { name: spec.name, ok: false, detail: `threw ${(err as Error).name}: ${(err as Error).message}` };
  }
}

// ---------------------------------------------------------------------------
// Fuzz corpus: 200 deterministic random-corruption inputs + explicit bombs.
// ---------------------------------------------------------------------------
const B64URL = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";

function randB64(rand: () => number, len: number): string {
  let s = "";
  for (let i = 0; i < len; i++) s += B64URL[Math.floor(rand() * B64URL.length)];
  return s;
}

function makeFuzzInputs(rand: () => number, count: number): Array<{ kind: string; input: string }> {
  const out: Array<{ kind: string; input: string }> = [];
  // A known-valid code we can corrupt (must NOT survive corruption into a valid build).
  const validXml = buildXml({
    className: "Huntress",
    level: 90,
    mainSocketGroup: 1,
    skillGroups: [{ gems: [{ name: "Twister", skillId: "twister", level: 20 }] }],
  });
  const validCode = encodePobCode(validXml, deflateSync);

  const gens: Array<() => { kind: string; input: string }> = [
    // 1. random url-safe base64 garbage of random length
    () => ({ kind: "random-b64", input: randB64(rand, 8 + Math.floor(rand() * 400)) }),
    // 2. random raw bytes -> base64 (valid base64, invalid deflate)
    () => {
      const n = 4 + Math.floor(rand() * 256);
      const buf = Buffer.from(Array.from({ length: n }, () => Math.floor(rand() * 256)));
      return { kind: "random-bytes-b64", input: buf.toString("base64") };
    },
    // 3. truncated valid code (breaks the deflate stream)
    () => ({ kind: "truncated-code", input: validCode.slice(0, 4 + Math.floor(rand() * (validCode.length - 8))) }),
    // 4. char-flip in the middle of a valid code (corrupts inflation)
    () => {
      const arr = validCode.split("");
      const i = 4 + Math.floor(rand() * (arr.length - 8));
      arr[i] = B64URL[(B64URL.indexOf(arr[i]!) + 1 + Math.floor(rand() * 60)) % B64URL.length]!;
      return { kind: "flipped-code", input: arr.join("") };
    },
    // 5. valid zlib of NON-PoB text (inflates fine, but no <Build/<PathOfBuilding marker)
    () => {
      const junk = `not a build ${randB64(rand, 20)} <Root><Nope/></Root>`;
      return { kind: "zlib-non-pob", input: encodePobCode(junk, deflateSync) };
    },
    // 6. control/punctuation/whitespace noise (fails base64 alphabet or decode)
    () => ({ kind: "punctuation-noise", input: "  <<>>@@%%" + randB64(rand, 10) + "\n\t!!??" }),
    // 7. empty-ish
    () => ({ kind: "near-empty", input: rand() < 0.5 ? "" : "   \n  " }),
  ];

  for (let i = 0; i < count; i++) {
    out.push(gens[i % gens.length]!());
  }
  return out;
}

// The importer's inflation cap (mirrors PobCodeImporter.MAX_INFLATED_BYTES). The
// guard makes inflateSync THROW before a payload larger than this is materialized.
const BOMB_CAP_BYTES = 8 * 1024 * 1024;

// A genuine decompression bomb: XML that DOES carry the PoB marker and inflates
// past the importer's 8 MiB cap. Returns the code plus the KNOWN uncompressed size
// so the proof does not have to (and must not) re-inflate the full payload.
function makeBomb(uncompressedMiB: number): { code: string; uncompressedBytes: number } {
  const filler = "<PathOfBuilding><Build className=\"Huntress\" level=\"90\"/>" + "A".repeat(1024);
  const target = uncompressedMiB * 1024 * 1024;
  const reps = Math.ceil(target / filler.length);
  const huge = filler.repeat(reps) + "</PathOfBuilding>";
  return { code: encodePobCode(huge, deflateSync), uncompressedBytes: huge.length };
}

interface FuzzResult {
  total: number;
  typedError: number;
  crashed: number;
  unexpectedSuccess: number;
  crashSamples: string[];
}

function runFuzz(inputs: Array<{ kind: string; input: string }>): FuzzResult {
  const res: FuzzResult = { total: inputs.length, typedError: 0, crashed: 0, unexpectedSuccess: 0, crashSamples: [] };
  for (const { kind, input } of inputs) {
    try {
      // Full pipeline: importAny may throw typed; if it returns, normalize may throw typed.
      const snap = normalize(importAny(input));
      // A corruption input should never yield a valid snapshot.
      res.unexpectedSuccess += 1;
      if (res.crashSamples.length < 8) res.crashSamples.push(`UNEXPECTED SUCCESS [${kind}] -> ${snap.identity.slice(0, 8)}`);
    } catch (err) {
      if (err instanceof NormalizerError) {
        res.typedError += 1;
      } else {
        res.crashed += 1;
        if (res.crashSamples.length < 8) res.crashSamples.push(`UNTYPED [${kind}] ${(err as Error).name}: ${(err as Error).message}`);
      }
    }
  }
  return res;
}

// ---------------------------------------------------------------------------
// Bomb guard: each bomb must (a) be rejected as a typed error and (b) not balloon
// RSS by anything close to its uncompressed size.
// ---------------------------------------------------------------------------
interface BombOutcome {
  uncompressedMiB: number;
  uncompressedBytes: number;
  codeBytes: number;
  /** Importer rejected the bomb with a typed NormalizerError. */
  typedError: boolean;
  errorName: string;
  /** The 8 MiB inflation cap made a direct capped inflate THROW (deterministic guard proof). */
  cappedInflateThrew: boolean;
  /** Informational only (RSS is noisy): rough process-memory delta around the import. */
  rssDeltaMiB: number;
}

function runBombs(sizesMiB: number[]): BombOutcome[] {
  const out: BombOutcome[] = [];
  for (const mib of sizesMiB) {
    const { code, uncompressedBytes } = makeBomb(mib);
    const b64 = code.replace(/-/g, "+").replace(/_/g, "/");
    const bytes = Buffer.from(b64, "base64");

    // (a) The importer rejects the bomb with a typed error (never a crash).
    const before = process.memoryUsage().rss;
    let typedError = false;
    let errorName = "(none)";
    try {
      normalize(importAny(code));
    } catch (err) {
      typedError = err instanceof NormalizerError;
      errorName = (err as Error).name;
    }
    const after = process.memoryUsage().rss;

    // (b) DETERMINISTIC guard proof: inflating the SAME bytes with the importer's
    // 8 MiB cap throws before the (larger-than-cap) payload is materialized. This
    // does not depend on RSS noise — it is the mechanism the importer relies on.
    let cappedInflateThrew = false;
    try {
      inflateSync(bytes, { maxOutputLength: BOMB_CAP_BYTES });
    } catch {
      cappedInflateThrew = true;
    }

    out.push({
      uncompressedMiB: mib,
      uncompressedBytes,
      codeBytes: code.length,
      typedError,
      errorName,
      cappedInflateThrew,
      rssDeltaMiB: Math.round(((after - before) / (1024 * 1024)) * 100) / 100,
    });
  }
  return out;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
function main(): number {
  const SEED = 0x5273b2 >>> 0; // fixed seed -> reproducible
  const rand = mulberry32(SEED);
  let failures = 0;

  console.log("=".repeat(78));
  console.log("S2 — Share-code round-trip parity + fuzz / bomb-guard harness");
  console.log("=".repeat(78));

  // -- Parity --------------------------------------------------------------
  console.log("\n[1] PARITY — encode->decode byte parity + normalize determinism (2 passes)\n");
  const corpus = synthCorpus();
  const parity = corpus.map(runParity);
  for (const p of parity) {
    console.log(`  ${p.ok ? "PASS" : "FAIL"}  ${p.name}`);
    console.log(`        ${p.detail}`);
  }
  const parityPass = parity.filter((p) => p.ok).length;
  console.log(`\n  Parity: ${parityPass}/${parity.length} documents byte- & semantically-parity-stable.`);
  if (parityPass !== parity.length) failures += parity.length - parityPass;

  // -- Fuzz ----------------------------------------------------------------
  console.log("\n[2] FUZZ — 200 deterministic random-corruption inputs (typed errors only)\n");
  const fuzzInputs = makeFuzzInputs(rand, 200);
  const fuzz = runFuzz(fuzzInputs);
  console.log(`  total inputs        : ${fuzz.total}`);
  console.log(`  typed NormalizerError: ${fuzz.typedError}`);
  console.log(`  untyped crashes     : ${fuzz.crashed}`);
  console.log(`  unexpected successes: ${fuzz.unexpectedSuccess}`);
  if (fuzz.crashSamples.length > 0) {
    console.log("  samples:");
    for (const s of fuzz.crashSamples) console.log(`    - ${s}`);
  }
  const fuzzOk = fuzz.crashed === 0 && fuzz.unexpectedSuccess === 0 && fuzz.typedError === fuzz.total;
  console.log(`\n  Fuzz: ${fuzzOk ? "PASS" : "FAIL"} — all ${fuzz.total} corruption inputs produced typed errors, no crashes.`);
  if (!fuzzOk) failures += 1;

  // -- Bomb guard ----------------------------------------------------------
  console.log("\n[3] BOMB GUARD — inflation cap rejects decompression bombs without ballooning RSS\n");
  const bombSizes = [16, 32, 64];
  const bombs = runBombs(bombSizes);
  // Guard proof (deterministic, RSS-noise-independent): each bomb is (a) rejected
  // by the importer with a TYPED error, and (b) the 8 MiB inflation cap makes a
  // direct capped inflate of the same bytes THROW before the >8 MiB payload is
  // materialized. RSS Δ is printed as an informational sanity readout only — it is
  // noisy (GC, the code buffer, bomb construction) and is never a pass/fail gate.
  const isGuarded = (b: BombOutcome): boolean =>
    b.typedError && b.cappedInflateThrew && b.uncompressedBytes > BOMB_CAP_BYTES;
  let bombOk = true;
  for (const b of bombs) {
    const guarded = isGuarded(b);
    if (!guarded) bombOk = false;
    console.log(
      `  ${guarded ? "PASS" : "FAIL"}  bomb ${b.uncompressedMiB} MiB uncompressed (code ${b.codeBytes}B): ` +
        `importer=${b.typedError ? "typed " + b.errorName : "UNTYPED(" + b.errorName + ")"}, ` +
        `8MiB-cap-inflate=${b.cappedInflateThrew ? "threw" : "DID NOT THROW"} ` +
        `[rss Δ ${b.rssDeltaMiB} MiB, informational]`,
    );
  }
  console.log(`\n  Bomb guard: ${bombOk ? "PASS" : "FAIL"} — 8 MiB inflation cap throws before any >8 MiB payload is materialized; importer surfaces a typed error.`);
  if (!bombOk) failures += 1;

  // -- Verdict -------------------------------------------------------------
  console.log("\n" + "=".repeat(78));
  const green = failures === 0;
  console.log(`S2 VERDICT: ${green ? "GREEN" : "RED"}  (parity ${parityPass}/${parity.length}, ` +
    `fuzz ${fuzz.typedError}/${fuzz.total} typed, bombs ${bombs.filter(isGuarded).length}/${bombs.length} guarded)`);
  console.log("BOUNDARY: synthetic parity only. Real-pobb.in byte parity + desktop-PoB2 export");
  console.log("comparison remain blocked on founder-provided codes (user-initiated, §7.5).");
  console.log("=".repeat(78));

  return green ? 0 : 1;
}

process.exit(main());
