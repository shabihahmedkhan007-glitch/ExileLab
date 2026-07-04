# RFC-0001: Canonical Build Model (BuildSnapshot)

| | |
|---|---|
| Status | **Accepted** (founder, 2026-07-04) |
| Date | 2026-07-04 |
| Discussion | `rfcs/0001-canonical-build-model.discussion.md` (resolved 2026-07-04; Q1–Q5 answered by founder) |
| Scope | Architecture only — responsibilities, boundaries, invariants, terminology. No fields, no serialization, no storage, no APIs, no code. |

---

## 1. Problem

ExileLab imports builds from many external sources — Path of Building share codes, Maxroll, Mobalytics, poe.ninja, pobb.in, and the official GGG API — and feeds them to many internal consumers: the calculation engine, Context Detector, Preference Engine, Comparator, Upgrade Planner, Doctor, and Build Coach.

Without a canonical internal representation, every consumer must understand every source: an N-sources × M-consumers integration problem in which each new source or consumer multiplies work, every source quirk leaks system-wide, and no two components agree on what "a build" is. Worse, the path of least resistance — using Path of Building's document format as the de-facto internal language, since the engine consumes it — would permanently couple ExileLab's core to a third-party format it does not control.

We need one internal language for builds, defined by us, that every importer produces and every consumer reads.

## 2. Goals

- **G1** — Define **BuildSnapshot**: the single canonical, normalized representation of a build. Everything downstream consumes BuildSnapshots; nothing downstream talks to external platforms.
- **G2** — Make the model the system's *narrow waist*: N importers + M consumers instead of N×M integrations.
- **G3** — Guarantee properties consumers can build on: immutability, deterministic identity, source independence, engine-sufficiency, honesty about data fidelity, version awareness.
- **G4** — Fix the dependency direction for all planned systems (calculation, detection, scoring, comparison, mutation, adaptation) before any of them exist.
- **G5** — Resolve the BuildSnapshot / Build Genome terminology overlap in the GLOSSARY.

## 3. Non-goals

- **Build Genome** — reserved for a future derived abstraction (build-essence for archetype matching/similarity); explicitly not designed here. The only commitment made: Genome, when it exists, is *derived from* BuildSnapshots.
- Concrete fields, schemas, serialization formats, hashing algorithms, storage, databases, or APIs — implementation concerns for later work.
- Import heuristics themselves (spike S3's territory) — this RFC only requires that their guesses be *declared* (see Assumptions).
- Calculation semantics — the engine's contract is consumed, not defined, here.
- Patch Adaptation design — a future RFC; this model only ensures it will be *possible* (patch-scoped identities, ID+patch referencing).

## 4. Design Principles

This RFC applies the repository principles (docs/PRINCIPLES.md) as follows:

- **Never duplicate PoB's calculations** (#1) → the model contains *build state only*, never computed values; the engine remains the sole calculator.
- **Every optimization must be reproducible** (#4) → immutability + deterministic identity make every result re-derivable from (snapshot, engine version).
- **External platforms are data sources, never the source of truth** (#6) → sources end at the importer boundary; the BuildSnapshot is authoritative from there on.
- **Modular over coupled** (#9) → the narrow waist is the modularity mechanism; consumers are source-blind by construction.
- **Documentation before implementation** (#10) → this RFC precedes any model code.

**The admission rule (founder directive, 2026-07-04):** *every piece of information in BuildSnapshot must satisfy at least one downstream consumer requirement.* BuildSnapshot exists to represent normalized build state — not to accumulate convenience data. Information useful only to a single importer, a single UI feature, or a debugging workflow belongs outside the canonical model unless multiple downstream systems depend on it. Every category in §5.3 — and every future addition — must name the consumer requirement that admits it. (Codified as invariant I7.)

**Compliance & vision check:** the model strengthens compliance — raw third-party payloads are quarantined as time-boxed importer artifacts (never redistributed, never part of the canonical data), guide content is structurally excluded, and Provenance is first-class so every comparison surface can attribute its source (charter §7.5). Vision alignment: a source-independent canonical model is what makes "a layer on top of the ecosystem, not a silo" technically true.

## 5. Proposed Architecture

### 5.1 Terminology (canonical; GLOSSARY updates in §13)

- **BuildSnapshot** — the immutable, normalized, source-independent representation of one build's complete state at one moment, on one game patch. The canonical internal language. *(Conceptual analogy: a git commit.)*
- **Raw Import Artifact** — the original payload an importer fetched or received. An importer-owned artifact with time-boxed retention, linked from the snapshot's provenance, never part of the snapshot itself, never consumed downstream.
- **BuildMutation** — a lightweight, immutable delta referencing a base BuildSnapshot, describing a candidate change (the optimizer's working unit). An *accepted* mutation is **promoted**: applied to its base to produce a new BuildSnapshot.
- **Calculation Result** — engine output for a (BuildSnapshot | BuildSnapshot + BuildMutation, engine version) pair. A separate artifact, never embedded in the snapshot.
- **Derived Analysis** — any model-versioned product computed from snapshots and/or calculation results (archetype classification, doctor findings, diffs, scores). Separate artifacts, never embedded.
- **Loadout Context** — one coherent equipment-and-tree configuration within a build (PoE2 weapon sets with per-set passive points). A BuildSnapshot contains one or more Loadout Contexts; one is designated primary.
- **Display Cache** — minimal denormalized rendering data (names, icons) carried by a snapshot for UI convenience. Derived data: excluded from identity (§6, AD-3).
- **Canonical Identity** — the stable identity of a snapshot, computed deterministically over its canonical build state (and only that).

### 5.2 The artifact pipeline

One-way, each stage immutable, each stage referencing its upstream by identity:

```
external source
      │  (importer — the only component that knows source formats)
      ▼
Raw Import Artifact          [importer-owned, time-boxed retention]
      │  (normalizer)
      ▼
BuildSnapshot                [canonical, immutable, hashed — THE narrow waist]
      │                                    │
      ▼                                    ▼
Calculation Result           BuildMutation (candidate deltas)
 [keyed by snapshot ×                │ (promotion on acceptance)
  engine version]                    ▼
      │                        new BuildSnapshot
      ▼
Derived Analyses             [keyed by inputs × model versions]
(context, findings, scores, diffs)
```

Responsibilities and boundaries:

- **Importers** own source knowledge. They produce Raw Import Artifacts and hand them to the normalizer. Source-specific concepts (guide variants, leveling steps, timelines) die at this boundary — a snapshot models one moment of one build.
- **The normalizer** owns the translation from raw payloads to the canonical model, including canonicalization (the discipline that makes identity deterministic) and the declaration of every assumption it makes.
- **BuildSnapshot** owns nothing behavioral. It is data with guarantees — the contract in §8.
- **The engine boundary adapter** (future) translates snapshots to what the calculation engine consumes. The canonical model is independent of the engine's document format; the conformance suite holds the adapter accountable (AD-6).

### 5.3 Information categories

The model covers these categories (categories, not fields — field definitions are implementation):

**Build state** (participates in Canonical Identity): Character; Passive Tree; Equipment; Skills & Gems (including main-skill designation); Configuration (calculation context — first-class, per discussion risk R5); Resources — all scoped within **Loadout Contexts** where the game allows per-loadout variation.

**Snapshot context** (about the snapshot, not the build): Versioning (game patch + snapshot-format version); Provenance (source, reference, import time, attribution data); Assumptions (imported vs. inferred vs. defaulted annotations); Metadata (display labels, league context); Display Cache. Of these, only categories the RFC review confirms as semantic participate in identity — Metadata and Display Cache explicitly do not.

Per I7, each category is admitted by named consumer requirements: build-state categories by the calculation engine and Comparator; Versioning by the engine (patch-correct game data) and Patch Adaptation; Provenance by attribution surfaces (compliance charter) and the Aggregation Engine; Assumptions by the Doctor, the optimizer, and trust display (honesty guarantees); Metadata by every user-facing surface (identity-excluded); Display Cache — see the I7 note under AD-3. A category serving no consumer would be removed from this list, and none currently fails the test.

## 6. Architectural Decisions

Each decision below was resolved in the Discussion stage (Q1–Q5) or follows from its accepted recommendations.

**AD-1 — BuildSnapshot is the canonical representation; Build Genome stays reserved.** *(Q1)*
Rationale: two names claiming the same territory guarantees documentation drift. Consequence: GLOSSARY reconciliation (§13); any future Genome RFC starts from "derived from snapshots."

**AD-2 — Snapshots are immutable; change is modeled as BuildMutation deltas with promotion.** *(Q2)*
Rationale: the optimizer generates thousands of near-identical candidates per run; full snapshots per candidate would drown storage and caching, while mutable builds would break every cache and reproducibility guarantee. Consequence: aligns with the planned engine cache key (base identity × mutation identity); promotion semantics (delta → new snapshot on user adoption) are part of the model's contract; detailed mutation taxonomy is deferred (§11).

**AD-3 — Hybrid game-data strategy: ID + patch references are authoritative; a minimal Display Cache rides along; the cache never participates in identity.** *(Q3)*
Rationale: references keep snapshots compact and make Patch Adaptation tractable; the cache lets old shared reports render instantly without historical-data lookups. Consequences: ExileLab commits to retaining per-patch game data for as long as snapshots referencing it must remain interpretable (invariant I6); two snapshots with identical build state have identical identity regardless of cache contents; cache staleness is a rendering concern only, never a correctness concern.

*I7 note:* the Display Cache is the element the admission rule presses hardest on, and it survives only under a narrow justification: it serves **multiple** downstream rendering consumers (build workspace, comparison columns, and — decisively — statically-rendered shared reports, which must render historical snapshots without a historical-game-data service). It is *not* general convenience storage: it is capped at what those renderers need (names/icons-level), stays identity-excluded, and if the rendering surfaces ever stop needing it, it is removed at a format-version bump rather than kept for comfort.

**AD-4 — Raw payloads are importer artifacts with time-boxed retention, never part of the snapshot.** *(Q4)*
Rationale: raw data enables re-normalization after normalizer fixes (discussion risk R2) but is third-party-served content whose stored footprint should be minimized (charter posture). Consequences: re-normalization is guaranteed only within the retention window (~90-day working default; exact window is an implementation decision, §12); older snapshots require re-fetching to re-derive; the archive is internal-only and linked via Provenance.

**AD-5 — Multiple Loadout Contexts from day one.** *(Q5)*
Rationale: PoE2 weapon-set swapping with per-set passive points is common; retrofitting loadouts into a single-loadout model would require invasive surgery across identity, diffing, and every consumer (discussion risk R6). Consequence: the model's shape accommodates multiple contexts now; early importers populate only the primary; consumers must not assume exactly one context exists.

**AD-6 — The canonical model is ExileLab's own ("A-lite"), independent of Path of Building's document format.** *(Discussion Design Option, accepted recommendation)*
Rationale: the narrow waist must be a format we control (risk R1); but semantics stay deliberately close to the engine's concepts wherever we have no independent need, keeping translation thin and verifiable. Consequences: a translation adapter at the engine boundary is a permanent, conformance-tested component; PoB payloads may circulate freely *only* inside disposable Phase 0 spikes — production importers emit the canonical model.

**AD-7 — Snapshots contain normalized build state only; calculated and derived values are separate downstream artifacts.** *(Discussion §5, Option A, accepted)*
Rationale: embedding calculations couples snapshot identity to engine versions and breaks reproducibility; embedding raw invites consumers to peek behind the source-independence boundary. Consequence: the artifact pipeline of §5.2, with each artifact keyed by its inputs' identities plus the versions of whatever produced it.

## 7. Invariants

Every BuildSnapshot, always:

- **I1 — Immutable.** Never modified after creation. New state = new snapshot (possibly via mutation promotion).
- **I2 — Deterministic identity.** Identical canonical build state ⇒ identical identity, regardless of source or import time. Canonicalization is a first-class normalizer responsibility, not a serialization afterthought. Metadata and Display Cache are excluded from identity.
- **I3 — Uniform shape, honest fidelity.** Structure is source-independent; fidelity differences between sources are expressed through Assumptions annotations, never through structural variation and never silently.
- **I4 — Engine-sufficient with declared assumptions.** Every snapshot can be submitted for calculation without further reference to its source. Every gap an importer filled is declared. ("Honest" supersedes "complete.")
- **I5 — Version-aware.** Every snapshot names its game patch and its snapshot-format version. Engine versions belong to Calculation Results, never to snapshots.
- **I6 — Self-contained by reference.** Interpretable using only itself plus the retained game data of its declared patch. No live external calls, ever.
- **I7 — Every element earns its place.** Every category (and, at implementation time, every field) is admitted only by a named downstream consumer requirement; single-importer, single-UI-feature, and debugging conveniences live outside the model. Anything that loses its justification is a removal candidate at the next format-version bump.

## 8. Downstream Dependencies

### 8.1 The consumer contract

Every consumer may assume a BuildSnapshot is: **valid** (passed canonical validation), **interpretable** (I6), **engine-sufficient** (I4), **immutable with stable identity** (I1/I2 — cache anything keyed by it), **honest** (I3/I4), **source-blind** (no consumer may branch on source platform; reading Provenance for attribution display is the only sanctioned use), and **comparable** (any two same-patch snapshots diff category-by-category; cross-patch comparability is *not* guaranteed).

Consumers may **not** assume: freshness; full fidelity of any category (check Assumptions); exactly one Loadout Context (AD-5); or that any Calculation Result or Derived Analysis already exists.

### 8.2 Dependency direction

All arrows point *into* BuildSnapshot; it knows nothing about its consumers:

- **Context Detection** reads snapshots → derived classifications.
- **Preference Engine** reads calculation results (keyed by snapshots) → scores.
- **Recommendation Engine / Comparator** reads multiple snapshots + results → diffs, ranked changes.
- **Upgrade Planner** generates BuildMutations against base snapshots.
- **Build Coach** reads derived findings only — two levels removed, by design.
- **Patch Adaptation** (future) transforms a snapshot on patch N into a *new* snapshot on patch N+1, enabled by I5 + AD-3.
- **Build Genome** (future, out of scope) will be derived from snapshots; the arrow is fixed now.

## 9. Alternatives Considered

- **PoB's document format as the canonical model (with an annotation envelope).** Fastest to ship; rejected because it makes a third-party format our permanent internal language, reduces source independence to a veneer, and grafts PoE2-native needs (assumptions, loadouts, patch identities) onto a document not designed for them. Its speed is retained where it's disposable: Phase 0 spikes only (AD-6).
- **Bundling raw + normalized (+ cached calculations) in one artifact.** One thing to store; rejected because identity becomes ambiguous, engine-version coupling violates I1/I5, and raw data in reach of consumers erodes I3 (discussion §5, Option B).
- **Embedding game entities in full.** Self-contained forever; rejected in favor of the hybrid (AD-3) — embedding is large, duplicative, and hostile to cross-patch work. The founder-selected display cache covers embedding's one real advantage (render-without-lookup).
- **Full snapshot per optimizer candidate.** Conceptually simplest; rejected for scale — thousands of near-duplicates per optimization run (AD-2).
- **Mutable working-copy builds.** Familiar document model; rejected because it breaks immutability precisely where the optimizer most needs caching and reproducibility (AD-2).
- **Strict completeness (reject imports with missing data).** Cleanest invariant on paper; rejected because real imports arrive incomplete — replaced by engine-sufficiency + declared assumptions (I4).

## 10. Risks

| Risk (from discussion §8) | Disposition in this design |
|---|---|
| R1 — PoB format leaks into the core | AD-6: independent model; PoB confined to engine adapter + disposable spikes. Residual risk: semantic drift between our model and engine concepts — held in check by the conformance suite. |
| R2 — Normalizer bugs become permanent | AD-4: raw archive enables re-normalization within the retention window. **Accepted residual risk (founder, Q4):** snapshots older than the window need re-fetching. |
| R3 — Silent defaulting | I3/I4: Assumptions are a structural category from the first importer, not an add-on. |
| R4 — Hash instability | I2 names canonicalization a first-class normalizer responsibility; verification approach is an implementation-stage concern but the requirement is contractual now. |
| R5 — Config as afterthought | Configuration is build state, inside identity, first-class (§5.3). |
| R6 — Single-loadout assumption | AD-5, day one. |
| R7 — No format versioning | I5: snapshot-format version exists independently of game patches. |
| R8 — Genome/Snapshot ambiguity | AD-1 + §13 GLOSSARY reconciliation. |
| *New:* R9 — Display cache treated as trustworthy data | AD-3 constraint: rendering-only, identity-excluded. A consumer reading the cache for semantics is a defect by definition. |
| *New:* R10 — Per-patch game-data retention lapses | AD-3/I6 create the obligation; the retention runbook is implementation work, but the commitment is made here so nobody "optimizes it away" later. |

## 11. Future RFCs

This RFC deliberately leaves seams for:

- **BuildMutation semantics** — delta taxonomy, composition, conflict rules, promotion mechanics (needed before Optimizer core, Phase 2).
- **Build Genome** — the derived build-essence abstraction (needed before archetype similarity at aggregation scale, Phase 3).
- **Patch Adaptation** — cross-patch snapshot transformation (post-ExileCon checkpoint decision).
- **Canonical Build dedup** — how the Aggregation Engine collapses near-identical public snapshots (Phase 3).

## 12. Open Questions

Genuinely remaining (neither blocks acceptance; both are implementation-stage decisions flagged for visibility):

- **OQ-1** — Exact raw-payload retention window (working default ~90 days; confirm against storage cost and re-normalization telemetry during Phase 1).
- **OQ-2** — Granularity of the Assumptions taxonomy (per-category vs. per-datum) — to be settled by the first importer + S3 spike findings, within the constraint that it can only get *finer* without a format-version bump.

## 13. Documentation Impact

On acceptance, in one pass:

- **docs/GLOSSARY.md** — expand **Build Snapshot** to carry the canonical-representation definition (per AD-1, replacing the "full normalized build data" phrasing with this RFC's); update **Build Genome** *(reserved)* to state "derived from BuildSnapshots; scoped by a future RFC"; add **BuildMutation**, **Raw Import Artifact**, **Loadout Context**, **Display Cache**, **Calculation Result** as canonical terms.
- **docs/DECISIONS.md** — append **ADR-004: Canonical Build Model** recording AD-1…AD-7 (summary form, referencing this RFC).
- **docs/TECH_ARCHITECTURE.md** — fill the *System Components* and *Data Flow* placeholder sections with the §5.2 artifact pipeline (its first real content).
- **docs/PRODUCT_PRD.md / docs/PRODUCT_PLAN.md** — no changes required; the model realizes what they already assume (`build-normalizer` package, engine cache keys). Verified, not modified.
- **docs/PROJECT_CONTEXT.md** — status update as always.
