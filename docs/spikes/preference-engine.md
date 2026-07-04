# S5 — Preference Engine: Scoring Design Note

| | |
|---|---|
| Spike | S5 — Preference-engine vertical slice (PRODUCT_PLAN Phase 0, Open Task 7) |
| Status | **Slice SHIPPED and GREEN** — 19 tests pass (`pnpm --filter @exilelab/preference-engine test`) |
| Package | `packages/preference-engine/` (`@exilelab/preference-engine`) |
| Deliverable | This note — the scoring-function design record so the founder can validate the scoring *philosophy* against the shipped code |
| Canonical terms | Preference Engine, Preference Axes, Goal Preset, Weighted Score, Satisficing (docs/GLOSSARY.md) |
| Reads / dependency direction | RFC-0001 §8.2: the Preference Engine reads **Calculation Results** (keyed by BuildSnapshot × engine version) → scores. It never calls the engine, never calls the LLM, never touches an external platform. It is a pure function over `EngineMetrics`. |

> Accuracy contract for this note: every formula and number below cites `file:line` in the shipped source. If the code changes, this note is wrong until re-verified. The `EngineMetrics` numbers the engine feeds are still MockEngine-scale (S1 not yet landed) — see §6 Open Questions on calibration.

---

## 0. What this component is

The Preference Engine is the pivot's beating heart: it replaces **"maximize DPS"** with a **weighted, satisficing, multi-objective score** over engine outputs (PRODUCT_PLAN §"The Preference Engine"). It answers one question deterministically: *given this player's priorities, how good is this build — or this candidate change — for **them**?*

The public surface (`src/index.ts`):

- **8 Preference Axes** — the user-weightable dimensions (`src/axes.ts:5-14`).
- **Normalization curves** — one per axis, mapping raw engine metrics into a comparable `[0,1]` score (`src/normalize.ts`).
- **Goal Presets** — pre-tuned weight + band + floor bundles (`src/presets.ts`).
- **Scoring** — `scoreBuild` (absolute 0–100 Weighted Score) and `scoreCandidate` (Weighted Score *delta* with per-axis decomposition) (`src/score.ts`).

The whole thing is pure and deterministic by design: identical inputs → identical output, and every reported total is the exact sum of its decomposition (asserted in `src/score.test.ts:151-178`).

---

## 1. The scoring function

### 1.1 Formula

The canonical definition (GLOSSARY "Weighted Score") is

```
WeightedScore(build) = Σᵢ  wᵢ · normalizeᵢ(metricᵢ)      subject to floor constraints
```

realized on the 0–100 scale in `scoreBuild` (`src/score.ts:110-133`). Per axis:

```
weightedScoreᵢ = wᵢ · normalizeᵢ(metricᵢ) · 100          # src/score.ts:122
WeightedScore  = Σᵢ weightedScoreᵢ                        # src/score.ts:123-124
```

So the axes are read in the fixed canonical order (`PREFERENCE_AXES`, `src/axes.ts:5-14`), each normalized to `[0,1]`, weighted, scaled ×100, and summed. Because every `normalizeᵢ ∈ [0,1]` and the weights sum to 1, `WeightedScore ∈ [0,100]` (asserted `src/score.test.ts:175-176`).

### 1.2 Sum-constrained weights

Sliders are a *sum-constrained allocation* (GLOSSARY; PRODUCT_PLAN §77). Callers pass any non-negative vector; `normalizeWeights` (`src/score.ts:78-90`) rescales it to sum to 1:

```
wᵢ = rawᵢ / Σⱼ max(rawⱼ, 0)          # negatives clamped to 0; src/score.ts:80-88
```

Degenerate all-zero vector → all-zero allocation → a well-defined score of 0, no divide-by-zero (`src/score.ts:87`, tested `src/score.test.ts:238-244`). Every built-in preset's weights normalize to 1 (tested `src/score.test.ts:230-236`).

### 1.3 Deltas are the real product (`scoreCandidate`)

Every optimizer surface ranks **Δscore under the user's weights, never raw ΔDPS** (PRODUCT_PLAN §80). `scoreCandidate` (`src/score.ts:143-189`) scores a base and a candidate under the *same* weights and bands, and returns:

```
weightedDeltaᵢ    = wᵢ · (candNormᵢ − baseNormᵢ) · 100    # src/score.ts:166-167
weightedScoreDelta = Σᵢ weightedDeltaᵢ                     # src/score.ts:168
```

**Decomposition integrity is a hard invariant:** `weightedScoreDelta` is the *exact* sum of the per-axis deltas — a consumer can audit any ranking number by adding up the decomposition (`src/score.ts:139-141` comment; tested for all presets `src/score.test.ts:159-168`). This is what makes the "+3% your objective: +1.2% dmg, +4% sustain, −0.5% EHP" explainable card (PRODUCT_PLAN §133) truthful rather than decorative.

The result also carries absolute `baseScore` / `candidateScore` and the floor verdict (§4).

---

## 2. Per-axis normalization curves

Two pure primitives underlie every axis (`src/normalize.ts`):

**Diminishing returns** — `diminishing(x, scale) = 1 − e^(−x/scale)` (`src/normalize.ts:55-58`). Monotonic increasing, concave, asymptotic to 1: more is always at least as good, but each unit is worth a little less than the last. Bounded in `[0,1)` (tested `src/score.test.ts:200-207`).

```
  1 |                          ........----=======
    |                 ...''''
    |            ..''
    |         .''
    |       .'                    y = 1 − e^(−x/scale)
    |     .'
    |    /
    |  ,'
  0 |,'________________________________________  x
    0    scale   2·scale   3·scale
         (0.63)  (0.86)    (0.95)
```

**Satisficing** — `satisfice(x, enough, scale)` (`src/normalize.ts:65-76`). Rises with diminishing returns toward `enough`, **reaches exactly 1.0 at `enough`, and stays saturated at 1.0 above it**:

```
satisfice(x) = 0                                    if x ≤ 0
             = 1                                    if x ≥ enough        # src/normalize.ts:72
             = (1 − e^(−x/scale)) / (1 − e^(−enough/scale))   otherwise  # src/normalize.ts:73-75
             = diminishing(x, scale)                if enough == null    # maximize; src/normalize.ts:71
```

The denominator `cap = 1 − e^(−enough/scale)` renormalizes the curve so it hits exactly 1.0 *at* `enough` rather than only asymptotically. This is the mathematical form of "enough is enough":

```
  1 |                  _____________________________  ← saturates at `enough`
    |            ..--''  :
    |challenge.-'        : no reward beyond here
    | .''                :  (overkill ≈ 0 marginal score)
    |'                   :
  0 |____________________:_______________________  metric
    0                  enough
```

Tested: saturates at/above `enough`, 0 at 0 (`src/score.test.ts:181-185`); strictly increasing and concave below `enough` — earlier increments buy more than later ones (`src/score.test.ts:187-198`).

### 2.1 The eight axes

Bands (`enough`, `scale`) are resolved by `resolveBand` (`src/normalize.ts:79-88`): a preset may set both, or set only `enough` (then `scale = enough/2`), or set neither (then the axis uses its `DEFAULT_AXIS_SCALES` fallback in maximize mode). All normalizers are `NORMALIZERS[axis]` (`src/normalize.ts:92-162`).

| # | Axis | Metric(s) | Curve | Composite blend |
|---|---|---|---|---|
| 1 | **Damage** | `fullDPS` | satisfice | — |
| 2 | **Survivability** | `totalEHP` (primary), `maximumHitTaken` (secondary) | satisfice + diminishing | `0.75·EHP + 0.25·hit` |
| 3 | **Movement Speed** | `effectiveMovementSpeedMod − 1` (the bonus) | satisfice | — |
| 4 | **Attack Speed** | `attackRate` | satisfice | — |
| 5 | **Cast Speed** | `castRate` | satisfice | — |
| 6 | **Skill Mobility Efficiency** | `mobilitySkillRate`, `mobilitySkillCostPerUse` | diminishing × affordability | `throughput·(0.5 + 0.5·afford)` |
| 7 | **Resource Sustain** | `manaRegenPerSecond`, `unreservedMana`, `skillCostPerSecond` | satisfice + diminishing | `0.65·regen + 0.35·pool` |
| 8 | **Currency Efficiency** | `changeCostDivines` | exponential decay | — |

**Simple satisficing axes (1, 3, 4, 5).** Each just maps its metric through `satisfice` with the preset's band, defaulting to its scale when no band is given.

- Damage `satisfice(fullDPS, …)` (`src/normalize.ts:93-99`).
- Movement uses the *bonus* `max(0, mod − 1)` so 1.0× base = 0 (`src/normalize.ts:115-119`); `moveScale = 0.5` means +50% reaches `diminishing = 1 − e^{−1} ≈ 0.63` before any band renormalization.
- Attack `satisfice(attackRate, …)`, `attackScale = 4.0` aps (`src/normalize.ts:121-124`).
- Cast `satisfice(castRate, …)`, `castScale = 3.0` cps (`src/normalize.ts:126-129`).

**Survivability (composite)** (`src/normalize.ts:101-113`):
```
score = clamp01( 0.75 · satisfice(totalEHP, band) + 0.25 · diminishing(maximumHitTaken, 15000) )
```
EHP satisfices at the goal's band; one-shot protection (`maximumHitTaken`, `maxHitScale = 15000`) is a secondary but real signal that keeps 25% of the weight even after EHP saturates — a build that clears its EHP band can still improve its one-shot buffer.

**Skill Mobility Efficiency (composite)** (`src/normalize.ts:131-141`). "Movement via attacking" is a real PoE2 pattern (Twister Huntress), so this axis rewards *cheap + frequent* use of the movement-carrying skill (which the Context Detector designates):
```
throughput    = diminishing(mobilitySkillRate, 2.5)
affordability = 1 / (1 + max(0, mobilitySkillCostPerUse) / 30)
score         = clamp01( throughput · (0.5 + 0.5 · affordability) )
```
Affordability discounts throughput to `[0.5, 1.0]`: a free skill keeps full throughput; an expensive one is halved. Frequency is necessary (the `0.5` floor still requires throughput), cost is a modifier — you cannot buy mobility score with cost alone.

**Resource Sustain (composite)** (`src/normalize.ts:143-154`):
```
regenRatio = manaRegenPerSecond / max(skillCostPerSecond, ε)
poolSeconds = unreservedMana / max(skillCostPerSecond, ε)
score = clamp01( 0.65 · satisfice(regenRatio, 1.0, 0.5) + 0.35 · diminishing(poolSeconds, 4.0) )
```
Full self-sustain (`regen ≥ cost`, ratio `≥ 1.0`) **satisfices** — the primary goal is a rotation you can hold indefinitely; there is no reward for regenerating far past your drain. The pool (seconds of casting the unreserved mana buys) is the secondary buffer worth 35%.

**Currency Efficiency (decay)** (`src/normalize.ts:156-161`):
```
score = e^(−changeCostDivines / 5.0)
```
A free change (0 div) scores exactly 1.0; cost decays it. Under a budget-weighted preset this is what penalizes expensive marginal upgrades — "avoid over-optimization" (tested: free → 1.0, 10 div → `< 1`, `src/score.test.ts:209-217`). Note this is the one **change-scoped** metric: 0 for a base build, priced only for a candidate mutation (`src/metrics.ts:55-58`).

### 2.2 `DEFAULT_AXIS_SCALES` rationale

`DEFAULT_AXIS_SCALES` (`src/normalize.ts:17-40`) holds the characteristic scales — the metric value at which a diminishing curve reaches ~63% (`1 − e^{−1}`). They are exposed for transparency/tuning; **presets override the *primary* `enough` thresholds via bands, but the *secondary*-term scales and the maximize-mode fallbacks live here.**

| Constant | Value | Governs | Why this magnitude |
|---|---|---|---|
| `moveScale` | 0.5 | Movement bonus | +50% MS ≈ 0.63 before band renorm — a strong but not maxed mapper |
| `attackScale` | 4.0 | Attack rate | ~4 aps is a fast attacker |
| `castScale` | 3.0 | Cast rate | ~3 cps is a fast caster |
| `mobRateScale` | 2.5 | Mobility skill uses/sec | frequent repositioning |
| `mobCostScale` | 30 | Mobility cost/use | affordability half-point |
| `maxHitScale` | 15000 | Survivability secondary | one-shot buffer characteristic |
| `poolSecondsScale` | 4.0 | Sustain pool buffer | ~4 s of casting reserve |
| `regenScale` | 0.5 | Sustain regen ratio | curvature toward the 1.0 self-sustain band |
| `currencyDivScale` | 5.0 | Currency decay | ~5 div is where cost bites hard |
| `damageDefaultScale` | 3,000,000 | Damage maximize fallback | only used when `enough = null` |
| `ehpDefaultScale` | 40,000 | EHP fallback | only used when no band given |

**These are the numbers §6 flags for calibration** — they are hand-set placeholders sane for MockEngine-scale outputs, not yet fitted against real PoB2 numbers.

---

## 3. Satisficing target bands per Goal Preset

### 3.1 The shipped preset table

Six presets ship (`src/presets.ts`; `PRESET_LIST` order `src/presets.ts:191-198`; default = **Balanced**, `src/presets.ts:200`). Weights below are the **raw** slider allocations (each already sums to 1.0); bands are the `enough` thresholds fed to `satisfice`; floors are §4.

**Weights** (rows are axes; `src/presets.ts` line ranges in header):

| Axis | Fast Mapping (27-36) | Boss Farming (53-62) | Hardcore Surv. (80-89) | Budget Farming (110-119) | Balanced (135-144) | Maximum DPS (162-171) |
|---|---|---|---|---|---|---|
| Damage | 0.18 | **0.42** | 0.15 | 0.20 | 0.20 | **0.70** |
| Survivability | 0.10 | 0.24 | **0.45** | 0.18 | 0.20 | 0.10 |
| Movement Speed | **0.28** | 0.03 | 0.05 | 0.15 | 0.12 | 0.03 |
| Attack Speed | 0.12 | 0.06 | 0.04 | 0.08 | 0.10 | 0.06 |
| Cast Speed | 0.06 | 0.05 | 0.04 | 0.05 | 0.08 | 0.04 |
| Skill Mobility Eff. | 0.14 | 0.03 | 0.05 | 0.08 | 0.10 | 0.02 |
| Resource Sustain | 0.06 | 0.12 | 0.15 | 0.06 | 0.10 | 0.03 |
| Currency Efficiency | 0.06 | 0.05 | 0.07 | **0.20** | 0.10 | 0.02 |

**Bands + floors** (`constraints`):

| Preset | Damage `enough` | Surv. `enough` | Floors |
|---|---|---|---|
| Fast Mapping | 400,000 | 25,000 | — |
| Boss Farming | 2,500,000 | 45,000 | — |
| Hardcore Survivability | 800,000 | 70,000 | `totalEHP ≥ 40,000`, `maximumHitTaken ≥ 12,000` |
| Budget Farming | 300,000 | 20,000 | — |
| Balanced | 1,000,000 | 40,000 | — |
| Maximum DPS | **null** (never saturates) | 15,000 | — |

The band values encode the design intent directly. Fast Mapping's damage band (400k) is "enough to delete packs, not bosses" (`src/presets.ts:24-26`); Boss Farming's (2.5M) is single-target-tuned and *still satisfices* — "no reward for overkill" (`src/presets.ts:50-52`). Maximum DPS is the deliberate **anti-satisficing contrast** (`enough = null`, `src/presets.ts:153-178`): kept as an explicit opt-in so the value of satisficing is visible by comparison.

> PRODUCT_PLAN §78 lists ten aspirational presets (Party carry, Smooth gameplay feel, Speed clearing, Tanky…). The slice ships six spanning the philosophical space (two satisficing goals that flip, a hard-floor goal, a currency-first goal, a neutral default, and the maximize contrast). The remaining named presets are Phase-1 productionization (PRODUCT_PLAN §133), not S5.

### 3.2 Why satisficing is the philosophical core

Satisficing is *the pivot* (PRODUCT_PLAN §79: "This is the philosophical core of the pivot"). The claim it encodes: for almost every goal, **damage only needs to be *enough*** — enough to delete packs while mapping, enough to kill the boss in a reasonable window. Past that band, the marginal Weighted Score of more damage is ~zero (§2 satisfice saturation), so the optimizer's budget — divines, passive points, gear slots — **flows to the player's *other* priorities** (movement, survivability, sustain, cost).

A pure-maximize objective can't express this: it will always spend the next divine on DPS because more DPS always scores higher. Satisficing is what lets ExileLab say *"you already have enough damage for boss farming — here's what to do with your next 3 divines instead"*, which is the entire product thesis of optimizing *the player's* objective rather than a leaderboard's. Maximum DPS is kept precisely to make that contrast legible (§3.1).

---

## 4. Floor constraints — exclusion, not penalty

Floors are Pro-mode **hard constraints** (`FloorConstraint`, `src/metrics.ts:87-90`): metric ≥ `min`. `evaluateFloors` (`src/score.ts:93-107`) collects every violation into `violatedFloors`, and both `scoreBuild`/`scoreCandidate` set `belowFloor = violatedFloors.length > 0` (`src/score.ts:130`, `181-183`).

The critical semantic — spelled out in the type doc (`src/metrics.ts:86-90`) and the field doc (`src/score.ts:60-64`):

> A candidate that violates a floor is **excluded from ranking**, not merely ranked low. Ranking surfaces MUST filter `belowFloor` candidates out before sorting by `weightedScoreDelta`.

This is a categorical difference from a penalty. A penalty says "this is worth less"; a floor says "this is **off the table** regardless of how good it looks on every other axis." Hardcore Survivability makes the point (`src/presets.ts:74-100`): a candidate that adds 5M DPS but drops EHP below the 40k floor is `belowFloor = true` and is dropped — its enormous DPS gain never gets a chance to win. Encoding this as a floor rather than a large negative weight guarantees no combination of other gains can ever "buy back" a build that would get you killed.

**UX floor cut-line.** This feeds a visible cut-line in the recommendation UI: `belowFloor` candidates render below (or hidden behind) a "violates your floor: EHP 35k < 40k required" divider, using `violatedFloors` (`metric`, `min`, `actual`, `src/metrics.ts:92-97`) as the human-readable reason. The optimizer surfaces the *safe frontier* first; floor-breakers are shown only as an explicit "risky" disclosure, never mixed into the ranked list. Test `src/score.test.ts:134-148` demonstrates the mechanic: given a risky-but-high-raw-score candidate and a safe one, filtering `belowFloor` before sorting removes the top *raw* option and leaves only the safe candidate.

---

## 5. Golden orderings — the S5 acceptance evidence

Reference: **`packages/preference-engine/src/score.test.ts`** (19 tests, all green). The S5 acceptance criteria (PRODUCT_PLAN §109: "fast-mapper weights must rank a movement-speed boot swap above a pure-DPS ring swap; boss-carry weights the reverse") are proven by golden orderings 1–3.

Shared fixture (`src/score.test.ts:15-42`): a middling fast-mapper `BASE` (600k DPS, +20% MS, 30k EHP) with two mutually exclusive candidate swaps holding everything else equal — `bootSwap` (pure movement: +20% → +50% MS) and `ringSwap` (pure DPS: 600k → 900k).

**Golden ordering 1 — the same swap flips by goal** (`src/score.test.ts:50-78`):
- Fast Mapping ranks **boot > ring** (`weightedScoreDelta` boot > ring) — movement weight 0.28 dominates and damage is near its low band.
- Boss Farming **flips** to **ring > boot** — damage weight 0.42 dominates and 600k is far below the 2.5M band, so DPS gains are steeply rewarded while movement is nearly irrelevant (weight 0.03).
- The combined assertion (`src/score.test.ts:65-77`) proves the ordering *genuinely* flips: same two candidates, opposite ranking, driven only by the weight/band vector. **This is the headline S5 result** — priorities, not raw stats, decide "better."

**Golden ordering 2 — satisficing kills overkill** (`src/score.test.ts:80-108`):
- Boss Farming, base already above the 2.5M band: +20% DPS (3.0M → 3.6M) yields `|weightedScoreDelta| < 0.01`, and the Damage axis contributes **exactly 0** (`dmg.weightedDelta === 0`) — both endpoints satisfice to 1.0, delta 0.
- The *same* +20% DPS *below* the band (600k → 720k) is clearly rewarded (`delta > 0.5`).
- Maximum DPS (`enough = null`) keeps rewarding the overkill (`delta > 0.5`) — the contrast that proves satisficing is what suppresses overkill, not some scale artifact.

**Golden ordering 3 — floors exclude** (`src/score.test.ts:110-149`): a candidate dropping EHP below Hardcore's 40k floor is `belowFloor = true` with a `totalEHP` violation; a safe candidate is not; and filtering `belowFloor` before sorting removes the top raw-score option (§4).

**Golden ordering 4 — determinism + decomposition integrity** (`src/score.test.ts:151-178`): identical inputs → identical output; per-axis decomposition sums *exactly* to the total for every preset; `scoreBuild` contributions sum to a Weighted Score in `[0,100]`.

Together these are the validation evidence that the scoring *philosophy* — weighted, satisficing, floor-gated, explainable — behaves as the pivot requires.

---

## 6. Open tuning questions for the founder

These are calibration, not correctness — the shape is validated; the constants are placeholders.

1. **Scale calibration against real engine numbers (blocked on S1).** Every value in `DEFAULT_AXIS_SCALES` (`src/normalize.ts:17-40`) and every preset `enough` band (`src/presets.ts`) is hand-set to be sane for **MockEngine-scale** outputs. Once S1 lands the real PoB2 engine, we must re-fit them against actual FullDPS / TotalEHP / rate distributions per content tier. Concretely: what is "enough" DPS to *actually* clear a T16 map vs. kill a pinnacle boss in a target time? What EHP survives current one-shots? Until then the orderings are directionally right but the absolute 0–100 numbers are not yet meaningful. **Recommend: build a small calibration harness that sweeps real fixture builds through the engine and back-solves each band from observed clear/kill outcomes.**

2. **Per-archetype preset tuning via the Context Detector.** Presets today are global. The Context Detector (RFC-0001 §8.2; PRODUCT_PLAN §"The Context Detector") is meant to *suggest* weights per archetype before the user touches a slider — e.g. a Twister Huntress that "moves by attacking" should suggest Attack Speed = high, Movement Speed = low, mapping onto the Skill Mobility Efficiency composite (`src/normalize.ts:131-141`). Open question: do we ship archetype-specific *preset variants*, or a detector layer that *nudges* the six base presets? The composite axes (Skill Mobility, Survivability, Resource Sustain blend ratios `0.75/0.25`, `0.65/0.35`, `0.5+0.5·afford`) are also archetype-sensitive and are candidates for detector-conditioned tuning.

3. **Composite blend weights.** The three fixed blends — Survivability `0.75·EHP + 0.25·hit`, Resource Sustain `0.65·regen + 0.35·pool`, Skill Mobility `throughput·(0.5 + 0.5·afford)` — are reasoned defaults, not measured. Worth a founder gut-check once real builds exist: is one-shot protection really 25% of survivability? Is the mobility affordability floor really 0.5?

4. **Preset coverage.** Six of the ten presets named in PRODUCT_PLAN §78 ship. Confirm which of the remaining (Party carry with 6-player damage scaling, Smooth gameplay feel, Speed clearing, Tanky) are Phase-1 priorities and what their bands should be — Party carry in particular needs a *scaled* damage target, not a max.

---

## Appendix — verification

- Source read in full: `axes.ts`, `normalize.ts`, `presets.ts`, `score.ts`, `metrics.ts`, `index.ts`, `score.test.ts`.
- `pnpm --filter @exilelab/preference-engine test` → **19 passed** (2026-07-05).
- Every formula/number above is cited to `packages/preference-engine/src/<file>:<line>`. No external calls, no LLM, deterministic TypeScript only (compliance charter §7.5; RFC-0001 I-series).
