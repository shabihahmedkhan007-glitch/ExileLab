# Discussion: RFC-0001 — Canonical Build Model (BuildSnapshot)

| | |
|---|---|
| Stage | **Discussion** (pre-RFC — see docs/WORKFLOW.md stage 2) |
| Date | 2026-07-04 |
| Status | **Resolved 2026-07-04** — all open questions (Q1–Q5) answered by founder; cleared for RFC-0001 drafting |
| Scope | Architecture only. No implementation, no schemas, no fields, no storage, no APIs. |
| Out of scope | Build Genome (explicitly deferred to a future RFC), everything downstream of the model itself |

---

## 1. What is a BuildSnapshot, conceptually?

**A BuildSnapshot is an immutable, source-independent statement of fact: "this is the complete state of one character build, as one moment in time, on one game patch."**

The closest analogy is a **git commit**. A commit doesn't care which editor wrote the code; it is self-contained, immutable, has a stable identity, and everything else (diffs, branches, blame) is defined *in terms of* commits. BuildSnapshot plays that role for builds: importers produce them, and every other system in ExileLab consumes them. No component except the importers may ever know what Maxroll's or poe.ninja's data looks like.

Two conceptual commitments follow:

- **It is a fact, not a live object.** A snapshot never updates. The same character imported tomorrow is a *new* snapshot. "The user's build" is a pointer to the latest snapshot, not a mutable thing.
- **It is a boundary, not just a format.** Its real architectural job is to be the *narrow waist* of the system — the point where N import sources and M consumers meet, turning an N×M integration problem into N+M.

### Relationship to the GLOSSARY (must be reconciled in the RFC)

The GLOSSARY currently defines both **Build Snapshot** (immutable imported copy: source + patch + "full normalized build data") and **Build Genome** *(reserved)* ("the normalized, source-agnostic structured representation... that every import is converted into"). As written, these overlap almost completely — two names for one idea is exactly what the GLOSSARY exists to prevent.

**Recommendation:** RFC-0001 claims the whole "canonical normalized representation" territory for **BuildSnapshot**. **Build Genome stays reserved** for something genuinely different and later — a *derived, comparison-oriented abstraction* (the "essence" of a build for archetype matching and similarity), which would be computed *from* snapshots. We do not design Genome now; we only fix the boundary so the names stop competing. GLOSSARY update lands with the accepted RFC.

---

## 2. What is NOT part of a BuildSnapshot?

Boundaries, with the reason each is excluded:

| Excluded | Why |
|---|---|
| **User preferences / axis weights / goal presets** | They describe the *player*, not the build. The same snapshot must be scorable under any weights. Binding weights to snapshots would silently break "re-score instantly when sliders move." |
| **Calculated values** (DPS, EHP, resistances…) | Engine output, not build state. They depend on engine version; embedding them couples the snapshot's identity to the engine pin and breaks reproducibility. Calculation results are separate artifacts *keyed by* snapshot identity (see §5). |
| **Derived analyses** (archetype classification, doctor findings, diffs, recommendations) | Products of model-versioned components that will improve over time. A snapshot must not change when the Context Detector gets smarter. |
| **Market prices / currency values** | Volatile by the hour; a snapshot is a moment of *build* state, not economy state. The price layer joins against snapshots, never lives inside them. |
| **Source platform guide content** (prose, videos, leveling guidance) | Compliance charter: guide content is the platforms' IP. We ingest build payloads only. This exclusion is a legal boundary, not just a design one. |
| **Account identity beyond minimal provenance** | Privacy surface. The snapshot needs "where this came from" for attribution, not "who this person is." |
| **The optimizer's working state** (applied suggestions, undo stack) | A modified build is either a new snapshot or an explicit mutation *referencing* a snapshot (Open Question Q2) — never an edit to one. |

---

## 3. Invariants — proposed, and challenged

**I1 — Immutability.** Once created, never modified. *Unchallenged.* This is what makes snapshot identity a valid cache key for everything downstream (engine results, analyses, diffs) and what makes optimization reproducible (PRINCIPLES #4).

**I2 — Stable, deterministic identity.** Two imports of the same build state yield the same canonical form and therefore the same identity/hash. *Challenged and kept with a warning:* this is the hardest invariant to actually honor — it demands strict canonicalization discipline (ordering, normalization of equivalent forms) from day one. If we get it wrong early, every downstream cache key inherits the instability. The RFC must treat canonicalization as a first-class requirement, not a serialization detail.

**I3 — Source independence.** No consumer can tell (or may ask) which platform a snapshot came from — except by reading the Provenance category for attribution display. *Challenged and refined:* full independence is a polite fiction, because **sources differ in fidelity** — a PoB export carries full configuration; a poe.ninja character may lack it; a guide link may carry variants. Pretending all sources are equal forces silent guessing. The refinement: **uniform shape, honest fidelity** — the snapshot's *structure* is source-independent, but it must carry explicit annotations of what was imported vs. inferred vs. defaulted (see the Assumptions category, §4). Downstream stays source-blind but *confidence-aware*.

**I4 — Completeness.** *Challenged and replaced.* Strict completeness ("reject anything missing data") would reject most real-world imports — the S3 spike exists precisely because imports arrive incomplete. The workable invariant is **engine-sufficiency with declared assumptions**: every snapshot can be submitted for calculation without further reference to its source, and every gap the importer filled is declared, never silent. "Honest" beats "complete."

**I5 — Version awareness.** Every snapshot names the **game patch** it belongs to; interpretation of its contents is defined relative to that patch's game data. *Refined:* game version is part of the snapshot; **engine version is not** — the engine is a consumer, and its version belongs to calculation results. Additionally the **snapshot format itself needs a version**, independent of game patches, so the model can evolve without corrupting history (see Risk R7).

**I6 — Self-containedness by reference.** A snapshot must be interpretable using only itself plus the pinned game data of its declared patch — never a live call to an external platform. (Whether game entities are *embedded* or *referenced* is Design Option B below.)

---

## 4. Information categories (categories only — no fields)

Categories the model must eventually cover. Grouped by their nature, because the groups age differently:

**Build state (the core, what the hash covers):**
- **Character** — class/ascendancy identity, level.
- **Passive Tree** — allocation, including PoE2-specific structures (see Risk R6 on weapon-set points).
- **Equipment** — itemization across all slots, including jewels and PoE2 slot types (flasks, charms).
- **Skills & Gems** — skill setups, support links, and the **main-skill designation** (an import heuristic output — S3 — so it doubly needs an assumption annotation).
- **Configuration** — the calculation context: enemy assumptions, active conditions, charges/flags. *Deliberately promoted to first-class:* config is the most commonly forgotten category and the largest source of "same build, wildly different numbers." Engine parity is impossible without it (Risk R5).
- **Resources** — the build's resource posture (life/ES/spirit/mana reservation state) *as build state*, distinct from computed defensive totals, which are calculation output.

**Identity & context (about the snapshot, not the build):**
- **Versioning** — game patch; snapshot-format version.
- **Provenance** — source platform, source reference, fetch/import time, attribution data (a compliance requirement, not a nice-to-have: every comparison card must be able to attribute its source).
- **Assumptions / fidelity annotations** — what was imported vs. inferred vs. defaulted, per I3/I4.
- **Metadata** — display naming, league context, and similar non-semantic labels (explicitly excluded from identity/hash so a renamed build isn't a "different" build — the RFC should confirm this boundary).

---

## 5. Raw, normalized, calculated, derived — what does the snapshot hold?

This is the central architectural decision. The clean mental model is a **one-way pipeline of immutable artifacts**, each referencing the previous by identity:

*raw import → **BuildSnapshot** (normalized) → calculation results → derived analyses*

**Option A — BuildSnapshot is normalized data only; raw payloads are archived separately; calculated/derived values are separate downstream artifacts.**
- Pros: single canonical language for all consumers; identity/hash is meaningful (same build ⇒ same hash regardless of source quirks); engine results cache cleanly against it; when the normalizer improves (it will — normalizer bugs are a certainty, S6 will prove it), we re-normalize from archived raw payloads and regenerate snapshots without re-fetching; keeps compliance surface small (raw archive is internal, retention-policied).
- Cons: three artifact kinds to manage instead of one; raw archive is an extra storage/retention decision (and a minor compliance question — Q4).

**Option B — BuildSnapshot bundles raw + normalized (and possibly cached calculations) in one artifact.**
- Pros: one thing to store and pass around; debugging convenience (the raw evidence travels with the data); no separate archive.
- Cons: identity becomes ambiguous (is the hash over the normalized form or the bundle? two sources yielding identical builds would hash differently); embedding calculations couples the artifact to engine versions, violating I1/I5; bundles bloat with the noisiest, least-stable data; consumers are tempted to peek at raw source data, quietly destroying I3.

**Recommendation: Option A.** The snapshot holds normalized build state only. Raw payloads are archived beside it (linked by provenance) for re-normalization and debugging. Calculated values live in their own artifacts keyed by (snapshot identity, engine version); derived analyses key additionally by their model versions. This is more moving parts on paper, but each artifact has one job, and every later system (patch adaptation, re-scoring, conformance testing) gets simpler because of it.

---

## 6. What every downstream engine may assume

The contract, stated as guarantees:

1. **Valid** — it passed canonical validation; malformed imports never become snapshots.
2. **Interpretable** — resolvable against the game data of its declared patch, with no external calls (I6).
3. **Engine-sufficient** — it can be sent to calculation as-is (I4).
4. **Immutable with stable identity** — anything may be cached keyed by its identity, forever (I1/I2).
5. **Honest** — anything inferred or defaulted is annotated; nothing is silently invented (I3/I4).
6. **Source-blind** — no consumer may branch on source platform; attribution display reads Provenance, and that is the only sanctioned use.
7. **Comparable** — any two snapshots on the same patch can be diffed category-by-category (cross-patch comparison is *not* guaranteed; that's Patch Adaptation's job).

And what consumers may **not** assume: freshness (snapshots age), presence of optional categories at full fidelity (check the annotations), or that any calculation/derivation already exists.

## 7. Future dependents and dependency direction

Every arrow points **into** BuildSnapshot; it depends on nothing downstream — only on game-data identities and the canonical model itself. It must never know that any of these consumers exist:

- **Context Detection** — reads snapshots → produces derived archetype classifications.
- **Preference Engine** — reads calculation results (which key off snapshots) → produces weighted scores. Never reads sources.
- **Recommendation Engine / Comparator** — reads *multiple* snapshots + calc results → produces diffs and ranked changes. Guarantee 7 exists for this.
- **Upgrade Planner** — generates *candidate modifications* evaluated against a base snapshot → depends on the mutation story (Q2).
- **Build Coach** — reads findings derived from calc results; two levels removed, must stay there (it narrates; it never touches build state).
- **Patch Adaptation** — the most demanding future client: transforms a snapshot on patch N into a *new* snapshot on patch N+1. It is the reason I5 (patch identity) and Option B-of-Q3 (referencing game entities by identity) matter now.
- **Build Genome** — out of scope by directive. The only decision we take: Genome, whenever it exists, is **derived from** snapshots. The dependency arrow is fixed today so the snapshot never grows Genome-shaped appendages.

## 8. Risks — mistakes that are cheap now and expensive later

- **R1 — PoB's shape leaks into the canonical model.** The engine consumes PoB XML, so the path of least resistance is "canonical model ≈ PoB's document structure." Then a third-party format we don't control becomes our internal language forever, and every PoB format change is a breaking change to *our* core. See Design Option below — this is the RFC's biggest judgment call.
- **R2 — Discarding raw imports.** If raw payloads aren't archived, every normalizer bug permanently corrupts affected snapshots (no re-derivation). Cheap insurance now; impossible retrofit later.
- **R3 — Silent defaulting.** If import heuristics fill gaps without annotation, "honest" (I4) dies at birth, and six months in nobody can say which snapshots are trustworthy. Annotations must exist from the first importer, not be bolted on.
- **R4 — Hash instability.** Weak canonicalization ⇒ identical builds with different identities ⇒ cache misses, duplicate corpus entries, broken dedup for Canonical Builds. Hardest to fix retroactively because every stored identity is wrong.
- **R5 — Config treated as an afterthought.** Without configuration as first-class build state, engine parity (the conformance suite's whole purpose) is unachievable, and every "your DPS differs from PoB" bug report traces here.
- **R6 — Single-loadout assumption.** PoE2 has weapon-set swapping with per-set passive points. A canonical model that assumes one weapon setup and one tree state will need invasive surgery. Model for multiple loadout contexts *conceptually* now, even if importers only fill one at first.
- **R7 — No format versioning.** Game patches version the *content*; nothing versions the *model*. The first structural change to BuildSnapshot would then corrupt or orphan history. Format version is part of I5 from day one.
- **R8 — Genome/Snapshot ambiguity left unresolved.** Two overlapping canonical concepts ⇒ six months of documents and code that disagree about which is authoritative. Resolved by the §1 recommendation.

## Design Option — the model's relationship to Path of Building (the R1 decision)

**Option A — Independent canonical model, with translation at the engine boundary.**
- Pros: we own our core language; PoB format churn is absorbed in one adapter; model can be shaped for *our* consumers (comparison, patch adaptation, honesty annotations — none of which PoB's document cares about); non-PoB sources normalize without contortions.
- Cons: real ongoing cost — a translation layer that must be *proven* faithful (the conformance suite becomes load-bearing); risk of semantic drift between our concepts and the engine's; slower to first demo.

**Option B — Canonical model = PoB's document plus an annotation envelope (provenance, assumptions, versioning around a PoB payload).**
- Pros: fastest possible path; zero translation loss to the engine; the S2/S3 spikes practically produce it for free; a solo developer ships weeks earlier.
- Cons: R1 in full — our narrow waist is someone else's format; every consumer parses PoB's structure, so source independence (I3) is only skin-deep; PoE2-native concepts we need (fidelity annotations, loadout contexts, patch-adaptation identities) get awkwardly grafted onto a document that wasn't designed for them; migrating away later means rewriting every consumer at once.

**Recommendation: Option A, sized honestly — "A-lite."** Own the model, but keep its *semantics* deliberately close to the engine's concepts wherever we have no independent need (don't invent novel abstractions for their own sake), so translation stays thin and the conformance suite can hold it to account. Accept Option B's speed only inside the Phase 0 spikes (S2/S3/S6 may pass PoB payloads around freely as prototypes); the moment production importers exist, they emit the canonical model. This gives us B's velocity where it's disposable and A's ownership where it's permanent.

---

## Open questions for founder review

- **Q1 — Naming:** ✅ **ANSWERED (founder, 2026-07-04): BuildSnapshot wins.** BuildSnapshot is the canonical normalized representation; Build Genome stays reserved for a future derived abstraction. GLOSSARY reconciliation ships with the accepted RFC.
- **Q2 — Mutation story:** ✅ **ANSWERED (founder, 2026-07-04): base + delta.** Optimizer candidates are lightweight deltas referencing an immutable base snapshot; a delta is promoted to a full new snapshot when the user adopts it. Consistent with PRODUCT_PLAN's engine cache key (buildHash + mutationHash). The RFC gets a dedicated section defining the delta concept and promotion semantics.
- **Q3 — Game-data embedding vs. referencing:** ✅ **ANSWERED (founder, 2026-07-04): hybrid — reference + display cache.** Identity + patch references are the source of truth (committing us to retaining per-patch game data); snapshots additionally carry a minimal display cache (names/icons) so UI rendering of old snapshots never needs a historical-data lookup. **Constraint the RFC must state:** the display cache is derived rendering data and is excluded from the snapshot's identity/hash (I2) — two snapshots with identical build state hash identically regardless of cache contents.
- **Q4 — Raw archive retention & compliance:** ✅ **ANSWERED (founder, 2026-07-04): time-boxed retention.** Raw payloads are archived for re-normalization/debugging but auto-deleted after a fixed window (exact window to be set in the RFC; ~90 days as the working default). Consequence the RFC must state: re-normalization after normalizer fixes is only guaranteed for imports within the window — older snapshots require a fresh re-fetch from the source. This keeps the stored footprint of third-party-served data minimal, consistent with the compliance charter's minimize-and-reversible posture.
- **Q5 — Multi-loadout scope:** ✅ **ANSWERED (founder, 2026-07-04): model from day one.** The canonical model structurally supports multiple loadout contexts (PoE2 weapon sets, per-set passive points) per R6; importers populate only the primary loadout initially.

## Recommendations summary

1. BuildSnapshot = the immutable, normalized, source-independent canonical representation — the system's narrow waist (§1).
2. Resolve the Genome/Snapshot overlap now, in BuildSnapshot's favor; Genome stays reserved and derived (§1, Q1).
3. Invariants: immutability, deterministic identity, uniform-shape-honest-fidelity, engine-sufficiency with declared assumptions, game-patch + format versioning, self-containedness by reference (§3).
4. Normalized-only snapshot; raw archived separately **with time-boxed retention (per Q4 answer)**; calculated/derived values as separate downstream artifacts (§5, Option A).
5. Own the canonical model ("A-lite"); PoB payloads allowed only inside disposable Phase 0 spikes (§8 Design Option).
6. Treat Configuration, Assumptions, and Provenance as first-class categories, not metadata afterthoughts (§4).

**Next step (on approval): draft `rfcs/0001-canonical-build-model.md` per the rfcs/README skeleton, incorporating the resolutions to Q1–Q5.**
