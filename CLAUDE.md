# CLAUDE.md — ExileLab operating rulebook

**ExileLab** is an intelligent build-optimization *layer* for Path of Exile 2: import a build from
anywhere (Maxroll, Mobalytics, poe.ninja, a Path of Building code, or a GGG character), measure it
with the real, unmodified PoB2 calculation engine, and recommend changes ranked against **the
player's own priorities** — never a fixed max-DPS objective.

This file is the **rulebook**: how to work in this repository. `README.md` is the brief app pitch;
`ARCHITECTURE.md` is the system overview; the authoritative product knowledge lives in `docs/`.

> **[IMPORTANT] The repository — not assistant memory or chat history — is the single source of
> truth.** Long conversational handoffs are an anti-pattern; anything that matters beyond this
> session belongs in a `docs/` file.
>
> Paths in this file are plain references, **not `@`-imports** — read a document *when the protocol
> or your task calls for it*, not all at once. Do not auto-load `docs/` into context.

---

## Start every session here

**[IMPORTANT] Before doing ANY work — no code, no edits, no exceptions:**

1. **Read `docs/PROJECT_CONTEXT.md`** — where development stands right now (phase, milestone, open
   tasks, blockers, where the last session stopped).
2. **Read the documents your task touches** (read order + ownership below).
3. **State back**, in a few lines: the current **phase**, the current **milestone**, **today's
   objective**, and **which document owns** the requested change.
4. **Wait for approval before making changes.**
5. If the user types only **"Continue."**, today's objective is `docs/PROJECT_CONTEXT.md` →
   *Next Recommended Task* — present the plan, then wait for approval.

**End every meaningful session** by updating `docs/PROJECT_CONTEXT.md` (phase, milestone, completed
work, open tasks, next recommended task, last-updated date) and recommending an atomic git commit.

---

## Repository structure

```
ExileLab/
├── CLAUDE.md              ← this rulebook — how to work here (start every session with it)
├── README.md             brief app pitch for humans
├── ARCHITECTURE.md       system overview / orientation map (defers to docs/)
├── docs/                 ← SOURCE OF TRUTH
│   ├── PROJECT_CONTEXT.md  living status: phase, milestone, tasks (update every session)
│   ├── VISION.md           why the project exists (rarely changes)
│   ├── PRINCIPLES.md       engineering philosophy guiding all decisions
│   ├── WORKFLOW.md         the official development lifecycle + session rules
│   ├── PRODUCT_PLAN.md     strategy, roadmap, phases, milestones
│   ├── PRODUCT_PRD.md      functional requirements, acceptance criteria, monetization, compliance
│   ├── UX_PRESENTATION.md  how users experience the product (screens, flows, components)
│   ├── TECH_ARCHITECTURE.md implementation architecture (services, data flow, infra)
│   ├── DECISIONS.md        append-only architectural decision log (ADRs)
│   └── GLOSSARY.md         canonical terminology — use these exact terms
├── rfcs/                 feature proposals (temporary; docs always win — see rfcs/README.md)
├── research/             knowledge gathering (never source of truth — see research/README.md)
├── assets/               screenshots/ and diagrams/
├── engine/               PoB2 calc-engine integration (LuaJIT sidecar) — not yet started
├── backend/              API & services (Node/Fastify) — not yet started
├── frontend/             web app (Next.js) — not yet started
├── scripts/              dev/ops scripts
└── tools/                internal tooling
```

## Documents — read order & ownership

Read in this order (top = read first). **Every change has exactly one owning document — identify
it before editing.** If a change ripples across several documents, **update all of them together in
the same pass**; documentation must never be internally inconsistent.

| # | File | Owns / read it for | Never put here |
|---|---|---|---|
| 1 | `docs/PROJECT_CONTEXT.md` | Current status: phase, milestone, tasks, blockers, last session | Requirements, strategy, architecture (link, don't duplicate) |
| 2 | `docs/VISION.md` | Why the project exists; unchanging principles | Implementation details |
| 3 | `docs/PRINCIPLES.md` | Engineering philosophy | Product features |
| 4 | `docs/WORKFLOW.md` | The development lifecycle and session rules | Product or technical content |
| 5 | `docs/PRODUCT_PLAN.md` | Strategy, roadmap, phases, milestones, direction | Code-level detail |
| 6 | `docs/PRODUCT_PRD.md` | Functional requirements, acceptance criteria, monetization, compliance charter (§7.5) | Implementation architecture |
| 7 | `docs/UX_PRESENTATION.md` | Screen flows, interaction, components, presentation hierarchy | Backend logic |
| 8 | `docs/TECH_ARCHITECTURE.md` | Services, data flow, engine, frontend, backend, infrastructure | Product decisions |
| 9 | `docs/DECISIONS.md` | Architectural history (ADRs) — append-only, never rewritten | Anything else |
| 10 | `docs/GLOSSARY.md` | Canonical terminology | Definitions that contradict the docs above |
| — | `rfcs/` | Proposals (temporary; docs always win) | Source-of-truth content |
| — | `research/` | Knowledge gathering | Product-behavior definitions |

*(Read `docs/UX_PRESENTATION.md` before touching anything user-facing. `ARCHITECTURE.md` is a
convenience overview — orientation only, it owns nothing.)*

---

## How change happens — the lifecycle

The full lifecycle is authoritative in `docs/WORKFLOW.md`. In short:

```
Idea → Discussion → Research → RFC → Review → Documentation
     → Prototype → Implementation → Testing → Git Commit → Update PROJECT_CONTEXT.md
```

Rules that bite:
- **Documentation lands before code.** New behavior is documented (through the workflow) before it
  is built. Code that contradicts the docs is a bug in one of them — fix the contradiction first.
- **New ideas never modify product docs directly.** They graduate: Idea → Discussion → Research →
  RFC → Review, and only an *accepted* RFC edits `docs/` (plus an ADR in `DECISIONS.md`).
- **If an RFC and a doc disagree, the doc wins.**
- **Proportionality:** a typo/link/format fix may skip the middle stages — but never the commit or
  the `PROJECT_CONTEXT.md` update, and never for anything touching behavior, requirements, or
  architecture. When unsure whether something is trivial, it isn't.

---

## Build with GSD skills — do not build ad-hoc

**[IMPORTANT] Real build work goes through the GSD skill workflow, not freehand coding.** The GSD
skills are the *engine* that executes the `WORKFLOW.md` lifecycle with atomic commits, state
tracking, and verification gates. When a task reaches a lifecycle stage below, invoke the matching
skill (via the Skill tool / slash command) rather than improvising.

| Lifecycle stage / need | Use the GSD skill |
|---|---|
| Kick off a project or a new milestone | `/gsd-new-project`, `/gsd-new-milestone` |
| Explore or capture a raw idea | `/gsd-explore`, `/gsd-capture` |
| Prototype / validation spike (**we are in Phase 0 spikes now**) | `/gsd-spike` (throwaway experiential spikes), `/gsd-sketch` (throwaway UI mockups) |
| Discuss a phase before planning | `/gsd-discuss-phase` |
| Plan a phase / plan a vertical MVP slice | `/gsd-plan-phase`, `/gsd-mvp-phase` |
| Implement a planned phase | `/gsd-execute-phase` (or `/gsd-quick` / `/gsd-fast` for trivial scoped tasks) |
| Test & verify the work | `/gsd-verify-work`, `/gsd-add-tests`, `/gsd-validate-phase` |
| Review code / security / UI | `/gsd-code-review`, `/gsd-secure-phase`, `/gsd-ui-phase`, `/gsd-ui-review` |
| Ship / open a PR | `/gsd-ship` |
| Check status or decide next step | `/gsd-progress`, `/gsd-stats`, `/gsd-health` |
| Turn any input into a knowledge graph | `/graphify`, `/gsd-graphify` |

Rules:
- **A behavioral change without a test is incomplete** (`WORKFLOW.md`); route it through
  `/gsd-plan-phase` → `/gsd-execute-phase` → `/gsd-verify-work`, not a lone edit.
- GSD does not replace this project's RFC/Documentation stages — an accepted RFC and its doc updates
  still precede `/gsd-execute-phase`. GSD runs the build *after* the design is documented.
- Prefer the **most specific** skill for the task; when unsure which stage you're in, run
  `/gsd-progress`.

---

## Non-negotiables

1. **Full legal & ToS compliance.** Official/sanctioned APIs only for server-side collection; never
   POESESSID; never automate player actions; attribute every aggregated build. The binding charter
   is `docs/PRODUCT_PRD.md` §7.5 — if GGG says stop, we stop.
2. **Deterministic math wears the crown.** The PoB2 engine computes every number; the LLM (the
   **Build Coach**) only narrates. The optimizer never assumes max DPS = better (ADR-003).
3. **The engine is consumed unmodified** — pinned to the upstream PathOfBuilding-PoE2 fork, one pin
   per game patch; we never diverge it (ADR-001). Work around headless gaps at the shim layer.
4. **The repository is the source of truth** — long-term knowledge lives in `docs/`, not in
   assistant memory or chat history.

## Conventions

- **Use canonical terms.** `docs/GLOSSARY.md` is authoritative (BuildSnapshot, BuildMutation,
  Preference Engine, Weighted Score, Context Detector, Archetype, Aggregation Engine, Build Coach…).
  Do not introduce synonyms in docs, code, or UI copy; a new concept is named in the glossary first.
- **Attribution is a feature, not fine print** — anything sourced from a public platform carries a
  visible source chip/link (compliance charter + UX law).
- **Commits are atomic**, with a message explaining *what changed and why*. Never commit secrets
  (`.env*` is gitignored). LF line endings (`.gitattributes`).
- **Keep this file lean.** It loads into every session; add durable rules here, put procedures in
  skills and detail in `docs/`.
