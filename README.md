# ExileLab

An intelligent build optimizer for **Path of Exile 2** that adapts builds to **your** playstyle — a
personalized optimization layer on top of the existing build ecosystem (Maxroll, Mobalytics,
poe.ninja, Path of Building codes), powered by the Path of Building 2 calculation engine running
headless server-side.

## What it does

Paste a build from anywhere — a Maxroll or Mobalytics link, a poe.ninja build, a Path of Building
code, or your own character — and ExileLab:

1. **Measures it** with the real, community-trusted PoB2 calculation engine (never LLM guesses).
2. **Understands what it's for** — detecting the build's archetype and intent before judging it
   (a speed-mapper's attack speed *is* its movement; we don't call it "wasted").
3. **Optimizes it for your goals** — you set priorities with sliders or a one-click preset (fast
   mapping, boss farming, hardcore survivability, budget farming…), and every recommendation is
   ranked against *your* weighted objective, not a fixed max-DPS one.

Why it's different: **preference-first, not DPS-first** · **context-aware, a coach not a judge** ·
**a layer, not another build silo** — we import from and attribute back to the ecosystem ·
**real math, honest AI** — the engine computes every number; the AI only explains it.

## Status

**Pre-implementation, by design.** The product is fully specified in `docs/` and is entering Phase 0
(validation spikes) — no application code exists yet. Current status always lives in
`docs/PROJECT_CONTEXT.md`.

## Working in this repository

**This repository — not any AI assistant's memory — is the single source of truth.**

- **`CLAUDE.md`** — the operating rulebook. Every contributor and AI assistant starts here: the
  session protocol, document ownership, the change lifecycle, and the build workflow.
- **`ARCHITECTURE.md`** — a one-page system overview to get oriented fast.
- **`docs/`** — the authoritative product knowledge (vision, principles, plan, PRD, UX, tech
  architecture, decisions, glossary). See the document index in `CLAUDE.md`.

---

*This product isn't affiliated with or endorsed by Grinding Gear Games in any way. "Path of Exile"
and "Path of Building" are the property of their respective owners; ExileLab is a working title.*
