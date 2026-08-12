# Analogous Products — the "it knows you" feature-world (UI/UX reference)

> **WINNER, and it is not close: MONARCH (Luke, 2026-08-10).** Promoted from one of six analogs to **the**
> model — for Run's **information architecture and in-app register**, not its marketing look. The full authed,
> surface-by-surface read is [`ia-teardown.md`](ia-teardown.md) §1; the doctrine it produced is
> [`monarch-for-traders.md`](monarch-for-traders.md). The rest of this file stands as written — the analogs
> below still carry the lessons attributed to them — with **two corrections** the authed read forced:
> 1. **The 2026-07-08 Monarch entry below measured `monarchmoney.com`, the marketing site (48px / weight 350,
>    Copernicus serif).** `app.monarch.com` is a different object: **16px base, weight 400, ABC Oracle, one
>    family, no serif in-app**, warm paper `#f6f5f3`, ink `rgb(34,32,29)`, 12px cards with an ink-tinted
>    elevation. Calm and **dense**. Anywhere these docs cite Monarch as validation for big-light display type,
>    that citation was to the door, not the room. Line 96's "convergent lesson" is a lesson about **landing
>    pages**.
> 2. **The design direction distilled at line 117 is about surface craft; the thing actually worth copying is
>    structural** — a flat nav ordered by the user's questions, depth in the page header, a per-page digest of
>    the *filtered* set, freshness on every synced row, saved views as an object, and **AI attached to every
>    surface while being a nav row nowhere.**

**Purpose:** before copying UI, study the products users *already trust* for the same *kind* of service
as Twin's #1 — a model of you, built from your data, that finds your patterns/leaks and coaches you.
Non-trading is fine; the point is the UI/UX conventions users are used to for this feature-world.
(Companion to the competitor master list in `recon.md` — those are *direct* rivals; these are *analogs*.)

**The abstraction:** ingest your behavior across sources → build a model of you → surface your
strengths + repeating weaknesses → coach/nudge → compound over time. Twin is this for prop trading.

---

## The field (successful, paid — grouped by what they teach us)

### 1. Poker trackers — the cultural cousin (tilt, leaks, bankroll: same psychology as prop)
- **PokerTracker 4** ($65–160 one-time), **Hold'em Manager 3** ($65–160), **Hand2Note 4** ($16/mo).
- **LeakTracker** literally flags your statistical leaks *vs winning players* ("BB defense, c-bet freq,
  river bluffing"). This is Twin's "failure signature," already a proven, paid convention.
- **Mine:** the leak-finder pattern + "you vs. a winning baseline." **Don't copy the look** — dense,
  dated desktop UI. Access: desktop apps → marketing sites + screenshots only.

### 2. Chess insights — cross-session behavioral profile, mass + modern
- **Chess.com Insights** (Diamond, paid): accuracy, common mistakes, **time-of-day/day-of-week success**,
  per-phase strength/weakness; "after 10–20 games you see your weakness patterns"; runs in background,
  notifies when ready. + **Aimchess**, **NextMove** (3rd-party: "look across your recent games to find
  the habits/decisions that repeat").
- Nearly 1:1 with Twin's #1 ("here's how you lose, across games"). **Mine:** how they present a
  cross-session identity + repeating-weakness surface at scale. Access: **web (chess.com)** — live-readable
  with a Diamond login.

### 3. Health wearables — the living daily companion (the GOLD standard for the feel)
- **Whoop** — 2.5M members, ~$600M+ ARR, **80%+ retention**, $30/mo. Daily Recovery/Strain **coaching**,
  always-on model of you.
- **Oura** — ~5M subscribers, ~$1B→$1.5B revenue, $5.99/mo. Readiness + trend insights.
- **The reference for "living surface, not a brief"** — calm, premium, habituating, present-tense. This is
  the closest to the direction we chose for Twin A. Access: mobile-first (web dashboards exist behind
  login) → best via marketing sites + Luke's screenshots.

### 4. Cross-account finance — the STRUCTURAL twin (cross-firm = cross-account) + best-in-class craft
- **Copilot Money** ($10.99/mo, iOS) — "best-looking finance app," thoughtful data-viz, ML spending
  insights/forecasts. **Monarch** ($14.99/mo, web+mobile) — comprehensive cross-account dashboard.
  **Cleo** — conversational AI money coach (chat-first = the #2 reference).
- Aggregating across accounts + behavioral insight = Twin's structure exactly. **Mine:** Copilot's
  data-viz craft; Monarch's multi-account model; Cleo's conversational surface. Access: Copilot = iOS-only
  (screenshots); **Monarch = web** (live-readable with login); Cleo = mobile.

### 5. Athletic identity / AI insight — mass-market "your data → personalized insight"
- **Strava Athlete Intelligence** — AI turns your activity data into personalized insights, trend-spotting,
  progress vs last 30 days. Identity + coaching at scale. Access: **web (strava.com)** — live-readable with
  a subscriber login.

### 6. AI habit/behavior coaches — conversational-layer references (placeholders only)
- **Noom** (CBT behavior change), **Rocky.ai**, **Lifestack**, **Cleo** — named as *conversational* (#2)
  references but never live-read. **Superseded** by the dedicated **"#2 analogs" section below** (Bee /
  Granola / Superhuman / OS ambient patterns), which is the real two-phase #2 recon. Keep for the *coach
  voice* angle only.

---

## Shortlist to live-read / study next (ranked for Twin)

| Product | Why | Access for live-read |
|---|---|---|
| **Whoop / Oura** | The "living daily companion that models you + coaches" feel — Twin A's direction | Mobile-first → marketing site + Luke screenshots |
| **Copilot Money** | Cross-account + award-winning data-viz craft (structural twin) | iOS-only → screenshots / Luke shows |
| **Chess.com Insights** | Cross-session weakness/pattern surface, 1:1 with #1 | **Web** — Diamond login |
| **Strava Athlete Intelligence** | Mass-market data→insight identity | **Web** — subscriber login |
| **Poker LeakTracker (PT4)** | Cultural cousin; the leak-finder convention | Desktop → screenshots |
| **Cleo / Monarch** | Conversational #2 (Cleo) + multi-account model (Monarch, web) | Cleo mobile; **Monarch web** |

**Read:** the *feel* Twin wants (living, calm, premium, present-tense) is proven by Whoop/Oura at huge
retention; the *structure* (cross-account + data-viz) is proven by Copilot; the *content surface*
(cross-session leak/pattern finding) is proven by Chess.com Insights + poker trackers. Copy the
conventions the target user already trusts from these — not from TMI/TILT.

---

## Live-read findings — public/landing pass (2026-07-08)

Visual signatures pulled via chrome-devtools CLI. The craft lessons converge hard:

- **Whoop** (whoop.com) — white editorial, **Proxima Nova**, hero at **120px / weight 400** (light!),
  −3.6px tracking; calm benefit copy. Premium = *big + light + calm*, not big + black.
- **Oura** (ouraring.com) — **Editorial New (serif) + Akkurat (sans)**, hero **96px / weight 300**;
  luxury-wellness editorial. Serif display + precise sans = premium.
- **Monarch** (monarchmoney.com) — **warm paper #f6f5f3**, **Copernicus (serif) + ABC Oracle**, hero
  48px / weight 350. **This is the register match** for a cross-account behavioral-money product — and
  it's essentially our **B "Dossier"** direction (warm paper + refined serif). Strong validation.
- **Cleo** (screenshots) — warm playful **conversational chat**: big "Hey you 👋" greeting, persona
  voice, thinking states ("Hold on…"), chat input pinned bottom. Good **#2 structure** reference — but
  its sassy/emoji voice is the *opposite* of Twin's calm-trust; take the structure, not the tone.
- **Aimchess** (aimchess.com) — Montserrat; value prop "see what's holding you back from your peak."
  Content-surface framing only (login bot-walled).

**The convergent lesson:** the beloved, paid products in this feature-world are **editorial, light-weight,
big-type, calm** — Oura/Monarch lean *serif*. Nobody here is loud/dark/neon (that's TMI/TILT).

## Still to read (authed — Luke logs in, all web)

- **Copilot Money** (app.copilot.money/login, email) — best-in-class data-viz craft; structural twin.
- **Chess.com Insights** (chess.com/insights, Diamond) — the cross-session leak/pattern surface (≈ #1).
- **Strava Athlete Intelligence** (strava.com) — mass-market data→personalized-insight.
- **PokerTracker 4** — desktop app (not web); study from Luke's screenshots.

### Authed pass (2026-07-08)
- **Copilot Money** (read inside) — white, **Matter** (premium chosen sans), deep-slate ink text
  `#143352` (never black), **zero gradients**, soft rounded cards (16–20px) with *neutral* elevation
  shadows, **24 crisp SVG charts**. Lesson: **premium data-viz is flat + crisp + restrained**, data as
  hero. (Note: tasteful *neutral* card shadows are fine — the ban is on *colored/neon* glow, not elevation.)
- **Chess.com** — Cloudflare-blocked in automation; skip live, use screenshots if wanted.
- **Strava** — Luke's account empty (0 activities → onboarding); Athlete Intelligence had no data. Dead end.

### Authed pass 2 — Monarch, all eleven surfaces (2026-08-10) → [`ia-teardown.md`](ia-teardown.md) §1
The one that was still owed, and it changed the plan rather than confirming it. Headlines: eleven flat nav rows
ordered by the user's questions; **no AI row** (a button on each dashboard widget, a global panel, and a generated
**Weekly Recap** that arrives as a 5-step walkthrough); Reports as *"one dataset, many lenses, savable"*
(Sankey/Pie/Treemap/Breakdown/Trend, grouped by category / group / merchant / fixed-flexible); a freshness stamp
(`22 hours ago`) on every account row; per-page stat digests of the *filtered* set; and — the strategic tell —
**a nav row being deleted** (Cash Flow folded into Reports). The recap's prose names merchants, compares to last
week and paces against a plan, and repeats a data-honesty note on every step. That is the bar, and it is set by a
personal-finance app rather than by anyone in trading.

---

## Design direction for Twin (distilled from the analogs)

The conventions this feature-world's *paying, beloved* products share — copy these:

1. **Type:** a chosen premium face (Matter / Proxima / Copernicus / Editorial New — never Geist/Inter
   default). Display type **light (300–400) and large**. Serif-editorial recurs for the calm/premium ones.
2. **Color:** considered neutrals (white or warm paper); ink text is **deep slate, never #000**. ONE
   restrained accent. **~Zero gradients.** No neon.
3. **Surface:** soft rounded cards (16–20px) with neutral elevation *or* flat hairline borders; generous space.
4. **Data-viz:** many crisp **SVG** charts, restrained color — data is the hero (Copilot).
5. **Feel:** calm, present, benefit-led. Conversational layer = chat + persona + thinking states +
   bottom input (Cleo) — but a **calm** voice, not sassy.
---

## #3 analogs — "intervene at the moment of an impulsive action" (other markets, 2026-07-08)

The direct #3 competitors don't build true pre-click intervention (see `recon.md` Round 5). The *job* —
a real-time agent that detects a risky behavioral moment and intervenes **before** the action — is solved
far better in three other markets. Each gives Twin's #3 a concrete, evidence-backed lesson:

1. **one sec** (one-sec.app) — **the purest analog.** Inserts a calm **friction-pause** (a breath) before
   you open an impulsive app: *"interrupt, don't block," "break your muscle memory,"* you stay in control.
   Science-backed (Max-Planck studies; ~57% usage drop). Dark Apple-native, SF Pro Rounded, calm.
   **Lesson:** the intervention is a *moment of self-awareness*, not a wall — add friction + reflection at
   the revenge-click, don't paternalistically block the trade.
2. **Responsible-gambling AI — Mindway AI (GameScanner) · Playtech BetBuddy** — **the structural twin** in
   an adjacent risk/money/impulse domain. Real-time behavioral-risk detection: monitors play live, flags
   the **"red zone,"** matches a player's pattern to *past self-excluders*, then triggers limits / cool-off /
   self-assessment. Neuroscience + ML + expert oversight; 9M+ players monitored. **Lesson:** the
   "red-zone early-warning" framing + **pattern-match to your own past failures** ("this looks like the run
   that blew 5 accounts") is a trusted, proven model — exactly Twin's pitch.
3. **Driver-safety coaching — Samsara · Netradyne (Driveri) · Motive** — **real-time in-the-moment nudge.**
   AI detects distraction/drowsiness and fires an in-cab nudge **within milliseconds** so the driver
   "corrects before it becomes an incident." Risk-prioritized (45+ factors); alerts deliberately tuned so
   they **don't become excessive**. **Lesson:** fire *instantly at the decision point*, only on real risk,
   and **manage alert-fatigue** — over-alerting is the failure mode that would kill Twin's trust.

**Synthesis for Twin #3:** a **calm friction-moment** (one sec) triggered by **real-time risk-zone
detection pattern-matched to your own blow-ups** (Mindway), fired **instantly at the click, only on real
risk, without over-alerting** (Samsara). That's evidence-backed and years ahead of the direct market's
"alert every 2 min" / "auto-lock after 3 losses."

**Access for deeper reads:** one sec / Opal / Jomo = mobile (marketing sites + screenshots); Mindway /
BetBuddy = B2B (marketing + case studies); Samsara / Netradyne / Motive = B2B (marketing + demo videos).
None need a login for the marketing-level UX language; the mobile ones want screenshots for the in-app moment.

---

## #2 analogs — "ambient/agentic surface, not a dashboard you visit" (other markets, 2026-07-08)

Direct trading #2 = on-demand chat tabs + scheduled debriefs (see `recon.md` Round 6) — none ambient. The
*job* — a proactive, always-present AI that surfaces the right thing **without you opening it** — is
defined and best-crafted in two other places: **ambient-AI products** and **OS-level glanceable patterns**.

**Ambient-AI products (the concept + the calm register):**
1. **Bee** (bee.computer) — wearable ambient AI: "understands you," "learns and grows with you," "ready
   when you need it," "notice." Warm off-white, restrained (1 gradient, 9 pills). **Lesson:** the
   ambient-companion *voice* (present, knows-you, ready) + calm warm craft — closest register to Twin.
2. **Granola** (granola.ai) — runs "in the background"; the output just *appears* (app is famously
   calm/minimal — study the app, not the pill-heavy landing). Premium light-large type (76px / weight 400).
   **Lesson:** the ambient value is *"it already did it"* — surface a finished read, not a blank chat box.
3. **Superhuman** (superhuman.com) — premium custom font, restrained (3 pills); "proactive," "before you,"
   "notice." **Lesson:** proactive-nudge language in a calm premium register.
4. **Limitless** (RIP — acquired by Meta, Dec 2025) — *was* the purest ambient copilot: "surfaces relevant
   info without asking." Historical, but the cleanest one-line definition of #2.

**OS-level glanceable-presence patterns (the UI *language* users already know for "present, not a page"):**
- **iOS Dynamic Island / Live Activities** — a persistent, glanceable, *live-updating* status, always there
  without being a screen you open.
- **Apple Watch Smart Stack / complications · Google proactive cards · Nest ambient display** — proactive,
  glanceable cards that surface the relevant thing by context, unprompted.
**Access:** Bee / Granola / Superhuman = web marketing (live-readable) + app screenshots for the in-app
ambient moment; OS patterns = Apple/Google design docs + your own device (screenshot).
