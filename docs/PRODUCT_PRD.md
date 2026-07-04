# PRD — "ExileLab" (working title): The PoE2 Personalized Build-Optimization Layer

**Version:** 2.0 · **Date:** 2026-07-04 · **Status:** Revised per ADR-003 pivot — awaiting founder sign-off
**Authors:** Product research synthesized from a 10-agent research workflow (GGG API/ToS, competitors, community sentiment, monetization, calc-engine feasibility, tech stack, local PoB2 repo audit, price-data sourcing, GGG IP policy, PoE2 1.0 roadmap). Sources cited in Appendix A.

### Revision history

| Version | Date | Change |
|---|---|---|
| 1.0 | 2026-07-03 | Original four-pillar "PoB, but smarter" PRD (AI Build Optimizer, Character Doctor, Build Market, Market Intelligence). |
| 2.0 | 2026-07-04 | **Applies the ADR-003 architecture pivot** (Accepted 2026-07-03; authoritative pivot text in `PRODUCT_PLAN.md` v2, "What changed in v2" + "PRD deltas"). ExileLab is re-scoped from a standalone four-pillar ecosystem to a **personalized build-optimization layer on top of existing platforms**. Changes: (1) §1 repositioned from "PoB, but smarter" to "an intelligent build optimizer that adapts builds to YOUR playstyle"; (2) the **Build Market** pillar is DELETED (§4.3 is now a tombstone) — we never compete with build repositories, and market/ladder aggregation survives only as supporting infrastructure (the Aggregation Engine, see `PRODUCT_PLAN.md`); (3) §4.1 Optimizer reframed from DPS-delta maximization to **preference-weighted Δscore** (Weighted Score, Preference Axes, Goal Presets, satisficing — see GLOSSARY); (4) §11 roadmap and §12 success metrics re-derived to the v2 phase shape, adding the north-star metric ">30% of optimizer runs use non-default weights"; (5) stale Build-Market / "Netflix for builds" / MKT-* references across §2/§3/§5/§6/§13 updated or annotated. **§7 legal and the §7.5 Compliance Charter are LOCKED and untouched** — not one word of the charter rules changed in this revision. |

> **Working title note:** the product name must NOT contain "Path of Exile", "PoE", or "Path of Building" (GGG trademark / community-project branding). "ExileLab" is a placeholder; "exile" is common in tolerated community tool names (exiledtools.com, exile.exchange). Final name TBD.

> **Workspace layout:** this directory (`standalone engine beta/`) is the standalone product — it will hold the new app's code, docs, and planning. The sibling `PathOfBuilding-PoE2/` repo is the upstream calc engine we build on (consumed unmodified as a headless service, §9.1) and our reference for import/trade/calc code paths. The app shares **zero UI** with PoB — an entirely new web UI per §9.2; PoB is engine + prior art only.

---

## 1. Executive summary

**One-liner:** *An intelligent build optimizer that adapts builds to YOUR playstyle.* A freemium web **optimization layer** that sits on top of existing platforms (Maxroll, Mobalytics, poe.ninja, PoB links) — import a Path of Exile 2 build from anywhere, and the system, with PoB-grade deterministic math (never LLM guesses), optimizes it against **your** declared priorities rather than a fixed max-DPS objective, tells you what's holding your goals back, and finds the best upgrades for your budget. We never compete with the build repositories; we make the builds they already host better for each individual player.

Product pillars on one shared engine (the Build Market pillar was deleted in v2 — see §4.3):

| # | Pillar | What it does | Legal/platform risk | Differentiation today |
|---|--------|--------------|--------------------|----------------------|
| 1 | **Personalized Build Optimizer** | Preference-weighted optimization: user sets priorities via Goal Presets + Preference Axes sliders, and every recommendation (wasted-stat findings, passive-node swaps, item swaps, budget upgrade finder) is ranked by **Δ Weighted Score under the user's weights**, with satisficing so the engine stops chasing overkill DPS | **Low** (official character API + our own math) | Does not exist for PoE2 in any form; incumbents optimize for max DPS, never *your* objective |
| 4 | **Character Doctor** (goal-aware) | Diagnoses why a build fails *relative to the player's declared goal*: chaos res too low, no stun immunity, defenses too thin for tier-X maps, and why you keep dying | **Low** | Does not exist; GGG ships no death recap and says it wants to "reduce how much obscure game knowledge creates power gaps" |
| 2 | **Market Intelligence** (redesigned from "Trade Sniper", demoted to a supporting price layer) | Currency-flip dashboard, price history, user-initiated upgrade pricing feeding the Currency-Efficiency axis of the optimizer, alerting | **HIGH as originally scoped — must be redesigned** (see §7) | Existing snipers are dumb notification pipes; nobody computes fair value — but the data & ToS constraints are severe |

**Core architecture decision (locked):** the deterministic PoB2 calculation engine (this repo, MIT-licensed) runs headless server-side and produces every number; an LLM (via OpenRouter, cheap flash-class models) only *narrates* the engine's structured output into human advice. This is exactly the credibility gap current AI tools fail on — the community demonstrably distrusts LLM game math ("the more specific you get, the more likely ChatGPT is giving you false information") while trusting PoB numbers absolutely.

**Business model (locked):** freemium. Free tier = the viral growth engine (import from any source + stat sheet + suggested Goal Preset + top-3 diagnoses). Premium ≈ **$5.99/mo / $49/yr / $9.99 League Pass (2 months, one-time)** = unlimited priority-queue optimizer runs, full Doctor reports, budget upgrade finder, comparative optimization, market alerts. Realistic steady state: 3K–12K subscribers → **$160K–$650K ARR** — a strong small-team business, seasonal around league launches.

**Timing:** PoE2 1.0 goes **free-to-play in late 2026** (announced at ExileCon, Nov 7–8, 2026). A massive new-player wave — the exact audience for Doctor/Optimizer — arrives right as we could launch. Patch 0.5 (May 2026) was the final EA content update; **ExileCon is a hard re-planning checkpoint** for this PRD.

**The single biggest risk in one sentence:** the entire platform depends on discretionary GGG goodwill — OAuth client approval, tolerated use of game art/data, and (for market features) an undocumented trade API GGG can shut off at any time; the original "trade sniper bot" concept as pitched would likely get our API access revoked and must be reshaped as described in §7.

---

## 2. Problem & opportunity

### 2.1 The player problem (evidence-backed)

1. **Players die and learn nothing.** PoE2 has XP loss + portal-limited deaths and *no death recap or combat log* — the single most persistent complaint thread from Dec 2024 through Mar 2026 on official forums ("you die once and learn nothing about how or why", "killed... at full health, no visible AoE, no clear telegraph", "stuck at level 70-72 and Tier 1-3 maps for what seems like an eternity"). GGG refuses to remove death penalties and has shipped no recap.
2. **Build knowledge is a power gap.** GGG's own stated long-term goal: "reduce how much obscure game knowledge creates power gaps between new and experienced players." Chaos resistance is the canonical hidden killer (gear-only in PoE2, no passives). This is first-party validation of the Character Doctor.
3. **PoB2 is powerful but passive and hard.** The community fork is desktop-only Lua, has a steep learning curve, still carries open accuracy bugs (July 2026), and *never recommends anything* — it shows numbers and leaves interpretation to the player.
4. **Guides rot every league.** ~4-month league cadence; e.g. Wyvern Druid took a ~35% composite nerf 0.4→0.5, invalidating every 0.4 guide. Players discover builds via Maxroll/Mobalytics/poe.ninja/YouTube with no way to know if a guide still works or fits their budget.
5. **Pricing rares is folklore.** No tool publishes market-average valuations for PoE2 rares; price-checking is per-item overlay lookups that guides themselves call unreliable for multi-mod rares.

### 2.2 Market size & timing

- Steam all-time peak **578,569 CCU** (Dec 2024 EA launch); 0.5 league (May 2026) crossed ~600K CCU in 24h with 400K+ returning during a free weekend; ~2.4M monthly Steam players (June 2026); all-platform actives plausibly 3–5M+.
- Deep seasonality: −65.7% CCU over 30 days post-league (July 2026 trough ~79K online). Revenue design must assume league-cyclical engagement (annual plans + League Pass SKU).
- **1.0 = free-to-play, late 2026, post-ExileCon** — the largest ARPG onboarding event since Diablo 4. New players need exactly pillars 1 & 4.
- Engaged tool-using audience estimate: 500K–1M in-league; funnel to 150–300K registered users at 2–4% paid conversion → 3K–12K subs.

### 2.3 Why now / why us

- **Whitespace is real:** no tool for PoE2 combines character import + deterministic calcs + automated recommendations. AI tools exist (PoAI, poe2skills-ai, Questie AI, hobbyist MCP servers) but are LLM-first, hallucinate math, and have negligible traction. poeprices.info-style ML pricing doesn't exist for PoE2.
- **We start from the engine.** This repo is the deterministic gold standard for PoE2 math, MIT-licensed, with a production-proven headless mode (`src/HeadlessWrapper.lua` — the entire 29-spec busted suite runs the full app headless) and the exact what-if primitives the product needs already implemented (`calcs.getMiscCalculator`, `calcs.getNodeCalculator`).
- **Adjacent-game precedent:** Raidbots proved players pay monthly for *deterministic server-side optimization compute* (queue priority, bigger sims). Mobalytics proved $7.99/mo for personalized analytics (7M+ MAU, acquired by ESL FACEIT 2025). WoWAnalyzer proved demand for automated "why is my character failing."

---

## 3. Users & personas

| Persona | Description | Pillar pull | Pays? |
|---|---|---|---|
| **The Stuck Mapper** (primary) | Lvl 70–85, dies in T5–T12 maps, doesn't know why; found their build on YouTube; has never opened PoB | Doctor → Optimizer | League Pass / monthly during league |
| **The Min-Maxer** | PoB power user; wants "best upgrade per divine" answered rigorously instead of manually trying 40 items | Optimizer, Market Intelligence | Annual — highest LTV |
| **The League Starter** | Returns every league, imports a guide build from Maxroll/Mobalytics, wants it adapted to their budget & playstyle and to know it still works post-patch | Optimizer (comparative + goal presets) | League Pass |
| **The Currency Gamer** | Plays the market as the game; flips currency, hunts underpriced uniques | Market Intelligence | Would pay the most — but this persona is the ToS-riskiest to serve (§7) |
| **The New 1.0 Player** (late 2026 wave) | F2P launch arrival; overwhelmed; needs "what's wrong / what next" in plain language | Doctor (free tier) | Conversion funnel seed |

---

## 4. Product pillars — detailed specs

> All pillars ship as one platform with a shared account, shared multi-source build import, and one engine service. "Parallel" development is sequenced *inside* one roadmap (§11) because the Optimizer (pillar 1) and Character Doctor (pillar 4) share ~80% of their plumbing; the Aggregation Engine that powers comparative optimization is core infrastructure (see `PRODUCT_PLAN.md`), and pillar 2's price-data layer is a separate supporting service. (The former Build Market pillar was deleted in v2 — §4.3.)

### 4.1 Pillar 1 — Personalized Build Optimizer

**Job to be done:** "Look at my build and tell me the highest-impact changes *for what I'm trying to do*, with numbers." Not "maximize DPS" — optimize **my** objective.

**The pivot in one paragraph (v2):** the optimizer no longer maximizes a single fixed metric. The **Preference Engine** (the most important component in the product; see GLOSSARY and `PRODUCT_PLAN.md`) computes a **Weighted Score** = `Σ wᵢ · normalizeᵢ(metricᵢ)` over engine outputs across eight **Preference Axes** (Damage, Survivability, Movement Speed, Attack Speed, Cast Speed, Skill Mobility Efficiency, Resource Sustain, Currency Efficiency). Weights come from sliders; **Goal Presets** (Fast Mapping, Boss Farming, Hardcore Survivability, Budget Farming, …) one-click-set them. **Satisficing** matters: the Damage axis scores against a per-goal *target band* (e.g. "enough to carry six players"), so past the target the optimizer stops chasing overkill DPS and spends remaining points/budget on the user's other priorities. Every optimizer surface below ranks candidates by **Δ Weighted Score under the user's weights**, never by raw ΔDPS. The **Context Detector** classifies the imported build's Archetype and *suggests* default weights before the user touches a slider (e.g. an attack-as-movement Twister build → Attack Speed HIGH, Movement Speed LOW), always visible and overridable.

**Input paths (all already proven in this repo):**
- OAuth character import — `GET api.pathofexile.com/character/poe2/{name}` (equipment, inventory, passives) via our own registered OAuth client (`src/Classes/PoEAPI.lua` shows the flow; we must NOT reuse `client_id=pob`).
- PoB share code paste — URL-safe base64 of zlib-deflated build XML (`ImportTab.lua:133/:260`); interoperable with pobb.in, Maxroll, poe.ninja, pob.cool.
- `.build` JSON file (GGG's official Build Planner format, documented at pathofexile.com/developer/docs/game).

**Features (F = free, P = premium):**

| ID | Feature | Tier | Spec |
|---|---|---|---|
| OPT-0 | **Preference Engine + Goal Presets + Context Detector** | F (presets + suggested weights) / P (full slider control + persistence) | The heart of v2. Deterministic Weighted Score over eight Preference Axes; one-click Goal Presets; per-axis normalization curves with satisficing target bands; Context Detector suggests weights from the detected Archetype with a human-readable rationale. Never calls the LLM. Every finding below is scored through it. |
| OPT-1 | **Wasted-stat report** | F (top 3) / P (full) | Engine outputs `FireResistOverCap` etc. natively (`BuildDisplayStats.lua`). Report: overcapped resists (with exact wasted %), stats on gear contributing zero to the build, dead/inefficient passive nodes (one-step node deltas via `calcs.getNodeCalculator`), unused gem links, spirit/mana waste. Findings are **weighted by the user's axes** (e.g. overcapped resist matters more under a Survivability-heavy preset). Each finding = {severity, Δ Weighted Score, per-axis decomposition, affected slot/node, suggested action}. |
| OPT-2 | **Dead-node detector & tree suggestions** | P | Local search over unallocated/allocated nodes using the accelerated node calculator (same machinery as PoB's heat map, which evaluates thousands of node deltas in seconds). Suggest reallocation sets ranked by **Δ Weighted Score under the user's weights** (not net DPS). Precedents: poesto, poe-graph-optimization, PoESkillTree GA. |
| OPT-3 | **Item swap analyzer** | P | User pastes/selects candidate item(s) → `calcs.getMiscCalculator` computes the resulting metrics → Preference Engine returns a **Δ Weighted Score card decomposed per axis** ("Ring B = +3% your objective: +1.2% damage, +4% sustain, −0.5% EHP"). Batch mode: compare all inventory/stash candidates for a slot. |
| OPT-4 | **Budget upgrade finder** ("best upgrades for 10 div") | P (flagship) | Pipeline: (a) enumerate slots by upgrade headroom; (b) fetch priced candidates — uniques from poe.ninja/poe2scout price tables, rares via **user-initiated, rate-limited trade2 spot queries** (Exiled Exchange 2 pattern — see §7 data constraints); (c) heuristic pre-filter (mod-weight scoring) to top-N per slot; (d) full engine calc per candidate; (e) rank by **Δ Weighted Score per divine** (the Currency-Efficiency axis modulates: a budget-farming preset penalizes expensive marginal upgrades — "avoid over-optimization"); (f) output ranked list with deep links to the official trade site (user clicks through and buys — we never automate trade actions). **At launch, rare-item coverage is best-effort; unique-first suggestions are the reliable core** (no PoE2 rare price index exists anywhere — see §8). |
| OPT-5 | **Comparative optimization** | P | Import user's build → the Aggregation Engine fetches public versions of the same Archetype (Maxroll / Mobalytics / poe.ninja) via public interchange endpoints only → the Comparator diffs tree/gear/gems → each meaningful divergence is engine-evaluated as a candidate change on the *user's* build and ranked by **Δ Weighted Score under the user's weights**, with a community-consensus boost and source attribution ("top players run X instead of your Y: +12% to *your* objective, ~2 div — as seen in Maxroll's guide →"). Compliance: public build payloads only, never guide content — see §7.5 and `PRODUCT_PLAN.md` Compliance notes. |
| OPT-6 | **Plain-language explanations** | P | LLM (the Build Coach) renders the engine's structured findings JSON into prose, now explaining *trade-offs against the user's stated priorities* ("Your cold res is 12% overcapped — under your Boss-Farming preset that suffix is doing nothing; here's what to look for instead"). Strict-schema structured output; cached by hash(build+findings); never generates numbers. |
| OPT-7 | **Optimizer run quota & queue** | F: ~3 runs/week, standard queue. P: unlimited, priority queue | The Raidbots model — server compute is the honest paywall justification. An Optimization Run is the metered freemium compute unit. |

**Acceptance criteria (v1):** import from any supported source → suggested Goal Preset + full report < 30s standard queue; **every recommendation ranked by Δ Weighted Score under the user's weights, never raw ΔDPS**; changing the preset/sliders visibly re-orders the recommendations (fast-mapping weights rank a movement-speed swap above a pure-DPS swap; boss-carry reverses it); satisficing verified (a boss-carry preset does NOT chase overkill DPS past its target band); every numeric claim reproducible in desktop PoB2 within engine parity tolerance; upgrade finder returns ≥3 priced suggestions for ≥80% of imported builds at 5/10/50 div budgets (unique-first acceptable).

### 4.2 Pillar 4 — Character Doctor (goal-aware)

**Job to be done:** "Tell me why my build sucks / why I keep dying — *relative to what I'm trying to do* — in words I understand."

**v2 note:** the rulebook is now **goal-aware** — thresholds are parameterized by the declared Goal Preset (hardcore-survivability tightens EHP floors; speed-clear relaxes them), so the same build is graded differently under different goals. Percentiles and "tier expectation" bands read from the Aggregation Engine's Canonical Builds of the *same Archetype*, never the global population.

**Design note:** the character API is a read-only snapshot; flask uptime and in-combat behavior are NOT exposed by any API. v1 diagnoses what the engine can prove from the snapshot; behavior-based diagnostics (flask uptime, actual death causes via client log parsing) are a later desktop-companion feature (log reading is explicitly tolerated by GGG, but it's not web).

**The diagnostic rulebook (deterministic, versioned, testable):** each rule = {check on engine output, content-tier thresholds, severity, fix templates}. Launch set:

| ID | Diagnosis | Engine basis |
|---|---|---|
| DOC-1 | Elemental resists under/overcapped | `*Resist`, `*ResistOverCap` |
| DOC-2 | **Chaos res too low** (the classic killer) | `ChaosResist` vs tier table |
| DOC-3 | EHP / max-hit too low for target tier | `TotalEHP`, `{Phys,Fire,Cold,Light,Chaos}MaximumHitTaken` (`CalcDefence.lua:3341/:3781`) vs per-tier expected hit sizes |
| DOC-4 | Missing stun/freeze/ailment protection | ailment avoidance/immunity outputs |
| DOC-5 | Defense layering incoherent (e.g. armour build with zero phys mitigation depth, ES with no recharge protection) | armour/evasion/ES, block, suppression outputs |
| DOC-6 | Sustain broken | `NetLifeRegen`, `TotalBuildDegen`, leech outputs |
| DOC-7 | DPS below tier expectation for the declared goal | `FullDPS` vs goal target band (percentile vs the Aggregation Engine's Canonical Builds of the same Archetype) |
| DOC-8 | Cost warnings / unusable skills | `LifeCost/ManaCost` + `WarningList` (`Calcs.lua:412-448`) |
| DOC-9 | Content-readiness verdict | Composite: "This build is ready for T13; your realistic wall is T8 — because X, Y." |

**Free tier shows top-3 diagnoses** (the viral screenshot: "Your chaos res is −34%. This is why you die."). **Premium = full checklist + itemized fixes + LLM narration + re-check after changes.**

**Engineering prerequisite (both pillars):** `loadBuildFromJSON` leaves main-skill unselected and config unset ("Good luck!" — `HeadlessWrapper.lua:218-226`). We must build **import heuristics**: auto-pick main skill (highest-DPS socketed active skill), sane config defaults per content tier, boss-config presets. This is the single biggest product-quality determinant for import-and-diagnose UX and needs its own spec + test corpus of real characters.

### 4.3 Pillar 3 — Build Market — DELETED in v2 (tombstone)

> **Deleted per ADR-003** (Accepted 2026-07-03). ExileLab is an optimization *layer* — **we never compete with build repositories** (Maxroll, Mobalytics, poe.ninja, pobb.in, GGG's Build Planner). There is no build hosting, no creator marketplace, and no ranked/computed-scorecard browsing surface. The pillar's original "Netflix for builds" positioning is retired.
>
> **What survives, and where:** the underlying build/ladder *aggregation* capability lives on as pure infrastructure — the **Aggregation Engine** (collects public builds via public interchange endpoints only, never guide content, with source attribution; maintains Canonical Builds and Archetype statistics) — and powers **Comparative Optimization** (OPT-5) and the Doctor's Archetype percentiles (DOC-7), not a marketplace. See `PRODUCT_PLAN.md` (v2) "The Comparative Optimization Engine" + "Aggregation Engine", GLOSSARY (Aggregation Engine, Canonical Build, Comparative Optimization), and the compliance rules in §7.5.
>
> This section number is retained (empty) so downstream cross-references stay traceable; the former MKT-1…MKT-6 feature IDs are withdrawn.

### 4.4 Pillar 2 — Market Intelligence (REDESIGNED from "Trade Market Sniper")

**⚠️ Founder decision required — the original concept cannot ship as pitched.** Research verdict (three independent agents converged):

- There is **no PoE2 public stash API** ("river") — the PoE1 firehose that powers poe.ninja's economy is PoE1-only. Nothing suggests a PoE2 version before/at 1.0.
- The trade2 site API is **undocumented**; GGG's ToU prohibits scraping (s7(f)), bots (s7(c)), and reverse-engineering endpoints (s7(i)); the dev docs say undocumented-API access requests "will be denied."
- Live search requires a logged-in session (POESESSID) — GGG's official position: sharing POESESSID with tools is "specifically against our terms of use." The official site caps live searches at 20/account *specifically to prevent sniping load*.
- Enforcement precedent exists: PoE Overlay 2020 account-lock waves ("hitting their API a few million times a day"); RMT/trade-bot ban waves during PoE2 EA; the 2026 Jenebu ban. GGG deliberately ships trade friction (instant-buyout Merchant's Tabs shrink sniping windows).
- A server-side sniping service would risk **OAuth revocation for the whole platform** — killing pillars 1 & 4 (and the aggregation infrastructure) to serve pillar 2.

**What ships instead (compliant core, gray edges clearly flagged):**

| ID | Feature | Data source | Risk |
|---|---|---|---|
| MI-1 | **Currency dashboard**: prices, trends, spread/volume history per pair | Official `service:cxapi` (hourly historical, sanctioned) + poe2scout API + poe.ninja API | ✅ Clean |
| MI-2 | **Flip/arbitrage analytics**: historical spread patterns, "what flips paid off this week", profit calculator with gold-tax modeling | Same as MI-1 | ✅ Clean (education/calculator angle is mainstream — Mobalytics publishes flipping guides) |
| MI-3 | **Unique price index + deal flags**: listing vs 7-day average ("this unique lists 3 div, average is 9") | poe.ninja/poe2scout unique tables (their upstream is gray but consuming their public APIs is ecosystem-normal; exiledtools monetizes on poe.ninja data today) | 🟡 Second-hand gray; no SLA — could break without notice |
| MI-4 | **Price-a-item / upgrade pricing**: user-initiated trade2 comparable-listing lookups at recommendation time (the tolerated Exiled Exchange 2 / Sidekick pattern), honest User-Agent, header-driven rate limiting (`TradeQueryRateLimiter` already in this repo) | trade2, user-initiated only | 🟡 Tolerated gray — never bulk, never background |
| MI-5 | **Alerts**: watchlist price-threshold alerts on MI-1/MI-3 data (Discord webhook, web push, in-app SSE); latency = data-source latency (hourly), sold honestly as market monitoring, NOT "instant sniping" | derived | ✅/🟡 |
| MI-6 | ~~Server-side live-search sniping, instant undervalued-listing alerts, auto-whisper~~ | — | ❌ **CUT.** Revisit only with explicit written GGG permission, or if a PoE2 stash API ships (design a feature-flagged adapter so we can move in weeks if it does — exiledtools is explicitly in the same wait mode) |

**Honest product consequence:** "instant alerts on underpriced listings" — the sexiest pitch line — is not shippable compliantly today. The pillar still has real value (currency analytics is poe2scout+exiledtools territory, done better and integrated with builds: "your next upgrade got 20% cheaper this week"). Position it as the *market layer of the build platform*, not a standalone sniper.

---

## 5. Monetization (freemium — founder-confirmed)

### 5.1 Tiers

| | **Free** (growth engine) | **Premium — $5.99/mo · $49/yr (~$4.08/mo) · $9.99 League Pass (2 months, one-time, no auto-renew)** |
|---|---|---|
| Character import & stat sheet | ✅ | ✅ |
| Character Doctor | Top-3 diagnoses | Full report + fixes + LLM narration + re-checks |
| Optimizer (preference-weighted) | ~3 runs/week, standard queue; presets + suggested weights | Unlimited, priority queue; full slider control + weight persistence |
| Budget upgrade finder | — | ✅ |
| Comparative optimization (vs public builds of your Archetype) | — | ✅ |
| Market Intelligence | Delayed snapshots | Full dashboards, watchlists, alerts |
| Saved characters | 1 | Unlimited |
| Ads (if run) | Light | Removed |

Later (post-PMF): **$11.99/mo "Trader" tier** — more watchlists, lower-latency data *within whatever limits are compliant*, API access. Only if MI pillar earns it.

### 5.2 Pricing rationale & benchmarks

- Category band $2.49–$9.99/mo: Mobalytics Plus $7.99, Blitz $4.99, u.gg $3.99/$2.49, Raidbots ~$3/$5/$10 tiers. $5.99 sits mid-band; the *compute-metered* paywall (queue priority, run quotas) copies Raidbots — the proven model for exactly our cost structure.
- **League Pass** copies PoE Overlay's league-cadence SKU — matches the community's play pattern and the "pay for convenience" norm they demonstrably accept (even GGG's paid Merchant's Tabs settled to "pay for convenience" consensus).
- **Regional/PPP pricing from day one** (Stripe + ParityDeals): large ARPG populations in BR/EE/TR/SEA; PoE Overlay already does regional pricing in this exact market.
- Donations don't work here (Awakened PoE Trade: near-universal adoption, ~$230/mo Patreon). Freemium is the only model that pays for engine ops.

### 5.3 Revenue model (stress-tested)

| Scenario | Registered users | Conversion | Subs | Blended ARPU | ARR |
|---|---|---|---|---|---|
| Bear (1% conv) | 150K | 1% | 1.5K | $4.50 | ~$81K |
| Base | 200K | 2–3% | 4–6K | $4.50 | ~$215–325K |
| Bull (1.0 wave lands) | 300K | 4% | 12K | $4.50 | ~$650K |

COGS: engine compute + market polling (both metered by the queue design); LLM ≈ negligible if explanation-only with caching (~$50–150/mo at launch). Infra ~$260–380/mo at 10K MAU (§9). Seasonality: expect 60–80% engagement decay mid-league; annual + League Pass SKUs smooth it.

### 5.4 Community acceptance strategy (this market punishes greed)

The PoE2 tool ecosystem is entirely free/open-source; the community tolerates freemium but has a "Pay 2 Win?" reflex. Non-negotiables:
1. Free tier must genuinely match free incumbents' *analysis* value (never paywall the basic stat sheet or top diagnoses).
2. Monetize **our compute and analysis**, never GGG's content (the Riot "transformative" test — safest design principle in the genre).
3. Contribute upstream to the PoB2 fork (we depend on its per-patch data maintenance; goodwill is a supply chain).
4. Required disclaimer everywhere: "This product isn't affiliated with or endorsed by Grinding Gear Games in any way."
5. Never touch POESESSID. Never automate trade actions. Ever.

---

## 6. Competitive landscape (condensed)

| Segment | Incumbents | Their gap |
|---|---|---|
| Build planning | PoB2 fork (desktop, gold-standard math), pob.cool (WASM web port), pobb.in (share codes), Maxroll planner, Mobalytics | All passive — show numbers, recommend nothing; no trade-priced upgrades |
| Economy | poe.ninja (uniques, 8 categories, free), poe2scout (currency, open API), exiledtools (signals on ninja data) | No rare pricing anywhere; no build-integrated market view |
| Price check | Exiled Exchange 2, Sidekick, PoE Overlay II | Per-item overlay lookups; no valuation model |
| Build discovery/hosting | poe.ninja builds (raw ladder), pobarchives (21K+ builds), Maxroll/Mobalytics tiers (editorial), GGG Build Planner | **Not our fight (v2).** We do not host, rank, or browse builds; we are the optimization *layer* that adapts any build they host to the individual player. Their build corpora are inputs to our Aggregation Engine (public payloads only, attributed), not competitors. |
| AI analysis | PoAI, poe2skills-ai, Questie AI, MCP hobby projects | LLM-first → hallucinated math → no trust, no traction |
| Adjacent proof | Raidbots ($/mo for sim compute), Mobalytics (acquired 2025), WoWAnalyzer | Model validation, not competition |

**Fast-follow threat:** Mobalytics & Maxroll have PoE2 audiences, funding, and (critically) **Build Planner subscribe-API partner access we don't have**. Our defense: engine depth (deterministic optimizer is hard to fast-follow without PoB-grade calc infrastructure) and speed to the 1.0 window.

---

## 7. Legal & platform risk (the section that shapes everything)

### 7.1 What's solid
- **MIT license** on this repo permits commercial use/modification/sale (obligation: ship the copyright notice). One gotcha: bundled `base64.lua` is LGPL — **swap it** in the proprietary server build.
- Web apps are GGG's explicitly **encouraged** third-party category. OAuth character import for PoE2 is documented and sanctioned (`account:characters`). Ladders and `service:cxapi` are sanctioned.
- Monetization is not prohibited: ToU s22 contemplates third-party API use; commercial precedent everywhere (Maxroll, Mobalytics, FilterBlade, poe.ninja ads). No GGG enforcement against a tool *for charging money*, ever. No DMCA/C&D against any fan tool found in 13 years.

### 7.2 What's discretionary (single points of failure)
- **OAuth client approval is manual** (email oauth@grindinggear.com; account name, client type, grant types, justified scopes, redirect URIs). GGG "will immediately reject any low-effort or LLM-generated requests." → **Application must be hand-written, disclose commercial intent, and read like a human wrote it.** Approval can be declined or revoked at will; APIs carry no availability guarantee.
- **Game art/data is GGG IP** used under tolerance, not license (ToU requires "prior written approval" for derivative display — universally ignored, never enforced, but revocable). Mitigations: text-first mode with our own iconography so all GGG art is removable in days; don't hard-paywall GGG assets; distinctive non-PoE brand name.
- Realistic worst case is **not a lawsuit** — it's (a) API/OAuth revocation (kills import + market features overnight), (b) a comply-and-continue C&D, (c) staff/user game-account bans if trade features cross into automation.

### 7.3 What's prohibited (drove the §4.4 redesign)
Bulk trade2 scraping, background live-search farms, POESESSID collection, auto-whisper/auto-buy, obfuscated user agents. The original "sniper bot" concept sits squarely here. **Decision needed from founder: accept the §4.4 redesign** (recommended), or pursue written GGG permission first (no precedent of it being granted for trade data — poe.ninja itself operates gray with no evidence of blessing).

### 7.4 Pre-launch legal checklist
1. Register our own confidential OAuth client (never reuse `client_id=pob`). 2. IP attorney review of art/data display posture. 3. Written outreach to GGG dev support for acknowledgment (cheap; high value if answered). 4. Swap LGPL base64.lua. 5. Non-affiliation disclaimer site-wide. 6. ToS/privacy policy covering imported character data. 7. Name/domain trademark check (no "PoE"/"Path of").

### 7.5 Compliance charter (founder directive, 2026-07-03 — LOCKED)

**Founder policy: we operate fully legally and ToS-compliant. No gray-hat shortcuts, ever.** Binding rules for every feature, current and future:

1. **Official APIs only for automated/server-side data collection.** Anything server-side and continuous uses only documented, sanctioned endpoints (OAuth character/ladder/cxapi). No bulk or background access to undocumented endpoints, full stop.
2. **Never POESESSID.** We never ask for, collect, store, or use session cookies — ours or users'.
3. **Never automate player actions.** No auto-whisper, auto-buy, auto-anything in or around the game. Alerts inform a human; the human acts.
4. **Honest identity always.** Registered OAuth client, required User-Agent format, non-affiliation disclaimer, commercial intent disclosed to GGG in our application.
5. **Rate limits are law.** Header-driven token buckets on every GGG call; back off on 429; one kill-switch per external data service.
6. **Tolerated-gray items are opt-in, minimized, and reversible** — exactly two exist, both ecosystem-universal, both flagged to counsel:
   - *GGG artwork/data display* (every major tool does this unlicensed): mitigated by text-first mode with our own iconography, removable in days on request, never hard-paywalled.
   - *User-initiated single-item trade2 price lookups* (MI-4/OPT-4 rare spot-pricing — the tolerated Sidekick/Exiled Exchange 2 pattern): strictly one user action → one lookup, honest UA, rate-limited. **If counsel or GGG ever objects, this degrades gracefully to trade-site deep links (user clicks and looks themselves) — the feature architecture must support that fallback from day one.**
7. **If GGG says stop, we stop** — comply-and-continue posture, no arguing, no workarounds.

This charter resolves Open Decision #1 (§14): the Pillar-2 redesign (§4.4) is **accepted**; MI-6 (server-side live-search sniping) stays cut permanently unless GGG ships a sanctioned API or grants written permission.

---

## 8. Data strategy (the price-data problem, stated honestly)

| Data need | Source at launch | Quality |
|---|---|---|
| Character snapshots | Official OAuth API | ✅ Full |
| Game data (mods, gems, bases, tree) | This repo's `src/Data` + `src/Export` pipeline (upstream-maintained per patch) | ✅ Full, but patch-lagged; ops cost every ~4 months + hotfixes |
| Currency prices | `service:cxapi` (official, hourly historical) + poe2scout + poe.ninja | ✅ Good, hourly latency |
| Unique prices | poe.ninja / poe2scout public APIs (their upstream = gray trade2 estimation; "There is no River API for Path of Exile 2 yet" — poe.ninja) | 🟡 Usable, no SLA, ~120d history |
| **Rare prices** | **Does not exist anywhere.** Only user-initiated per-item trade2 comparable lookups | 🔴 Gap — upgrade finder is unique-first at launch; rare pricing = spot-checks |
| Ladder/meta | Official ladder API (top 1,000/league) | ✅ Sanctioned but shallow |
| Death/behavior data | Not exposed by any API | 🔴 v1 infers from snapshot; desktop log-parser later |

**Contingency (design in from day 1):** a feature-flagged "river adapter" — if GGG ships a PoE2 public stash API (ecosystem is explicitly waiting; ExileCon Nov 2026 is the likely announcement venue), we light up real price distributions, rare valuation, and honest deal-flagging within weeks. This is also the trigger to revisit MI-6.

---

## 9. Technical architecture & stack (one stack, not a menu)

### 9.1 The engine service — the crown jewel

**Run the PoB2 engine unmodified, headless, as a Docker sidecar** — never rewrite it, never FFI-embed it:
- Image = LuaJIT + pinned PoB2 `src/` + `HeadlessWrapper.lua` + **real zlib binding** (Deflate/Inflate are stubbed empty at `HeadlessWrapper.lua:95-102` — must fix) + prebuilt `ModCache.lua`, **pinned per game patch**.
- Thin HTTP/JSON shim per worker (pattern: PoB PR #9505's stdio JSON-RPC server; pob-mcp drives it identically). Pre-warmed process pool — LuaJIT is single-threaded, so parallelism = N processes, each holding a loaded build env, recycled every N jobs.
- Batched what-ifs via `calcs.getMiscCalculator` (one base env, many cheap override recalcs) and `calcs.getNodeCalculator` for tree sweeps.
- Results cached by `(buildHash, mutationHash)`. Conformance suite asserting parity with desktop PoB2 outputs per engine version.
- Estimated cost per calc (UNVERIFIED — see Spike-1): ~5–50ms accelerated, ~50–500ms full pass; complex minion/multi-skill builds much slower. Server payload ~45–50MB/game version (TreeData images never load headless).
- Free-tier cost lever if needed: pob-web proves the whole engine runs client-side via WASM — offload free-tier casual calcs to the browser later.

**Why sidecar over Rust+mlua / Go+gopher-lua:** upstream ships fixes weekly; a sidecar means `git pull` + ModCache regen + redeploy. gopher-lua is ~10–30× slower than LuaJIT (disqualifying); mlua+LuaJIT is the documented fallback if process-pool overhead ever matters.

### 9.2 Full stack

| Layer | Choice | Why |
|---|---|---|
| Frontend | **Next.js 15 + TypeScript**, TanStack Query/Table, Tailwind + shadcn/ui | Shareable stat sheets & Doctor report cards are SEO-critical (RSC/ISR); optimizer/slider views are client components — one framework covers both |
| Passive tree | Custom **PixiJS WebGL2** renderer from this repo's TreeData atlases | Well-trodden (pob-web, pobb.in); ~2–4 week build, read-only v1 |
| API | **Node 22 + Fastify** | TS end-to-end; small-team velocity |
| Jobs | **BullMQ on Redis** | Optimizer runs are job-shaped; Temporal is overkill |
| Engine | LuaJIT sidecar pool (above), dedicated-vCPU nodes | |
| OLTP | **Postgres 17** (users, builds, subs, alerts) | |
| Market analytics | **Single-node ClickHouse** (price ticks, averages, build-market analytics) | 3–10× faster analytics, 15–30× compression vs TimescaleDB; single binary |
| Cache/pubsub | Redis/Valkey (BullMQ + SSE fan-out) | |
| Market ingestion | Separate Node worker: cxapi poller + poe2scout/ninja fetchers + strictly header-driven token-bucket for any user-initiated trade2 calls | Isolates ALL GGG-API risk in one service with one kill-switch |
| LLM | **OpenRouter**, flash-class models (~$0.05–0.50/M tok), strict-schema structured output, prompt caching, Redis-cached explanations, per-user daily budgets enforced app-side | Explanation-only by design |
| Alerts | Discord webhooks + Web Push + in-app SSE | Discord is the community's native channel, free |
| Payments | Stripe + ParityDeals (PPP) | |
| Hosting | **Hetzner + Coolify + Cloudflare** (free CDN/WAF); Sentry; Resend | Flat billing; ~$260–380/mo at 10K MAU → ~$900–1,500/mo at 100K MAU (vs $600+/mo launch on Vercel-style stacks). EU-centric; add a US edge node later if alert latency warrants |

### 9.3 Validation spikes — BEFORE full build-out (each ≤ 1 week)

1. **Engine benchmark (the go/no-go):** Docker + LuaJIT + HeadlessWrapper; timed `calcs.perform` + `getMiscCalculator` loops on 3 representative real builds (melee/minion/DoT). Output: calcs/sec/core, memory per warm env (est. 200–500MB — unmeasured), cost per optimizer run. Kills or confirms the worker-pool sizing model.
2. **zlib shim + share-code round-trip:** byte-parity with desktop PoB2 export.
3. **Import heuristics prototype:** 20 real characters → auto main-skill + config defaults → % producing sane FullDPS without human input (target ≥90%).
4. **OAuth application dry-run:** draft the GGG application (hand-written, commercial intent disclosed); submit early — approval latency is unknown and gates everything.
5. **Upgrade-finder slice:** one slot, unique-only, poe2scout prices → ranked ΔDPS/div for a test build, end-to-end.

---

## 10. AI strategy (deterministic core, LLM shell)

1. **The engine is the product; the LLM is the interface.** Every number from `calcs.*`; LLM renders findings JSON → prose. Community evidence is unambiguous: LLM game-math is distrusted ("dead wrong", "well articulated but often completely wrong"), PoB math is gospel.
2. LLM tasks (all cheap, cacheable, schema-constrained, all via the Build Coach persona): findings narration, fix phrasing framed as trade-offs against the user's stated priorities, natural-language goal parsing ("tanky minion build, boss farming, under 5 div" → preset + weight hints).
3. Explicit non-goals: LLM-computed stats, LLM build generation, chat assistant (v1). Scope creep here is a 10–50× cost multiplier and a trust killer.
4. "Personalized Build Optimizer" is the marketing name for **deterministic preference-weighted search + LLM explanation** — and the GGG OAuth application should describe it that way (they auto-reject applications that smell LLM-generated).

---

## 11. Roadmap

> Solo/small-team pacing (v2 phase shape — mirrors `PRODUCT_PLAN.md` v2). Plumbing order is dictated by dependencies: engine service → multi-source import + suggested preset → **preference-weighted optimizer + Doctor** → comparative optimization + upgrade finder → hardening/launch. The former Phase 4 "Build Market" is deleted (ADR-003); the roadmap is one phase shorter as a result.

**Phase 0 — Validation (2–3 wks):** Spikes S1–S7 (engine benchmark go/no-go; zlib round-trip; import heuristics; GGG OAuth application; **S5 preference-engine vertical slice** — score one build under different weight vectors, orderings must flip sensibly; **S6 aggregation feasibility** — normalize the same Archetype from 3 sources + comparator diff; **S7 this PRD v2 revision**). Gate: engine economics viable + S5 orderings founder-validated + S6 diff works + OAuth submitted. *If the benchmark fails (>2s/calc on complex builds), the optimizer scope shrinks to precomputed-candidate mode — decide then.*

**Phase 1 — Foundation (4–6 wks):** Engine-as-a-service (pool, cache, conformance suite, patch-pinning pipeline); accounts; **multi-source import** (OAuth + PoB code + pobb.in/Maxroll/poe.ninja links + `.build`) with source attribution; **Context Detector v1** (Archetype classification + suggested Goal Preset with rationale); web stat sheet + read-only preference-slider preview.

**Phase 2 — Personalized Optimizer + Doctor + payments (6–8 wks) → CLOSED BETA:** **Preference Engine v1** (axes, normalization curves, satisficing targets, weight persistence); preference-driven optimizer core (weighted wasted-stat report, node suggestions + item-swap analyzer ranked by Δ Weighted Score); **goal-aware Character Doctor** rulebook; LLM trade-off narration; free/premium gating + Stripe + League Pass; **launch closed beta into the league community** (shareable free Doctor cards = the acquisition loop). Beta gate includes preset-override telemetry (>30% of users adjust ≥1 slider) — validates the pivot's core hypothesis.

**⚑ Hard checkpoint — ExileCon, Nov 7–8, 2026:** re-plan against announcements: 1.0 date (launch timing), PoE2 stash API (light up river adapter + revisit MI-6), first-party death recap (reshape Doctor toward optimization), Build Planner subscribe-API public access (integrate as an *export* target — send the optimized build to the player's in-game planner, a perfect fit for the layer positioning).

**Phase 3 — Comparative optimization + budget upgrade finder (6–8 wks):** **Aggregation Engine** (productionize S6: public-interchange-endpoint fetchers only, normalizer hardening, polite caching, per-source kill-switches, attribution pipeline, Archetype index); **Comparator + comparative recommendations** (diff vs Canonical Builds of the same Archetype, each engine-evaluated on the user's build, ranked by Δ Weighted Score under the user's weights, community-consensus boost, every card attributes its source); **price layer (supporting service)** — cxapi/poe2scout/ninja ingestion (ClickHouse); **preference-driven budget upgrade finder** — unique-first, ranked by Δ Weighted Score per divine, with user-initiated rare spot-pricing and trade deep-links; watchlist alerts. Partnership outreach to Maxroll/Mobalytics/poe.ninja (traffic-referral pitch).

**Phase 4 — Hardening + public launch (4–6 wks, was 6–8: Build Market deleted):** load test (k6, WASM client-calc lever if COGS demands); security pass (authz edges, webhook signatures, SSRF on aggregation fetchers), backup/restore drill, status page; launch checklist (name/domain/trademark, §7.4 legal review incl. the aggregation surface, LGPL base64 swap, pricing page, "optimize for YOUR playstyle" demo content, creator collabs). **PUBLIC LAUNCH targeting the 1.0 F2P window.**

---

## 12. Success metrics

> Re-derived to the v2 phase exits (see `PRODUCT_PLAN.md` v2, Phase 2 beta gates + Phase 4 launch targets). Build-Market-specific metrics are dropped with the pillar; the pivot adds a **north-star adoption metric** for personalization.

| Stage | Metric | Target |
|---|---|---|
| Beta | Import → full report completion | >70% |
| Beta | Doctor report shared (link/screenshot) | ≥15% of reports |
| Beta | **Preset-override engagement** (users who adjust ≥1 preference slider) — validates the pivot hypothesis | >30% |
| Beta | First paying subscribers | >0 (conversion signal) |
| Launch | Registered users (first full league) | 50K |
| Launch | Free→paid conversion | ≥2% (stress-floor 1%) |
| Launch | Optimizer suggestion → trade deep-link CTR | >25% (proxy for "advice trusted") |
| Launch | **★ North-star — optimizer runs that use non-default weights** (personalization actually adopted, not just DPS-max by another name) | >30% |
| Ongoing | League-over-league returning users | >40% |
| Ongoing | Engine parity bugs escaping to prod | <5/patch cycle |
| Ongoing | Infra + LLM COGS as % of MRR | <20% |

---

## 13. Top risks & mitigations

> **v2 top-risk shift:** with the Build Market pillar deleted, its "marketplace cold-start" risk is retired; the new #1 product risk is **objective-function quality** — a bad weight/curve set produces confident bad advice (risk 0 below). Risks 0, 0a, 0b are the pivot's additions.

| # | Risk | L×I | Mitigation |
|---|---|---|---|
| 0 | **Objective-function quality** (bad axis weights/normalization curves → confident bad recommendations) — the #1 product risk in v2 | M × Critical | S5 spike validates orderings before build-out; per-axis Δ Weighted Score decomposition shown to the user (auditability); golden-ordering + satisficing-band tests; beta "was this recommendation good?" loop; presets tuned per Archetype via the Context Detector |
| 0a | Context Detector misreads a build → wrong *suggested* priorities | M × M | Suggestions always visible + overridable; rationale shown; override telemetry flags weak Archetypes; fixture per known mechanic |
| 0b | Third-party source dependence (Maxroll/Mobalytics/poe.ninja interchange formats or goodwill change) → weakens comparative optimization | M × M | Public-interchange-endpoints-only + prominent attribution + partnership outreach; per-source kill-switch; PoB-code paste always works as a universal fallback; never republish guide content |
| 1 | GGG declines/revokes OAuth (whole platform) | M × Critical | Hand-written application early (Spike-4); scrupulous rate-limit compliance; web-app category; written acknowledgment attempt; PoB-code + `.build` import paths work with zero GGG API |
| 2 | Trade-feature overreach triggers enforcement | H if ignored | §4.4 redesign shipped as spec'd; kill-switch on the isolated market-ingestion service; never POESESSID/automation |
| 3 | No rare-price data weakens flagship upgrade finder | Certain × M | Unique-first launch; honest UX copy; river adapter contingency; user-initiated spot-checks |
| 4 | Engine perf economics fail | L-M × H | Spike-1 first; pre-filtering; accelerated calculators; WASM client offload lever |
| 5 | Upstream PoB2 fork breaks/lags/objects | M × H | Contribute upstream (goodwill + influence); pin versions; conformance suite; budget ~1 wk/patch for data ops |
| 6 | Mobalytics/Maxroll fast-follow | M × M | Speed to 1.0 window; engine depth moat; community-first posture |
| 7 | GGG ships death recap / build ladder at 1.0 | M × M | ExileCon checkpoint; Doctor pivots toward optimization (GGG won't judge builds — stated on record) |
| 8 | Community backlash at monetized fork | M × M | §5.4 non-negotiables; upstream contributions; free tier generosity; distinct brand |
| 9 | League seasonality cash-flow | Certain × L-M | League Pass + annual SKUs; costs scale down with idle compute |

---

## 14. Open decisions (founder)

1. ~~**Accept the Pillar-2 redesign** (§4.4)?~~ **RESOLVED 2026-07-03: accepted.** Founder directive: fully legal/ToS-compliant operation, no exceptions — see Compliance charter §7.5. MI-6 stays cut.
2. Product name + domain (constraint: no "PoE"/"Path of"; §7.4 check).
3. Ads on free tier at launch, or clean free tier until scale? (Recommend: no ads at launch — community goodwill is worth more than early ad pennies.)
4. Confirmed defaults (already assumed by this PRD, flag if wrong): web-first with desktop log-parser companion later; engine-math/LLM-explain split; $5.99/$49/$9.99 price points.
5. Open-source posture: keep our engine *wrapper* closed but upstream engine fixes to the fork (recommended), or fully closed?

---

## Appendix A — Key sources

**Primary (GGG):** developer docs (`/developer/docs`, `/docs/reference`, `/docs/authorization`, `/docs/game` — Build Planner spec), ToU (`/legal/terms-of-use-and-privacy-policy`), POESESSID policy (forum 3328601), 20-live-search cap, PoE Overlay 2020 statements, forum threads 3588490 / 3658908 / 3897973 / 3845293 / 3674156 / 3571584 (pain-point quotes), Dev Insights announcement (3942448).
**This repo:** `LICENSE.md` (MIT + LGPL base64.lua), `src/HeadlessWrapper.lua`, `src/Classes/PoEAPI.lua` (OAuth PKCE, poe2 endpoints), `src/Classes/ImportTab.lua` (import + share codes), `src/Modules/Calcs.lua` (`buildOutput:397`, `getMiscCalculator:123`, `getNodeCalculator:115`), `src/Modules/BuildDisplayStats.lua` (exposed stat surface), `src/Modules/CalcDefence.lua` (EHP:3341, MaxHit:3781), `src/Classes/TradeQueryRequests.lua`/`TradeQueryGenerator.lua`/`TradeQueryRateLimiter` (trade2 client), `spec/System/*`.
**Ecosystem:** poe.ninja blog ("no River API for PoE2"), poe2scout (GitHub, MIT), exiledtools, pob-web (atty303), PoB PR #9505 + pob-mcp, pobb.in (GPLv3 — do not copy), Exiled Exchange 2, Sidekick, Maxroll Build-Planner guide (subscribe flow live, 0.5.4), Mobalytics/Blitz/u.gg/OP.GG/Raidbots pricing pages, Overwolf creator-economics reports, Crunchbase (Mobalytics), ExileCon 2026 announcement.
**Caveats carried from research:** Raidbots current pricing unverified (Patreon-era figures); some 2026 quotes sourced from secondary coverage (re-verify before public claims); "no DMCA ever" rests on web-search coverage, not court-record search; this PRD is research, not legal advice.
