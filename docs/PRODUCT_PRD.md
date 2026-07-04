# PRD — "ExileLab" (working title): The PoE2 Build-Intelligence Platform

**Version:** 1.0 · **Date:** 2026-07-03 · **Status:** Draft for founder review
**Authors:** Product research synthesized from a 10-agent research workflow (GGG API/ToS, competitors, community sentiment, monetization, calc-engine feasibility, tech stack, local PoB2 repo audit, price-data sourcing, GGG IP policy, PoE2 1.0 roadmap). Sources cited in Appendix A.

> **Working title note:** the product name must NOT contain "Path of Exile", "PoE", or "Path of Building" (GGG trademark / community-project branding). "ExileLab" is a placeholder; "exile" is common in tolerated community tool names (exiledtools.com, exile.exchange). Final name TBD.

> **Workspace layout:** this directory (`standalone engine beta/`) is the standalone product — it will hold the new app's code, docs, and planning. The sibling `PathOfBuilding-PoE2/` repo is the upstream calc engine we build on (consumed unmodified as a headless service, §9.1) and our reference for import/trade/calc code paths. The app shares **zero UI** with PoB — an entirely new web UI per §9.2; PoB is engine + prior art only.

---

## 1. Executive summary

**One-liner:** *PoB, but smarter.* A freemium web platform that imports a player's Path of Exile 2 character and tells them — with PoB-grade deterministic math, never LLM guesses — what's wrong with their build, exactly what to change, and what the best upgrades are for their budget.

Four product pillars on one shared engine:

| # | Pillar | What it does | Legal/platform risk | Differentiation today |
|---|--------|--------------|--------------------|----------------------|
| 1 | **AI Build Optimizer** | Wasted-stat detection (overcapped resists, dead nodes), item-swap DPS deltas, budget-aware upgrade finder ("best upgrades for 10 div") | **Low** (official character API + our own math) | Does not exist for PoE2 in any form |
| 4 | **Character Doctor** | Diagnoses why a build fails: chaos res too low, no stun immunity, defenses too thin for tier-X maps, and why you keep dying | **Low** | Does not exist; GGG ships no death recap and says it wants to "reduce how much obscure game knowledge creates power gaps" |
| 3 | **Build Market** | Upload/import builds, ranked by computed budget / mapping speed / boss DPS / survivability ("Netflix for builds") | **Low-medium** (GGG is building build *distribution*; our moat is computed *ranking*, which GGG has explicitly sworn off) | Aggregators show raw ladder data or editorial tiers; nobody ranks by computed performance |
| 2 | **Market Intelligence** (redesigned from "Trade Sniper") | Currency-flip dashboard, price history, undervalued-listing signals, user-initiated upgrade pricing, alerting | **HIGH as originally scoped — must be redesigned** (see §7) | Existing snipers are dumb notification pipes; nobody computes fair value — but the data & ToS constraints are severe |

**Core architecture decision (locked):** the deterministic PoB2 calculation engine (this repo, MIT-licensed) runs headless server-side and produces every number; an LLM (via OpenRouter, cheap flash-class models) only *narrates* the engine's structured output into human advice. This is exactly the credibility gap current AI tools fail on — the community demonstrably distrusts LLM game math ("the more specific you get, the more likely ChatGPT is giving you false information") while trusting PoB numbers absolutely.

**Business model (locked):** freemium. Free tier = the viral growth engine (import + stat sheet + top-3 diagnoses + build browsing). Premium ≈ **$5.99/mo / $49/yr / $9.99 League Pass (2 months, one-time)** = unlimited priority-queue optimizer runs, full Doctor reports, budget upgrade finder, market alerts. Realistic steady state: 3K–12K subscribers → **$160K–$650K ARR** — a strong small-team business, seasonal around league launches.

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
| **The League Starter** | Returns every league, needs a build that fits budget & playstyle, wants to know a guide still works post-patch | Build Market | League Pass |
| **The Currency Gamer** | Plays the market as the game; flips currency, hunts underpriced uniques | Market Intelligence | Would pay the most — but this persona is the ToS-riskiest to serve (§7) |
| **The New 1.0 Player** (late 2026 wave) | F2P launch arrival; overwhelmed; needs "what's wrong / what next" in plain language | Doctor (free tier) | Conversion funnel seed |

---

## 4. Product pillars — detailed specs

> All four ship as one platform with a shared account, shared character import, and one engine service. "Parallel" development is sequenced *inside* one roadmap (§11) because pillars 1 & 4 share ~80% of their plumbing and unblock 3; pillar 2's data layer is a separate service.

### 4.1 Pillar 1 — AI Build Optimizer

**Job to be done:** "Look at my character and tell me the highest-impact changes, with numbers."

**Input paths (all already proven in this repo):**
- OAuth character import — `GET api.pathofexile.com/character/poe2/{name}` (equipment, inventory, passives) via our own registered OAuth client (`src/Classes/PoEAPI.lua` shows the flow; we must NOT reuse `client_id=pob`).
- PoB share code paste — URL-safe base64 of zlib-deflated build XML (`ImportTab.lua:133/:260`); interoperable with pobb.in, Maxroll, poe.ninja, pob.cool.
- `.build` JSON file (GGG's official Build Planner format, documented at pathofexile.com/developer/docs/game).

**Features (F = free, P = premium):**

| ID | Feature | Tier | Spec |
|---|---|---|---|
| OPT-1 | **Wasted-stat report** | F (top 3) / P (full) | Engine outputs `FireResistOverCap` etc. natively (`BuildDisplayStats.lua`). Report: overcapped resists (with exact wasted %), stats on gear contributing zero to the build, dead/inefficient passive nodes (one-step node deltas via `calcs.getNodeCalculator`), unused gem links, spirit/mana waste. Each finding = {severity, numeric impact, affected slot/node, suggested action}. |
| OPT-2 | **Dead-node detector & tree suggestions** | P | Local search over unallocated/allocated nodes using the accelerated node calculator (same machinery as PoB's heat map, which evaluates thousands of node deltas in seconds). Suggest reallocation sets with net DPS/EHP delta. Precedents: poesto, poe-graph-optimization, PoESkillTree GA. |
| OPT-3 | **Item swap analyzer** | P | User pastes/selects candidate item(s) → `calcs.getMiscCalculator` computes exact DPS/EHP delta ("Ring B = +18.2% DPS, −3% EHP"). Batch mode: compare all inventory/stash candidates for a slot. |
| OPT-4 | **Budget upgrade finder** ("best upgrades for 10 div") | P (flagship) | Pipeline: (a) enumerate slots by upgrade headroom; (b) fetch priced candidates — uniques from poe.ninja/poe2scout price tables, rares via **user-initiated, rate-limited trade2 spot queries** (Exiled Exchange 2 pattern — see §7 data constraints); (c) heuristic pre-filter (mod-weight scoring) to top-N per slot; (d) full engine calc per candidate; (e) rank by ΔDPS-or-ΔEHP per divine; (f) output ranked list with deep links to the official trade site (user clicks through and buys — we never automate trade actions). **At launch, rare-item coverage is best-effort; unique-first suggestions are the reliable core** (no PoE2 rare price index exists anywhere — see §8). |
| OPT-5 | **Plain-language explanations** | P | LLM renders the engine's structured findings JSON into prose ("Your cold res is 12% overcapped — that suffix on your boots is doing nothing; here's what to look for instead"). Strict-schema structured output; cached by hash(build+findings); never generates numbers. |
| OPT-6 | **Optimizer run quota & queue** | F: ~3 runs/week, standard queue. P: unlimited, priority queue | The Raidbots model — server compute is the honest paywall justification. |

**Acceptance criteria (v1):** import → full report < 30s standard queue; every numeric claim reproducible in desktop PoB2 within engine parity tolerance; upgrade finder returns ≥3 priced suggestions for ≥80% of imported characters at 5/10/50 div budgets (unique-first acceptable).

### 4.2 Pillar 4 — Character Doctor

**Job to be done:** "Tell me why my build sucks / why I keep dying — in words I understand."

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
| DOC-7 | DPS below tier expectation | `FullDPS` vs tier bands (percentile vs our build corpus once Build Market has data) |
| DOC-8 | Cost warnings / unusable skills | `LifeCost/ManaCost` + `WarningList` (`Calcs.lua:412-448`) |
| DOC-9 | Content-readiness verdict | Composite: "This build is ready for T13; your realistic wall is T8 — because X, Y." |

**Free tier shows top-3 diagnoses** (the viral screenshot: "Your chaos res is −34%. This is why you die."). **Premium = full checklist + itemized fixes + LLM narration + re-check after changes.**

**Engineering prerequisite (both pillars):** `loadBuildFromJSON` leaves main-skill unselected and config unset ("Good luck!" — `HeadlessWrapper.lua:218-226`). We must build **import heuristics**: auto-pick main skill (highest-DPS socketed active skill), sane config defaults per content tier, boss-config presets. This is the single biggest product-quality determinant for import-and-diagnose UX and needs its own spec + test corpus of real characters.

### 4.3 Pillar 3 — Build Market

**Job to be done:** "Find me a build that fits my budget/playstyle — ranked by what it actually does, not by editorial opinion."

**Strategic positioning (from 1.0-roadmap research):** GGG now owns build *distribution* (in-game Build Planner, `.build` files, partner-gated subscribe API that Maxroll/Mobalytics already have; Rogers floated a "most-used builds ladder"). GGG has explicitly sworn off *quality ranking* ("It's not on us to decide what's good"). **Our moat is computed performance ranking — never compete on hosting/distribution.**

| ID | Feature | Tier |
|---|---|---|
| MKT-1 | Ingest builds: PoB codes, `.build` files, ladder scraping via official ladder API (top 1,000/league), creator uploads | — |
| MKT-2 | **Computed scorecards**: every build run through the engine → boss DPS, clear-speed proxy (movement/AoE/single-target mix), survivability grade (EHP/max-hit/sustain), **budget estimate** (sum of priced uniques + gear-quality heuristic) | F (browse) |
| MKT-3 | Rank/filter by budget bracket, ascendancy, skill, playstyle, patch; "still works in 0.5?" staleness flags (auto re-calc on patch data update) | F basic / P advanced filters |
| MKT-4 | "Builds like mine but better" — similarity match from imported character | P |
| MKT-5 | Creator pages + verified guide links; deep-link out to guides (be the index, not the host) | F |
| MKT-6 | League-start planner: budget-phased progression snapshots of a build (day-1 → week-1 → endgame) | P |

**Cold start:** seed from ladder API (top 1,000 per league is official and sanctioned) + poe.ninja-style public character import of consenting/public profiles + PoB code submissions incentivized by free Premium for creators.

### 4.4 Pillar 2 — Market Intelligence (REDESIGNED from "Trade Market Sniper")

**⚠️ Founder decision required — the original concept cannot ship as pitched.** Research verdict (three independent agents converged):

- There is **no PoE2 public stash API** ("river") — the PoE1 firehose that powers poe.ninja's economy is PoE1-only. Nothing suggests a PoE2 version before/at 1.0.
- The trade2 site API is **undocumented**; GGG's ToU prohibits scraping (s7(f)), bots (s7(c)), and reverse-engineering endpoints (s7(i)); the dev docs say undocumented-API access requests "will be denied."
- Live search requires a logged-in session (POESESSID) — GGG's official position: sharing POESESSID with tools is "specifically against our terms of use." The official site caps live searches at 20/account *specifically to prevent sniping load*.
- Enforcement precedent exists: PoE Overlay 2020 account-lock waves ("hitting their API a few million times a day"); RMT/trade-bot ban waves during PoE2 EA; the 2026 Jenebu ban. GGG deliberately ships trade friction (instant-buyout Merchant's Tabs shrink sniping windows).
- A server-side sniping service would risk **OAuth revocation for the whole platform** — killing pillars 1, 3, 4 to serve pillar 2.

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
| Optimizer | ~3 runs/week, standard queue | Unlimited, priority queue |
| Budget upgrade finder | — | ✅ |
| Build Market | Browse + basic filters | Computed-rank filters, "builds like mine", league-start planner |
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
| Build discovery | poe.ninja builds (raw ladder), pobarchives (21K+ builds, no rankings), Maxroll/Mobalytics tiers (editorial) | Nobody ranks by computed budget/DPS/survivability |
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
| Frontend | **Next.js 15 + TypeScript**, TanStack Query/Table, Tailwind + shadcn/ui | Build Market & shareable Doctor reports are SEO-critical (RSC/ISR); optimizer views are client components — one framework covers both |
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
2. LLM tasks (all cheap, cacheable, schema-constrained): findings narration, fix phrasing, build-summary blurbs for Build Market cards, natural-language search parsing ("tanky minion build under 5 div" → structured filters).
3. Explicit non-goals: LLM-computed stats, LLM build generation, chat assistant (v1). Scope creep here is a 10–50× cost multiplier and a trust killer.
4. "AI Build Optimizer" is the marketing name for **deterministic search + LLM explanation** — and the GGG OAuth application should describe it that way (they auto-reject applications that smell LLM-generated).

---

## 11. Roadmap

> Solo/small-team pacing. All four pillars progress "in parallel" as thin slices on the shared platform, but plumbing order is dictated by dependencies: engine service → import+Doctor → optimizer → market layers.

**Phase 0 — Validation (2–3 wks):** Spikes 1–5. Gate: engine economics viable + OAuth application submitted. *If the benchmark fails (>2s/calc on complex builds), the optimizer scope shrinks to precomputed-candidate mode — decide then.*

**Phase 1 — Foundation (4–6 wks):** Engine-as-a-service (pool, cache, conformance suite, patch-pinning pipeline); accounts; import (OAuth + PoB code + `.build`); web stat sheet.

**Phase 2 — Doctor + Optimizer core (6–8 wks):** Diagnostic rulebook + tier thresholds; wasted-stat report; node deltas; item-swap analyzer; LLM narration; free/premium gating + Stripe + League Pass; **launch closed beta into the league community** (shareable free Doctor reports = the acquisition loop).

**Phase 3 — Budget upgrade finder + Market layer (6–8 wks):** cxapi/poe2scout/ninja ingestion (ClickHouse); unique-first upgrade finder with trade deep-links; currency dashboard + flip analytics + watchlist alerts; user-initiated rare spot-pricing.

**Phase 4 — Build Market (6–8 wks):** ladder ingestion + scorecards + ranked browse; "builds like mine"; creator pages; staleness flags. **Public launch targeting the 1.0 F2P window.**

**⚑ Hard checkpoint — ExileCon, Nov 7–8, 2026:** re-plan against announcements: 1.0 date (launch timing), PoE2 stash API (light up river adapter + revisit MI-6), first-party death recap (reshape Doctor toward optimizer/planning), Build Planner subscribe-API public access (apply immediately).

---

## 12. Success metrics

| Stage | Metric | Target |
|---|---|---|
| Beta | Import → full report completion | >70% |
| Beta | Doctor report shared (link/screenshot) | >15% of reports |
| Launch | Registered users (first full league) | 50K |
| Launch | Free→paid conversion | ≥2% (stress-floor 1%) |
| Launch | Optimizer suggestion → trade deep-link CTR | >25% (proxy for "advice trusted") |
| Ongoing | League-over-league returning users | >40% |
| Ongoing | Engine parity bugs escaping to prod | <5/patch cycle |
| Ongoing | Infra + LLM COGS as % of MRR | <20% |

---

## 13. Top risks & mitigations

| # | Risk | L×I | Mitigation |
|---|---|---|---|
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
