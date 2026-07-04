# Fixture Corpus (SYNTHETIC)

> **Everything in `research/fixtures/` is synthetic and invented for testing.**
> No real player data. Nothing here was fetched from Maxroll, Mobalytics, poe.ninja,
> pobb.in, or the GGG API — there are **no network calls anywhere** in these fixtures
> or their generator scripts (compliance charter, `docs/PRODUCT_PRD.md` §7.5). Item
> names, modifier lines, passive-node ids, gem levels, and stat values are
> game-*plausible* PoE2 placeholders, **not** real game data.
>
> Per `research/README.md`, this directory only *gathers data to inform spikes*; it
> defines no product behavior. Findings that should change the product still graduate
> through an RFC.

This corpus lets the Phase 0 validation spikes run against a stable, offline, honestly
labeled input set before any real fixtures (real pobb.in codes, GGG-OAuth characters)
are available. It targets ExileLab's own **native-JSON interchange format** (the schema
in `packages/build-normalizer/src/importers/native-json.ts`); every fixture is validated
against that importer + the normalizer programmatically (see *Validation* below).

## Layout

```
research/fixtures/
├── README.md                     ← this file
├── benchmark-builds/             ← 3 builds — the S1 benchmark trio (PRD §9.3)
│   ├── melee-attacker.json         Warrior / Titan — Boneshatter slam
│   ├── minion-build.json           Witch / Infernalist — skeleton summoner
│   └── dot-caster.json             Witch / Blood Mage — Essence Drain chaos DoT
├── import-corpus/                ← 20 varied characters + manifest for S3
│   ├── char-01..char-20 *.json     spread of class/ascendancy/level 30–95 + edge cases
│   └── manifest.json               lists each character and its intended edge case
├── archetype-3-sources/          ← ONE archetype in 3 source versions for S6
│   ├── a-maxroll-native.json       (a) native JSON  "as if from Maxroll"
│   ├── b-pob-share-code.txt        (b) PoB-style share code (SAME build as a)
│   ├── c-poeninja-variant-native.json  (c) documented variant "as if poe.ninja"
│   └── differences.md              the intended a→c diff, for checking S6 output
└── scripts/
    ├── generate.ts                 (re)builds benchmark-builds/ + import-corpus/
    ├── make-pob-code.ts            emits (b) via encodePobCode + node:zlib deflate
    └── validate.ts                 imports + normalizes every fixture; must pass
```

## Which spike consumes which corpus

| Corpus | Spike | Use |
|---|---|---|
| `benchmark-builds/` | **S1 — engine benchmark** (PRD §9.3) | the melee / minion / DoT trio to time `calcs.perform` + `getMiscCalculator` against, once the real PoB2 LuaJIT sidecar replaces MockEngine. |
| `import-corpus/` | **S3 — import heuristics** (target ≥90% sane FullDPS) | 20 characters covering the messy inputs auto-main-skill + config-default heuristics must survive (no main flagged, empty gear, multi-loadout, spirit-heavy, ES-only, ambiguous main, missing skillIds, etc.). |
| `archetype-3-sources/` | **S6 — aggregation feasibility** (3-source normalize + diff) | one archetype from three "sources"; normalize all three and diff two versions (see `archetype-3-sources/differences.md`). Also exercises the Context Detector's *attack-as-movement* case (`char-17` in the import corpus is a second seed for that). |

## What is synthetic vs. what real data replaces it

| Here (synthetic) | Replaced in production by |
|---|---|
| `a-maxroll-native.json` | a build normalized from a real Maxroll public interchange endpoint (attribution retained; guide content excluded — charter §7.5). |
| `b-pob-share-code.txt` (hand-authored XML → code) | a **real pobb.in / desktop-PoB2 export code** pasted by a user or fetched from a public share link. |
| `c-poeninja-variant-native.json` | a real top-ladder character from the poe.ninja builds data feed (anonymized or attributed per the S6 compliance decision, UX_PRESENTATION §Q4). |
| `import-corpus/*.json` | real characters imported via **GGG OAuth** (character API) and pasted PoB codes. |
| Item names / mods / node ids / stat values | real PoE2 game data pinned to the imported build's patch (RFC-0001 AD-3 game-data references). |
| `gamePatch: "poe2-0.3.0"` | the actual patch each real import declares. |

Because these are ExileLab's own native format (or a self-generated PoB code), the
normalizer treats their fields as `imported` with no declared gaps — *except* the PoB
code (b), which legitimately declares gaps (e.g. `versioning.gamePatch`) exactly as a
real PoB paste would. That honesty is part of what the fixtures exercise (RFC-0001 I3/I4).

## Regenerating

Deterministic — the same seeds produce byte-identical files:

```sh
pnpm exec tsx research/fixtures/scripts/generate.ts        # benchmark-builds/ + import-corpus/
pnpm exec tsx research/fixtures/scripts/make-pob-code.ts   # archetype-3-sources/b-pob-share-code.txt
```

(`a-maxroll-native.json`, `c-poeninja-variant-native.json`, and the docs are checked in
directly — (b) mirrors (a), so it is generated.)

## Validation (the gate)

```sh
pnpm exec tsx research/fixtures/scripts/validate.ts
```

`validate.ts` routes every fixture through `detectSource → import → normalize` from
`@exilelab/build-normalizer` and asserts each yields a well-formed canonical
`BuildSnapshot` (has a Canonical Identity, ≥1 Loadout Context, exactly one primary —
RFC-0001 AD-5/I2). It also runs a cross-source sanity check: (a) and (b) describe the
same build, and (a)→(c) diverge by exactly the 6 nodes documented in `differences.md`.
Exit code 0 means the whole corpus imports and normalizes cleanly.
