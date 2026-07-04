# GLOSSARY

Canonical terminology for all ExileLab documentation and code. **Use these exact terms** — do not introduce synonyms in docs, RFCs, code, or UI copy. When a new concept needs a name, add it here first (via the normal RFC → docs flow for product concepts, or directly for neutral technical terms).

Terms marked *(reserved)* are named here to prevent naming drift but are not yet used in the product docs.

---

**BuildSnapshot** *(canonical spelling; defined by RFC-0001)*
The immutable, normalized, source-independent representation of one build's complete state at one moment, on one game patch — ExileLab's canonical internal language. Every importer produces BuildSnapshots; every downstream system consumes them; none may talk to external platforms directly. Carries a deterministic Canonical Identity computed over its build state only (Metadata and Display Cache excluded). A re-import or an accepted BuildMutation creates a *new* snapshot; nothing ever mutates an old one. Contains one or more Loadout Contexts. Full contract: invariants I1–I7 and the consumer guarantees in RFC-0001.

**Build Genome** *(reserved)*
Reserved for a future *derived* abstraction — the comparison-oriented "essence" of a build for archetype matching and similarity at aggregation scale. Whenever it exists, it is computed **from** BuildSnapshots and is never the canonical representation itself (RFC-0001, AD-1). Scoped by a future RFC; do not use this term for normalized build data.

**BuildMutation**
A lightweight, immutable delta referencing a base BuildSnapshot, describing one candidate change — the optimizer's working unit (thousands may exist per optimization run). An accepted mutation is **promoted**: applied to its base to produce a new BuildSnapshot. Defined at architecture level in RFC-0001 (AD-2); detailed semantics deferred to a future RFC.

**Raw Import Artifact**
The original payload an importer fetched or received from an external source. An importer-owned artifact with time-boxed retention (RFC-0001, AD-4), linked from a snapshot's Provenance for re-normalization and debugging. Never part of a BuildSnapshot, never consumed downstream, never redistributed.

**Calculation Result**
Engine output for a (BuildSnapshot — optionally plus a BuildMutation — × engine version) pair. A separate immutable artifact keyed by those identities; never embedded in a snapshot (RFC-0001, AD-7).

**Loadout Context**
One coherent equipment-and-tree configuration within a build (PoE2 weapon sets with per-set passive points). A BuildSnapshot supports multiple Loadout Contexts from day one, with one designated primary (RFC-0001, AD-5); consumers must not assume exactly one exists.

**Display Cache**
Minimal denormalized rendering data (names/icons-level) carried by a BuildSnapshot so UI surfaces — including statically-rendered shared reports — can render historical snapshots without a historical-game-data lookup. Strictly rendering-only: excluded from Canonical Identity, never a source of semantic truth, capped at what renderers need (RFC-0001, AD-3 + I7 note).

**Canonical Build**
The deduplicated representative of one archetype variant within the aggregation dataset — when many public builds are near-identical copies of the same guide/ladder build, the Aggregation Engine collapses them into one Canonical Build (with attribution) used for comparison and percentile statistics.

**Preference Engine**
The deterministic scoring component that turns a build's engine-computed metrics plus the user's axis weights into a single **Weighted Score**. Implements satisficing (floor constraints first, then maximize). Never calls the LLM.

**Preference Axes**
The eight user-weightable dimensions of the Weighted Score: Damage, Survivability, Movement Speed, Attack Speed, Cast Speed, Skill Mobility Efficiency, Resource Sustain, Currency Efficiency.

**Goal Preset**
A named, pre-tuned set of axis weights (and floor constraints) — e.g. Fast Mapping, Boss Farming, Hardcore Survivability, Budget Farming. Selecting a preset sets the sliders; users may then adjust.

**Weighted Score**
The single 0–100 number the Preference Engine assigns a build (or a candidate change) under a given set of axis weights and constraints: `Σ wᵢ · normalizeᵢ(metricᵢ)` subject to floor constraints. All rankings ("recommended changes", "score-per-divine") are orderings of Weighted Score deltas.

**Context Detector**
The component that classifies what a build is *trying to do* (its **Archetype**) before any judgment is made — e.g. detecting attack speed used as mobility. Its output conditions the Doctor's grading and the optimizer's suggestions.

**Archetype**
The detected playstyle/skill classification of a build (e.g. "Twister Huntress speed-mapper"). Comparison sets, percentiles, and goal-aware grading are always relative to an archetype, never to the global population.

**Optimization Run**
One server-side execution unit: a build snapshot + weights/constraints submitted to the engine queue, producing scored candidate changes. Optimization Runs are the metered freemium compute unit (queue priority, run quotas).

**Doctor Report**
The Character Doctor's output: a severity-sorted, goal-aware diagnosis of a build snapshot (checklist findings with deterministic evidence, category grades, fix options), optionally narrated by the Build Coach.

**Build Coach** *(reserved)*
The product's single LLM-narration persona and the only channel through which generated text reaches the user (always inside the labeled AI callout). The Build Coach explains deterministic findings; it never produces a number, item name, or node name that isn't in the structured results it narrates.

**Aggregation Engine**
(Formerly "Build Aggregation Service" — standardized to **Aggregation Engine** on 2026-07-04; the old name survives only in ADR-003's historical text.) The service that collects public builds via public interchange endpoints only (never guide content), with attribution, normalizes them into BuildSnapshots, and maintains Canonical Builds and archetype statistics.

**Comparative Optimization**
The feature that diffs a user's build snapshot against Canonical Builds of the same archetype and re-scores the differences under the *user's* weights — surfacing which specific divergences help or hurt *their* goals.

**Engine Sidecar**
The LuaJIT process pool running the unmodified PoB2 calculation engine behind a JSON shim. The only component that executes engine code; everything else talks to it over its internal API.

**Compliance Charter**
The locked ruleset in `PRODUCT_PRD.md` §7.5 governing all data collection and platform interaction (official APIs only, never POESESSID, no automation, attribution, comply-and-stop). Binding on every feature and RFC.
