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

**Foundation + product surfaces built and green** (230+ tests): the canonical build model
(RFC-0001), preference engine, context detector, goal-aware Doctor, comparator, Build Coach
(LLM narration, kill-switched), Fastify API, and the Next.js web app — Overview, Tune, Doctor,
Compare, and Upgrades. The calculation engine is a clearly-marked deterministic mock until the
Phase 0 S1 spike lands the real PoB2 sidecar; prices are synthetic and disclaimed until the
compliance-reviewed price layer ships. Current status always lives in `docs/PROJECT_CONTEXT.md`.

## Launch it locally

Prereqs: **Node 22+** and **pnpm 9+** (`npm i -g pnpm`).

```bash
pnpm install        # once, from the repo root
pnpm -r build       # build all workspace packages
```

**API key setup (once)** — enables the Build Coach (AI narration):

```bash
# copy the env template, then open backend/api/.env and paste your key
cp backend/api/.env.example backend/api/.env
```

Put your key (from https://openrouter.ai/keys) in `backend/api/.env`:

```
OPENROUTER_API_KEY=sk-or-v1-...
```

The file is gitignored and auto-loaded on server start. (Alternatively set it in
the shell — `$env:OPENROUTER_API_KEY="sk-or-..."` on PowerShell, `export …` on
bash — shell vars override the file.) No key = the coach is simply off;
everything else works.

**Terminal 1 — the API** (port 3001):

```bash
pnpm --filter @exilelab/api exec tsx src/server.ts
```

**Terminal 2 — the web app** (port 3000):

```bash
pnpm --filter @exilelab/web dev
```

Open **http://localhost:3000**, paste a build into the box — try the contents of
`research/fixtures/benchmark-builds/dot-caster.json` or the share code in
`research/fixtures/archetype-3-sources/b-pob-share-code.txt` — and explore the
Overview / Tune / Doctor / Compare / Upgrades tabs.

**What the env switches do**

| Variable | Absent (default) | Set |
|---|---|---|
| `OPENROUTER_API_KEY` | Build Coach off — no ✨ narration cards, everything else works | Coach narrates Doctor/Tune results (guardrailed: the LLM can never introduce a number not in the findings) |
| `COACH_MODEL` | `inclusionai/ling-2.6-flash` — cheapest model that reliably works (~$1 per 100k narrations, ~1.4s, guardrail-clean) | `qwen/qwen3-next-80b-a3b-instruct:free` ($0 but flaky upstream 429s) · `openai/gpt-4.1-nano` (grammar-enforced schema, fastest) · `anthropic/claude-haiku-4.5` (best prose) — any [OpenRouter model](https://openrouter.ai/models) |
| `PRICE_PROVIDER` | `mock` — deterministic synthetic prices, visibly disclaimed | any other value kills the price layer (Upgrades returns 503, Tune drops cost chips) |
| `DATABASE_URL` | in-memory storage | Postgres 17 persistence (`backend/api/docker-compose.db.yml`) |

Run the test suite anytime with `pnpm -r test`.

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
