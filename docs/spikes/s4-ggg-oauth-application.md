# S4 — GGG OAuth Application (draft package)

> **DRAFT — the founder must personalize and send this manually.**
> Every placeholder in `«guillemets»` is a decision only the founder can make: the final
> product name, the GGG account name to apply under, and the production domain. Fill those
> in, re-read the email in your own voice, then send it yourself to **oauth@grindinggear.com**.
> **Submission is the external step no agent can or will perform** — no automated system
> sends this, and per the Compliance Charter (`PRODUCT_PRD.md` §7.5 rule 4) the application
> must read like a human wrote it, because it *is* written by one.
>
> This spike delivers the application to the last executable inch: a ready-to-send email,
> the pre-submission decisions checklist, and the honest-identity strings we commit to.
> It does **not** register a client — GGG approves clients by hand, on their timeline
> (`PRODUCT_PRD.md` §7.2). PoB-code and `.build` import keep Phase 1 unblocked while we wait.

---

## 0. Why this is written by a human, on purpose

GGG's developer team states they **"will immediately reject any low-effort or LLM-generated
requests"** (`PRODUCT_PRD.md` §7.2). Two consequences shape everything below:

1. The email is deliberately plain — short paragraphs, specific facts, no marketing gloss,
   no bullet-point avalanche. It should sound like one developer emailing another.
2. We describe the product honestly as **deterministic search with an LLM only explaining
   the results** — never as "an AI that analyzes builds." Applications that smell
   LLM-generated get auto-rejected (`PRODUCT_PRD.md` §10 item 4). Our actual architecture
   happens to be the honest version of this: the calculation engine produces every number;
   the LLM only turns already-computed findings into sentences.

Do not paste this into an LLM to "polish" it before sending. That would defeat the point.

---

## 1. The application email (ready to personalize and send)

**To:** oauth@grindinggear.com
**Subject:** OAuth client application — «Product Name» (PoE2 character analysis web app)

---

Hi,

I'm building a web app that helps Path of Exile 2 players understand and improve their
characters, and I'd like to register a confidential OAuth client for it. I'm applying under
the account **«GGG account name»**.

The short version of what it does: a player signs in, we import their character through the
official character API, and we run the numbers through the community Path of Building 2
calculation engine on our server. From those numbers we point out concrete things — an
overcapped resistance that's wasting an item mod, chaos resistance that's low enough to be
getting them killed, a passive node that isn't doing much — and we suggest specific changes,
each with the DPS or survivability delta the engine computes for it. It's a search-and-math
tool at heart; there's a language-model layer, but it only phrases the findings the engine
already produced into plain English. It never invents a number, an item, or a stat. We learned
from watching people (correctly) distrust AI tools that guess at game math — our whole pitch is
that the math is real and reproducible in desktop PoB2.

Players can also paste a Path of Building code or upload a `.build` file, so a lot of the app
works without your API at all. What the character API specifically unlocks is the frictionless
path — sign in, see what's wrong — which for newer players is the difference between using the
tool and bouncing off it.

I want to be upfront that this is a commercial project. It's planned as freemium: the import,
the stat sheet, and the top few diagnoses are free, and a subscription unlocks the fuller
reports and the budget upgrade finder. The paid part is our own analysis and server compute —
we don't gate or resell any of your game data or art behind it.

**Scope requested:** `account:characters` (read-only), and nothing else. That single scope is
the entire reason we need OAuth — we read the signed-in player's PoE2 characters (passives,
equipment, skills) to analyze them. We don't need league, stash, guild, or profile data, so
we're not asking for it. Character data is used only to generate that player's own report; we
don't redistribute it.

**Client details:**

- Client type: confidential (there's a server-side backend holding the secret; the browser
  never sees it).
- Grant type: authorization code with PKCE, plus refresh tokens for keeping a session signed
  in without re-prompting.
- Redirect URI: `https://«your-domain»/api/auth/poe/callback` (production). I'll also want a
  localhost callback for development if that's allowed — happy to follow whatever you prefer
  there.

On compliance, so you know where I stand: every server-side call to your API goes out with an
honest, identifying User-Agent and respects your rate-limit headers with a token bucket and
back-off on 429. I will never ask for or touch a POESESSID, and the app never automates any
in-game or trade action — it shows a human information and the human acts. If you ever tell me
to change or stop something, I'll comply, no argument.

One thing I should flag honestly: **«Product Name» is a working title, not the final name.**
I know the name can't reference "Path of Exile," "PoE," or "Path of Building," and the final
name and domain will respect that before anything launches. If it's easier to approve against
the final name, I'm glad to follow up once it's locked.

The app isn't affiliated with or endorsed by Grinding Gear Games, and it'll say so plainly on
the site.

Happy to answer anything or adjust the scope. Thanks for reading, and thanks for keeping the
API open to third-party tools.

Best,
«Founder name»
«Contact email»
«Optional: link to a one-page description or the site, once one exists»

---

## 2. Pre-submission checklist

Do these **before** sending. The email above has placeholders precisely because these are
unresolved founder decisions, and GGG asks for several of them directly.

### 2.1 Decisions the founder must make first

- [ ] **Final product name** — ⚠️ **§7.4 trademark constraint: the name is NOT final.**
      It must not contain "Path of Exile", "PoE", or "Path of Building" (GGG trademark /
      community-project branding; `PRODUCT_PRD.md` §7 working-title note + §7.4). "ExileLab"
      is a placeholder. The email flags this to GGG honestly rather than hiding it. If you can
      lock the name before applying, do — it avoids a re-name conversation after approval.
- [ ] **GGG account name to apply under** — GGG asks which account owns the client. Decide
      whether that's your personal account or a dedicated business account.
- [ ] **Production domain** — needed for the redirect URI. Must also clear the §7.4 name
      constraint (no "PoE"/"Path of" in the domain) and a trademark check.
- [ ] **Legal entity / contact identity** — the name and contact email you're comfortable
      putting on a commercial application to a game studio.

### 2.2 Fields GGG's process expects (from `PRODUCT_PRD.md` §7.2)

GGG's manual review (email to oauth@grindinggear.com) asks for these; each is answered in the
email above once the placeholders are filled:

- [ ] **Account name** → §2.1 decision.
- [ ] **Client type** → confidential (fixed; we have a server backend).
- [ ] **Grant types** → authorization code + PKCE, refresh token (fixed).
- [ ] **Requested scopes, each justified** → `account:characters` only, justified as
      read-only character import for analysis. Do **not** pad the scope list — asking for
      access we don't use is exactly the kind of low-effort request that gets rejected.
- [ ] **Redirect URIs** → `https://«your-domain»/api/auth/poe/callback` + optional localhost
      dev callback. ⚠️ Placeholder — set the real domain first.
- [ ] **Commercial intent** → disclosed honestly (freemium), per Charter rule 4. Non-negotiable.

### 2.3 Related §7.4 pre-launch items (adjacent, not part of this email)

Not required to send the application, but tracked here so they don't get lost:

- [ ] Never reuse `client_id=pob` — we register our own client (this application). (§7.4 item 1)
- [ ] Non-affiliation disclaimer live site-wide before launch. (§7.4 item 5; text in §3.2)
- [ ] ToS / privacy policy covering imported character data. (§7.4 item 6)
- [ ] Name/domain trademark check — no "PoE"/"Path of". (§7.4 item 7)

---

## 3. Honest-identity notes (Charter §7.5 rule 4)

These are the identity strings the app commits to. They back up the promises the email makes.

### 3.1 Proposed User-Agent string

GGG expects an honest, identifying User-Agent on API calls. Proposed format, following the
convention GGG documents for OAuth clients:

```
OAuth «client_id»/«app_version» (contact: «contact_email»)
```

Concrete example once values are locked:

```
OAuth exilelab/0.1.0 (contact: dev@«your-domain»)
```

Notes for the founder / implementer:
- ⚠️ Confirm the exact required format against GGG's current developer docs at registration
  time — GGG occasionally specifies additional tokens (e.g. a strict-mode marker). This spike
  cannot fetch that page (Charter §7.5 rule 1 + the team's no-external-fetch rule); verify it
  by hand when you have the approved `client_id`.
- The `«client_id»` is assigned by GGG on approval; wire it in then.
- Never obfuscate or randomize this string — an honest, stable UA is the whole point
  (Charter §7.5 rule 4; obfuscated user agents are listed as prohibited in §7.3).
- This is the single UA used by the isolated GGG-facing client module (the one component that
  holds all GGG-API risk behind one kill-switch, per `PRODUCT_PLAN.md` §9.2 / market-ingest).

### 3.2 Non-affiliation disclaimer text

Required verbatim-in-spirit everywhere the product is presented (§5.4 non-negotiable #4,
Charter §7.5 rule 4). Canonical wording from `PRODUCT_PRD.md` §5.4:

> This product isn't affiliated with or endorsed by Grinding Gear Games in any way.

Placement: site footer (site-wide), the OAuth consent hand-off screen, and any shared/embedded
report surface. Keep it plain text, always visible, never behind a paywall or a modal.

### 3.3 Compliance posture we're asserting to GGG (all already locked in Charter §7.5)

- **Official APIs only** for server-side collection; `account:characters` read is the only
  GGG endpoint this client touches. (rule 1)
- **Never POESESSID** — never asked for, stored, or used. (rule 2)
- **Never automate player actions** — no auto-whisper/buy/anything; alerts inform a human. (rule 3)
- **Rate limits are law** — header-driven token bucket, back off on 429, one kill-switch for
  the GGG client. (rule 5)
- **Comply-and-stop** — if GGG says stop, we stop, no workarounds. (rule 7)

---

## 4. Status & boundary (honest close)

- **Delivered:** a ready-to-send email, the decisions/fields checklist, and the committed
  identity strings — the complete package a founder can personalize and send today.
- **Blocked externally, by design:** actual submission (a human must send it) and approval
  (GGG's manual, discretionary, unbounded-latency review — `PRODUCT_PRD.md` §7.2, risk #1).
  No agent sends this and no agent can approve it.
- **Not gating Phase 1:** OAuth character import ships behind a feature flag that flips on when
  approval lands; PoB-code paste and `.build` upload work with zero GGG API in the meantime
  (`PRODUCT_PLAN.md` Phase 1 item 3, risk row "GGG OAuth slow/denied").
- **Next action for the founder:** resolve the §2.1 decisions (name, account, domain), then
  send §1 from your own mail client. Start early — this is the longest-lead item in Phase 0
  (`PRODUCT_PLAN.md` Phase 0 item S4).
