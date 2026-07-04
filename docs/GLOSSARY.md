# GLOSSARY

Canonical terminology for all ExileLab documentation and code. **Use these exact terms** — do not introduce synonyms in docs, RFCs, code, or UI copy. When a new concept needs a name, add it here first (via the normal RFC → docs flow for product concepts, or directly for neutral technical terms).

Terms marked *(reserved)* are named here to prevent naming drift but are not yet used in the product docs.

---

**Build Snapshot**
An immutable, imported copy of a build at a point in time — source (PoB code, platform link, or OAuth character), patch version, and the full normalized build data. All calculations, reports, and diffs reference a specific snapshot. A re-import creates a new snapshot; it never mutates an old one.

**Build Genome** *(reserved)*
The normalized, source-agnostic structured representation of a build (tree allocation, items, gems/links, config) that every import — regardless of origin platform — is converted into. The Build Normalizer produces it; everything downstream consumes it.

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
(Also "Build Aggregation Service" in `PRODUCT_PLAN.md` — same component; prefer **Aggregation Engine** going forward.) The service that collects public builds via public interchange endpoints only (never guide content), with attribution, normalizes them into Build Genomes, and maintains Canonical Builds and archetype statistics.

**Comparative Optimization**
The feature that diffs a user's build snapshot against Canonical Builds of the same archetype and re-scores the differences under the *user's* weights — surfacing which specific divergences help or hurt *their* goals.

**Engine Sidecar**
The LuaJIT process pool running the unmodified PoB2 calculation engine behind a JSON shim. The only component that executes engine code; everything else talks to it over its internal API.

**Compliance Charter**
The locked ruleset in `PRODUCT_PRD.md` §7.5 governing all data collection and platform interaction (official APIs only, never POESESSID, no automation, attribution, comply-and-stop). Binding on every feature and RFC.
