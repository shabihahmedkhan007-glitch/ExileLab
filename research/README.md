# Research — Knowledge Gathering

This directory collects information. **Nothing in here defines product behavior.**

## Rules

- Research documents **never directly modify product documentation** and are never cited as the source of truth.
- Research exists to inform proposals: findings that should change the product **must** graduate into an RFC (`rfcs/`) and pass review before any `docs/` file changes.
- Date every document and name its sources — research goes stale (game patches, API changes) and must be re-checkable.
- Compliance applies here too: research into data sources must respect the compliance charter (`docs/PRODUCT_PRD.md` §7.5) — no gray-hat collection methods, even "just to test".

## Possible topics

- Path of Building engine (headless behavior, performance, calculation internals)
- Maxroll (interchange endpoints, embed conventions, partnership posture)
- Mobalytics (PoE2 surface, presentation patterns)
- poe.ninja (build data, economy feeds)
- Official GGG APIs (OAuth, character API, rate limits, cxapi)
- Build aggregation (normalization, dedup, archetype clustering)
- Optimization algorithms (candidate generation, multi-objective scoring, satisficing)
- Performance experiments (engine benchmarks, caching, queue behavior)

## Flow

The Research stage sits inside the full lifecycle defined in `docs/WORKFLOW.md` (the authoritative version):

```
Idea → Discussion → Research (here) → RFC (rfcs/) → Review → Documentation
     → Prototype → Implementation → Testing → Git Commit → Update PROJECT_CONTEXT.md
```
