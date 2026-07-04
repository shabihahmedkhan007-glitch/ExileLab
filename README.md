# ExileLab

An intelligent build optimizer for Path of Exile 2 that adapts builds to **your** playstyle — a personalized optimization layer on top of existing build platforms (Maxroll, Mobalytics, poe.ninja, Path of Building links), powered by the Path of Building 2 calculation engine running headless server-side.

**This repository — not any AI assistant's memory — is the single source of truth for the project.**

---

## 🚦 Session-start protocol (MANDATORY for every AI assistant and contributor)

Before doing **any** work in this repository, read these documents **in this order**:

1. `docs/PROJECT_CONTEXT.md` — where development currently stands (living status document)
2. `docs/VISION.md` — why the project exists
3. `docs/PRINCIPLES.md` — the engineering philosophy
4. `docs/WORKFLOW.md` — the development lifecycle every change follows
5. `docs/PRODUCT_PLAN.md` — strategy, phases, roadmap
6. `docs/PRODUCT_PRD.md` — functional requirements and acceptance criteria
7. `docs/TECH_ARCHITECTURE.md` — implementation architecture
8. `docs/DECISIONS.md` — the append-only architectural decision log
9. `docs/GLOSSARY.md` — canonical terminology (use these exact terms)

(Also read `docs/UX_PRESENTATION.md` before touching anything user-facing.)

**After reading, and before implementing anything, you must:**

- Demonstrate understanding of the project.
- State the **current development phase**.
- State the **current milestone**.
- State **today's objective**.
- Identify **which document owns the requested change** (see ownership map below).
- Explain the plan.
- **Wait for approval before making changes.**

If the user simply types **"Continue."**, derive today's objective from `docs/PROJECT_CONTEXT.md` → *Next Recommended Task*, present the plan, and wait for approval.

---

## Repository structure

```
ExileLab/
├── README.md              ← you are here — permanent entry point for every session
├── docs/                  ← source of truth
│   ├── PROJECT_CONTEXT.md living status: phase, milestone, open tasks, last session (update every session)
│   ├── VISION.md          why the project exists (rarely changes)
│   ├── PRINCIPLES.md      engineering philosophy guiding all decisions
│   ├── WORKFLOW.md        official development lifecycle + session rules
│   ├── PRODUCT_PLAN.md    strategy, roadmap, phases, milestones
│   ├── PRODUCT_PRD.md     functional requirements & acceptance criteria
│   ├── UX_PRESENTATION.md how users experience the product (screens, flows, components)
│   ├── TECH_ARCHITECTURE.md implementation architecture (services, data flow, infra)
│   ├── DECISIONS.md       append-only architectural decision log (ADRs)
│   └── GLOSSARY.md        canonical terminology
├── rfcs/                  ← feature proposals (temporary; see rfcs/README.md)
├── research/              ← knowledge gathering (never source of truth; see research/README.md)
├── assets/                screenshots/ and diagrams/
├── frontend/              web app (Next.js) — not yet started
├── backend/               API & services (Node/Fastify) — not yet started
├── engine/                PoB2 calc-engine integration (LuaJIT sidecar) — not yet started
├── scripts/               dev/ops scripts
└── tools/                 internal tooling
```

## Document ownership map

Every change has exactly one owning document. Identify it **before** editing. If a change ripples across several documents, **update all affected documents together in the same pass** — documentation must never be internally inconsistent.

| Document | Owns | Never contains |
|---|---|---|
| `VISION.md` | Why the project exists; unchanging principles | Implementation details |
| `PRINCIPLES.md` | Engineering philosophy | Product features |
| `WORKFLOW.md` | The development lifecycle and session rules | Product or technical content |
| `PROJECT_CONTEXT.md` | Current status: phase, milestone, tasks, blockers | Requirements, strategy, architecture (link, don't duplicate) |
| `PRODUCT_PLAN.md` | Strategy, roadmap, phases, milestones, major direction | Code-level detail |
| `PRODUCT_PRD.md` | Functional requirements, acceptance criteria, monetization, compliance charter (§7.5) | Implementation architecture |
| `UX_PRESENTATION.md` | Screen flows, interaction, components, presentation hierarchy | Backend logic |
| `TECH_ARCHITECTURE.md` | Services, data flow, engine, frontend, backend, infrastructure | Product decisions |
| `DECISIONS.md` | Architectural history (ADRs) — append-only, never rewritten | Anything else |
| `GLOSSARY.md` | Canonical terminology | Definitions that contradict the docs above |
| `rfcs/` | Proposals (temporary; docs always win) | Source-of-truth content |
| `research/` | Knowledge gathering | Product behavior definitions |

## How change happens

The full lifecycle is defined in `docs/WORKFLOW.md`:

```
Idea → Discussion → Research → RFC → Review → Documentation
     → Prototype → Implementation → Testing → Git Commit → Update PROJECT_CONTEXT.md
```

New ideas **never** modify product documentation directly. If an RFC and a doc disagree, the doc wins. Every meaningful session ends by updating `docs/PROJECT_CONTEXT.md` and suggesting a git commit.

## Non-negotiables

- **Full legal & ToS compliance** — compliance charter in `docs/PRODUCT_PRD.md` §7.5. Official APIs only, no session-token workarounds, no player-action automation, attribution for aggregated builds.
- **Deterministic math** — the PoB2 engine computes; the LLM only narrates. The optimizer never assumes max DPS = better.
- **The engine is consumed unmodified** — pinned to the upstream PathOfBuilding-PoE2 fork; we never diverge it (ADR-001).
- **The repository is the source of truth** — long-term project knowledge lives here, not in assistant memory or chat history.
