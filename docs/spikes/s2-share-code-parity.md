# S2 — Share-code round-trip parity (spike report)

> **Phase 0 spike** (PRODUCT_PLAN §"Phase 0", S2). Status: **synthetic parity GREEN; real-code
> byte-parity BLOCKED on founder-provided codes.** Harness: `scripts/spikes/s2-roundtrip.ts`
> (executes today via `tsx`; real pass counts below).

## 0. TL;DR

- The share-code transport (`encode → decode`) is **byte-lossless**, and the normalize pipeline
  is **deterministic**: two independent passes over the same PoB-style document yield a
  byte-identical decoded XML and a semantically-identical `BuildSnapshot` (same Canonical
  Identity + same canonical build state). **10/10 synthetic documents pass.**
- **200/200** deterministic random-corruption inputs produce a **typed `NormalizerError`** — never
  an uncaught crash, never a spurious successful import.
- The **decompression-bomb guard** holds: a payload that would inflate past 8 MiB is rejected by
  the importer's inflation cap (`inflateSync … maxOutputLength`) *before* the oversized buffer is
  materialized, surfaced to the caller as a typed error. **3/3 bombs (16 / 32 / 64 MiB
  uncompressed) guarded.**

Run it:

```
pnpm exec tsx scripts/spikes/s2-roundtrip.ts     # or: node_modules/.bin/tsx …
```

Latest run:

```
S2 VERDICT: GREEN  (parity 10/10, fuzz 200/200 typed, bombs 3/3 guarded)
```

## 1. What "round-trip parity" means here (and what it does not)

The plan line reads *"zlib shim + share-code round-trip — byte-parity on 10 pobb.in codes."* There
are two distinct round-trips hiding in that phrase; this spike proves the one that is executable
today with **no network and no third-party payloads** (Compliance Charter §7.5), and scopes the one
that is not.

| Round-trip | What it proves | Status |
|---|---|---|
| **Transport** — `XML → deflate → base64url → base64 → inflate → XML` | the zlib/base64 shim is lossless; a code decodes back to the exact bytes it was built from | **proven** (byte-equal, 10/10) |
| **Normalize determinism** — `code → import → normalize → BuildSnapshot`, twice | the importer + normalizer are pure: identical input ⇒ identical Canonical Identity ⇒ cacheable, reproducible (RFC-0001 I1/I2) | **proven** (identity + canonical build-state equal across passes, 10/10) |
| **Real-code byte parity** — an actual pobb.in / desktop-PoB2 export decodes to the same bytes their tools produced | our shim matches the real-world encoder byte-for-byte on genuine data | **blocked** — see §4 |
| **Snapshot → PoB2 XML re-serialization** | a snapshot can be re-emitted as a PoB document identical to the source | **out of scope by design** — see §4 |

## 2. What the harness does

### 2.1 Parity (`[1]` in the output)

A synthetic corpus of **10 PoB-style XML documents** is generated inline, varied across the axes an
importer actually stresses: minimal (class+level only); a full single-loadout build (ascendancy,
explicit main socket group, items with slots, gems); a **multi-`Spec`** tree (`activeSpec`); a
**multi-`SkillSet`** build (`activeSkillSet`); a large build (120 nodes, 12 items) for size; XML
**entity/unicode** item text (`&amp; &lt; &quot;`, `€`, `í`); a no-items build; a 5-link
main group; a build with **no explicit main group** (importer must infer); and a level-100 deep
tree. `research/fixtures/import-corpus/` is not a source of *PoB codes* (it holds normalized JSON
build fixtures for S3), so the parity corpus is generated inline — the posture the plan permits
("reuse fixtures where present, else generate inline").

For each document the harness runs **two independent passes**:

1. `code₁ = encode(xml)`; `decoded₁ = inflate(base64(code₁))`; assert `decoded₁ === xml`.
2. `snap₁ = normalize(importAny(code₁))`.
3. `code₂ = encode(decoded₁)` (re-encode); `decoded₂ = inflate(code₂)`; assert `decoded₂ === xml`.
4. `snap₂ = normalize(importAny(code₂))`.

then asserts **byte parity** (`decoded₁ === decoded₂`) and **semantic equality**
(`snap₁.identity === snap₂.identity` **and** `stableStringify(buildState)` equal). `importedAt` is a
wall-clock and legitimately differs, so the comparison is over Canonical Identity + canonical build
state — exactly the fields RFC-0001 I2 says must be stable — not the whole artifact.

### 2.2 Fuzz (`[2]`)

**200** corruption inputs from a seeded PRNG (mulberry32, fixed seed — fully reproducible) across
seven generators: random base64url garbage; random raw bytes → base64 (valid base64, invalid
deflate); truncated valid codes; single-char flips mid-stream; valid zlib of **non-PoB** text (no
`<Build>`/`<PathOfBuilding>` marker); punctuation/whitespace noise; and near-empty inputs. Each is
pushed through the **full** pipeline (`normalize(importAny(input))`). The contract asserted:

- **never an untyped crash** — every failure is an `instanceof NormalizerError`
  (`UnknownSourceError` / `ImportError` / `NormalizeError`);
- **never a spurious success** — a corruption input must not yield a valid snapshot.

Result: **200 typed errors, 0 crashes, 0 unexpected successes.**

### 2.3 Bomb guard (`[3]`)

Three genuine decompression bombs are built — PoB-marked XML that inflates to **16 / 32 / 64 MiB**
uncompressed but compresses to a few hundred KB. For each, the harness asserts:

- the importer rejects it with a **typed** error (the >8 MiB inflate throws inside `tryDecode`,
  which returns `null`, so `detect()` is false and `importAny` throws `UnknownSourceError`); and
- a **deterministic** guard proof independent of memory noise: inflating the *same* bytes directly
  with the importer's 8 MiB cap (`inflateSync(bytes, { maxOutputLength: 8·1024·1024 })`) **throws**,
  and the known uncompressed size exceeds the cap — i.e. the cap fires before the payload is
  materialized.

RSS deltas are printed as an *informational* readout only; they are inherently noisy (GC timing,
the code buffer, bomb construction) and are **not** a pass/fail gate. The meaningful, stable signal
is that memory tracks the **8 MiB cap**, not the bomb's uncompressed size — the RSS delta is roughly
flat (~8 MiB) across 16/32/64 MiB bombs.

## 3. Results (latest run)

```
[1] PARITY                    10/10 byte- & semantically-parity-stable
[2] FUZZ (200 inputs)         200 typed NormalizerError, 0 crashes, 0 unexpected successes
[3] BOMB GUARD (16/32/64 MiB) 3/3 typed rejection + 8 MiB cap threw before materialization
S2 VERDICT: GREEN
```

## 4. The boundary (what remains — honestly)

Two pieces of "byte-parity on 10 real codes" **cannot** be executed inside this spike, and no amount
of synthetic testing substitutes for them:

1. **Byte parity against 10 REAL pobb.in codes.** This requires the founder to paste in genuine
   share codes. Per the Compliance Charter §7.5 (rule: official/public interchange, **user-initiated
   only**, no automation, no scraping) an agent must **not** fetch pobb.in / Maxroll / poe.ninja
   payloads — not even "just to test." The harness is built to accept them the moment they exist:
   drop real codes into a corpus and the same two-pass parity assertions run unchanged. Until then,
   we have proven our shim is **internally** lossless and deterministic, not that it agrees
   **byte-for-byte with GGG/pobb.in's encoder** on real data. That agreement is the actual S2 gate
   and it stays **open, blocked on founder-provided codes.**

2. **Desktop-PoB2 export comparison.** The definitive check is: export a build from desktop Path of
   Building 2, import the code here, and confirm the decoded XML and the derived snapshot match what
   PoB itself round-trips. That needs a PoB2 install and a human to drive it — the same
   founder/manual boundary as S1's real-engine work.

3. **Snapshot → PoB XML re-serialization is a non-goal, by design.** RFC-0001 AD-6 fixes the
   canonical model as ExileLab's own; PoB XML is an **import-only** format and production emits the
   canonical `BuildSnapshot`, never PoB XML. So "re-encode" in this spike means *re-run the transport
   + normalize pipeline*, **not** *reconstruct a PoB document from a snapshot* — there is deliberately
   no XML exporter to test, and building one would re-couple the core to a third-party format the RFC
   spent its length removing.

## 5. Verdict

**GO for the pipeline; gate stays open on real codes.** The zlib/base64 transport is lossless, the
importer+normalizer are deterministic and cacheable (RFC-0001 I1/I2), untrusted paste input is
crash-proof (typed errors only), and the decompression-bomb guard holds at 8 MiB. The one thing left
to close S2 as written — **byte parity against 10 real pobb.in codes + a desktop-PoB2 export
diff** — is a **user-initiated, founder-provided** step (Charter §7.5); the harness is complete and
waiting for that input.
