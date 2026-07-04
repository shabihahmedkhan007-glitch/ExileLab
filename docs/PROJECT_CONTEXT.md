# PROJECT_CONTEXT — Living Status Document

> The first document every session reads (after README.md) and the last document every session updates. This replaces long chat handoffs. Keep entries short and link to owning docs instead of duplicating them.

## Current Phase

**Pre-implementation → entering Phase 0 (Validation Spikes)** of `PRODUCT_PLAN.md`. No application code exists yet — by design. Workflow-wise (see `WORKFLOW.md`): documentation system complete; next work is Research/Prototype-stage spike activity.

## Current Milestone

**Phase 0 complete (est. 2–3 weeks):** spike gates S1–S3 passed, S4 (GGG OAuth application) submitted, S5 orderings validated, S6 diff demo works, S7 (PRD v2 revision) approved. Full definitions in `PRODUCT_PLAN.md` → Phase 0.

## Current Objective

Repository housekeeping before spikes begin: initialize git, fix known documentation inconsistencies (see Open Tasks 2), then start S4 + S1.

## Current RFC

None. RFC-0001 not yet created. (S7, the PRD v2 revision, does **not** need an RFC — it applies the already-accepted ADR-003 pivot to a lagging document.)

## Completed Work

- 2026-07-03 — PRD v1 written (10-agent research synthesis) → now `docs/PRODUCT_PRD.md`.
- 2026-07-03 — Founder compliance directive locked (→ ADR-002); trade-sniper pillar redesigned/demoted.
- 2026-07-03 — Architecture pivot applied (→ ADR-003); `PRODUCT_PLAN.md` rewritten as v2.
- 2026-07-03 — UX/presentation vision written → `docs/UX_PRESENTATION.md`.
- 2026-07-04 — Repository reorganized: `docs/` structure, `rfcs/`, `research/`, scaffolded code dirs; VISION, TECH_ARCHITECTURE (placeholder), DECISIONS (ADR-001–003), GLOSSARY created.
- 2026-07-04 — Repository operating system established: README session-start protocol, PRINCIPLES.md, WORKFLOW.md, this document.

## Open Tasks

1. `git init` + first commit (do first — makes everything below undoable).
2. Doc consistency pass: fix stale `PLAN.md`/`PRD.md`/`PRESENTATION.md` filename references inside `PRODUCT_PLAN.md` and `UX_PRESENTATION.md` (incl. its self-referencing header); settle "Build Aggregation Service" → "Aggregation Engine" naming (GLOSSARY already prefers the latter); PRD pillar-numbering cosmetics fold into S7.
3. S4 — draft & submit GGG OAuth application (longest external lead time).
4. S1 — engine benchmark spike (GO/NO-GO gate: median full calc <500ms, misc <50ms).
5. Collect fixtures: 3 benchmark builds, 20-character import corpus, 1 archetype in 3 source versions (incl. a Twister Huntress).
6. S2 — zlib shim + share-code round-trip (byte parity on 10 pobb.in codes).
7. S5 — preference-engine vertical slice + scoring design note.
8. S3 — import heuristics (gate ≥90% sane FullDPS).
9. S6 — aggregation feasibility (3-source normalize + diff demo).
10. S7 — PRD v2 revision + founder sign-off.
11. Decide: is an execution-level work-breakdown doc (BUILD-PLAN) needed for Phase 0, or does PRODUCT_PLAN.md suffice? (Requested pre-reorg, never written.)

## Known Risks

Top of the register (full table in `PRODUCT_PLAN.md` → Risks): objective-function quality (#1 product risk — S5 de-risks); S1 benchmark failure (fallback: precomputed-candidate mode); GGG OAuth lead time/denial (PoB-code import keeps Phase 1 unblocked); third-party source dependence (kill-switches + PoB-code fallback); docs drift if the workflow is bypassed under time pressure.

## Blockers

- Repository is **not yet a git repository** — blocks honest history, the ADR append-only guarantee, and commit-based workflow. Resolve first.

## Next Recommended Task

**Open Task 1 + 2:** `git init`, initial commit of the current state, then the doc consistency pass (stale filename references). After that, start S4 (OAuth draft) and S1 (engine benchmark) in parallel.

## Recent Decisions

- ADR-001 — PoB2 engine headless, unmodified, pinned submodule (2026-07-03).
- ADR-002 — Full legal & ToS compliance; official APIs only (2026-07-03).
- ADR-003 — Pivot: optimization layer, not standalone ecosystem; Build Market deleted (2026-07-03).
- Process (2026-07-04, this doc + WORKFLOW.md): repository is the source of truth; assistant memory stays minimal; teaching/mentor style is session-scoped, never persisted.

## Last Session Summary

**2026-07-04:** Reorganized the repo into the documented structure (moved PLAN/PRD/PRESENTATION into `docs/` under new names, created VISION/TECH_ARCHITECTURE/DECISIONS/GLOSSARY, rfcs/ + research/ process dirs, scaffolded code dirs). Ran a full planning review (found the stale-reference and PRD-v1 inconsistencies now in Open Tasks). Established the repository operating system: README session-start protocol, PRINCIPLES.md, WORKFLOW.md lifecycle, and this living status document. No application code written; no RFCs created.

## Last Updated

2026-07-04
