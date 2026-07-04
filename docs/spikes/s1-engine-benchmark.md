# Spike S1 — Engine Benchmark (GO / NO-GO)

| | |
|---|---|
| Spike | **S1 — Engine benchmark** (PRD §9.3 spike 1; PRODUCT_PLAN Phase 0 S1) |
| Status | **PREPARED — BLOCKED on execution boundary** (Docker host + upstream PoB2 submodule pin) |
| Owner deliverable | `engine/benchmark/` (harness) + this doc |
| Date | 2026-07-05 |
| Gate | median full calc **< 500 ms**, median misc recalc **< 50 ms** on a Hetzner CCX vCPU |
| Fallback if NO-GO | precomputed-candidate mode (PLAN Phase 0 risks; PRD §11 Phase 0) |
| Relates to | ADR-001 (pinned unmodified PoB2 headless), RFC-0001 AD-6 (engine-boundary adapter), `engine/engine-adapter/src/conformance.ts` |

This is the architecture's **first gate**. It answers one question with numbers:
*is the unmodified PoB2 engine, run headless in a LuaJIT process pool, fast enough
to power live preference-weighted optimization — or does the optimizer shrink to
precomputed-candidate mode?* Everything downstream (worker-pool sizing, per-run
compute cost, freemium quotas) is conditioned on the answer.

---

## What is prepared (complete, runnable elsewhere)

The full harness lives in `engine/benchmark/` and is ready to run on any Docker
host the moment the two external inputs below exist. See its `README.md` for
exact commands.

- **`Dockerfile`** — LuaJIT 2.1 + pinned PoB2 `src/` + HeadlessWrapper entry +
  **real zlib binding** (`lua-zlib`, satisfying PRD §9.1's "Deflate/Inflate stubbed
  at HeadlessWrapper.lua:95-102 must be shimmed") + a ModCache warm-start check.
  Multi-stage: a Node stage converts the fixtures first.
- **`bench.lua`** — the driver. Bootstraps headless PoB2, and per build times
  (a) `calcs.buildOutput` full passes, (b) 500 `calcs.getMiscCalculator` override
  recalcs, (c) a `calcs.getNodeCalculator` node sweep; computes median/p95, applies
  the gate over the **worst** build, and emits `{median, p95, per-build}` JSON.
- **`convert-fixture.ts`** — self-contained TypeScript that renders each native
  JSON fixture into the PoB2 XML the headless load path consumes, with **declared
  best-effort gaps** (items / gems / masteries / patch→tree / config keys). Typechecks
  under the repo's strict TS config with zero added dependencies.
- **`zlib-shim.lua`** — installs the real `Deflate`/`Inflate` over HeadlessWrapper's
  empty stubs **without editing the fork** (ADR-001: shim at the integration layer).
- **`run.sh`** — sets `LUA_PATH`, runs the driver, forwards the gate as its exit
  code (`0` GO / `3` NO-GO), and writes `/out/s1-report.json` when `/out` is mounted.

---

## Exact execution boundary (why numbers are not in this doc)

Three things are required to produce a report, and all three are **outside this
harness by design** (HARD RULE 6 — deliver to the last executable inch, report the
boundary honestly):

1. **A Docker host.** The authoring machine has **no Docker and no LuaJIT**, so the
   image cannot be built or run here. Nothing about the harness is machine-specific;
   it builds unmodified elsewhere.
2. **The upstream PoB2 submodule pin.** ADR-001 makes the engine a pinned,
   unmodified submodule at `engine/vendor/PathOfBuilding-PoE2` — *one pin per game
   patch*, and **which** commit is a **founder decision**. This harness deliberately
   does **not** clone or hardcode the fork URL / commit (`README.md` §"One-time
   submodule pin" has the exact `git submodule add` command to run when the founder
   supplies them).
3. **The 3 native fixtures.** `research/fixtures/benchmark-builds/{melee,minion,dot}.json`
   (PLAN Phase 0 task 6 — "3 benchmark builds"). The native schema is specified in
   `convert-fixture.ts` and echoed in the harness README; collecting the actual
   representative builds is a separate fixture-collection task.

Two Lua integration points may need a **one-line** adjustment against the actual
pin (the fork may expose the calc entrypoints as `calcs.*` free functions — as the
PRD cites — or only via `build.calcsTab:*` methods). Both are flagged inline as
`-- PIN-CHECK:` in `bench.lua`. This is the only part of the driver that cannot be
finalized without the pin in hand.

---

## Expected cost / time

- **Human time:** ~30–60 min end-to-end on a Docker host once submodule + fixtures
  exist (image build is dominated by `apt` + `luarocks lua-zlib` + PoB data load;
  the timed run itself is seconds).
- **Compute cost:** negligible — one short-lived Hetzner CCX run pinned to one vCPU
  (`--cpus 1`). The value is the measurement, not sustained load.
- **PRD prior (UNVERIFIED — this spike verifies it):** ~5–50 ms accelerated recalc,
  ~50–500 ms full pass; complex minion/multi-skill builds "much slower"; ~200–500 MB
  per warm env (PRD §9.1 / §9.3). Confirming or killing these is the whole point.

---

## Decision table

Gate evaluated over the **worst** (slowest) of the 3 builds:

| worst full-calc median | worst misc median | Decision | Action |
|---|---|---|---|
| < 500 ms | < 50 ms | **GO** | Sidecar + process-pool architecture is viable; productionize as Engine service v1 (PLAN Phase 1). |
| < 500 ms | ≥ 50 ms | **NO-GO (misc)** | Batch / pre-filter overrides and re-measure; if still failing, move what-if analysis to precomputed-candidate mode. |
| ≥ 500 ms | any | **NO-GO (full)** | Shrink optimizer to precomputed-candidate mode; keep import-and-diagnose on cached full calcs. WASM client-offload lever for free-tier casual calcs. |

`bench.lua` encodes exactly this gate and exits `0` (GO) / `3` (NO-GO) so `run.sh`
and CI branch on it.

---

## How results wire into conformance

The benchmark and `engine/engine-adapter/src/conformance.ts` share the **same 3
builds** on purpose. Once the real engine runs here, its **outputs** over these
fixtures become the `expectedMetrics` of new `ConformanceFixture`s (with a small
relative `tolerance`, since the real engine is floating-point unlike the exact-`0`
MockEngine suite) — the "parity-with-desktop-PoB fixtures become another suite"
seam in that file's header. Capturing those outputs is **out of S1's scope** (S1
gates *performance*; conformance gates *correctness*), but the fixtures are shared
so the corpus is collected once. Mechanics: harness README §"Wiring results into
the conformance suite".

---

## Status summary

**PREPARED — BLOCKED.** The harness is complete and internally verified to the
limit possible without the external inputs: `convert-fixture.ts` typechecks under
strict TS with no added dependency, and `bench.lua` / `Dockerfile` / `run.sh` /
`zlib-shim.lua` are lint-clean by inspection. It will produce a GO/NO-GO report
unmodified once a Docker host, the founder's PoB2 submodule pin, and the 3 native
fixtures are supplied. No numbers are asserted here because none were measured —
faking them would defeat the gate.
