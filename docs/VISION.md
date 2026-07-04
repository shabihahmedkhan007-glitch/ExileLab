# VISION

> This document is intentionally short and should almost never change. Every future feature must align with it.

## What problem are we solving?

Path of Exile 2 players follow build guides and copy top-ladder builds, but those builds are optimized for *someone else* — usually for maximum DPS on paper. Players have no way to know **why their version of a build feels bad**, or **how to adapt a build to what they personally value** (speed, comfort, tankiness, budget). Existing tools show numbers; none of them give a personalized verdict and a concrete next action.

## Who are we solving it for?

Path of Exile 2 players across the whole skill spectrum — from casual players who just want their character to stop dying, to theorycrafters who want precise, preference-weighted trade-off analysis. If you can paste a build link, you're the audience.

## Why does ExileLab exist?

To be the **intelligent optimization layer on top of the existing build ecosystem** — not another build repository. Players bring a build from anywhere (Maxroll, Mobalytics, poe.ninja, a Path of Building code, or their own character); ExileLab measures it with a real deterministic calculation engine, understands what the build is *trying* to do, and tells the player exactly how to make it better **for their goals**.

## How are we different from existing tools?

- **Preference-first, not DPS-first.** Every recommendation is scored against the player's own weighted priorities (damage, survivability, movement, speed, sustain, budget…). We never assume max DPS = better.
- **Context-aware.** We detect what a build's stats are *for* (e.g. attack speed as mobility) before judging anything — a coach, not a judge.
- **A layer, not a silo.** We import from and attribute back to the existing platforms instead of competing to host builds.
- **Real math, honest AI.** A production-proven calculation engine does all computation; AI only explains. The numbers are computed, never generated.

## Principles that never change

1. **Fully legal and ToS-compliant** — official APIs only, no gray-hat shortcuts, ever.
2. **The player's goals define "better"** — no universal meta judgment.
3. **Deterministic math wears the crown** — the LLM never produces a number.
4. **Never shame the build** — understand it first, then advise.
5. **Attribute and integrate** — we stand on the ecosystem with credit, not against it.
6. **Free tier gets true answers** — freemium gates depth and speed, never correctness.
