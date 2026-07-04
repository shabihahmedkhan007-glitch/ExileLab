# PROJECT_CONTEXT — Living Status Document

> The first document every session reads (after README.md) and the last document every session updates. This replaces long chat handoffs. Keep entries short and link to owning docs instead of duplicating them.

## Current Phase

**Pre-implementation → entering Phase 0 (Validation Spikes)** of `PRODUCT_PLAN.md`. No application code exists yet — by design. Workflow-wise (see `WORKFLOW.md`): documentation system complete; next work is Research/Prototype-stage spike activity.

## Current Milestone

**Phase 0 complete (est. 2–3 weeks):** spike gates S1–S3 passed, S4 (GGG OAuth application) submitted, S5 orderings validated, S6 diff demo works, S7 (PRD v2 revision) approved. Full definitions in `PRODUCT_PLAN.md` → Phase 0.

## Current Objective

**RFC-0001 is Accepted and its documentation impact is applied.** Next milestone: **Phase 0 validation spikes** — S4 (GGG OAuth application, longest lead) and S1 (engine benchmark GO/NO-GO) first, per PRODUCT_PLAN Phase 0. Documentation changes continue to flow only through the WORKFLOW.md lifecycle.

## Current RFC

None in flight. **RFC-0001 — Canonical Build Model (BuildSnapshot): ACCEPTED (founder, 2026-07-04)** — `rfcs/0001-canonical-build-model.md`. Documentation impact pass applied same day: GLOSSARY reconciled (BuildSnapshot canonical; Build Genome reserved/derived) + 5 new terms (BuildMutation, Raw Import Artifact, Calculation Result, Loadout Context, Display Cache); ADR-004 appended; TECH_ARCHITECTURE System Components + Data Flow populated (first real content); PRODUCT_PRD/PLAN verified, no changes needed. Future RFC seams left by 0001: BuildMutation semantics, Build Genome, Patch Adaptation, Canonical Build dedup. (S7, the PRD v2 revision, does **not** need an RFC — it applies the already-accepted ADR-003 pivot to a lagging document.)

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

1. S4 — draft & submit GGG OAuth application (longest external lead time).
2. S1 — engine benchmark spike (GO/NO-GO gate: median full calc <500ms, misc <50ms).
3. Collect fixtures: 3 benchmark builds, 20-character import corpus, 1 archetype in 3 source versions (incl. a Twister Huntress).
4. S2 — zlib shim + share-code round-trip (byte parity on 10 pobb.in codes).
5. S5 — preference-engine vertical slice + scoring design note.
6. S3 — import heuristics (gate ≥90% sane FullDPS).
7. S6 — aggregation feasibility (3-source normalize + diff demo).
8. S7 — PRD v2 revision + founder sign-off (also covers PRD pillar-numbering cosmetics).
9. Decide: is an execution-level work-breakdown doc (BUILD-PLAN) needed for Phase 0, or does PRODUCT_PLAN.md suffice? (Requested pre-reorg, never written.)
10. Future RFCs when their phase needs them: BuildMutation semantics (before Optimizer core, Phase 2); Build Genome (Phase 3); Patch Adaptation (post-ExileCon); Canonical Build dedup (Phase 3).

## Known Risks

Top of the register (full table in `PRODUCT_PLAN.md` → Risks): objective-function quality (#1 product risk — S5 de-risks); S1 benchmark failure (fallback: precomputed-candidate mode); GGG OAuth lead time/denial (PoB-code import keeps Phase 1 unblocked); third-party source dependence (kill-switches + PoB-code fallback); docs drift if the workflow is bypassed under time pressure.

## Blockers

- None.

## Next Recommended Task

**S4 — draft the GGG OAuth application** (Open Task 1; longest external lead time, start immediately), then **S1 — engine benchmark spike** (Open Task 2; the architecture's GO/NO-GO gate). Both are Phase 0 spikes from PRODUCT_PLAN; neither requires an RFC (they are Research/Prototype-stage work).

## Recent Decisions

- **ADR-004 — Canonical Build Model: BuildSnapshot (RFC-0001)** (2026-07-04): immutable source-independent canonical representation; BuildMutation base+delta; hybrid game-data referencing with identity-excluded Display Cache; time-boxed raw retention; multi-loadout day one; model independent of PoB format; I7 admission rule.
- ADR-001 — PoB2 engine headless, unmodified, pinned submodule (2026-07-03).
- ADR-002 — Full legal & ToS compliance; official APIs only (2026-07-03).
- ADR-003 — Pivot: optimization layer, not standalone ecosystem; Build Market deleted (2026-07-03).
- Process (2026-07-04, this doc + WORKFLOW.md): repository is the source of truth; assistant memory stays minimal; teaching/mentor style is session-scoped, never persisted.

## Last Session Summary

**2026-07-04 (RFC-0001 accepted + docs pass):** Founder accepted RFC-0001 (with the I7 admission rule added during review). Executed the §13 documentation impact pass in one sweep: GLOSSARY — BuildSnapshot takes the canonical definition, Build Genome re-scoped to reserved/derived, Aggregation Engine entry corrected ("normalizes into BuildSnapshots"), five new terms added; DECISIONS — ADR-004 appended; TECH_ARCHITECTURE — System Components and Data Flow populated from RFC-0001 §5.2 (first real content); PRODUCT_PRD/PLAN verified consistent, unchanged. Next milestone recorded: Phase 0 spikes (S4 OAuth first, S1 benchmark GO/NO-GO). No implementation.

**2026-07-04 (RFC-0001 Discussion):** Wrote the Discussion-stage document for RFC-0001 (`rfcs/0001-canonical-build-model.discussion.md`): BuildSnapshot as the system's immutable "narrow waist"; boundaries (no preferences/calc results/prices/guide content); invariants refined (honest fidelity over strict completeness; game-patch + format versioning; deterministic identity); category inventory (Configuration, Assumptions, Provenance first-class); pipeline recommendation raw→snapshot→calc→derived (normalized-only snapshot, Option A); "A-lite" independent-model recommendation vs PoB-format coupling; 8 risks; 5 open questions (Q1–Q5) awaiting founder answers before the RFC draft. No RFC created, no code — architecture discussion only.

**2026-07-04 (cleanup):** Root cleanup before RFC-0001 — created `research/archive/` and moved the pivot PDF into it (contents untouched; the three by-name mentions in DECISIONS/PRODUCT_PLAN/UX_PRESENTATION are not path-links, so nothing broke; path notes folded into Open Task 1). Confirmed the repo was already git-initialized with first commit `4ea751c` by the founder — Blockers cleared. Move + this status update staged; commit left to founder. Earlier same day: full repo reorganization, planning review, and the repository operating system (README protocol, PRINCIPLES, WORKFLOW, this doc). No application code; no RFCs.

## Last Updated

2026-07-04
