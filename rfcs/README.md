# RFCs — Feature Proposals

Every significant feature or change begins its life as an RFC in this directory.

## What an RFC is

- A **proposal document** — it argues for a change, it does not describe the current product.
- **Temporary** — its job ends when it is accepted or rejected.
- **Reviewed** — no RFC is implemented without review.

## What an RFC is not

RFCs are **never the source of truth**. The source of truth is always:

- `docs/PRODUCT_PLAN.md`
- `docs/PRODUCT_PRD.md`
- `docs/UX_PRESENTATION.md`
- `docs/TECH_ARCHITECTURE.md`

If an RFC and a doc disagree, the doc wins.

## Lifecycle

The RFC stage sits inside the full lifecycle defined in `docs/WORKFLOW.md` (the authoritative version):

```
Idea → Discussion → Research → RFC (here) → Review → Documentation
     → Prototype → Implementation → Testing → Git Commit → Update PROJECT_CONTEXT.md
```

1. **Draft** — written here as `NNNN-short-title.md` (numbers increment sequentially).
2. **Review** — discussed; compliance charter (`docs/PRODUCT_PRD.md` §7.5), vision alignment (`docs/VISION.md`), and principles check (`docs/PRINCIPLES.md`) are mandatory.
3. **Accepted** — the proposer applies the RFC's changes to the relevant `docs/` files; architectural decisions get an ADR appended to `docs/DECISIONS.md`. The RFC is marked `Accepted` and kept.
4. **Rejected** — the RFC is marked `Rejected` with the reason and kept for historical reference. Never delete RFCs.

## Suggested RFC skeleton

```markdown
# RFC-NNNN: <title>
Status: Draft | In Review | Accepted | Rejected
Date: YYYY-MM-DD

## Problem
## Proposal
## Alternatives considered
## Compliance, vision & principles check
## Documentation impact   ← which docs/ files change if accepted
```
