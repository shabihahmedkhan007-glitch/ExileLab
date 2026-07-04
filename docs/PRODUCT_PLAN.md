# Plan: ExileLab v2 — Personalized Build Optimization Layer (from scratch → public launch)

**Date:** 2026-07-03 (v2 — supersedes v1 same day) · **Companion docs:** `PRODUCT_PRD.md` (v1.0 — see "PRD deltas" below), `research/archive/Plan File Modification Request — Architecture Pivot.pdf` (founder directive, applied in full)
**Constraint inherited from PRD §7.5 (LOCKED, unchanged):** fully legal & ToS-compliant — official/public APIs only for server-side collection, never POESESSID, never automation of player actions. Extended in this version to cover third-party build platforms (see Compliance notes).

---

## What changed in v2 (the pivot, applied)

| v1 (standalone ecosystem) | v2 (optimization layer) |
|---|---|
| Four pillars incl. **Build Market** ("Netflix for builds"): hosting, creator marketplace, ranked browsing, ladder ingestion as a product pillar | **Build Market DELETED.** No hosting, no creator platform, no ranked browsing. We sit **on top of** Maxroll, Mobalytics, poe.ninja, PoB links — never compete with them |
| Optimizer assumes higher DPS = better | **Goal-based, preference-weighted optimizer** — the single most important feature. Users control priorities via sliders; the engine optimizes *their* objective, not max DPS |
| Static build analysis | **Context-aware analysis** (e.g. Twister Huntress: attack speed IS movement → movement-speed stat is low priority) + **comparative optimization** against multiple public versions of the same archetype |
| Internal build corpus (ladder + submissions) | **Aggregation Engine**: fetch/normalize external builds from community sources as optimization baselines |
| Positioning: "Netflix for builds" | Positioning: **"An intelligent build optimizer that adapts builds to YOUR playstyle"** |

**Kept from v1 (unchanged foundations):** PoB2 engine as headless Docker sidecar + conformance suite; multi-path import; Character Doctor (reframed goal-aware); freemium pricing ($5.99/mo · $49/yr · $9.99 League Pass); Raidbots-style compute metering; tech stack (Next.js/Fastify/BullMQ/Postgres/Redis/Hetzner); compliance charter; ExileCon checkpoint. Market/pricing data ingestion survives **demoted from product pillar to supporting service** — the upgrade finder and the Currency-Efficiency axis need prices; standalone currency dashboards move to post-launch backlog.

### PRD deltas (PRODUCT_PRD.md remains v1.0 until revised)
Superseded by this plan: PRD §4.3 (Build Market pillar — deleted), "Netflix for builds" positioning (§1), MKT-* features, Phase 4 of §11, parts of §4.1 that frame the optimizer as DPS-delta-maximization. A PRD v2 revision is a listed task in Phase 0. Everything legal/monetization/engine-feasibility in the PRD stands.

---

## Goals

1. Ship the **personalized build optimizer**: import a build from anywhere (Maxroll / Mobalytics / poe.ninja / PoB code / creator link) → the system analyzes it → optimizes it according to **user-defined priorities**, not a fixed DPS objective.
2. Ship the supporting intelligence: goal-aware Character Doctor, comparative analysis vs public builds of the same archetype, budget-aware upgrade finding with a currency-efficiency axis.
3. Public launch aligned to the PoE2 1.0 F2P window (late 2026; date at ExileCon Nov 7–8).
4. Every number engine-computed and reproducible in desktop PoB2; LLM narrates only.
5. Solo/small-team sustainable: pinned engine per game patch, infra <$400/mo at launch.

**Non-goals (v2):** build hosting/marketplace, creator submission platform, ranked build browsing, ladder ingestion as a product surface, desktop overlay, chat assistant, LLM-generated builds, PoE1.

---

## Approach — v2 architecture

### Unchanged core (see PRD §9 for detail)
Monorepo (pnpm+Turbo, TS) · engine = unmodified PoB2 fork as pinned git submodule, headless LuaJIT Docker sidecar, JSON-RPC shim, warm process pool, `(engineVersion, buildHash, mutationHash)` cache, **conformance suite vs desktop PoB2** · Next.js 15 web · Fastify API · BullMQ/Redis jobs · Postgres 17 · OpenRouter flash-class LLM (strict-schema, explanation-only, kill-switch).

### New/changed components

```
services/
├── calc-orchestrator/        (v1, unchanged)
├── build-aggregation/        NEW — fetch + normalize external builds
│     sources: Maxroll pob endpoint (maxroll.gg/poe2/api/pob — the same public
│     endpoint desktop PoB uses, see fork BuildSiteTools.lua:19-41), pobb.in,
│     poe.ninja pob/raw + builds data, .build files, pasted PoB codes
├── market-ingest/            (v1, demoted to supporting service: cxapi + poe2scout/ninja
│                              price tables feeding the upgrade finder only)
packages/
├── preference-engine/        NEW — the heart of v2 (spec below)
├── context-detector/         NEW — build archetype & mechanics classification
├── build-normalizer/         NEW — one canonical BuildSnapshot from any source
├── comparator/               NEW — multi-build diffing (tree/gear/gems/stats)
├── rulebook/                 (v1 Doctor rules, now goal-aware: thresholds vary by declared goal)
├── core / ggg-client / llm   (v1)
```

### The Preference Engine (most important component in the product)

**Objective:** replace "maximize DPS" with a **weighted multi-objective score** over engine outputs.

- **Axes (sliders), each mapping to engine-computed metrics:**
  | Axis | Engine metrics (all in `BuildDisplayStats`/output today) |
  |---|---|
  | Damage Output | FullDPS/CombinedDPS vs goal target (see below) |
  | Survivability | TotalEHP, MaximumHitTaken×5, block/evasion/suppression, resist margins |
  | Movement Speed | EffectiveMovementSpeedMod |
  | Attack Speed | Speed (attack rate) |
  | Cast Speed | Speed (cast rate) |
  | Skill Mobility Efficiency | composite: attack/cast rate of the *movement-carrying* skill + its resource cost per use (context-detector decides which skill carries movement) |
  | Resource Sustain | mana/spirit unreserved & regen vs cost, cost WarningList, cooldown coverage |
  | Currency Efficiency | Δscore per divine of the change (uses price layer) |
- **Score:** `score(build) = Σ wᵢ · normalizeᵢ(metricᵢ)` with per-axis normalization curves (diminishing returns — e.g. survivability saturates at content-tier thresholds; damage saturates at goal target). Weights `wᵢ` come from sliders (sum-constrained allocation UI).
- **Goal presets** (one click sets sliders + target curves; user can then adjust): Fast mapping · Boss farming · Party carry (damage target = 6-player scaling, NOT max) · Tanky · Budget farming · Smooth gameplay feel · Speed clearing · Hardcore survivability · Maximum DPS · Balanced.
- **Satisficing, not maximizing:** damage axis scores against a *target band* per goal ("enough to carry six players"), so the optimizer stops chasing overkill DPS and spends remaining budget/points on the user's other priorities. This is the philosophical core of the pivot.
- Every optimizer surface (node suggestions, item swaps, upgrade finder ranking) consumes **Δscore under the user's weights**, never raw ΔDPS.

### The Context Detector

Classifies the imported build so default weights are *suggested* intelligently before the user touches a slider:
- Skill-mechanics tags from game data (movement-skill?, channelled?, attack vs spell, repeated-use mobility like whirl/dash loops) → e.g. Twister Huntress: flags "movement via attack repetition" → suggests Attack Speed=High, MovementSpeed=Low.
- Defense archetype (ES/armour/evasion/block mix), resource pattern (mana/spirit pressure), damage delivery (hit/DoT/minion).
- Output: suggested preset + human-readable rationale ("this build moves by attacking — attack speed is your real movement stat"). User always sees and can override. Rules are data-driven and unit-tested per archetype fixture.

### The Comparative Optimization Engine

Instead of optimizing in a vacuum: import user's Twister Huntress → aggregation service fetches Maxroll's version, Mobalytics' version, poe.ninja top-player versions of the same archetype (matched by main skill + ascendancy) → normalizer → comparator diffs passive trees, gear slots, gem setups → each meaningful difference is engine-evaluated as a candidate change on the *user's* build → recommendations ranked by Δscore under the user's weights ("top players run X instead of your Y: +12% to *your* objective, costs ~2 div"). Statistically common choices across sources rank higher (community-validated).

### Compliance notes for the new aggregation surface (extends §7.5 charter)

- **User-initiated first:** pasting a Maxroll/Mobalytics/poe.ninja/pobb.in link imports via the same public endpoints desktop PoB itself uses (`BuildSiteTools.lua` lists them) — established, tolerated integration pattern.
- **Server-side baseline corpus** (for comparison archetypes): poe.ninja builds data (public), pobb.in public pastes, cached user-initiated imports. **No bulk scraping of Maxroll/Mobalytics guide pages** — their guide *content* is their IP; we only pull the PoB-interchange payloads their public endpoints serve, respect robots/ToS, cache politely, attribute the source by name+link in every recommendation ("as seen in Maxroll's guide →"). Attribution turns them into referral partners, not victims — we send them traffic.
- Partnership outreach to Maxroll/Mobalytics/poe.ninja in Phase 3 (we are now their complement, not their competitor — this pivot makes partnerships plausible).

---

## Tasks

### Phase 0 — Validation spikes (2–3 wks) — first, in order

1. [ ] **S1 — Engine benchmark (GO/NO-GO)** — unchanged from v1: Dockerized headless PoB2; time full calcs / 500 misc-calc overrides / node sweep on 3 real builds. **Gate: median full calc <500ms, misc <50ms** on Hetzner CCX vCPU, else optimizer becomes precomputed-candidate mode.
2. [ ] **S2 — zlib shim + share-code round-trip** — unchanged: byte-parity on 10 pobb.in codes.
3. [ ] **S3 — Import heuristics** — unchanged: 20 real characters → auto main-skill + config defaults → **gate ≥90% sane FullDPS**.
4. [ ] **S4 — GGG OAuth application** — unchanged, start day 1 (longest lead time); PoB-code import keeps Phase 1 unblocked.
5. [ ] **S5 — Preference-engine vertical slice (REPLACES v1's unique-price slice)** — hardcode 3 goal presets; score one build under different weight vectors; verify orderings flip sensibly (fast-mapper weights must rank a movement-speed boot swap above a pure-DPS ring swap; boss-carry weights the reverse). Deliverable: the scoring function design note (`docs/spikes/preference-engine.md`) — normalization curves per axis, satisficing target bands.
6. [ ] **S6 — Aggregation feasibility (NEW)** — fetch the same archetype from Maxroll pob endpoint, pobb.in, poe.ninja; normalize all to one BuildSnapshot; comparator produces a sane tree/gear/gem diff for two versions of one archetype. Confirms the multi-source pipeline before we architect around it.
7. [ ] **S7 — PRD v2 revision** — apply the pivot to PRODUCT_PRD.md (delete §4.3, reposition §1/§4.1, re-derive success metrics); founder sign-off.

**Exit:** S1/S2/S3 gates passed; S5 orderings validated by founder on real examples; S6 diff demo works; S4 submitted; PRD v2 approved.

### Phase 1 — Foundation (4–6 wks)

**Goal:** import a build from *any supported source* → PoB-parity stat sheet + suggested goal preset, deployed.

1. [ ] Repo bootstrap (monorepo layout above; CI: lint, test, engine conformance, docker build).
2. [ ] Engine service v1 (productionize S1/S2: JSON-RPC shim, process pool, BullMQ orchestrator, result cache, **conformance suite ≥20 fixture builds in CI**, patch-pin runbook rehearsed).
3. [ ] **Build normalizer + multi-source import** — PoB code paste, pobb.in link, Maxroll link, poe.ninja link, `.build` upload, GGG OAuth character import behind feature flag (flips on when S4 approval lands). Source attribution stored on every import.
4. [ ] **Context detector v1** — archetype classification + suggested preset with rationale; fixture-tested on ≥10 archetypes (must include an attack-as-movement build).
5. [ ] Accounts + API skeleton (platform auth, Postgres schema: users/builds/imports/reports/entitlements/preferences).
6. [ ] Web v1 — landing, import flow, stat sheet (shareable, OG-image), **preference slider UI + goal presets** (read-only preview of suggested weights; optimization itself is Phase 2), disclaimers, ToS/privacy.
7. [ ] Deploy (Hetzner+Coolify+Cloudflare, staging+prod, Sentry).

**Exit:** stranger pastes a Maxroll link → correct stat sheet + "this looks like a fast-mapping Twister build; suggested priorities: Attack Speed HIGH…" in <30s.

### Phase 2 — Personalized Optimizer + Doctor + payments (6–8 wks) → CLOSED BETA

**Goal:** the core promise — "optimized for YOUR priorities" — plus first revenue.

1. [ ] **Preference engine v1** (`packages/preference-engine/`) — S5 productionized: axes, normalization curves, satisficing targets per goal, weight persistence per user+build.
2. [ ] **Optimizer core, preference-driven** — wasted-stat report (findings weighted by user axes: overcapped res matters more under Survivability weight); passive-node suggestions ranked by Δscore (batched nodeCalc); item-swap analyzer (paste item → Δscore card decomposed per axis: "+3% your objective: +1.2% dmg, +4% sustain, −0.5% EHP").
3. [ ] **Goal-aware Character Doctor** — v1 rulebook (DOC-1…9) with thresholds parameterized by declared goal (hardcore-survivability tightens EHP floors; speed-clear relaxes them); free top-3 shareable card, premium full report + re-check diff.
4. [ ] LLM narration (unchanged scope: strict schema, cache, budgets, kill-switch) — now explains *trade-offs against the user's stated priorities*.
5. [ ] Billing — unchanged: Stripe $5.99/$49/League Pass $9.99, PPP, quotas (free ~3 optimizer runs/wk standard queue; premium unlimited priority).
6. [ ] Closed beta (50–200 league players), metrics wiring (import completion, preset-override rate, share rate, conversion).

**Exit (beta gates):** import→report >70% completion; ≥15% share rate; **preset-override telemetry shows users engage sliders (>30% adjust at least one)** — validates the pivot's core hypothesis; first paying subscribers.

### ⚑ ExileCon checkpoint (Nov 7–8, 2026) — unchanged decision table

1.0 date → lock launch date · PoE2 economy/stash API → upgrade-finder pricing leaps forward (river adapter) · first-party death recap → Doctor pivots further toward optimization · Build Planner subscribe-API opens publicly → integrate as an *export* target (send optimized build to your in-game planner — perfect fit for the layer positioning).

### Phase 3 — Comparative optimization + budget upgrade finder (6–8 wks)

**Goal:** the full "optimization layer over the ecosystem" experience.

1. [ ] **Aggregation Engine** — productionize S6: source fetchers (public interchange endpoints only), normalizer hardening, polite caching, per-source kill-switches, attribution pipeline; archetype index (main skill + ascendancy + patch) over the corpus (poe.ninja builds data + pobb.in publics + cached imports).
2. [ ] **Comparator + comparative recommendations** — tree/gear/gem/config diffing; each diff engine-evaluated on the user's build; ranked by Δscore under user weights; "community consensus" boost for changes common across sources; every card attributes and links its source build/guide.
3. [ ] **Price layer (supporting service)** — cxapi poller + poe2scout/ninja unique tables (ClickHouse); provenance tags, kill-switches, staleness alarms. No standalone dashboards at launch (backlog).
4. [ ] **Budget upgrade finder, preference-driven** — slot headroom → priced unique candidates (+ user-initiated rare spot-lookups per §7.5 rule 6, deep-link fallback built in) → heuristic pre-filter → engine calc top-K → **rank by Δscore per divine** (Currency-Efficiency axis modulates: budget-farming preset penalizes expensive marginal upgrades — "avoid over-optimization" per the pivot directive). Official trade-site deep links only.
5. [ ] Watchlist alerts on priced upgrade targets (Discord/WebPush/SSE, hourly-data honesty).
6. [ ] Partnership outreach: Maxroll, Mobalytics, poe.ninja (traffic-referral pitch with attribution data from Phase 3.2).

**Exit:** "import Maxroll Twister → compare vs 3 public versions → 5 ranked changes under MY sliders → 3 priced upgrades under 10 div" works end-to-end for ≥80% of beta archetypes.

### Phase 4 — Hardening + public launch (4–6 wks, was 6–8: Build Market deleted)

1. [ ] Load test (k6, 10× beta peak on calc queue + SSE); WASM client-calc lever if COGS demands.
2. [ ] Security pass (authz edges, webhook signatures, SSRF on fetchers), backup/restore drill, status page.
3. [ ] Launch checklist — name/domain/trademark (no "PoE"/"Path of"), §7.4 legal checklist (attorney review incl. the aggregation surface, LGPL base64 swap done, disclaimers), pricing page, launch content led by the free Doctor card + "optimize for YOUR playstyle" demo clips; creator collabs (their guides + our optimizer = their build adapted to each viewer).
4. [ ] **PUBLIC LAUNCH** in the 1.0 window.

**Exit = launch targets (v2-adjusted):** 50K registered first full league; ≥2% conversion; suggestion→trade-link CTR >25%; **>30% of optimizer runs use non-default weights** (the pivot's north-star adoption metric); COGS <20% of MRR.

---

## Testing

| Layer | What | When |
|---|---|---|
| Engine conformance | ≥20 fixture builds, every stat vs desktop PoB2, every engine-pin bump | CI, Phase 1→ |
| **Preference engine** | golden orderings: fixture build × weight vector → expected recommendation ranking; normalization-curve unit tests; satisficing band tests (boss-carry must NOT chase overkill DPS) | CI, Phase 2 |
| **Context detector** | archetype fixtures (incl. attack-as-movement, dash-loop, ES-tank) → expected tags + suggested preset | CI, Phase 1 |
| **Normalizer/comparator** | same archetype from 3 sources → identical canonical form; diff golden files | CI, Phase 3 |
| Rulebook | goal-parameterized golden files (same build, different goals → different findings/severities) | CI, Phase 2 |
| Unit | ggg-client rate limiter, import heuristics corpus, price math, entitlements | CI, all |
| Integration | import(source×5)→calc→report vs live engine container | CI, Phase 1 |
| E2E (Playwright) | import→sliders→optimize→subscribe→premium | nightly, Phase 2 |
| LLM contract | schema validity; trade-off narration snapshots; kill-switch degradation | Phase 2 |
| Load | k6 at 10× beta | Phase 4 |
| Compliance audit | no undocumented-endpoint calls outside the user-initiated module; no session cookies; per-source kill-switches; aggregation fetchers hit interchange endpoints only + attribution present | every phase exit |
| Manual | founder runs full journey on prod each phase exit; **S5-style sanity panel each release: 3 presets × 1 build → do the top recommendations make sense to a player?** | phase gates |

## Risks

| Risk | Mitigation |
|---|---|
| **Objective-function quality** (bad weights/curves → confident bad advice — now the #1 product risk, replacing v1's Build Market cold-start) | S5 spike validates orderings before build-out; per-axis score decomposition shown to user (auditability); golden-ordering tests; beta feedback loop on "was this recommendation good?"; presets tuned per archetype with context detector |
| Context detector misreads a build → wrong suggested priorities | Suggestions always visible + overridable; rationale shown; override telemetry flags weak archetypes; fixture per known mechanic |
| Third-party source dependence (Maxroll/Mobalytics/poe.ninja formats or goodwill change) | Interchange-endpoint-only + attribution + partnership outreach; per-source kill-switch; PoB-code paste always works as universal fallback |
| Aggregation seen as leeching by platforms | We link out prominently (we *send* traffic), never republish guide content, only build payloads; outreach in Phase 3 before scaling the corpus |
| S1 benchmark fails | Unchanged: first task, precomputed-candidate fallback, WASM lever |
| GGG OAuth slow/denied | Unchanged: PoB-code first-class, OAuth feature-flagged |
| GGG patch churn | Unchanged: pinned submodule + rehearsed runbook + conformance suite |
| Preference UI overwhelms casuals | Presets-first UX (one click), sliders behind "customize"; free tier works without ever touching a slider |
| ExileCon invalidates assumptions | Unchanged scheduled checkpoint with decision table |

## Immediate next actions (this week)

1. [ ] Founder approves PLAN v2.
2. [ ] S4 — draft GGG OAuth application (unchanged, longest lead).
3. [ ] S1 — engine benchmark spike (unchanged go/no-go).
4. [ ] S5 — preference-engine design note + scoring prototype (the pivot's core, start immediately after S1 container exists).
5. [ ] S7 — PRD v2 revision reflecting this pivot.
6. [ ] Collect fixture set: 3 benchmark builds + 20-character import corpus + **1 archetype in 3 source versions** (for S6), incl. a Twister Huntress for the attack-as-movement case.
