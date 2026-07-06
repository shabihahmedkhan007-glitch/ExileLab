# ExileLab — Product Recovery Design Review

**Date:** 2026-07-06
**Author:** Office of the CEO — founding product synthesis
**Status:** Decision document. It supersedes the "verdict-first / we cannot win by showing more numbers" thesis of the prior UX presentation doc, and it names where it does so.
**Sources:** Six cross-examined internal design reviews (veterans, ux-research, information-architecture, cognitive-psychology, product-strategy, systems-thinking); first-hand code verification of `frontend/web` and `backend/api`; `EXILELAB_REVIEW_PACK.md`. Every load-bearing claim below is anchored to a file:line I verified against source, not to a team's say-so.
**Revision:** Corrected after an adversarial red-team audit (2026-07-06) that independently re-verified the citations. The strategic direction survived intact; the audit's material corrections are folded in: the stat floor is split into Floor v1 (one small backend projection widening) and Floor v2 (genuine engine + normalizer work — Spirit, DoT decomposition); the passive tree is acknowledged as a real data-acquisition workstream; R8 (mock-engine trust risk) added; the litmus test is phase-aware; on-canvas motion is scoped to candidate-delta highlighting. The original "zero backend" framing was wrong and is retracted.

---

## 1. Executive Summary

The founder's hypothesis — "the UI accidentally hides the build and promotes the report" — is **confirmed, and the reality is worse than the hypothesis and cheaper to fix than anyone feared.**

Worse, because the build is not hidden; it is **discarded.** The backend serves the full canonical snapshot to the browser on every workspace load and the frontend re-types it `snapshot: unknown // opaque to the UI` (`types.ts:98`) and throws it away. The shipped `/b/{id}` is five report tabs (`page.tsx:30-37`) with no tree, no gear panel, no gem-link view, no config surface, and — the cardinal sin for any Path of Exile tool — no resistances at a glance. It took a build code as input and never draws the character again. It became analytics-for-builds when its reason to exist is a workbench-for-builds.

Cheaper, because I verified the three facts that reset the cost calculus — stated here with the honest boundaries a red-team audit forced onto each:

- **The build is already in the browser.** Rendering gear, gems, and config is pure view-layer work over data already delivered (`backend/api/src/services.ts:129` types `snapshot: CoreSnapshot`; `:424` sends it). One genuine data dependency remains: the **passive tree** needs a bundled, patch-versioned PoE2 tree dataset (node names, coordinates, base image) that exists nowhere in the repo today — a real acquisition-and-maintenance workstream, not a rendering detail.
- **Most of the stat floor is one small backend change away — not zero-backend.** The engine boundary computes structured `resists.{fire,cold,lightning,chaos}` vs cap, `energyShield`, Life, and per-type max-hit (`outputs.ts:106-153`) — but `toStoredResult` projects them away (`outputs.ts:174-184`) before the frontend payload is assembled, so the browser receives only the flat six-metric slice. Surfacing them requires a **small, explicit backend change** (widen the projection, or add an `outputs` field to `BuildDetailResponse`) — cheap, but it must be named. **Spirit and decomposed DoT/ailment DPS are not computed anywhere in the stack today** (the normalizer drops the raw `resources` block; the engine emits a single `dps`) — they are genuine engine + normalizer work, scheduled as such, never promised as free.
- **The score's math already ships.** Every recommendation carries `perAxis: {baseNormalized, candidateNormalized, weight, weightedDelta}` (`types.ts:107-124`). The verdict is one render away from its own derivation.

So the diagnosis is not seven cosmetic failures. It is **one root cause and two precise defects.** The root cause is opacity: once the build is discarded, a report-first dashboard is the only thing left to draw, so the "feels like Mobalytics" complaint is a *symptom*, not an independent taste failure. The two defects are: (1) the build substrate is discarded at the view boundary, and (2) applying a change is a full page navigation (`onApply → api.promote → router.push`, `page.tsx:131-145`) instead of an in-place edit, discarding all live state and re-hitting the metered engine.

**The prescription is a single inversion, not a rewrite.** Invert the z-order: make the build the persistent, matte substrate on screen at all times, and recast every current report — score, radar, findings, tune-bars, Doctor grades — as translucent annotation *painted onto* the build. The intelligence was never wrong to exist; it is the moat. It was **miscast** — promoted from overlay to artifact while the artifact was demoted to a blob. We invert the z-order; we do not delete the reports. **The backend work is small and named: one projection widening now; Spirit/DoT decomposition with the engine sidecar later.**

The one load-bearing sentence, from which every downstream decision is answered:

> **The build is the product. The intelligence is the overlay.** If a feature can only exist by hiding the build to show a report, it is misdesigned.

---

## 2. Biggest Product Mistakes

These are strategic — decisions about *what the product is*. Each is verified in code.

**M1 — The build artifact is absent, not merely de-emphasized.** `page.tsx:30-37` ships exactly five report tabs (Overview, Tune, Compare, Upgrades, Doctor). There is no tree renderer anywhere in the codebase, and the canonical `ItemTooltip.tsx` is imported only by `ItemSwapPanel` — the user's own equipped gear is rendered by it **zero times.** The product is ~100% report, 0% artifact. The Grammarly move (intelligence annotating an artifact you are looking at) was replaced by the Google-Analytics move (a summary of an artifact you cannot see).

**M2 — The build is thrown away while fully in hand.** `snapshot: unknown` (`types.ts:98`) is the whole disease in one line: the complete tree/gear/gem/config payload arrives every load and the UI deletes it at the boundary. This is the actual reason the IA drifted into a SaaS dashboard — with the artifact opaque, a report is the path of least resistance. Fix the opacity and the dashboard-vs-workbench problem dissolves on its own. Every other fix downstream of this is cosmetics on a scorecard.

**M3 — Apply is a navigation, not an edit — the UI betrays an architecture the backend got right.** The backend already models build = immutable document, mutation = pending diff, promotion = commit (RFC-0001). The UI discards that isomorphism at exactly one boundary: `onApply` hard-navigates to a fresh URL (`page.tsx:131-145`), and the destination re-runs `getBuild + tuneByPreset + doctor` from scratch, so every accepted change is a full reload that re-hits the metered engine and destroys all live lens state. There is no change-stack, no undo, no diff-vs-imported — the exact iteration loop that separates a workbench from a viewer.

**M4 — The moat is dressed as the incumbent it must beat.** The genuinely differentiated intelligence — the Weighted-Score-under-*your*-weights, the satisficing target-bands, the "won't suggest — below your floor" cut-line — is wrapped in the visual costume of Mobalytics and Raidbots. It is miscast, not wrong. A streamer shown this today says "slick build-analyzer dashboard," not "Path of Building evolved," because there is no build on screen to evolve.

**M5 — The headline number can be zeroed by the optimizer having nothing to say.** `liveBaseScore` reads `recs[0]` and returns `0` when the recommendation list is empty (`Overview.tsx:53`; `scoring.ts:97-98,110-113`). A perfectly good build the optimizer has no suggestions for renders as **"0/100, delivers nothing"** at `text-5xl`. The product's largest, first-read object is transport-coupled to a list it should be independent of.

---

## 3. Biggest UX Mistakes

These are experience-level — what the user feels in the first sixty seconds and every session after.

**U1 — The post-import destination is a verdict screen.** After paste, the workspace opens on Overview — its own header calls it "the verdict screen" — a `text-5xl` score (`Overview.tsx:71`) over a radar, before a single passive node or item is visible. The first question a veteran asks a tool that grades their work — *"did it parse MY build correctly?"* — is unanswerable in the UI. Trust in a judging tool is sequenced: prove you saw the build, *then* judge. This inverts the sequence.

**U2 — Resistances are nowhere at a glance.** `Overview.tsx:88-124` hardcodes six tiles — Full DPS, Effective HP, Movement, Attack rate, Max hit taken, Unreserved mana — with **no fire/cold/lightning/chaos row.** Resistance surfaces only *negatively*, as an overcap "wasted stat" finding. A PoE tool that cannot show chaos res in the first glance is dead on arrival; the product's own docs make "-34% chaos res, this is why you die" the marquee example, then never render it.

**U3 — Detection changes zero displayed stats — the sharpest "doesn't play" tell.** The `ContextBadge` claims to detect the archetype, yet `Overview.tsx:108-113` renders a hardcoded **"Attack rate {m.attackRate}/s" tile, in lightning-yellow, for every build** — including the dot-caster fixture, an Essence Drain chaos-DoT Witch for which attack rate is meaningless. There is no DoT DPS, no hit-vs-DoT split, no poison/ailment stack readout. Detection that reshapes nothing reads as fake. This single tile is the most surgical proof the UI is a report skin, not a workbench.

**U4 — The build's composition is invisible: gems, config, Spirit.** No component renders skill gems or support links, though the dot-caster's Essence Drain + four supports and its auras sit in the payload. The only combat-config control in the entire workspace is Doctor's bare map-tier +/- stepper — the fixture's `enemyIsBoss: true` is neither shown nor editable, so the DPS figure runs under hidden, unreproducible assumptions. And Spirit — *the* defining PoE2 mechanic — appears zero times, though `spirit / spiritReserved / energyShield` are right there in the snapshot's `resources` block.

**U5 — The five verbs are mutually-exclusive full-screen modes that destroy work.** `tab` is local `useState` (`page.tsx:44`); switching unmounts the previous view and its state. Import a rival into Compare, glance at Doctor, and the rival is gone — a re-paste and a re-run of a metered engine call. You can never see your tree while tuning or your gear while reading Doctor. The fixed spatial memory a veteran navigates PoB by — a stat lives in one place, always — is annihilated on every tab switch.

**U6 — The one genuine workbench moment is wired to prose.** Tune's slider fires a live client-side re-rank (the plumbing works; no fetch), but the only thing that visibly moves is the *order of a column of text ScoreBars.* The expensive, correct interactivity is built and pointed at a to-do list instead of at the build. The moat is "watch your build morph as you change what you value"; today it is "watch a to-do list re-sort."

---

## 4. Biggest Information Architecture Mistakes

These are structural — how the object model is composed onto screens.

**I1 — The object hierarchy is inverted.** `Overview.tsx:63-81` makes the Weighted Score + radar the first-read, top-left, `text-5xl` object; the build's own measured numbers are demoted to a second card literally labelled "Your build, measured." The verdict owns the center of every screen; the build owns the center of nothing.

**I2 — There is no ambient stat floor.** No screen carries an always-visible core-stats band. The four resistances + overcap, the Life/ES split, Spirit, EHP + max-hit-by-type, and the decomposed main-skill DPS — the numbers that decide whether a build is *playable* — are each a tab-switch away or absent entirely. In PoB these are ambient by law.

**I3 — Feature = page, not lens.** A single `tab` state swaps the entire content region; the only thing that persists across tabs is `weights`, never a build view. Navigation swaps the artifact *out* for a report instead of swapping the *annotation* over a persistent artifact. This is hub-and-spoke (Mobalytics), and it becomes twelve disconnected reports as the roadmap lands.

**I4 — The most build-native artifact is the least legible surface in the product.** The passive tree appears in exactly one place: Compare's `NodeChips`, rendering each diffed node as a chip whose label is the **raw integer node ID** (`CompareView.tsx:469`), capped at 28 with "+N more." No player can read "15423." Nobody who could render the tree would ever show a wall of integers — the chips exist *because* no tree surface exists to make them legible by recognition.

**I5 — The score is treated as the subject, not a lens.** A 0-100 composite under private preset weights is a navigation aid. Rendering it as the typographically dominant hero makes a lens into the subject and buries the raw, reproducible engine numbers (1.9M DPS, 42k EHP) the community trusts absolutely and re-derives in PoB.

**I6 — The one control surface is fractured across five silos.** The `PreferencePanel` sliders exist only inside Tune. Overview, Compare, and Upgrades cannot drag a weight; Doctor uses a parallel goal-chip. The signature "move the slider, the whole screen re-ranks" moment can physically happen on only one of five pages.

---

## 5. What PoB Gets Right

Path of Building is the standard we are measured against, and every property that earns its expert trust routes through one law it never breaks. Name the law, because ExileLab violated exactly it:

> **The artifact stays on screen and the intelligence annotates it.** The build — tree, items, gems, config, full stat panel — is the persistent document; every number is a readout on it, never a report that replaces it.

The specific properties that follow from that law, and that we must re-earn:

- **Numbers are never hidden.** The full stat panel is always present. Nothing the player needs is behind a verdict or a click.
- **Every number is reproducible and openable.** A veteran re-derives `1.9M DPS` from the tree and gear himself. That reproducibility *is* the trust currency — an un-openable number is indistinguishable from a guess.
- **Native dialect is exact.** Rarity colors, stat colors, green/red signed deltas, named passive nodes, monospaced mod text. These are load-bearing correctness, not decoration.
- **Fixed spatial memory.** A stat lives in one place, always, across every operation. Expert speed comes from *not having to re-read the UI.*
- **Config is part of the number.** The assumptions behind a DPS figure — boss, shock, charges, distance — are visible and editable, so the figure is reproducible.
- **Density is a feature.** For a 6,000-hour audience, high information-per-inch is the reward, not the regression.

PoB's weakness — the thing that leaves room for us — is that it **shows everything and judges nothing.** It hands you a wall of equally-loud, unranked numbers and no opinion about which three matter for how *you* play. That gap is the entire opportunity, and it is an *overlay* on top of everything PoB does right, never a replacement for it.

---

## 6. What We Should Keep

Much of this product is genuinely well-built. These survive the redesign intact; several are the moat. Keep them — and in most cases, *re-point* them at a build that is finally visible.

- **The paste-anything box + four verb cards** on the landing (`app/page.tsx`). Zero-onboarding import that mirrors PoB's paste-to-import. Keep as-is; it is not the problem.
- **The canonical `ItemTooltip`** — correct rarity colors and monospaced mod dialect. Keep, and finally *use it* to render the build's own equipped gear.
- **`StatDelta` + PoE stat colors + tabular numerals** — the right atomic primitive for honest, native readouts. Keep, and promote it into a dense grouped stat panel.
- **The Weighted-Score-under-*your*-weights thesis, and Compare's re-scoring of a rival below yours** (`CompareView` score row). This is the actual differentiator — the pivot in one number. Keep the idea; recast it as an overlay.
- **The "won't suggest — drops you below your floor" cut-line** (`TuneView.tsx:122-153`). Showing what the optimizer *refused* to recommend, and why, is more sophisticated than anything Raidbots does and the single best trust mechanism in the product. Keep and feature it.
- **The live client-side re-ranking** (`scoring.ts`). The one true direct-manipulation moment — the workbench seed. Keep it; re-point it from the prose list to the build.
- **The `AICallout` containment** (`DoctorView.tsx:136`): all LLM prose confined to one labeled, collapsible, kill-switchable card, never inline with engine numbers. "Math wears the crown, the LLM holds the coat." Keep untouched.
- **The `SourceChip` attribution** (`BuildHeader.tsx:41`) — compliance and good citizenship, styled as a feature. Keep ambient.
- **The `ContextBadge` archetype-before-judgment** (`BuildHeader.tsx:37`) — proving understanding before advising. Keep, and render the evidence it inferred from inline.
- **The goal presets and satisficing target-bands** (`/goals`) — PoE-literate and genuinely novel. Keep; foreground once the build is visible.
- **The honest synthetic-price disclaimers and kill-switch empty states** (`UpgradesView`). Degradation without broken states. Keep.
- **The backend narrow-waist** (snapshot / mutation / promote, RFC-0001). Excellent — the UI must *mirror* it, not replace it. It is the blueprint for the document-editor UI.
- **The two-surface split, already real in code:** `/b/{id}` as the one-build-one-URL workbench and `/r/{id}` as the frozen report (both exist). Keep the spine and extend it.

---

## 7. What We Should Never Copy

The patterns that make a tool read as a SaaS analytics product built by someone who doesn't play. Each is a rejection with a reason.

- **The verdict-as-hero** — a `/100` as the largest object on the screen (`Overview.tsx:71`). The most commodity, least-defensible pattern in the product; identical to every stats site's opinion. Never lead with it.
- **The radar as an analytical instrument.** Angle and area are the least-accurate quantitative encodings (Cleveland-McGill); its eight unlabeled axes carry the primary gap-read worst of any option. Keep it only as a brand glyph and the `/r/` share image — never as the analytical centerpiece.
- **SaaS violet** — `--color-accent: #8b7bff` (`globals.css:25`), the exact Linear/Superhuman signature, driving every button, the wordmark, the range thumb, and a page-wide radial vignette (`body::before`). PoE's vocabulary contains no violet. Never on the workbench.
- **Everything-is-a-card** — floating, equal-weight, rounded, filled tiles (`.card`, `globals.css:145-149`; `Overview.tsx` is four of them stacked). The card gestalt *is* the dashboard. Structure comes from rules and whitespace, not containers.
- **Colored chrome** — buttons and headers carrying brand color. A dashboard colors its chrome to look alive because its data is boring; a workbench lets the data be the only source of color. Chrome is monochrome.
- **Cool blue-black** — `--color-bg: #0a0b0f`, the dev-tool signature. PoE's dark is warmer. Never the Vercel near-black.
- **Gamification** — badges, confetti, mascots, celebratory motion. Never. This audience reads it as contempt.
- **A chat interface.** Open-ended chat manufactures a hallucination surface the deterministic engine cannot answer for. Narration stays one-way, inside the `AICallout`. Never a chat box.
- **Hover-lift, scale, glow, or shadow-grow on data.** Data does not levitate on mouseover. The card-hover-lift is a pure marketing tell.
- **Dialect errors** — raw node-ID integers (`CompareView.tsx:469`), or an attack-rate tile on a caster. These are typos in the reader's native language and the clearest "doesn't play" signal. Never.

---

## 8. New Product Philosophy

*This section and 9-11 derive from the accepted founding philosophy and visual language; they do not restate it, they operationalize it.*

**Position by triangulation, because the triangulation is the moat:**

> Path of Building shows you everything and judges nothing. Mobalytics judges everything and shows you nothing. **ExileLab shows you everything — and points at the three things that matter for how *you* play.**

**The mental model the user must hold:** *"This is my build, on a workbench. A very smart, very honest assistant stands next to it, pointing at what matters for how I play — and I can open the math behind every number it shows me, check it against desktop PoB, and undo anything it touches."*

**The load-bearing sentence, restated as the design test:** the build (its tree, gear, gems, config, and full stat panel — numbers included) is the persistent document on screen at all times; score, radar, findings, tune-bars, and Doctor grades are annotations painted *onto* that document. For any proposal, ask: *does this put the build more on screen and make the intelligence a more legible annotation on it?* If it replaces the artifact with a verdict, reject it.

**Three refinements of the founder's hypothesis, each load-bearing:**

1. **The build is not hidden — it is discarded** (`snapshot: unknown`, `types.ts:98`). The report is not over-promoted on top of a present build; it is the *only* thing rendered.
2. **The dashboard shape is a symptom, not the disease.** A report-first IA is the path of least resistance once the build is opaque. Fix the opacity and the dashboard-vs-workbench problem dissolves. This is why it is the highest-leverage finding: one root cause, not seven.
3. **The intelligence was miscast, not wrong.** Invert the z-order; do not delete the reports.

**The strategic contradiction I am explicitly overruling.** The prior UX doc's thesis — *"the product looks like a diagnosis, not a spreadsheet; we cannot win by showing more numbers"* — contradicts the founder's hypothesis, the evidence, and the backend's own document/diff architecture. I overrule it, and own that I am overruling stated strategy. The corrected law:

> We cannot win by showing numbers the way a raw PoB sidebar does — dense, unranked, all equally loud. But we also cannot win by showing *fewer* numbers than PoB — that makes us a scorecard a 6,000-hour player closes in ten seconds because he can't find his own chaos res. The differentiation is **the same numbers PoB shows, plus an overlay that tells you which three matter for your goal and what to do about them, with every number openable to its engine derivation.** "Verdict first" survives only as a *reading order* — the three-that-matter float to the top of a build that is fully present — never as "the verdict is the whole screen."

**What artifact-primacy looks like — seven visual laws, each a testable property of a screenshot, not a vibe:**

- **P1 — Depth encodes ownership.** The build canvas is an opaque, matte substrate at z0 — material you could touch. Every annotation (score chip, finding, tune-bar, candidate) is translucent, luminous glass at z1, casting a soft shadow onto the substrate, dismissible. Fatal findings are z2. From a *blurred* screenshot you must be able to tell which pixels are the build and which are the tool talking about it.
- **P2 — The size budget is spent on engine truth, never on verdicts.** The largest, boldest, most-colored object on any screen is an engine number a veteran re-derives in PoB (main-skill DPS, EHP, a red resist) — never the composite `/100`. Emphasis is zero-sum; spending it on the optimizer's number instead of the deterministic truth is the miscasting we are overruling.
- **P3 — Kill the card; group by rule and proximity.** On the workbench, structure comes from hairline rules, whitespace, and section labels over one continuous surface. A card says "self-contained report module"; a ruled section says "region of one instrument." Only overlays (P1's glass) get a border and shadow, because they genuinely float.
- **P4 — Annotation adjacency.** Intelligence is drawn *on the thing it concerns.* A finding about chaos res glows on the resist row; a candidate annotates the gear slot it replaces; a weighted node recolors in the tree. Position is the binding between overlay and artifact; break it and you are back to a report.
- **P5 — Color is earned, never ambient.** At rest a workbench is ~90% greyscale. Color appears only where the *engine* speaks: stat values in PoE dialect, green/red deltas, severity, rarity. Chrome is monochrome. The test: desaturate the screenshot — a workbench stays readable (color was data); a dashboard goes muddy (color was decoration).
- **P6 — Native dialect is the price of admission, not decoration.** Rarity colors, stat colors, named nodes, mod text. A dialect error is a typo in the reader's native language.
- **P7 — Restraint reads as expertise.** No glow, no gradient, no hover-lift on data. The confidence to leave the chrome silent is what separates an instrument from a product demo.

**The design invariants — violating any of these is a bug, not a taste disagreement:**

1. The build is always on screen. Navigation swaps the annotation, never the artifact.
2. Every number is one click from its engine derivation (scores → per-axis math, already in the payload; stats → contributing mods **once the real PoB2 sidecar lands** — the mock engine emits aggregates with no per-mod attribution, so this half of the invariant is gated on the sidecar and headline numbers are labeled preview/estimated until then; see R8). An un-openable number is indistinguishable from an LLM guess.
3. The mandatory stat floor renders before any verdict, every archetype, always ambient.
4. Detection reshapes presentation. A DoT caster shows DoT/ailment stats and no attack-rate tile. Detection that changes zero displayed stats is forbidden.
5. Math wears the crown; the LLM holds the coat. All generated text lives only inside one labeled, collapsible, kill-switchable `AICallout`. No chat.
6. Config is part of the number. The assumptions behind a DPS figure are always legible.
7. Editing is in-place and reversible. Immutability is a backend invariant, never an interaction one — git commits are immutable yet the editor shows one working tree.
8. Speak the native dialect everywhere. Never raw node-ID integers.
9. The score is a lens, not the subject — an expandable chip over the build, measured from the build's own payload.
10. Two surfaces, one object model. `/b/` is the dense workbench; `/r/` is the frozen report. The workbench never degrades into a report to serve the share loop.

---

## 9. New Information Hierarchy

Three tiers, enforced structurally — not by which tab you clicked.

| Tier | Definition | What lives here |
|---|---|---|
| **AMBIENT** (always on screen, never behind a tab) | The build document, the stats that decide whether it is playable, and the active goal | The build canvas (tree, gear grid, gem-link cards, config); the mandatory stat floor; the active goal chip; class/level/ascendancy + archetype badge; the source-attribution chip |
| **ON-DEMAND** (one interaction away, overlaid on the canvas) | The intelligence lenses and every drill-down | Weighted-Score chip → its per-axis decomposition; any stat → its contributing mods; the Tune rail; the full Doctor finding list; the Compare diff; the Upgrades shopping bars; candidate details |
| **INTERRUPTIVE** (pushes itself at you, unbidden) | Fatal Doctor findings only | One-shot-vulnerable, uncapped resist, broken sustain → a persistent banner on the canvas. Nothing else earns interruption. |

**What owns the center:** the build. On `/b/{id}` the build canvas is the persistent center; a persistent inspector rail (the preference sliders + the live stat panel) sits to one side and never moves. The five verbs become lenses that change *what is annotated on the canvas*, never *what occupies the center*.

**Where numbers vs scores live — the decision that resolves the whole "spreadsheet vs diagnosis" fight:**

- **Raw engine numbers are AMBIENT and primary.** They live in the stat panel, always visible, in PoE stat colors, tabular and monospaced. The community trusts `1.9M DPS / 42k EHP / -34% chaos res` absolutely and re-derives them in PoB.
- **The composite score is an ON-DEMAND lens.** An expandable chip over the build, measured from the build's own payload — never the `text-5xl` hero, never `0` because the optimizer found no candidates.

**The mandatory stat floor** — phased honestly, because two of its rows require engine work the plan must schedule, not wish away. **Floor v1** ships with one small backend projection change; **Floor v2** lands with the engine sidecar:

- **Four resistances vs cap** (fire/cold/lightning/chaos) — *Floor v1.* Computed at the engine boundary (`outputs.ts:106-153`) but currently projected away before the frontend payload (`toStoredResult`, `outputs.ts:174-184`); surfacing them is a small projection widening. A PoE tool that can't show chaos res at a glance is dead on arrival.
- **Life / ES split** and **EHP + max-hit-taken by damage type** — *Floor v1*, the same projection change. Collapsing all defense into one EHP number hides *why* a build dies.
- **Spirit (total / reserved / free)** — *Floor v2.* Spirit is computed nowhere in the current stack and the normalizer drops the raw `resources` block; this is genuine engine + normalizer work. It remains mandatory — its absence is the clearest "doesn't understand PoE2" signal — but it is scheduled, not free.
- **Main-skill DPS, decomposed and archetype-appropriate** (for the dot-caster: DoT/ailment DPS, poison stacks, hit-vs-DoT split) — *Floor v2*, engine work; today's engine emits a single `dps`. Until it lands: archetype-appropriate *selection* from the metrics we do have, and never a hardcoded attack-rate tile for a caster.

---

## 10. New Landing Experience — the first sixty seconds

The homepage is not the problem; the paste-box-as-import and the four verb cards are right and stay. The defect is the post-import *destination.* Here is the corrected path.

**0-5s — Paste.** The user lands on one honest headline ("The best build isn't max DPS. It's the one that fits how you play."), one paste box that accepts anything (PoB code, pobb.in/Maxroll/poe.ninja URL, or account import), and four verb cards naming the products. *Feeling: "I don't have to learn anything. I just paste."* **Keep as-is.**

**5-15s — Honest staged progress.** Not a spinner. A staged line: `fetching → parsing → calculating (queue #3) → scoring`. Engine calls are genuinely multi-second; honesty about it *builds* trust. *Feeling: "Real math is happening to my build, server-side."*

**15-25s — Land IN the build. This is the inversion.** The workspace opens on the build canvas: the user's tree (rendered, nodes *named* — requires the bundled tree dataset), their equipped gear in canonical `ItemTooltip` dialect, their gem-link cards, and the ambient stat floor — Floor v1 at launch (resists vs cap, Life/ES, EHP + max-hits); Spirit and DoT DPS join when the Floor v2 engine work lands. The archetype badge sits above it ("chaos DoT caster — detected from Essence Drain + Deadly Poison + Contagion") *with the evidence it was inferred from inline*, before any judgment. *Feeling — the single most important feeling in the product: "It parsed MY build correctly. This is my character. This tool actually plays the game."* This is the trust handshake the current product skips entirely — today it opens on a `text-5xl` score over six generic tiles.

**25-40s — The three that matter float up.** Now, and only now, the intelligence annotates. The Weighted-Score chip appears (measured from the build, expandable to its axis math). Up to three severity-sorted findings surface as annotations pointing at the offending stat/node/item — a fatal finding (uncapped chaos res) rendered as a banner *on the canvas*, near the resist row it concerns. *Feeling: "It sees the same build I see — and it's telling me the two things I'd never have found."*

**40-60s — One move, and the build changes.** The user drags a slider or picks a goal preset. The ranked change-rail re-sorts client-side in under a second (the plumbing already works — `scoring.ts`), **and the annotations on the build move with it**: the nodes and slots that the top-ranked candidates would touch light up and re-highlight as the ranking shifts, the rail deltas tween, the score chip ticks. (Honest scoping: `perAxis` attribution exists per *candidate*, not per allocated node — so the on-canvas motion is candidate-delta highlighting, which is real and buildable today. True per-node contribution recoloring requires new engine attribution and is future scope, costed, not implied.) Still not a to-do list re-sorting — *the changes that matter to their build being re-appraised under what they value, on the build.* *Feeling — the "aha" and the demo clip: "Watch what my build should become shift as I change what I want."*

---

## 11. Screen-by-Screen Experience

### The workbench frame

Move the `max-w-6xl` constraint out of the root layout (`layout.tsx:38` wraps *every* route — landing, `/b/`, `/r/`, `/goals`) into per-segment layouts: keep it for `/`, `/r/`, and `/goals`, which must stay centered and mobile-honest, and give `/b/` its own full-viewport layout. That 1152px centered column is blog/landing width; a workbench is full-viewport, edge-anchored, and desktop-fixed — an instrument, not a page. Three zones:

```
┌───────────────────────────────────────────────┬──────────────────────┐
│  [banner: fatal findings only — pinned]        │                      │
│                                                │   INSPECTOR RAIL     │
│              BUILD CANVAS  (z0, matte)         │   (persistent)       │
│         tree · gear grid · gem links · config  │                      │
│                                                │  · stat floor        │
│         ┌ glass overlay (z1) ┐                 │  · goal chip         │
│         │ finding / score /  │  ← anchored to  │  · preference rail   │
│         │ candidate detail   │    its target   │  · archetype badge   │
│         └────────────────────┘                 │  · source chip       │
└───────────────────────────────────────────────┴──────────────────────┘
```

The canvas is fluid, matte, always present. The inspector rail is fixed at 320-360px, docked right, never scrolls out of view; it holds the stat floor plus the hoisted `PreferencePanel` (one shared weight/goal state for all lenses). Overlays are glass panels anchored to the node/slot/stat they concern. The banner is reserved exclusively for fatal Doctor findings.

### Per-surface decisions

| Surface | Verdict | What it becomes |
|---|---|---|
| **Landing** (`app/page.tsx`) | KEEP | Paste box + verb cards. Untouched. |
| **Post-import destination** | KILL & REPLACE | Today Overview is "the verdict screen." Replace with the build canvas + ambient stat floor as the default view. "Overview" as a separate report tab ceases to exist — it *is* the workspace. |
| **Overview** component | TRANSFORM → the persistent frame | Its good atom (`StatDelta`, PoE colors) is promoted into the dense grouped stat panel (Offense/Defense/Sustain columns) that lives in the rail permanently. The `text-5xl` score becomes an expandable chip. |
| **Tune** | TRANSFORM → a lens + the shared rail | Best moment in the product (live re-rank + the floor cut-line, `TuneView.tsx:122-153`). Keep the mechanism; re-point it at the build. Hoist `PreferencePanel` into the persistent rail. Tune becomes the lens where the ranked-change rail and on-canvas recoloring are foregrounded. |
| **Doctor** | TRANSFORM → the diagnostics lens | Keep the checklist, letter grades, severity rows, inline evidence, and the `AICallout` footer. But findings *annotate the build* — each links to and highlights the node/item/stat it concerns. Fatal findings escalate to an on-canvas banner. The bare map-tier stepper grows into the visible config surface. |
| **Compare** | TRANSFORM; KILL the node-ID chips | Keep the thesis row (rival re-scored under *your* weights can rank below yours). Kill `NodeChips` rendering raw integers (`:469`); resolve IDs to notable/cluster *names* (requires the bundled tree dataset — the Phase 1 data workstream; the snapshot carries only `allocatedNodes` integers and `displayCache` never maps node IDs), and render the diff as **one tree, three colors** (both/yours/theirs) once the canvas exists. Never two trees, never integers. |
| **Upgrades** | KEEP mechanics; TRANSFORM into slot annotations | Keep the score-per-divine bars, blur-with-count freemium, and the honest synthetic-price disclaimers. Recast candidates as annotations on the gear slots they'd replace, with the existing `ItemTooltip` diff. |
| **Shared report** `/r/{id}` | KEEP and DOUBLE DOWN | The acquisition surface; it *should* stay report-shaped. Frozen, statically rendered, mobile-honest, radar as the OG hero image. Two audiences, two compositions of one object model. |
| **Goals** `/goals` | KEEP | The preset gallery and satisficing target-bands are PoE-literate and novel. Foreground once the build is visible. |
| **Apply / edit model** | KILL & REPLACE (highest-leverage single change) | Today `onApply → router.push` (`page.tsx:131-145`) — a full navigation that discards live state and re-hits the engine. Replace with one client-side staging/diff/undo primitive: apply mutates a resident working copy, pushes an undoable entry onto a visible change stack, animates the stat-rail deltas; promotion to an immutable snapshot is a silent background commit (URL swaps quietly, never a reload). |

### Visual specifics (folded into the surfaces above)

**Typography.** Numbers are the product; they get their own face. Engine numbers render in an embedded technical tabular mono with true lining figures — not the current `ui-monospace` *fallback* stack (`globals.css:53`), which resolves to Consolas on Windows and SF Mono on Mac, i.e. inconsistent across the exact users who screenshot and compare. Labels are a neutral grotesque; numbers and their labels do not share a family — that contrast *is* the "this is a readout" signal. Banish the serif from `/b/` (it belongs on the wordmark and `/r/`). Scale is biased small and real: marquee stat (DPS, EHP) at 24-28px is the biggest number on screen — *not* the score, which is a 13px chip. Target roughly 2x the current density: the entire stat floor (~18-22 values) fits in one rail column without scrolling. Every numeric column is right-aligned, decimals stacked, labels in a fixed gutter — this single alignment rule lets you delete card borders and still read cleanly.

**Color.** Warm the base off the cool `#0a0b0f` (`globals.css:12`) toward a neutral-warm obsidian — half of why a screenshot pings "Power BI" vs "Path of Exile." **Kill the violet accent** (`#8b7bff`, `globals.css:25`) — the single highest-leverage color change — for a restrained antique brass (the color PoE associates with value and highlight) or go accent-less and let the PoE stat colors be the whole palette; kill the accent vignette and the glass header on `/b/`. The accent never touches a data pixel. Keep the delta tokens (`--color-gain`/`--color-loss`) exactly. Fix the collision: `--color-sev-critical` is *identical* to `--color-loss` (`#ff6470`, `globals.css:31/37`) and one hair off `--color-life`, so "critical finding," "a downgrade," and "your Life stat" are the same red — separate them (severity is an alert channel; stat colors are a data channel). Add the missing rarity tokens (Normal `#c8c8c8`, Magic `#8888ff`, Rare `#ffff77`, Unique `#af6025`, Gem `#1ba29b`, Currency `#aa9e82`) and use them verbatim in every tooltip.

**Motion.** Motion carries exactly one meaning: the engine recomputed your build, here is what changed. Keep the honest staged-progress line (it replaces the spinner). The core aha is the **delta tween** — on a slider move or an applied candidate, affected numbers count old→new (~300-500ms, tabular so no reflow) and flash gain-green/loss-red, then settle. The candidate rail re-sorts by FLIP slide (~250ms); tree nodes crossfade to new weighted-contribution colors (~200ms). Banned: entrance animation on the canvas itself (the substrate is always there, it appears, it does not perform); spinners; hover-lift/scale on data; parallax. Reduced-motion is honored — deltas still flash color (the signal survives) but do not tween.

### The litmus test

Screenshot any `/b/` screen, crop the wordmark, show it to a veteran: they must think *"that's my build — and this was built by someone who actually plays,"* and they must not be able to ask *"which analytics product is this?"* The pass conditions are **phase-aware** — a test the plan cannot meet until its final phase is not a gate, it is a lie waiting to be discovered:

- **After Phase 1:** the post-import screen shows *their* tree, gear, gem links, and four resists vs cap before any score; a stat readout stays legible when desaturated; no attack-rate tile appears on a caster.
- **After Phase 3:** a Compare diff shows one tree in three colors with named notables; findings and candidates point at the thing they concern.
- **After Phase 5 (sidecar + Floor v2):** Spirit and decomposed DoT stats are ambient; any number opens to its engine derivation and re-derives in desktop PoB. Until then, headline numbers carry a preview/estimated label.

The current build fails every condition in every phase.

---

## 12. Migration Strategy

The redesign is not a rewrite. Migration is a sequence of view-layer additions — plus **two named backend items** (the stat-floor projection widening early; the Spirit/DoT engine work late) and **one data workstream** (the bundled, patch-versioned tree dataset) — each independently shippable, that progressively invert the z-order. There is no big-bang moment where the app is broken between the old shape and the new one: every step ships behind the existing tab shell until the lens recast retires it.

Two rules dictate the order, and they are the entire strategy:

1. **Artifact precedes overlay.** You cannot annotate what isn't drawn — so the snapshot is un-discarded first, the substrate (gear, gems, config, static tree) is rendered before any lens points at it, and the working-copy/diff/undo primitive is built only after the surfaces it animates exist.
2. **Cheapest-highest-trust precedes heaviest.** The stat floor and score decoupling are days of work and kill the two DOA failure modes ("can't find my chaos res"; "0/100 on a good build") — they go first. The interactive PixiJS tree, editable config with metered recalc, and the Floor v2 engine work are polish on an already-correct workbench — they go last.

The phased sequence itself lives in one place: **§15.** The prioritized cut of the same work lives in **§16.** This section deliberately does not restate them.

---

## 13. Risks

Honest risks of the redesign itself, and how we hold each.

**R1 — Density intimidates the casual "Stuck Mapper."** Piling the full stat floor and a tree onto the screen could overwhelm the new-player persona the PRD leads with. *We hold it with* progressive disclosure: the floor is calm and ambient, PoB-density is on-demand, and a *present-but-annotated* build teaches the game rather than dumping a wall of scores with no object. *The genuine residual risk:* if the overlay isn't disciplined, we recreate PoB's overwhelm — the "intelligence guides attention on the canvas" answer is asserted, not yet proven, and must be watched in testing.

**R2 — "Looks like PoB" erodes the at-a-glance differentiation.** Leading with the build instead of the score risks looking like a PoB clone. *We hold it by* locating the differentiation in the *overlay* (weighted re-ranking, goal-aware diagnosis on a visible build), never in hiding numbers. *The residual risk:* PoB parity is table stakes with no immediate wow — the wow must come entirely from the live re-appraisal, so if step 5 (the aha) slips, we ship parity with no hook.

**R3 — Demoting the radar weakens the share loop.** The radar is the most screenshot-able artifact and the documented `/r/` acquisition engine. *We hold it by* keeping the radar as the `/r/` OG hero and an ambient brand glyph, demoting only its *analytical* role to aligned bars on the workbench. *The residual risk:* growth may find a bar-based share converts worse than a bare `71/100`; this is testable and should be tested, not assumed.

**R4 — The working-copy primitive is real client-state complexity.** A live change-stack is more state than a URL hop, and done wrong it leaks page-navigations back in. *We hold it by* keeping immutability a *backend* invariant (the git model: immutable commits, one working tree) — the draft is client state, promote is the commit. *The residual risk:* the mutation boundary must be designed explicitly, or the clean one-way pipeline the backend team values springs a leak.

**R5 — Desktop-fixed abandons mobile for `/b/`.** The workbench commits to fixed desktop density and shows an honest "open on desktop" state below a threshold. *We hold it by* intent — `/b/` is an instrument like PoB; `/r/` and the landing carry mobile. *The residual risk:* we are betting theorycrafting is a desktop act; if a meaningful cohort wants mobile *editing*, we've under-served them by design.

**R6 — The static-tree-first bet.** Shipping a pre-rendered PNG + SVG overlay before the interactive renderer risks feeling like a stopgap and inviting "when's the real tree?" *We hold it by* treating it as a genuine substrate that satisfies the always-on invariant; PixiJS is an upgrade, not a prerequisite. *The residual risk:* if named-node legibility on a static PNG is poor at real zoom, we may be forced to PixiJS sooner than planned.

**R7 — The load-bearing assumption itself.** The "presentation-first" thesis rests on the served payload actually carrying the full node list, gear, and gem groups — not a summary. *I verified it does* (`backend/api/src/services.ts:129` declares `snapshot: CoreSnapshot`; `services.ts:424` includes `snapshot: core` in the response). *I name it anyway* because it is the one assumption whose failure would reshape the plan: if it were ever false, the substrate phase would need an API field and the cost estimate would rise. It is verified today; it should be re-checked before scoping if the payload shape ever changes.

**R8 — The trust thesis currently rests on a mock engine.** The document's deepest claim — every number is reproducible engine truth a veteran can re-derive in desktop PoB, and reproducibility *is* the trust currency — is not satisfiable by the shipped engine, which is a deterministic mock (`mock-engine.ts` computes dps from node/link/mod counts; `outputs.ts` documents scale knobs mapping mock magnitudes to "PoB2-shaped" numbers). A veteran who re-derives today's headline DPS in PoB will get a different number, and "open a stat to its contributing mods" is impossible because the mock emits aggregates with no per-mod attribution. *We hold it by* labeling headline numbers preview/estimated until the real PoB2 LuaJIT sidecar lands (the S1 spike), gating invariant 2's derivation claim and the litmus test's reproducibility condition on the sidecar, and treating the sidecar as the trust unlock — a reason to pull it earlier if the inversion outruns it. *The residual risk:* if the workbench inversion ships long before the sidecar, we present a beautiful artifact annotated with synthetic numbers, and the first veteran who cross-checks will say so publicly. The mitigation is honesty in the UI, not hope.

---

## 14. Long-Term Vision (five years)

The philosophy is not a near-term patch; it is the thing that keeps the five-year roadmap from fragmenting into twelve dashboards. The mechanism is structural: **build one staging/diff/undo primitive and one lens/overlay registration model now, and every future feature is an overlay or a diff over the same persistent document.** N features then cost N overlays on one substrate, not N sibling report tabs. Concretely, the roadmap the founder named absorbs cleanly:

- **Coach** is a narration layer painted on the build, confined to the `AICallout` dialect — one-way, math-crowned, pointing at the same nodes and stats the deterministic engine already annotates. It never becomes a chat box.
- **Compare** is a diff lens, and diff-first is *already* the interaction grammar: rival re-scored under your weights, rendered as one tree in three colors. It is Compare today, done right.
- **Multi-build** is multiple working trees over one document model — the git-worktree analogy made literal. The working-copy primitive from step 7 is exactly what makes several loadouts cheap.
- **Patch adaptation** — "your build after the nerf" — is a diff against a re-simulated future patch. It reuses the diff grammar for free; no new paradigm.
- **Build Genome** deepens archetype detection into a cross-build feature space, then renders as an overlay that positions *your* build in the population — annotating the canvas, never replacing it with a population report.
- **Team optimization** is a multi-diff over several documents (party synergy) — the same diff primitive fanned out.

Every one of these is a lens on a persistent substrate or a diff over it. None requires hiding the build. Invariant 1 — *if a feature can only exist by hiding the build, it is misdesigned* — is the single rule that keeps the roadmap coherent across five years. The backend's snapshot/mutation/promote narrow-waist already *is* this shape; the UI's job is to stop betraying it and start mirroring it.

---

## 15. Concrete Implementation Plan

Phases, not code. The order is dictated by two rules: **artifact before overlay**, and **cheapest-highest-trust before heaviest.** Each phase is independently shippable and leaves the product more inverted than before.

**Phase 0 — Un-discard the snapshot; ship Floor v1; decouple the score.** Re-type and read the snapshot; **widen the backend projection** (`toStoredResult`, `outputs.ts:174-184`) so the resists/Life/ES/per-type-max-hit the engine boundary already computes reach the frontend payload — the one small backend change in the early plan; render the Floor v1 stat band (resists vs cap, Life/ES, EHP + max-hit-by-type, archetype-appropriate selection from available metrics); measure the score from the build's own payload and demote it to an expandable chip. *Why first:* one small projection change plus view work, highest trust-per-effort, kills the DOA "no chaos res" problem and the "0/100" bug, and flips the first glance from verdict to evidence. This phase alone changes the product's character.

**Phase 1 — Render the build substrate.** Equipped gear via `ItemTooltip`, per-group gem-link cards, inline read-only config, and the static tree PNG + named-node SVG overlay. **This phase carries the plan's one data workstream:** source, generate, and bundle the patch-versioned PoE2 tree dataset (node id → name, id → coordinates, base image) — it exists nowhere in the repo, the snapshot carries only node-ID integers, and both the tree render and every "named notable" promise in this document depend on it. Cost it as a real deliverable with per-patch maintenance, not as a rendering detail. Lock the "persistent build substrate" invariant. *Why second:* you cannot annotate what isn't drawn; the substrate must exist before any lens can point at it. This delivers the trust handshake — "it parsed MY build."

**Phase 2 — Hoist the inspector rail; re-point the re-rank.** Move `PreferencePanel` into the persistent rail (one shared weight/goal state) and wire the live re-rank to candidate-delta highlighting on the canvas (nodes/slots the top-ranked candidates touch light up and shift with the ranking) + rail delta tweens. *Why third:* the substrate now exists to re-appraise; this delivers the "watch what my build should become shift" aha — the demo clip and the felt moat. (Per-node contribution recoloring needs engine attribution that does not exist; it is future scope, not this phase.)

**Phase 3 — Recast the tabs as lenses.** Findings annotate their target node/item/stat; Compare becomes one-tree-three-colors with named notables; Upgrades becomes slot annotations; the node-ID chips die. *Why fourth:* with substrate and rail in place, the reports become overlays cheaply, and the dashboard-vs-workbench problem visibly dissolves.

**Phase 4 — The working-copy / diff / undo primitive.** Apply becomes an in-place mutation on a resident working copy with a visible change stack; promotion is a silent background commit. *Why here, despite being the highest strategic leverage:* it depends on the substrate and rail existing to animate deltas onto, and it is the primitive the entire five-year roadmap reuses — so it is done once, deliberately, after the surfaces it serves are real, not rushed before them.

**Phase 5 — The engine unlock and heavy refinements.** The real PoB2 LuaJIT sidecar (the S1 spike's GO gate) replaces the mock behind the conformance-tested adapter — this is what removes the preview/estimated label from every headline number and turns on invariant 2's "open a stat to its contributing mods" (R8). With it: **Floor v2** — Spirit total/reserved/free (engine + normalizer work; the normalizer must stop dropping the resources data) and decomposed DoT/ailment/hit-split DPS. Also here: editable config with metered recalc; the interactive PixiJS tree as an upgrade of the present static substrate; the armour/block/ailment breakdown. *Why last in this plan:* nothing before it is blocked on it — but it is the trust unlock, so if the inversion outruns it, pull the sidecar forward rather than shipping a beautiful artifact annotated with synthetic numbers indefinitely.

The rationale in one line: pay for the artifact first (cheap — the data is on the wire, plus one projection widening and the tree dataset), then paint the intelligence onto it, then build the reusable editing primitive once its surfaces exist, and land the engine work that makes every number honest.

---

## 16. Prioritized Action List

**High — do now; cheap, DOA-fixing, inverts the first glance:**

- Re-type `snapshot: unknown` → `CoreSnapshot` on the client and read it (`types.ts:98`) — the unlock for everything else.
- Widen the backend projection (`toStoredResult`, `outputs.ts:174-184`) so resists vs cap, Life/ES, and per-type max-hit reach the frontend payload — the one small backend change in the early plan.
- Ship the Floor v1 ambient stat band (four resists vs cap, Life/ES, EHP + max-hit-by-type) from the widened payload. (Spirit and decomposed DoT DPS are Floor v2 — engine work, tracked under Low.)
- Decouple `liveBaseScore` from `recs[0]`; measure it from the build's own payload; kill the "0/100" failure mode (`scoring.ts:97-113`).
- Render equipped gear with the existing `ItemTooltip` and add per-group gem-link cards from data already in the payload.
- Replace the hardcoded attack-rate tile with archetype-appropriate stat selection; no attack-rate tile for a caster (`Overview.tsx:108-113`).
- Demote the score from `text-5xl` hero to an expandable chip that opens its `perAxis` math (`types.ts:107-124`).
- Label headline numbers preview/estimated while the engine is the mock (R8) — one honest badge protects the entire trust thesis.

**Medium — the substrate, the rail, and the visual inversion:**

- Source, generate, and bundle the patch-versioned PoE2 tree dataset (node id → name/coordinates + base image) — the plan's one data workstream; the tree render and every named-notable promise depend on it.
- Ship the static pre-rendered tree PNG + SVG allocation overlay with named nodes (depends on the tree dataset); lock the persistent-substrate invariant.
- Hoist `PreferencePanel` into a persistent inspector rail governing one shared weight/goal state across all lenses.
- Re-point the live re-rank at the build (candidate-delta highlighting on the canvas + rail delta tweens), not the prose ScoreBar list.
- Kill the node-ID chips; resolve IDs to notable/cluster names via the tree dataset; render the Compare diff as one tree, three colors (`CompareView.tsx:469`).
- Recast Doctor findings and Upgrades candidates as annotations on the node/item/stat they concern; fatal findings → on-canvas banner.
- Display the active combat config inline, read-only — satisfies the reproducibility invariant cheaply, before editable config exists.
- Kill the violet accent and vignette (`globals.css:25`), warm the base off `#0a0b0f`, separate the `sev-critical`/`loss`/`life` red collision (`globals.css:31/37`), add the missing rarity tokens, and embed one numeric mono face (replace the `ui-monospace` fallback).
- Build the client-side working-copy/diff/undo primitive and make apply in-place with a silent background promote (replaces `page.tsx:131-145`) — the highest strategic leverage item, deliberately sequenced here because it depends on the substrate and rail landing first.

**Low — the engine unlock and heavy refinements:**

- Land the real PoB2 LuaJIT sidecar (S1 spike GO gate) behind the conformance-tested adapter — removes the preview/estimated label, enables stat→contributing-mods derivation (invariant 2), and unlocks Floor v2. Pull this forward if the inversion outruns it (R8).
- Floor v2: Spirit total/reserved/free (engine + normalizer work — the normalizer currently drops the resources data) and decomposed DoT/ailment/hit-split main-skill DPS.
- Ship a real Export-to-PoB share code and fix or remove the mislabeled dead "Export to PoB" span (its title cites trade-compliance for a build-share action with no compliance obstacle).
- Editable config with metered recalc, once the working-copy primitive exists.
- Interactive PixiJS tree as an upgrade of the present static substrate.
- Armour/block/ailment-threshold breakdown once the sidecar exposes it.
- Per-node weighted-contribution recoloring on the resident tree, if and when the engine exposes per-node attribution — until then the on-canvas motion is candidate-delta highlighting by design.
