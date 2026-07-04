# ARCHITECTURE — ExileLab System Overview

> **What this document is.** A single, readable orientation map of how the whole system fits
> together — the big picture that is otherwise scattered across strategy, RFCs, and the
> implementation spec. Read it to get your bearings fast.
>
> **What this document is *not*.** It is **not** a source of truth and it **owns no decisions**.
> Authority lives elsewhere and this file always defers to it:
> - Implementation architecture (services, APIs, database, deployment) → `docs/TECH_ARCHITECTURE.md`
> - Strategy, roadmap, phases, component rationale → `docs/PRODUCT_PLAN.md`
> - Functional requirements & the tech-stack table → `docs/PRODUCT_PRD.md` §9
> - Architectural history (why things are the way they are) → `docs/DECISIONS.md`
> - Canonical terms used below → `docs/GLOSSARY.md`
>
> If this overview ever disagrees with an owning document, the owning document wins — fix the
> contradiction (per `docs/WORKFLOW.md`). **Status: pre-implementation.** No application code exists
> yet; everything below is the *target* architecture the docs commit to, not a description of
> shipped code.

---

## 1. The system in one picture

ExileLab is an **intelligent optimization layer on top of the existing PoE2 build ecosystem** —
not another build repository. A player brings a build from anywhere (Maxroll, Mobalytics,
poe.ninja, a Path of Building code, or their own character); ExileLab measures it with a real
deterministic engine, understands what the build is *trying* to do, and tells the player exactly
how to make it better **for their goals**.

Two architectural commitments shape everything:

1. **Deterministic math wears the crown.** Every number is computed by the unmodified,
   community-trusted **Path of Building 2 calculation engine**, run headless server-side and
   consumed as a pinned dependency (ADR-001). We never re-implement its math. The LLM (the
   **Build Coach**) only *narrates* structured results into prose — it never produces a number,
   ranking, or recommendation (PRINCIPLES §2, PRD §10).
2. **The player's goals define "better."** The **Preference Engine** scores builds against the
   user's own weighted priorities, not a fixed max-DPS objective (ADR-003). This is the product's
   center of gravity and its #1 quality risk.

```
        external sources                         the player's priorities
   (Maxroll · Mobalytics · poe.ninja                 (sliders / goal preset)
    · PoB code · GGG character API)                          │
                 │                                           │
                 ▼                                           ▼
        ┌─────────────────┐        ┌──────────────────────────────────────┐
        │  Import + Normalize │ ──▶ │  BuildSnapshot  (the narrow waist)   │
        └─────────────────┘        └──────────────────────────────────────┘
                                              │
                    ┌─────────────────────────┼─────────────────────────┐
                    ▼                         ▼                          ▼
             PoB2 engine sidecar      Context Detector            Comparative
             (deterministic math)     (what is it FOR?)           Optimization
                    │                         │                    (vs public builds)
                    └──────────┬──────────────┘                          │
                               ▼                                         │
                       Preference Engine  ◀───────────────────────────────┘
                     (weighted, satisficing score)
                               │
                               ▼
                    Ranked, explainable changes  ──▶  Build Coach (LLM narration only)
```

---

## 2. The narrow waist — `BuildSnapshot` (canonical model)

The single most important structural decision (RFC-0001 → ADR-004): every importer converges on
one canonical representation, and every downstream consumer reads only that. This turns an N×M
integration problem (N sources × M consumers) into N + M, and keeps the core independent of any
third-party format.

- **BuildSnapshot** — the immutable, normalized, source-independent representation of one build's
  complete state at one moment on one game patch. It carries a deterministic **Canonical Identity**
  hashed over build state only. It holds normalized build state **and nothing else**: calculated
  and derived values are separate downstream artifacts, never embedded.
- **Immutability + change as delta** — nothing mutates a snapshot. A **BuildMutation** is an
  immutable candidate delta against a base snapshot (the optimizer's working unit); on user
  acceptance it is *promoted* into a new snapshot.
- **Source-blind consumers** — the Context Detector, Preference Engine, Comparator, Upgrade
  Planner, Doctor, and Coach all read snapshots / calculation results, never sources. Attribution
  reads the snapshot's Provenance only.
- **Engine independence** — a permanent, conformance-tested **engine boundary adapter** translates
  snapshots into what the PoB2 engine consumes. The canonical model never depends on PoB's document
  format; PoB payloads circulate only inside disposable spikes.

Full contract (invariants I1–I7, consumer guarantees): `rfcs/0001-canonical-build-model.md`.

---

## 3. Data flow — the one-way artifact pipeline

Every stage is immutable and references its upstream by identity. Data flows one way; calculated
and derived values are never folded back into snapshots; every downstream cache keys off snapshot
identity plus the version of whatever produced the artifact; **no component after the importers may
contact an external platform** (compliance charter, PRD §7.5).

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

*(Mirrors `docs/TECH_ARCHITECTURE.md` → Data Flow, sourced from RFC-0001 §5.2. That doc is
authoritative; this copy is for orientation.)*

---

## 4. Component map

| Component | Responsibility | Notes |
|---|---|---|
| **Importers** | One per external source; the only components that know source formats | Produce Raw Import Artifacts; source-specific concepts end here |
| **Normalizer** | Translate raw payloads into the canonical model; own canonicalization (deterministic identity) | Declares every assumption (imported vs. inferred vs. defaulted) |
| **BuildSnapshot** | The canonical narrow waist (see §2) | Data with guarantees; owns no behavior |
| **BuildMutation** | Immutable candidate deltas against a base snapshot | Promoted to new snapshots on acceptance |
| **Engine boundary adapter** | Translate snapshots into PoB2 engine inputs | Held faithful by the conformance suite |
| **Engine Sidecar** | LuaJIT process pool running the unmodified PoB2 engine behind a JSON shim | The only component that executes engine code (ADR-001) |
| **Context Detector** | Classify what a build is *trying to do* (its Archetype) before any judgment | Suggests default weights; user always overrides |
| **Preference Engine** | Turn engine metrics + user axis weights into one Weighted Score (satisficing) | Deterministic; never calls the LLM |
| **Comparator / Comparative Optimization** | Diff the user's build against Canonical Builds of the same archetype; re-score diffs under the user's weights | Every card attributes + links its source |
| **Aggregation Engine** | Collect public builds via public interchange endpoints only (never guide content), with attribution; normalize to snapshots | Maintains Canonical Builds + archetype statistics |
| **Character Doctor** | Severity-sorted, goal-aware diagnosis of a snapshot | Free top-3 card; premium full report |
| **Build Coach** *(LLM)* | The single narration persona; the only channel generated text reaches the user | Explains deterministic findings only; introduces no new numbers/names |

Detailed definitions: `docs/GLOSSARY.md`. Component rationale and phasing: `docs/PRODUCT_PLAN.md`.

---

## 5. The optimization core

The three components that make ExileLab an *optimizer*, not a viewer:

- **Preference Engine** — replaces "maximize DPS" with a weighted multi-objective score
  `score(build) = Σ wᵢ · normalizeᵢ(metricᵢ)` over eight **Preference Axes** (Damage,
  Survivability, Movement Speed, Attack Speed, Cast Speed, Skill Mobility Efficiency, Resource
  Sustain, Currency Efficiency), each mapped to engine-computed metrics. Weights come from sliders
  or a **Goal Preset**. It is **satisficing, not maximizing**: the damage axis scores against a
  per-goal *target band* ("enough to carry six players"), so the optimizer stops chasing overkill
  and spends the remaining budget on what the player actually values. Every optimizer surface
  consumes Δscore under the user's weights, never raw ΔDPS.
- **Context Detector** — classifies the imported build (skill mechanics, defense archetype,
  resource pattern, damage delivery) so sensible default weights are *suggested* before the user
  touches a slider (e.g. a Twister Huntress: "this build moves by attacking — attack speed is your
  real movement stat"). Always visible, always overridable.
- **Comparative Optimization** — fetches public versions of the same archetype through the
  Aggregation Engine, diffs them against the user's build, engine-evaluates each meaningful
  difference as a candidate change, and ranks the results by Δscore under the *user's* weights,
  with source attribution.

The presentation of all of this (the sliders-as-product, the radar chart, the Raidbots-style score
bars, the coach-not-judge tone) is owned by `docs/UX_PRESENTATION.md`.

---

## 6. Tech stack at a glance

The intended stack (authoritative table with rationale: `docs/PRODUCT_PRD.md` §9.2). One stack,
chosen once — boring technology that pays rent (PRINCIPLES §8).

| Layer | Choice |
|---|---|
| Monorepo | pnpm + Turbo, TypeScript end-to-end |
| Calculation engine | Unmodified PoB2 fork, headless LuaJIT **Docker sidecar**, pinned per game patch (git submodule), JSON-RPC shim, warm process pool, conformance suite vs desktop PoB2 |
| Frontend | Next.js 15 + TypeScript, TanStack Query/Table, Tailwind + shadcn/ui |
| Passive tree | Custom PixiJS WebGL2 renderer from the engine's TreeData atlases |
| API | Node + Fastify |
| Jobs / queue | BullMQ on Redis |
| OLTP database | Postgres 17 |
| Market analytics | Single-node ClickHouse (price ticks, aggregates) |
| Cache / pub-sub | Redis / Valkey (BullMQ + SSE fan-out) |
| LLM | OpenRouter flash-class models — strict-schema, explanation-only, cached, kill-switch |
| Payments | Stripe + ParityDeals (PPP) |
| Hosting | Hetzner + Coolify + Cloudflare; Sentry; Resend |

Result caching is keyed by `(engineVersion, buildHash, mutationHash)`; all external-API risk is
isolated in one market-ingestion service with a per-source kill-switch.

---

## 7. Repository ↔ architecture mapping

Where each part of the system will live (directories are scaffolded; code has not landed):

| Directory | Holds |
|---|---|
| `engine/` | PoB2 calc-engine integration — the LuaJIT sidecar, JSON shim, engine boundary adapter, conformance suite |
| `backend/` | API & services (Fastify), job orchestration (BullMQ), importers, normalizer, Aggregation Engine, Preference Engine, Context Detector, Comparator, Doctor rulebook, price layer |
| `frontend/` | Next.js web app — the build workspace, sliders, radar, tree viewer, shared reports |
| `scripts/` | Dev / ops scripts (engine patch-pin runbook, data export, fixtures) |
| `tools/` | Internal tooling |
| `assets/` | Screenshots and diagrams |
| `docs/` | **Source of truth** — see the document index in `CLAUDE.md` |
| `rfcs/` · `research/` | Proposals (temporary) and knowledge gathering (never source of truth) |

The intended service/package layout inside `backend/` and `engine/` (`services/*`, `packages/*`)
is specified in `docs/PRODUCT_PLAN.md` → *Approach*; it migrates into
`docs/TECH_ARCHITECTURE.md` → *Repository Structure* as code lands.

---

## 8. Where to go for detail

| You want… | Read |
|---|---|
| Why the project exists | `docs/VISION.md` |
| The engineering philosophy | `docs/PRINCIPLES.md` |
| Strategy, roadmap, phases, component specs | `docs/PRODUCT_PLAN.md` |
| Functional requirements, monetization, compliance, full stack table | `docs/PRODUCT_PRD.md` |
| Implementation architecture (services, APIs, DB, deploy) | `docs/TECH_ARCHITECTURE.md` |
| How the user sees and touches it | `docs/UX_PRESENTATION.md` |
| The canonical build model in full | `rfcs/0001-canonical-build-model.md` |
| Why a decision was made | `docs/DECISIONS.md` |
| The exact meaning of a term | `docs/GLOSSARY.md` |
| How to make a change (the rules) | `CLAUDE.md` and `docs/WORKFLOW.md` |
