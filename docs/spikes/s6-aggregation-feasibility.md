# S6 — Aggregation Feasibility

> **Phase 0 spike (PRODUCT_PLAN §"Phase 0" S6).** Prove the aggregation pipeline end-to-end
> on synthetic data: *"'fetch' the same archetype from 3 sources → normalize all to one
> BuildSnapshot shape → comparator produces a sane tree/gear/gem diff."*
>
> **Status: PASS** — the runnable demo (`scripts/spikes/s6-aggregation-demo.ts`, 39/39 checks)
> proves the architecture is feasible today on real production code. One importer-fidelity
> residual and the external-fetcher boundary keep the *full* gate open; both are scoped below.

Run it:

```
pnpm -r build                                   # dist entrypoints the spike imports
pnpm exec tsx scripts/spikes/s6-aggregation-demo.ts
```

No network calls anywhere (Compliance Charter PRD §7.5) — the PoB share code is decoded
locally with `node:zlib`. The run is deterministic (Canonical Identity is computed over
build state only, so import timestamps do not perturb it); re-runs are byte-identical.

---

## 1. What the demo does

It loads the **same archetype** — the canonical *Twister Huntress speed-mapper* (GLOSSARY
*Archetype*; UX_PRESENTATION §L2) — from three SYNTHETIC sources standing in for three public
platforms, through the **real** importer boundary and the **real** comparator. Nothing here is
mocked except the fixtures themselves (labeled synthetic; see
`research/fixtures/archetype-3-sources/README.md` and `differences.md`).

| # | Fixture | Stands in for | Format → importer |
|---|---------|---------------|-------------------|
| a | `a-maxroll-native.json` | Maxroll pob endpoint | ExileLab native JSON → `native-json` |
| b | `b-pob-share-code.txt` | pobb.in / PoB2 share code | PoB code (base64 + zlib) → `pob-code` |
| c | `c-poeninja-variant-native.json` | poe.ninja top-ladder player | ExileLab native JSON → `native-json` |

`(a)` and `(b)` are the **same build in two different formats**; `(c)` is a deliberate variant
differing from `(a)` by exactly **boots + 6 passive nodes + 1 support gem** (`differences.md`).

Pipeline per source: `importAny(text)` → Raw Import Artifact → `normalize(...)` → canonical
`BuildSnapshot`. Then the comparator (`diffSnapshots`, `compareMany`) and core
(`promoteMutation`) do the rest — exactly the components `POST /import` and Comparative
Optimization consume in production (RFC-0001 §5.2).

---

## 2. What was proven

### (1) Multi-FORMAT normalization → one canonical shape
Three sources across **two formats** normalize to the identical `BuildSnapshot` structure.
Native JSON `(a)` and the PoB share code `(b)` — decoded from URL-safe base64 of a zlib-deflated
XML — agree on the **load-bearing build state**: class `Huntress`, ascendancy `Amazon`, level
`91`, all **100 allocated passive nodes**, and the main skill (`Twister` + its four supports).
Their Canonical Identities legitimately **differ** (the two importers synthesize different setup
ids / mod-line text); RFC-0001 requires *semantic* agreement, not byte-identical hashes, and
that is what the comparator consumes. This is the narrow-waist promise realized: N importers, one
consumer contract (RFC-0001 G2/I3).

### (2) Sane diff — `(a) → (c)` matches `differences.md` line-for-line
The comparator's category-by-category diff of `(a)` vs `(c)` reproduces the intended diff exactly:

- **Passive tree:** 6 nodes only in `(a)` `[1075,1320,1485,1966,2432,3091]`, 6 only in `(c)`
  `[2000,2100,2200,2300,2400,2500]`, **94 shared**.
- **Gear:** exactly **one** slot changed — `Boots`: `Stealth Boots (Rare)` → `Seven-League Step
  (Unique)`, gaining `+45% Movement Speed` and `Tailwind on Kill`, losing `+30% Movement Speed`.
  The other 9 slots `unchanged`.
- **Gems:** exactly one setup changed — the main group `sg-main`: active skill `Twister`
  unchanged, support `SupportFork` → `SupportChain`.
- **Config:** unchanged.

The diff emits **15 promotable candidate BuildMutations** (6 `allocatePassiveNode` + 6
`deallocatePassiveNode` + 1 `swapItem` + 2 `changeSupport` — the single Fork→Chain swap expressed
as two atomic, promotable ops). This is the "sane tree/gear/gem diff" the gate asks for.

### (3) Consensus across sources
Reframed as the real product flow — a ladder player `(c)` comparing against two aggregated
mainstream sources `(a)` and `(b)` — `compareMany` flags every change corroborated by ≥2 distinct
sources as **community-validated** (PRODUCT_PLAN: *"statistically common choices across sources
rank higher"*). **All 12 passive-node changes reach consensus across both formats** (2/2 sources),
attribution correctly dropped on shared changes. Passive-node ids are format-independent, so tree
consensus is robust across native + PoB today.

### (4) Promotability
A diff candidate is a real core `BuildMutation`. The demo **actually promotes** the headline
upgrade — adopting `(c)`'s Seven-League Step boots onto baseline `(a)` — via `promoteMutation`:
the base snapshot is unchanged (immutability I1), the promoted snapshot carries the new boots and
a **new Canonical Identity** (I2), and its Provenance records `source = "promoted-mutation"`
(RFC-0001 AD-2). A consensus passive-node candidate is promoted too, proving the whole candidate
stream is engine/optimizer-ready.

---

## 3. What remains before the gate fully closes

The **architecture** is proven; two boundaries remain, both honestly outside a Phase-0 spike.

1. **Real external source payloads + interchange endpoints (compliance-blocked).**
   The three fixtures are synthetic stand-ins. Closing the real gate needs actual public
   interchange payloads — real pobb.in codes, GGG-OAuth character exports, Maxroll/poe.ninja
   feeds — fetched through **compliance-reviewed fetchers that do not yet exist** (Aggregation
   Engine collects via *public interchange endpoints only*, with attribution; Compliance Charter
   §7.5; GGG OAuth is still pending — see `docs/spikes/s4-ggg-oauth-application.md`). No agent may
   fetch these; the demo deliberately runs on the founder-provided synthetic boundary instead.

2. **One importer-fidelity residual (not a comparator bug).**
   In the consensus run, the **boots swap** and the **Fork→Chain gem swap** do **not** reach
   cross-format consensus, for two importer-side reasons the demo surfaces explicitly:
   - *Boots:* a genuine `Boots` change appears in **both** per-source diffs but under **different
     change keys** — the `pob-code` importer folds `Rarity:` / item name / base-type into the
     item's modifier lines, so the same Stealth Boots fingerprints differently than the native
     item. Not co-bucketed → no consensus.
   - *Gem:* the support swap appears in the **native source only** — the `pob-code` importer
     synthesizes group ids (`group-1`) instead of the native setup ids (`sg-main`), so no
     `changeSupport` candidate aligns against `(c)`.

   The **comparator is correct** in both cases (it is faithfully reporting divergent inputs). The
   fix is importer-side normalization to close before aggregation trusts cross-format gear/gem
   consensus: (a) parse PoB item text into clean modifier lines (strip `Rarity:`/name/base), and
   (b) derive stable, content-addressed setup ids so equivalent skill groups align across
   importers. This does not touch the comparator (whose tests stay green); it is normalizer work,
   flagged here so nobody "optimizes away" the observation. Tree consensus is already
   format-robust and needs nothing.

---

## 4. Verdict

**Feasible — PASS.** On real production code (build-normalizer importers + normalizer, comparator
diff/consensus, core mutation/promotion), the same archetype fetched from three sources across two
formats normalizes to one canonical `BuildSnapshot` shape, produces a diff that matches the
intended `differences.md` line-for-line, yields format-independent community-validated tree
consensus, and emits candidates that promote cleanly. The narrow-waist aggregation architecture of
RFC-0001 holds end-to-end.

The *full* gate stays open only on things a Phase-0 spike cannot and must not force: real
compliance-reviewed source fetchers, and one bounded importer-fidelity fix for cross-format
gear/gem alignment. Both are named, scoped, and reproducible from the runnable demo.
