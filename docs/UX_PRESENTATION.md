# PRESENTATION.md — How ExileLab Presents Itself
**The presentation layer for the Intelligent Build Optimization Layer**

| | |
|---|---|
| Status | v1 — presentation/UX vision, post-pivot |
| Date | 2026-07-03 |
| Depends on | `PLAN.md` v2 (architecture, pivot applied), `PRD.md` (product spec), pivot PDF |
| Doc hierarchy | PRD = what/why · PLAN = strategy/architecture · **PRESENTATION = how the user sees and touches it** |
| Scope | Information architecture, core screens, component system, visual language, interaction flows, freemium presentation, LLM-narration presentation |
| Out of scope | Visual design assets (mockups/Figma), copywriting, marketing site |

---

## 1. Presentation thesis

One sentence: **the product looks like a diagnosis, not a spreadsheet.**

Path of Building already exists and is free. poe.ninja already exists and is free. We cannot win by showing *more numbers* — we win by showing **the three numbers that matter to this player, why they matter, and exactly what to do about them**. Every screen is built around that hierarchy:

1. **Verdict first** — a score, a grade, or a delta, in one glance.
2. **Evidence second** — the deterministic engine numbers that produced the verdict, one click away, never hidden.
3. **Action third** — a concrete, apply-able change (node path, item swap, gem re-link) with its cost.

Three presentation laws that follow from the pivot:

- **Law 1 — The sliders are the product.** The preference axes are not a settings page; they are the primary, always-visible control surface. Moving a slider visibly re-ranks everything on screen in under a second. This is the "aha" moment and the demo clip; it must never be buried behind a modal.
- **Law 2 — Never shame the build.** The context detector exists so we never tell a Twister Huntress her attack speed is "wasted." Tone is coach, not judge: "Your build prioritizes X — here's how to get more of what *you* want," never "your build is bad."
- **Law 3 — Math wears the crown, the LLM holds the coat.** Deterministic numbers are typographically primary (big, monospaced, colored). LLM narration is visually secondary (callout card, marked as generated, collapsible). The user must never be unsure which is which.

---

## 2. Who we steal from (reference presentation patterns)

These are the proven patterns the design is assembled from. Each is a pattern we adopt *and adapt* — cited here so a designer knows exactly what to look at.

### 2.1 Raidbots (WoW sim service) — the business-model UX
The closest analog: server-side compute, freemium queue, paste-to-import. Steal:
- **Named products, not features.** Raidbots sells "Quick Sim," "Top Gear," "Droptimizer" — each a card on the home screen with a one-line promise. We do the same: **"Tune"** (preference optimizer), **"Doctor"** (diagnosis), **"Compare"** (vs public builds), **"Upgrade Finder"** (score-per-divine). Four verbs, four cards, zero learning curve.
- **The result bar chart.** Top Gear's horizontal bar chart — each candidate item a bar, length = DPS gain, sorted descending — is the single most legible "what should I change" visualization in gaming. Ours is the same chart with **weighted-score gain** as the bar length and a secondary faded bar for raw DPS, so the player sees both "best for me" and "best on paper."
- **Honest queue presentation.** Free tier shows queue position and a progress bar with an estimated wait; premium shows "priority." The upgrade prompt lives *inside the wait state* ("skip the queue"), which converts without dark patterns. We copy this verbatim — it is compliant with our charter and proven at scale.
- **Permalink reports.** Every result is a shareable URL that renders read-only for non-logged-in visitors. This is our primary acquisition loop: a Doctor report or a Tune result pasted into a guild Discord *is* the marketing.

### 2.2 Mobalytics GPI — the multi-axis score
- **The radar chart as identity.** GPI's spider chart made "your playstyle, visualized" a product. Our 8 preference axes map perfectly onto a radar: **one polygon = what your build currently delivers, a second overlaid polygon = what your sliders say you want.** The gap between the two polygons *is the product's value proposition drawn as a picture.* This chart is the centerpiece of the build overview screen and the social-share image.
- **Top-3 focus, not top-30 dump.** Mobalytics never lists every weakness; it picks the highest-leverage 2–3 and frames each as a card with "why it matters" + "what to do." Doctor adopts this: findings beyond the top 3 collapse under "Show all findings (12)."
- **Coaching tone.** Weaknesses phrased as opportunities with severity, not failures. Copy guideline: every finding leads with the *gain* ("+18% effective HP available"), not the deficiency ("your chaos res is terrible").

### 2.3 WoWAnalyzer — the diagnosis report
- **Checklist with severity thresholds.** Each rule renders as a row: colored severity chip (✅ pass / 🟡 minor / 🟠 major / 🔴 critical), one-line statement, expandable "why + how we computed this." Doctor's report page is structurally identical.
- **The grade is honest about its scope.** WoWAnalyzer grades *what it can measure* and says so. Our Doctor states its basis: "Graded against level-92 mapping content with your Config settings" — with the config inline-editable right there.

### 2.4 poe.ninja + Path of Building + pobb.in — the native dialect
PoE players have a visual dialect; violating it reads as "made by someone who doesn't play." **Must keep, non-negotiable:**
- **Item tooltips** in the canonical format: dark panel, rarity-colored header (normal/magic/rare/unique), implicit line, separator, blue-tinted explicit mod lines. Rendered identically to in-game/PoB. (Engine data gives us everything needed.)
- **Stat color language**: fire=red, cold=blue, lightning=yellow-white, chaos=magenta, life=red, mana=blue, ES=silver — in stat panels and diffs.
- **Green/red delta convention** from PoB's Compare tooltip: `+1,240 Total DPS` green, `-312 Effective HP` red, rendered as changed-lines inside tooltips and stat panels. Players already read this fluently; our entire diff system is this convention, systematized.
- **The passive tree looks like the passive tree.** PixiJS renders the real tree assets (we have `TreeData/`). No abstract graph re-imaginings.
- **The left-rail stat panel** (PoB's sidebar of grouped colored stats) as the "evidence" layer — familiar, dense, scannable.

**Where we diverge (deliberately):** everything *around* those artifacts is modern SaaS — clean type (a humanist sans for UI, keeping serif display only for page titles to nod at PoE), generous whitespace, shadcn components, no faux-parchment textures. Dark theme is the default and the primary theme (players live in dark UIs); light theme ships but is secondary. The product should feel like **Linear wearing a Path of Exile ring**, not like a fan site from 2014.

### 2.5 Genshin Optimizer / stat-weight tools — the constraint UI
For power users: the pattern of **"floor + maximize"** (satisficing) presented as *constraint rows*, not sliders — "Effective HP ≥ 60k, then maximize weighted score." We expose this as the **Pro mode** of the preference panel (see §4.2).

---

## 3. Information architecture

```
exilelab.app
│
├── /                     Landing: paste box + 4 product cards (Tune/Doctor/Compare/Upgrades)
│
├── /b/{buildId}          THE BUILD WORKSPACE (one build = one URL, shareable)
│   ├── Overview          radar chart, context badge, headline stats, top-3 doctor flags
│   ├── Tune              preference sliders/presets → ranked change list → apply/preview
│   ├── Doctor            full diagnosis report (checklist + severity + fixes)
│   ├── Compare           user build vs N public builds of same archetype (diff table + tree overlay)
│   ├── Upgrades          budget upgrade finder (score-per-divine bar chart)
│   ├── Details           full PoB-style evidence layer: stat panel, tree viewer, items, skills, config
│   └── History           snapshots of this build over time (premium)
│
├── /r/{reportId}         Read-only shared report (any tab's result, frozen + attributed)
├── /account              profile, linked GGG account (OAuth), subscription, API usage
└── /goals                preset gallery (fast mapping, boss farming, HC survivability, …)
```

Rules:
- **One build, one URL.** Everything about a build lives under `/b/{id}` as tabs, so context (sliders, config, detected archetype) persists across features. No feature is a separate silo.
- **Import is not a page, it's a box.** The landing paste box accepts *anything* — PoB share code, pobb.in / maxroll / poe.ninja / mobalytics URL, or a character name via "import from account" (OAuth). Source detection is automatic; the user never picks a format from a dropdown.
- **Attribution is part of the layout.** Any build or comparison sourced from a public platform renders a persistent source chip ("via Maxroll — view original guide ↗") in the build header. This is a compliance-charter requirement (PRD §7.5) *and* good citizenship; it is styled as a feature, not fine print.

---

## 4. The core screens

### 4.1 Build Overview — "the verdict screen"

The first thing seen after import. Layout, desktop, three zones:

```
┌────────────────────────────────────────────────────────────────────┐
│  [Lvl 91 Deadeye]  Twister Huntress   ⚡ archetype: speed-mapper    │
│  via pobb.in ↗ · patch 0.5 · imported 2m ago          [Re-import]  │
├───────────────────────┬────────────────────────────────────────────┤
│                       │   YOUR BUILD, MEASURED                     │
│    RADAR CHART        │   1.9M  Twister DPS        (bell curve pos)│
│  (delivers-polygon    │   42k   Effective HP       vs archetype    │
│   vs wants-polygon,   │   -34%  Chaos Res  🔴                      │
│   8 axes)             │   118%  Movement (incl. attack-as-move)    │
│                       │                                            │
│  [goal preset chip:   │   TOP FINDINGS                    Doctor → │
│   "Fast Mapping" ▾]   │   🔴 Chaos res leaves you one-shot to …    │
│                       │   🟠 4 passive points recoverable at …     │
│                       │   🟡 Flask uptime 61% — sustain axis low   │
├───────────────────────┴────────────────────────────────────────────┤
│   [ Tune my build ]   [ Full diagnosis ]   [ Compare to top builds ]│
└────────────────────────────────────────────────────────────────────┘
```

Presentation details that matter:
- **The context badge** ("archetype: speed-mapper — attack speed detected as mobility") is displayed *before* any judgment, with a hover explaining how it was detected and a one-click "wrong? pick archetype" correction. This is Law 2 made visible: the product proves it understood the build before it dares to advise.
- **Percentile positioning, not absolutes.** "1.9M DPS" means nothing to a casual; "1.9M — 68th percentile among Deadeye speed-mappers" means everything. Every headline stat gets a tiny inline bell-curve/percentile marker sourced from the aggregation service.
- The radar's two polygons (delivers vs wants) update **live** when the goal preset changes — this animation is the hero of the landing-page demo video.

### 4.2 Tune — "the slider screen" (the flagship)

Split view. Left rail: controls. Right: consequences. **The controls never leave the screen** (Law 1).

```
┌─────────────────────────┬──────────────────────────────────────────┐
│ WHAT DO YOU WANT?       │  RECOMMENDED CHANGES        score 71→84  │
│                         │                                          │
│ Preset: Fast Mapping ▾  │  ████████████████ +9.2  Re-path: drop    │
│                         │    3 nodes at X, take Whirling Barrier   │
│ Damage        ●━━━━ 65  │    [tree preview] [apply]                │
│ Survivability ━●━━━ 40  │  ███████████ +6.8  Swap boots: yours →   │
│ Move speed    ━━━●━ 80  │    +35% ms / Tailwind base  ~2 div       │
│ Attack speed  ━━●━━ 60  │    [item diff] [find on trade ↗]         │
│ Cast speed    ●━━━━ 10  │  ██████ +3.1  Gem: swap support X for Y  │
│ Mobility eff. ━━━●━ 75  │  ████ +2.4  …                            │
│ Sustain       ━●━━━ 45  │                                          │
│ Currency eff. ━━●━━ 55  │  ─ won't suggest: -EHP below your floor ─│
│                         │                                          │
│ ▸ Pro: constraints      │  [Preview all on tree]  [Export to PoB]  │
│   EHP ≥ 40k  ✎          │                                          │
└─────────────────────────┴──────────────────────────────────────────┘
```

- **Presets first, sliders second.** Casuals pick a preset chip ("Fast Mapping") and never touch a slider; the sliders visibly move to the preset's weights so the mapping is learnable. Power users drag. **Pro mode** adds satisficing constraint rows ("EHP ≥ 40k, then maximize") — the Genshin Optimizer pattern.
- **Slider moves re-rank in <1s.** This is why PLAN.md's S1/S5 spikes gate everything: cached engine deltas re-scored client-side against new weights means re-ranking is instant; only *new* candidate generation hits the queue.
- **Each recommendation is a Raidbots bar**: length = weighted-score gain, with sub-bars on hover decomposing the gain per axis ("+11 move, −2 damage, +0.4 sustain"). Cost chip (divines) on gear suggestions, wired to the price layer.
- **The floor line.** Suggestions that would violate the survivability floor render *below a labeled cut line*, greyed: "won't suggest — drops you below your EHP floor." Showing what we *refused* to recommend builds more trust than the recommendations themselves.
- **Every suggestion has an exit ramp**: `[apply]` (mutates the working copy, adds an undo-able entry to a change stack), `[Export to PoB]` (share code with changes applied), `[find on trade ↗]` (deep-link to official trade site — user-initiated, per compliance charter).

### 4.3 Doctor — "the report screen"

WoWAnalyzer's checklist, in PoE's dialect:

- Header: overall **letter grade per category** (Offense / Defense / Sustain / QoL), each grade a chip that expands to its rules. Grades are goal-aware: graded against the *active preset* ("B for Fast Mapping — would be D for Hardcore").
- Body: severity-sorted finding rows. Each row = severity chip + plain-language statement + **the deterministic evidence inline** ("MaximumHitTaken vs chaos: 4,120 — Xesht slam deals ~11k") + expandable fix options (each fix is a Tune-style suggestion with score delta).
- Footer: the **LLM narration card** — a single distinctly-styled callout ("✨ Summary — generated") that reads the findings back as two sentences of coach-voice prose. Collapsible, cached, killswitch-able (PLAN.md), and *never* contains a number that isn't in the findings above it.

### 4.4 Compare — "the diff screen"

User's build in column one, 2–4 public builds of the detected archetype in the next columns (each with source chip + attribution link).

- **Stat diff table**: rows = key stats, cells green/red-shaded vs the user's column (PoB Compare convention, systematized). A "weighted score under *your* sliders" row sits at the top — public builds are re-scored against the *user's* preferences, which is the pivot's whole thesis in one row: *the "best" build on poe.ninja might score below yours for what you want.*
- **Tree overlay diff**: one tree, three node colors — allocated by both (dim gold), only yours (blue), only theirs (green) — with a legend and per-cluster "adopt this branch" affordances. Never two trees side-by-side (unreadable at tree scale).
- **Gear diff**: slot-by-slot paired tooltips with changed mod-lines highlighted.
- Steal-one-thing flow: any difference row has `[try this]` → applies to working copy → score delta appears immediately.

### 4.5 Upgrades — "the shopping screen"

The Raidbots Droptimizer analog and the premium anchor:
- Input: budget stepper ("I have **10 div** to spend") + slot filter.
- Output: one bar chart, bars = candidate changes, length = **Δweighted-score per divine**, cost chip on each bar, hover decomposes per-axis. Below the chart, the same items as rows with full tooltips and `[find on trade ↗]` deep links.
- Free tier: top result visible, rest blurred with count ("+9 more upgrades — Pro"). Blur-with-count converts better than hiding and is honest about what exists.

---

## 5. Component system (build once, use everywhere)

Eight primitives carry the entire product; every screen above is a composition of these:

| # | Component | Used in | Definition |
|---|-----------|---------|------------|
| 1 | **StatDelta** | everywhere | `label · value · signed colored delta` row; PoB green/red convention; tabular monospaced numerals |
| 2 | **ScoreBar** | Tune, Upgrades, Compare | horizontal gain bar with per-axis decomposition on hover + cost chip |
| 3 | **PreferencePanel** | Tune, Overview, Doctor header | preset chips + 8 sliders + Pro constraint rows; emits weights; collapsible to a one-line summary chip elsewhere |
| 4 | **RadarChart** | Overview, share images | delivers-polygon vs wants-polygon, 8 axes, animated on weight change |
| 5 | **FindingCard** | Doctor, Overview | severity chip + statement + inline evidence + expandable fixes |
| 6 | **ItemTooltip** | everywhere | canonical PoE tooltip renderer, with optional diff-highlight mode |
| 7 | **TreeViewer** | Tune, Compare, Details | PixiJS canvas; modes: view / diff-overlay / path-preview; node hover = real node tooltips |
| 8 | **AICallout** | Doctor, Tune, Compare | the *only* container LLM text ever appears in: ✨ icon, "generated" label, distinct border, collapse control |

Plus two chrome-level patterns: the **source-attribution chip** (build header, report footer) and the **queue/compute meter** (header pill showing runs remaining / queue state, which doubles as the upgrade entry point).

---

## 6. Presenting the freemium line

Rules (Raidbots-derived, compliance-friendly):
- **Gate depth, not correctness.** Free users get true, complete answers at lower resolution: top-1 suggestion per category, standard queue, 1 saved build. Never a degraded/wrong answer.
- **The paywall is always contextual and always countable.** "+9 more upgrades — Pro", "skip the 40s queue — Pro", never an interstitial modal ambush.
- **Pro is visible as speed and depth**, not as removed annoyances. No ads in the free tier that Pro removes (ads would also poison the "premium tool" positioning).
- League Pass ($9.99, 2 months) gets its own chip at league start — presented as "league-long Pro" on the landing page during launch windows.

## 7. Presenting the LLM (trust rules)

1. LLM text appears **only** inside `AICallout` — never inline with engine numbers, never in a tooltip, never in a stat panel.
2. Every callout is labeled *generated* and carries a hover: "Narration is AI-generated from the deterministic results above. The numbers are computed, not generated."
3. The LLM never introduces a number, item name, or node name that isn't in the structured findings it narrates (enforced by the strict-schema pipeline in PLAN.md; the UI contract assumes it).
4. Kill-switch degradation is invisible: callouts simply don't render; no broken states.
5. No chat interface in v1. Chat invites open-ended questions the deterministic engine can't answer, which manufactures hallucination surface. Narration is one-way.

## 8. Responsive & performance posture

- **Desktop-first, mobile-honest.** Theorycrafting happens on desktop; on mobile we present *reports* beautifully (Overview, Doctor, shared `/r/` links — the Discord-click case) and disable heavy editing (tree diff view-only, sliders work, apply works). Breakpoint behavior: the split Tune view stacks, controls become a bottom sheet.
- **Tree canvas budget**: PixiJS scene ≤ 16ms frame on a 2019 laptop; degrade to static pre-rendered tree PNG with SVG overlay on weak GPUs (the poe.ninja approach).
- **Skeletons match the final layout** (no spinner-only states); import shows a staged progress line ("fetching → parsing → calculating (queue #3) → scoring") because engine calls are genuinely multi-second and honesty beats a fake spinner.
- Share pages (`/r/`) are statically rendered with OG images (the radar chart + headline stats as the social card — the radar *is* the brand image).

## 9. Voice & tone (micro-copy rules)

- Coach, never judge: "you can recover 4 points here" not "you wasted 4 points."
- Respect the archetype: recommendations phrased relative to *their* goal ("for faster mapping…"), never absolute ("optimal is…").
- Numbers are exact, claims are scoped: "graded for tier-15 mapping with your config" not "your build is B-tier."
- PoE-literate but not memey: use the game's real terms (ES, EHP, ailment, avoidance); no forced slang.
- Attribution copy is warm: "based on {author}'s Maxroll guide — see the full guide ↗" (partnership posture, per PLAN.md compliance notes).

## 10. Open presentation questions (for design phase)

1. Radar chart with 8 axes may be 2 too many for legibility — test 8 vs 6 (merging attack/cast speed into "action speed", mobility-efficiency into movement) with real players.
2. Slider scale presentation: 0–100 numbers vs unlabeled notches — do numbers invite false precision?
3. Tree diff overlay colors must survive the tree's own gold/teal palette *and* colorblindness — needs a real palette pass on actual tree assets.
4. Whether Compare shows public builds' *character names* or anonymizes to "top ladder Deadeye #3" — leaning attribution-with-name for guide-sourced builds (it's the partnership posture) and anonymized for ladder-scraped ones. Decide with legal/compliance review in S6.
5. OG share image pipeline (radar + stats) — build in Phase 1 (cheap, high leverage) or defer to Phase 2? Leaning Phase 1.

---

*Consistent with PLAN.md v2 (pivot applied): no Build Market screens exist in this document. The preference panel is the product's face; comparison and aggregation surfaces carry mandatory attribution; all trade interactions are user-initiated deep links per the compliance charter (PRD §7.5).*
