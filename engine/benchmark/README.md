# S1 — Engine Benchmark Harness

The **go/no-go** validation spike for ExileLab's architecture (PRD §9.3 spike 1,
PRODUCT_PLAN Phase 0 S1, ADR-001). It runs the **unmodified** PoB2 fork headless
under LuaJIT 2.1 in Docker and times the three cost centres the optimizer's
worker-pool sizing model depends on, over 3 representative real builds
(melee / minion / DoT):

| Cost centre | Engine primitive | What it models |
|---|---|---|
| **Full calc pass** | `calcs.buildOutput(build, "MAIN")` | Cold-ish full recompute (import, first score). |
| **Misc recalc ×500** | `calcs.getMiscCalculator(build)` | The optimizer hot path: one base env, thousands of cheap override recalcs. |
| **Node sweep** | `calcs.getNodeCalculator(build)` | One-step passive-node deltas (wasted-stat / upgrade suggestions). |

It emits a JSON report (`{median, p95, per-build}`) to stdout and exits with the
**gate** as its status code.

> ### Execution boundary (read this first)
> This harness was authored on a machine with **no Docker and no LuaJIT**, and the
> upstream PoB2 submodule pin is a **founder decision that has not been cloned
> here**. Therefore the benchmark has **not been executed** — this directory is
> the complete, runnable-elsewhere harness delivered to the last executable inch.
> To produce numbers you need: (1) a Docker host, (2) the submodule pinned (below),
> (3) the 3 native fixtures collected (below). Two Lua integration points that may
> need a one-line adjustment against the actual pin are marked `-- PIN-CHECK:` in
> `bench.lua`.

---

## Files

| File | Role |
|---|---|
| `Dockerfile` | LuaJIT 2.1 + pinned PoB2 `src/` + HeadlessWrapper + real zlib binding (`lua-zlib`) + ModCache check. Multi-stage: a Node stage converts fixtures first. |
| `bench.lua` | The benchmark driver. Bootstraps headless PoB2, loads each fixture, times (a)/(b)/(c), computes median/p95, evaluates the gate, prints JSON. |
| `convert-fixture.ts` | Native-JSON → PoB2-XML fixture converter (self-contained TypeScript, zero deps). |
| `zlib-shim.lua` | Overrides HeadlessWrapper's empty `Deflate`/`Inflate` stubs with a real `lua-zlib` binding (PRD §9.1), without editing the fork (ADR-001). |
| `run.sh` | In-image launcher: sets `LUA_PATH`, runs `bench.lua`, forwards the gate exit code, writes `/out/s1-report.json` if `/out` is mounted. |

---

## One-time submodule pin (founder decision — do NOT run casually)

The engine is a pinned, unmodified git submodule (ADR-001: "one pin per game
patch"). From the repo root, the founder pins the upstream PoB2 fork with:

```bash
git submodule add <UPSTREAM_POB2_POE2_FORK_URL> engine/vendor/PathOfBuilding-PoE2
cd engine/vendor/PathOfBuilding-PoE2
git checkout <PINNED_COMMIT_FOR_PATCH_0_2_0>   # the exact patch pin
cd ../../..
git submodule update --init --recursive
```

`<UPSTREAM_POB2_POE2_FORK_URL>` and `<PINNED_COMMIT_FOR_PATCH_0_2_0>` are supplied
by the founder — **this harness deliberately does not clone or hardcode them**
(HARD RULE 6: external boundary reported, not faked). Everything below assumes the
submodule is present at `engine/vendor/PathOfBuilding-PoE2/`.

---

## Fixtures (native JSON → converted XML)

The 3 benchmark builds live as **ExileLab-native JSON** at
`research/fixtures/benchmark-builds/{melee,minion,dot}.json` (collected per
PRODUCT_PLAN Phase 0 task 6 — "3 benchmark builds"). They are stored native, not
as PoB payloads, so they stay source-independent (RFC-0001 AD-6) and the eventual
conformance suite can reuse them without a PoB dependency.

`convert-fixture.ts` renders each into the PoB XML the headless `Build:Load` path
consumes. The native schema (see the `NativeBenchmarkBuild` interface in
`convert-fixture.ts` for the authoritative types):

```jsonc
{
  "name": "melee-warrior-earthquake",
  "archetype": "melee",              // "melee" | "minion" | "dot"
  "patchVersion": "0.2.0",
  "character": { "className": "Warrior", "ascendancy": "Titan", "level": 92 },
  "loadouts": [
    {
      "id": "primary",
      "primary": true,
      "allocatedNodes": [123, 456, 789],
      "masteryEffects": [ { "nodeId": 123, "effectId": 45 } ],
      "items": [
        {
          "slot": "weapon1",
          "name": "Example Maul",
          "base": "Advanced Anvil Maul",
          "rarity": "rare",
          "modifiers": ["+120 to maximum Life", "35% increased Physical Damage"]
        }
      ],
      "skills": [
        { "isMain": true, "skillGemRef": "Earthquake", "level": 20, "quality": 20,
          "supports": ["Melee Physical Damage", "Brutality"] }
      ]
    }
  ],
  "config": { "enemy.isBoss": true, "enemy.level": 84 }
}
```

Convert locally (optional; the Docker build does this automatically in stage 1):

```bash
cd engine/benchmark
npx tsx convert-fixture.ts ../../research/fixtures/benchmark-builds/melee.json melee.xml
```

### convert-fixture gaps (declared, best-effort)

The mapping is honest about what it cannot do without full game data (this is a
**timing** benchmark — correctness parity is Spike 2 / the conformance suite):

- **G1 items** — item text is `Rarity/Name/Base` + `modifiers` verbatim; bases/mods
  that PoB's ItemDB can't resolve are ignored by the engine (logged, non-fatal).
- **G2 gems** — `skillGemRef`/supports emitted as `nameSpec`; PoB gem ids resolve
  exactly, friendly names resolve if unambiguous.
- **G3 masteries** — rendered in PoB's `{nodeId,effectId}` encoding; ids must be
  PoB tree ids.
- **G4 patch → tree version** — via a small lookup; unknown patch falls back to the
  default and warns on stderr.
- **G5 config keys** — canonical→PoB via `CONFIG_KEY_MAP`; unmapped keys pass
  through (PoB ignores unknown `Config` inputs).

---

## Running

From the **repo root** (build context must see the submodule + fixtures):

```bash
# 1. Build the image (converts fixtures, builds LuaJIT+PoB2 engine).
docker build -f engine/benchmark/Dockerfile -t exilelab-s1-bench .

# 2. Run it on a Hetzner CCX (dedicated vCPU) — one vCPU, results to ./out.
mkdir -p out
docker run --rm --cpus 1 -v "$PWD/out:/out" exilelab-s1-bench
echo "gate exit: $?"   # 0=GO, 3=NO-GO, other=error
cat out/s1-report.json
```

Tunables (env, defaults in parentheses): `BENCH_FULL_ITERS` (30),
`BENCH_MISC_ITERS` (500), `BENCH_NODE_SWEEP` (200), `BENCH_WARMUP` (3),
`BENCH_GATE_FULL_MS` (500), `BENCH_GATE_MISC_MS` (50). Example:

```bash
docker run --rm --cpus 1 -e BENCH_MISC_ITERS=1000 exilelab-s1-bench
```

> **Measure on the target class.** The gate thresholds are calibrated for a
> **Hetzner CCX dedicated vCPU** (PLAN Phase 0 S1). `--cpus 1` pins one core so the
> single-threaded LuaJIT number is per-worker. Numbers on a shared/laptop CPU are
> indicative only.

---

## The GO / NO-GO gate

Evaluated in `bench.lua` over the **worst** (slowest) of the 3 builds — the pool
must survive the slowest representative build, not the average:

| Metric | Threshold | Source |
|---|---|---|
| Full calc pass, **median** | **< 500 ms** | PLAN Phase 0 S1 |
| Misc recalc, **median** | **< 50 ms** | PLAN Phase 0 S1 |

- **GO** (both pass, exit `0`) → the sidecar + process-pool architecture is viable
  as designed; proceed to Engine service v1 (PLAN Phase 1).
- **NO-GO** (either fails, exit `3`) → **fall back to precomputed-candidate mode**:
  the optimizer stops doing live per-request engine search and instead scores
  against a precomputed candidate corpus (PRODUCT_PLAN risk row "S1 benchmark
  fails"; PRD §11 Phase 0: *"If the benchmark fails (>2s/calc on complex builds),
  the optimizer scope shrinks to precomputed-candidate mode — decide then."*).
  Secondary levers before abandoning live calc: pre-filtering candidates, the
  accelerated `getMiscCalculator` path (already the (b) measurement), and the
  WASM client-offload lever for free-tier casual calcs (PRD §9.1).

### Decision table

| worst full-calc median | worst misc median | Decision | Action |
|---|---|---|---|
| < 500 ms | < 50 ms | **GO** | Productionize the sidecar (Phase 1). |
| < 500 ms | ≥ 50 ms | **NO-GO (misc)** | Batch/pre-filter overrides; re-measure. If still failing → precomputed-candidate for what-ifs. |
| ≥ 500 ms | any | **NO-GO (full)** | Shrink optimizer to precomputed-candidate mode; keep import/diagnose on cached full calcs. |

---

## Wiring results into the conformance suite

`engine/engine-adapter/src/conformance.ts` runs `ConformanceFixture`s — each an
input snapshot (+ optional mutation) paired with **expected engine metrics** — via
`runConformanceSuite`. This benchmark and that suite share the **same 3 builds**:

1. The benchmark proves the real engine is fast enough (this spike).
2. The **outputs** captured while running the real engine over these fixtures
   become the `expectedMetrics` of new `ConformanceFixture`s (with a small relative
   `tolerance`, since the real engine is floating-point, unlike the exact-`0`
   MockEngine suite). That is the "parity-with-desktop-PoB fixtures become another
   suite" seam described in `conformance.ts`'s header.
3. To capture them: extend `bench.lua` to also dump `build.calcsTab.mainOutput`
   (or the specific `PlayerStat` set the adapter maps) per fixture into the report,
   then translate that into a `ConformanceFixture` alongside the native JSON. That
   capture step is **out of scope for S1** (S1 gates *performance*; the conformance
   fixtures gate *correctness*) but the fixtures are deliberately shared so the
   corpus is collected once.

---

## Cost / time expectation

- **Author time to run:** ~30–60 min on a Docker host once the submodule + fixtures
  are present (image build dominated by `apt` + `luarocks` + PoB data load).
- **Compute cost:** negligible — a single short-lived CCX run. The point is the
  measurement, not sustained load.
