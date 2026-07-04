# TECH_ARCHITECTURE

> Implementation architecture only — no product decisions belong here (those live in `PRODUCT_PLAN.md` / `PRODUCT_PRD.md`).
>
> **Status: placeholder.** Sections below are scaffolding to be filled in as implementation begins. Until then, the architecture overview in `PRODUCT_PLAN.md` and the tech-stack section of `PRODUCT_PRD.md` remain the reference; content migrates here as it becomes implementation-concrete.

## High Level Architecture

_TBD_

## Repository Structure

_TBD — mirrors the top-level layout in `README.md`; expand per-directory conventions here as code lands._

## System Components

*(First entries populated from RFC-0001 — Canonical Build Model. Architecture level; no implementation detail yet.)*

- **Importers** — one per external source (PoB share codes, pobb.in, Maxroll, Mobalytics, poe.ninja, GGG OAuth). The only components that know source formats. Produce Raw Import Artifacts (time-boxed retention) and hand them to the normalizer. Source-specific concepts end at this boundary.
- **Normalizer** — translates raw payloads into the canonical model. Owns canonicalization (the discipline behind deterministic snapshot identity) and declares every assumption it makes (imported vs. inferred vs. defaulted).
- **BuildSnapshot (canonical model)** — the narrow waist. Immutable, source-independent, patch- and format-versioned, one-or-more Loadout Contexts, identity computed over build state only. Contract: RFC-0001 invariants I1–I7 and consumer guarantees. Data with guarantees; owns no behavior.
- **BuildMutation** — immutable candidate deltas against a base snapshot (the optimizer's working unit); promoted to new snapshots on user acceptance.
- **Engine boundary adapter** — translates snapshots into what the (unmodified, pinned) PoB2 calculation engine consumes; held faithful by the conformance suite. The canonical model never depends on the engine's document format.
- **Downstream consumers** — Context Detector, Preference Engine, Comparator/Recommendation, Upgrade Planner, Doctor, Build Coach: all read snapshots / calculation results / derived analyses, never sources. Source-blind by construction.

## Engine Layer

_TBD — PoB2 calculation engine integration (`engine/`)._

## Backend

_TBD — services and APIs (`backend/`)._

## Frontend

_TBD — web application (`frontend/`)._

## Data Flow

*(From RFC-0001 §5.2 — the one-way artifact pipeline. Each stage is immutable and references its upstream by identity.)*

```
external source
      │  (importer)
      ▼
Raw Import Artifact          [importer-owned, time-boxed retention]
      │  (normalizer)
      ▼
BuildSnapshot                [canonical, immutable, hashed — THE narrow waist]
      │                                    │
      ▼                                    ▼
Calculation Result           BuildMutation (candidate deltas)
 [keyed by snapshot ×                │ (promotion on acceptance)
  engine version]                    ▼
      │                        new BuildSnapshot
      ▼
Derived Analyses             [keyed by inputs × model versions]
(context, findings, scores, diffs)
```

Rules: data flows one way; calculated and derived values are never embedded in snapshots; every downstream cache keys off snapshot identity (plus the version of whatever produced the artifact); no component after the importers may contact an external platform.

## External Integrations

_TBD_

## APIs

_TBD_

## Database

_TBD_

## Future Scaling

_TBD_

## Security

_TBD_

## Deployment

_TBD_
