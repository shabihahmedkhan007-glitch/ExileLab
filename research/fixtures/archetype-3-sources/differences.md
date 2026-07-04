# Twister Huntress speed-mapper — 3 source versions (SYNTHETIC)

**Everything here is invented for testing.** No real Maxroll / pobb.in / poe.ninja / GGG
data, no network fetch. These three files stand in for "the same archetype fetched from
three public sources" so the **S6 aggregation feasibility spike** can prove the
multi-source pipeline: normalize all three to canonical `BuildSnapshot`s and produce a
sane tree/gear/gem diff. Real data replaces these per the top-level `../README.md`.

The archetype is the canonical example from the docs (GLOSSARY *Archetype*,
UX_PRESENTATION §L2, PRODUCT_PLAN): a Huntress whose **movement comes from attacking**
(`Twister`), so the Context Detector should suggest *Attack Speed HIGH / Movement Speed
LOW* and must never shame her low move-speed stat.

## The three sources

| # | File | Stands in for | Format |
|---|------|---------------|--------|
| a | `a-maxroll-native.json` | Maxroll pob endpoint | ExileLab native JSON |
| b | `b-pob-share-code.txt` | pobb.in / PoB2 share code | PoB-style code (base64 + zlib deflate) |
| c | `c-poeninja-variant-native.json` | poe.ninja top-ladder player | ExileLab native JSON |

- **(a) and (b) are the SAME build**, expressed in two different source formats. (b) is
  produced by `../scripts/make-pob-code.ts` from an XML that mirrors (a). After
  normalization they agree on class, ascendancy, level, the 100 allocated nodes, gear,
  and skills. (Their Canonical Identities are *not* required to be byte-identical — the
  two importers legitimately differ on synthesized ids/refs — but their build state is
  semantically the same, which is what S6's comparator consumes.)
- **(c) is a deliberate variant** of the same archetype, with the differences below.

## Intended diff: (a) baseline → (c) variant

Exactly three categories change; everything else is identical to (a).

### 1. Boots (gear diff — 1 slot)

| | (a) baseline | (c) variant |
|---|---|---|
| Slot `Boots` | **Stealth Boots** (Rare) — `+30% Movement Speed`, `+64 to maximum Life` | **Seven-League Step** (Unique) — `+45% Movement Speed`, `10% chance to gain Tailwind on Kill`, `+48 to maximum Life` |

Expected comparator output: one gear swap on `Boots`; more move speed + Tailwind uptime,
slightly less flat life. Under fast-mapping weights this should read as an upgrade.

### 2. Passive tree (6 nodes swapped)

Same total node count (100). Six node ids differ:

| Removed in (c) (present only in a) | Added in (c) (present only in c) |
|---|---|
| `1075` | `2000` |
| `1320` | `2100` |
| `1485` | `2200` |
| `1966` | `2300` |
| `2432` | `2400` |
| `3091` | `2500` |

`validate.ts` asserts exactly **6** nodes are unique to (a) vs (c).

### 3. Skill gem (1 support swap, main group)

| | (a) baseline | (c) variant |
|---|---|---|
| Main group (`Twister`) 5th support | **Fork** (`SupportFork`) | **Chain** (`SupportChain`) |

Active skill (`Twister`) and the other four supports (`Scattershot`, `Martial Tempo`,
`Primal Armament`) are unchanged, so the diff is a single support-gem swap.

## What stays identical (a ↔ c)

Class `Huntress` / ascendancy `Amazon` / level `91`; weapons, helmet, body, gloves, belt,
amulet, both rings; the other 94 passive nodes; Herald of Thunder, Grace, and Blink
groups; configuration (`enemyIsBoss:false`, `movesByAttacking:true`, `frenzyCharges:3`);
resources. This isolates the S6 diff to **boots + 6 nodes + 1 gem**, so the spike's
comparator output can be checked against this document line-for-line.
