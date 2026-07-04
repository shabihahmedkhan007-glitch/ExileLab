# PROJECT_CONTEXT — Living Status Document

> The first document every session reads (after README.md) and the last document every session updates. This replaces long chat handoffs. Keep entries short and link to owning docs instead of duplicating them.

## Current Phase

**Pre-implementation → entering Phase 0 (Validation Spikes)** of `PRODUCT_PLAN.md`. No application code exists yet — by design. Workflow-wise (see `WORKFLOW.md`): documentation system complete; next work is Research/Prototype-stage spike activity.

## Current Milestone

**Phase 0 complete (est. 2–3 weeks):** spike gates S1–S3 passed, S4 (GGG OAuth application) submitted, S5 orderings validated, S6 diff demo works, S7 (PRD v2 revision) approved. Full definitions in `PRODUCT_PLAN.md` → Phase 0.

## Current Objective

Begin Phase 0 work: RFC-0001 — Canonical Build Model (BuildSnapshot), alongside S4 (GGG OAuth draft) and S1 (engine benchmark). **Documentation is frozen as of 2026-07-04** — changes only via the WORKFLOW.md lifecycle (RFC → review → docs) from here on.

## Current RFC

**RFC-0001 — Canonical Build Model (BuildSnapshot): Discussion resolved 2026-07-04, cleared for drafting.** All open questions answered by founder (`rfcs/0001-canonical-build-model.discussion.md`): Q1 BuildSnapshot wins the canonical name (Genome stays reserved/derived); Q2 mutations as base+delta with promotion on adoption; Q3 hybrid game-data strategy (ID+patch references authoritative, display cache excluded from hash); Q4 time-boxed raw-payload retention (~90-day working default); Q5 multi-loadout modeled from day one. (S7, the PRD v2 revision, does **not** need an RFC — it applies the already-accepted ADR-003 pivot to a lagging document.)

## Completed Work

- 2026-07-03 — PRD v1 written (10-agent research synthesis) → now `docs/PRODUCT_PRD.md`.
- 2026-07-03 — Founder compliance directive locked (→ ADR-002); trade-sniper pillar redesigned/demoted.
- 2026-07-03 — Architecture pivot applied (→ ADR-003); `PRODUCT_PLAN.md` rewritten as v2.
- 2026-07-03 — UX/presentation vision written → `docs/UX_PRESENTATION.md`.
- 2026-07-04 — Repository reorganized: `docs/` structure, `rfcs/`, `research/`, scaffolded code dirs; VISION, TECH_ARCHITECTURE (placeholder), DECISIONS (ADR-001–003), GLOSSARY created.
- 2026-07-04 — Repository operating system established: README session-start protocol, PRINCIPLES.md, WORKFLOW.md, this document.
- 2026-07-04 — Git repository initialized; first commit `4ea751c` on `main` (founder).
- 2026-07-04 — Root cleanup: pivot PDF archived to `research/archive/`.
- 2026-07-04 — Dev environment finalized: `.gitignore`, `.gitattributes` (LF normalization), `CLAUDE.md` (auto-loads the README session-start protocol for Claude Code).
- 2026-07-04 — Doc consistency pass (approved, maintenance-only): stale `PLAN.md`/`PRD.md` filename references fixed in PRODUCT_PLAN and UX_PRESENTATION (incl. its header), pivot-PDF path updated to `research/archive/`, "Build Aggregation Service" standardized to "Aggregation Engine" (ADR-003's historical text intentionally untouched). **Documentation frozen**; next milestone: RFC-0001.

## Open Tasks

1. RFC-0001 — Canonical Build Model (BuildSnapshot): **Discussion resolved (Q1–Q5 answered)** → draft the RFC → review → accept → apply to docs (incl. GLOSSARY reconciliation of Build Snapshot vs Build Genome).
2. S4 — draft & submit GGG OAuth application (longest external lead time).
3. S1 — engine benchmark spike (GO/NO-GO gate: median full calc <500ms, misc <50ms).
4. Collect fixtures: 3 benchmark builds, 20-character import corpus, 1 archetype in 3 source versions (incl. a Twister Huntress).
5. S2 — zlib shim + share-code round-trip (byte parity on 10 pobb.in codes).
6. S5 — preference-engine vertical slice + scoring design note.
7. S3 — import heuristics (gate ≥90% sane FullDPS).
8. S6 — aggregation feasibility (3-source normalize + diff demo).
9. S7 — PRD v2 revision + founder sign-off (also covers PRD pillar-numbering cosmetics).
10. Decide: is an execution-level work-breakdown doc (BUILD-PLAN) needed for Phase 0, or does PRODUCT_PLAN.md suffice? (Requested pre-reorg, never written.)

## Known Risks

Top of the register (full table in `PRODUCT_PLAN.md` → Risks): objective-function quality (#1 product risk — S5 de-risks); S1 benchmark failure (fallback: precomputed-candidate mode); GGG OAuth lead time/denial (PoB-code import keeps Phase 1 unblocked); third-party source dependence (kill-switches + PoB-code fallback); docs drift if the workflow is bypassed under time pressure.

## Blockers

- None.

## Next Recommended Task

**Draft RFC-0001** in `rfcs/0001-canonical-build-model.md` per the rfcs/README skeleton, incorporating the resolved Q1–Q5 answers from the discussion document. S4 (OAuth draft) can proceed in parallel — it has the longest external lead time.

## Recent Decisions

- ADR-001 — PoB2 engine headless, unmodified, pinned submodule (2026-07-03).
- ADR-002 — Full legal & ToS compliance; official APIs only (2026-07-03).
- ADR-003 — Pivot: optimization layer, not standalone ecosystem; Build Market deleted (2026-07-03).
- Process (2026-07-04, this doc + WORKFLOW.md): repository is the source of truth; assistant memory stays minimal; teaching/mentor style is session-scoped, never persisted.

## Last Session Summary

**2026-07-04 (RFC-0001 Discussion):** Wrote the Discussion-stage document for RFC-0001 (`rfcs/0001-canonical-build-model.discussion.md`): BuildSnapshot as the system's immutable "narrow waist"; boundaries (no preferences/calc results/prices/guide content); invariants refined (honest fidelity over strict completeness; game-patch + format versioning; deterministic identity); category inventory (Configuration, Assumptions, Provenance first-class); pipeline recommendation raw→snapshot→calc→derived (normalized-only snapshot, Option A); "A-lite" independent-model recommendation vs PoB-format coupling; 8 risks; 5 open questions (Q1–Q5) awaiting founder answers before the RFC draft. No RFC created, no code — architecture discussion only.

**2026-07-04 (cleanup):** Root cleanup before RFC-0001 — created `research/archive/` and moved the pivot PDF into it (contents untouched; the three by-name mentions in DECISIONS/PRODUCT_PLAN/UX_PRESENTATION are not path-links, so nothing broke; path notes folded into Open Task 1). Confirmed the repo was already git-initialized with first commit `4ea751c` by the founder — Blockers cleared. Move + this status update staged; commit left to founder. Earlier same day: full repo reorganization, planning review, and the repository operating system (README protocol, PRINCIPLES, WORKFLOW, this doc). No application code; no RFCs.

## Last Updated

2026-07-04
