# S3 — Import heuristics scorecard (spike report)

> **Phase 0 spike** (PRODUCT_PLAN §"Phase 0", S3). Status: **pipeline proof GREEN; ≥90%-sane-FullDPS
> gate BLOCKED-ON-S1.** Harness: `scripts/spikes/s3-import-heuristics.ts` (executes today via `tsx`).
> Corpus: `research/fixtures/import-corpus/` (20 characters + `manifest.json`).

## 0. TL;DR

Every one of the **20** corpus characters flows through the real backend import pipeline
(`detectSource → import → normalize → ExileLabService` main-skill/config/MockEngine) **without a
crash**, and for **every** import the RFC-0001 honesty invariant holds and configuration is
well-formed and declared. Main-skill selection and FullDPS are **reported**, not silently assumed.

```
imports without crash                     : 20/20 (100%)
main skill selected                       : 18/20 (90%)   (imported 17, inferred 1)
configuration sane (declared + well-formed): 20/20 (100%)
assumptions declared for every default    : 20/20 (100%)
FullDPS sane (>0, finite)                 : 19/20 (95%)   ← MockEngine, gate BLOCKED-ON-S1
S3 VERDICT: GREEN (pipeline proof)   [gate BLOCKED-ON-S1]
```

Run it:

```
pnpm exec tsx scripts/spikes/s3-import-heuristics.ts
```

## 1. Where the heuristics actually live

The task asks us to score "backend main-skill/config heuristics." In this codebase those heuristics
are **implicit in the normalizer's defaults + the backend's summarize step**, not a separate module —
so that is what the spike evaluates (per the task's "if heuristics live implicit in normalizer
defaults, evaluate THOSE"):

- **Main-skill selection.** The importer marks a group `isMain` from the source's explicit
  designation (`mainSocketGroup` for PoB; `isMain` for native JSON). The **normalizer**
  (`packages/build-normalizer/src/normalizer.ts`) resolves exactly one main skill per loadout:
  the explicitly-flagged group if present (recorded `imported`), else the **first** group
  (recorded `inferred`), else none. The **backend** (`backend/api/src/services.ts` `summarize()`)
  then reads `primaryLoadout.skills.find(isMainSkill) ?? skills[0]` and resolves its display name via
  the Display Cache. The spike checks *both*: was a main skill resolved, and was it `imported`
  (explicit) or `inferred` (defaulted)?
- **Configuration.** The normalizer lifts the primary loadout's `configuration` into build-state
  `ConfigEntry[]`, recording `imported` when the source carried config and `defaulted` when it did
  not (never silent). MockEngine only consumes `enemy.isBoss` today, so config *magnitude* barely
  moves the mock — the spike therefore scores config on **well-formedness + declaration**, not on
  DPS impact (see §4).
- **Assumptions / honesty.** RFC-0001 I3/I4: every filled-by-default field must carry a declared
  `Assumption`. The spike verifies **no silent default sentinel** survives normalization.

## 2. The scorecard columns

| column | meaning | pass rule |
|---|---|---|
| `main skill` / `main` | resolved main skill name + its origin | `imported` or `inferred` = selected; `n/a` = build genuinely has no skills |
| `cfg#` | number of `ConfigEntry` rows lifted to build-state | informational |
| `cfg` | configuration sanity | a `configuration` assumption is declared **and** every entry has a non-empty key + finite scalar value |
| `honest` | assumptions declared for every default | no default sentinel (class `Unknown`, patch `unknown`, empty config, inferred main) is left undeclared; every assumption is well-formed |
| `fullDPS` / `dps` | MockEngine FullDPS + sanity | `>0` and finite — **pipeline-sane only** (see §4) |

## 3. Results (latest run, 20-character corpus)

```
#   fixture / name               source      class      lvl  main skill         main      cfg#  cfg  honest  fullDPS    dps
----------------------------------------------------------------------------------------------------------------------------
1   char-01-happy-path           native-json Ranger     90   Lightning Arrow    imported  1     ok   ok      4,828,950  ok
2   char-02-no-main-skill        native-json Monk       84   Falling Thunder    inferred  0     ok   ok      3,951,825  ok
3   char-03-empty-gear           native-json Sorceress  72   Spark              imported  0     ok   ok      3,003,600  ok
4   char-04-multi-loadout        native-json Huntress   88   Lightning Spear    imported  0     ok   ok      4,813,800  ok
5   char-05-spirit-heavy         native-json Warrior    91   Sunder             imported  0     ok   ok      5,088,000  ok
6   char-06-es-only              native-json Witch      89   Arc                imported  1     ok   ok      4,403,550  ok
7   char-07-low-level            native-json Mercenary  30   Galvanic Shards    imported  0     ok   ok      1,147,650  ok
8   char-08-high-level           native-json Monk       95   Ice Strike         imported  2     ok   ok      6,024,975  ok
9   char-09-gems-no-skillid      native-json Sorceress  80   Frostbolt          imported  0     ok   ok      4,213,575  ok
10  char-10-items-no-rarity      native-json Ranger     76   Poisonous Concocti imported  0     ok   ok      3,106,650  ok
11  char-11-no-config            native-json Warrior    85   Earthshatter       imported  0     ok   ok      4,466,850  ok
12  char-12-no-skills            native-json Mercenary  68   (none)             n/a       0     ok   ok      2,529,675  ok
13  char-13-multi-main           native-json Huntress   87   Spear Throw        imported  0     ok   ok      4,834,950  ok
14  char-14-six-link             native-json Witch      90   Fireball           imported  0     ok   ok      5,513,100  ok
15  char-15-duplicate-nodes      native-json Monk       83   Tempest Flurry     imported  0     ok   ok      1,314,075  ok
16  char-16-minimal              native-json Druid      55   (none)             n/a       0     ok   ok      0          0
17  char-17-attack-as-movement   native-json Huntress   89   Twister            imported  2     ok   ok      4,647,450  ok
18  char-18-config-dependent     native-json Mercenary  86   Explosive Grenade  imported  4     ok   ok      4,795,050  ok
19  char-19-mana-stacker         native-json Sorceress  92   Lightning Conduit  imported  0     ok   ok      5,623,575  ok
20  char-20-full-multiloadout    native-json Warrior    93   Perfect Strike     imported  1     ok   ok      5,733,750  ok
```

### Reading the edge cases

- **`char-02-no-main-skill`** — two groups, none flagged → main **inferred** (first group). This is
  the one `inferred` in the corpus and it is correctly labelled, not silently guessed.
- **`char-12-no-skills`, `char-16-minimal`** — genuinely skill-less builds → main **`(none)`**. The
  pipeline reports `null` honestly rather than fabricating a main skill; both still normalize and
  measure without crashing. This is why "main skill selected" is **18/20**, not a bug — 2 of the 20
  fixtures are deliberately skill-less. `char-16-minimal` also has no allocated nodes, so its
  structure-derived MockEngine DPS is `0` (the single non-sane FullDPS row).
- **`char-13-multi-main`** — multiple `isMain=true`; the normalizer deterministically takes the first
  (`imported`), so downstream identity stays stable.
- **`char-03-empty-gear` / `char-11-no-config`** — missing arrays default cleanly and are **declared**
  (`honest = ok`), confirming R3 "silent defaulting" is closed.
- **`char-04/20-multi-loadout`** — no primary flag; the normalizer picks exactly one and declares
  `primary` as `inferred` (AD-5), and the pipeline never assumes a single loadout.

## 4. The gate boundary — why FullDPS cannot close on MockEngine

The plan's S3 gate is **"20 real characters → auto main-skill + config defaults → ≥90% sane
FullDPS."** The first two clauses are exercisable today and pass; the **FullDPS clause cannot be
closed here**, and the harness says so explicitly:

```
GATE — ≥90% sane FullDPS
  MockEngine FullDPS-sane rate : 95% (threshold 90%)
  gate-status                  : BLOCKED-ON-S1
```

`MockEngine` (the S1 stand-in, `engine/engine-adapter`) derives plausible-*shaped* magnitudes from
build **structure** (node count, support links, main-skill count, level, gear) via documented
formulas + deterministic jitter — it performs **no real calculation**. So the 95% "sane" figure
proves the **pipeline** end-to-end (import → normalize → main-skill/config heuristics → engine
adapter → a finite, positive FullDPS for every build that has a skill and nodes) — it does **not**
prove that *real PoB2 FullDPS defaults* are sane for these builds. "Config sane" has the same
ceiling: the mock only reads `enemy.isBoss`, so config correctness is scored structurally
(well-formed + declared), not by its effect on a real damage number.

The gate closes only when the real **LuaJIT PoB2 sidecar** replaces the mock behind the same
`EngineAdapter` seam (S1 / ADR-001). At that point this exact harness — unchanged — re-runs against
real numbers and the ≥90% threshold becomes meaningful. The corpus, the heuristic scoring, and the
scorecard are all in place and waiting for that engine.

## 5. Corpus provenance & honesty

`research/fixtures/import-corpus/manifest.json` marks the corpus `_synthetic: true` — every build is
game-plausible but invented (placeholder item names, mods, node ids), containing **no real player
data**. That is the correct posture for Phase 0 (Charter §7.5): we do not need — and must not fetch —
real characters to validate import *mechanics*. `manifest.json` is a catalogue, not a build, and the
harness excludes it by name so the corpus is exactly 20 characters. If the directory is ever emptied,
the harness falls back to an equivalent inline synthetic corpus so it always runs.

## 6. Verdict

**GO for the import pipeline; FullDPS gate deferred to S1.** Detection, normalization, main-skill
resolution (with honest `imported`/`inferred`/`none` labelling), configuration lifting, and the
RFC-0001 honesty invariant are all **sound and green across 20 diverse edge cases**. The
`≥90%-sane-FullDPS` gate is **BLOCKED-ON-S1** — it is an engine-accuracy gate that only real PoB2
numbers can close, and the harness is complete to that last executable inch.
