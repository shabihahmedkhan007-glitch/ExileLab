# PRINCIPLES — Engineering Philosophy

These principles guide every engineering decision in ExileLab. When two options are otherwise equal, the one that better honors these principles wins. When a proposal violates one, the violation must be called out explicitly (in the RFC or review) and justified — silence is not acceptance.

## Correctness & trust

1. **Never duplicate calculations already solved by Path of Building.**
   The PoB2 engine is the community-trusted calculator. Re-implementing any of its math creates a second source of truth that will drift. If a number is computable by the engine, the engine computes it (ADR-001).

2. **Prefer deterministic systems over AI guesses.**
   Anything that can be a rule, a formula, or a lookup must be one. The LLM narrates results; it never produces a number, a ranking, or a recommendation (see PRODUCT_PRD §10).

3. **Every recommendation must be explainable.**
   A suggestion the user can't audit is a suggestion they can't trust. Every ranked change carries its per-axis score decomposition and the engine outputs behind it.

4. **Every optimization must be reproducible.**
   Same Build Snapshot + same weights + same engine version → same result, always. Cache keys, engine pins, and scoring functions are all versioned so any past result can be regenerated and verified in desktop PoB2.

## Product judgment

5. **Player intent is more important than maximum theoretical DPS.**
   The Preference Engine exists because "better" is personal. No feature may silently assume a max-DPS objective (ADR-003).

6. **External platforms are data sources, never the source of truth.**
   Maxroll, Mobalytics, poe.ninja, and pobb.in feed the Aggregation Engine through public interchange endpoints, with attribution. Our normalized Build Snapshot — computed by our pinned engine — is the authoritative representation; upstream formats and availability may change under us and must never be load-bearing (see PRODUCT_PLAN compliance notes).

7. **Avoid feature creep. Build only what the current milestone requires.**
   The current milestone is defined in PROJECT_CONTEXT.md and scoped in PRODUCT_PLAN.md. Ideas that fall outside it go through the workflow (Idea → Discussion → Research → RFC), not into the sprint.

## Architecture & process

8. **Keep architecture simple and maintainable.**
   This is a solo/small-team project (PRODUCT_PLAN Goal 5). Every added service, queue, or dependency must pay rent. Boring technology, chosen once, beats novel technology chosen per-feature.

9. **Prefer modular systems over tightly coupled systems.**
   Components communicate through explicit contracts (the engine behind its JSON shim, the Preference Engine as a pure scoring package, sources behind per-source fetchers with kill-switches). Any single external dependency must be removable without a rewrite.

10. **Documentation before implementation.**
    The docs/ directory is the single source of truth. Code that contradicts the docs is a bug in one of them — resolve the contradiction before shipping. New behavior is documented (via the workflow) before it is built.

11. **Small iterative improvements over massive rewrites.**
    Ship thin vertical slices, validate (spikes, beta gates), then extend. A change that can't be reviewed in one sitting is too big — split it.

## Applying these principles

- RFCs must include a principles check alongside the compliance and vision checks.
- Code review evaluates against these principles, not just correctness.
- If a principle itself proves wrong, changing it is an architectural decision: append an ADR to DECISIONS.md and update this file in the same pass.
