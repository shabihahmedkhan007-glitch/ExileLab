# DECISIONS — Architectural Decision Log

Permanent, **append-only** record of architectural decisions.

**Rules**
- Append only.
- Never rewrite history.
- Never delete previous decisions.
- ADR numbers increment sequentially.
- A superseded decision is not edited — a new ADR is appended that references and supersedes it, and the old ADR's Status is updated to `Superseded by ADR-XXX` (the only permitted edit).

**Template**

```
## ADR-XXX — <title>

Date: YYYY-MM-DD

Status: Proposed | Accepted | Superseded by ADR-YYY

Context:
<what situation forced a decision>

Decision:
<what was decided>

Consequences:
<what follows from it — good and bad>
```

Statuses: `Proposed` → `Accepted` (or `Rejected`); later possibly `Superseded by ADR-XXX`.

---

## ADR-001 — Use the Path of Building 2 engine headless, unmodified, as a pinned dependency

Date: 2026-07-03

Status: Accepted

Context:
The product needs accurate PoE2 build calculations (150+ stats, DPS, EHP, resistances). Writing a calculation engine from scratch is a multi-year effort; the community PoB2 fork (MIT-licensed) already has a production-proven engine with a headless entry point.

Decision:
Run the PoB2 fork's calculation engine server-side under LuaJIT as a sidecar service, consumed **unmodified** and pinned (git submodule, one pin per game patch). All product code lives outside the engine; integration happens through a thin shim. The engine is never forked or diverged.

Consequences:
- We inherit upstream accuracy and patch-tracking for free; upstream updates are a re-pin, not a merge.
- We must work around headless gaps at the shim layer (zlib stubs, import heuristics) rather than patching the engine.
- Engine performance is a hard external constraint — a benchmark spike gates the architecture (go/no-go).
- LGPL `base64.lua` bundled in the engine must be swapped at the integration layer for license cleanliness.

---

## ADR-002 — Full legal & ToS compliance; official APIs only (founder directive)

Date: 2026-07-03

Status: Accepted

Context:
The original trade-sniper concept required data sources that violate GGG's Terms of Service (no public PoE2 stash API, undocumented trade2 API, POESESSID sharing banned). The founder issued a binding directive: fully legal operation, no gray-hat shortcuts.

Decision:
Adopt a locked compliance charter (`PRODUCT_PRD.md` §7.5): server-side collection uses official/sanctioned APIs only; never POESESSID; never automate player actions; register our own GGG OAuth client; honor rate limits; trade interactions are user-initiated deep links only. Server-side sniping is permanently cut absent a sanctioned API or written GGG permission.

Consequences:
- The trade-sniper pillar was redesigned and later demoted to a supporting price layer.
- Some competitor capabilities are deliberately out of reach; this is accepted as a moat of trust rather than a weakness.
- Every phase includes a compliance audit; any GGG objection is comply-and-stop.

---

## ADR-003 — Architecture pivot: optimization layer, not standalone ecosystem

Date: 2026-07-03

Status: Accepted

Context:
Founder directive ("Plan File Modification Request — Architecture Pivot") re-scoped the product: competing with Maxroll/Mobalytics/poe.ninja as a build repository is the wrong fight; the unserved need is personalized optimization.

Decision:
ExileLab is a **personalized build-optimization layer on top of existing platforms**. The Build Market pillar is deleted. The core becomes: preference-weighted multi-objective optimizer (slider axes + goal presets, satisficing scoring), context-aware archetype detection, comparative optimization against public builds via public interchange endpoints with attribution, and a Build Aggregation Service that never scrapes guide content.

Consequences:
- No build hosting, creator marketplace, or ranked browsing; the aggregation service and normalizer become core infrastructure instead.
- Objective-function quality (the preference score) becomes the #1 product risk.
- Positioning, PRD, plans, and UX are all derived from this pivot; `PRODUCT_PLAN.md` is at v2 accordingly.

---

## ADR-004 — Canonical Build Model: BuildSnapshot (RFC-0001)

Date: 2026-07-04

Status: Accepted

Context:
ExileLab imports builds from many sources (PoB codes, Maxroll, Mobalytics, poe.ninja, GGG API) and feeds many consumers (engine, Context Detector, Preference Engine, Comparator, Upgrade Planner, Doctor, Coach). Without one canonical representation this is an N×M integration problem, and the path of least resistance — adopting Path of Building's document format as the internal language — would permanently couple the core to a third-party format. Full rationale, alternatives, and risks: `rfcs/0001-canonical-build-model.md` (Accepted 2026-07-04; discussion resolved same day).

Decision:
Adopt **BuildSnapshot** as the single canonical, normalized, source-independent representation of build state — the system's narrow waist. Key rulings (AD-1…AD-7 of the RFC): BuildSnapshot owns the canonical-representation name and Build Genome stays reserved for a future derived abstraction; snapshots are immutable, with change modeled as BuildMutation deltas promoted to new snapshots on acceptance; game data is referenced by ID + patch with a minimal identity-excluded Display Cache; raw payloads are importer artifacts with time-boxed retention, never part of the snapshot; multiple Loadout Contexts are modeled from day one; the model is ExileLab's own ("A-lite"), independent of PoB's format, with a conformance-tested adapter at the engine boundary; snapshots hold normalized build state only — calculated and derived values are separate downstream artifacts. Invariants I1–I7 apply, including the admission rule (I7): every element must be justified by a named downstream consumer requirement.

Consequences:
- All importers converge on one output; all consumers are source-blind by construction (attribution reads Provenance only).
- ExileLab commits to retaining per-patch game data for as long as referencing snapshots must remain interpretable.
- Re-normalization is guaranteed only within the raw-retention window (~90-day working default); older snapshots require re-fetching (accepted residual risk).
- A permanent, conformance-tested translation adapter exists at the engine boundary; PoB payloads circulate only inside disposable Phase 0 spikes.
- Deterministic identity discipline (canonicalization) becomes a first-class normalizer responsibility; every downstream cache keys off snapshot identity.
- GLOSSARY reconciled and extended (BuildSnapshot, Build Genome, BuildMutation, Raw Import Artifact, Calculation Result, Loadout Context, Display Cache).
