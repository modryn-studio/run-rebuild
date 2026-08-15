# Tradovate Partner API — build reference (recon 2026-07-18)

Read from the live docs (`partner.tradovate.com`, `.md`/`/llms.txt` endpoints) for the **dark-but-ready**
Tradovate backend. **This is the Partner / third-party / B2B-vendor API — NOT the personal/retail API.** The
distinction matters: the empty-`fill/list` problem competitors hit is a *retail-OAuth* artifact; the Partner
API exposes fills properly (below).

> Docs are AI-agent friendly: append `.md` to any page, `/llms.txt` for indexes, and there's an MCP server at
> `https://partner.tradovate.com/_mcp/server`.

## Auth (partner, not retail OAuth)
- Flow: `POST {host}/v1/auth/accesstokenrequest` with `{ name, password, appId, appVersion, cid, sec }`
  (username/password + App ID + API **secret** + CID). Returns `accessToken` + `expirationTime`.
- **Token life: 90 min; refresh at 85 min.** (Confirms Michelle's "rotate token on the live socket" concern.)
- Bearer token on REST; WebSocket auth after connect via `{ request: 'auth', accessToken }`.
- Requires **Organization Admin credentials + API Key + CID** (issued by an Eval Support rep).

## Hosts
- `live.tradovateapi.com` — live. `demo.tradovateapi.com` — **simulation/eval engine (where funded-eval
  accounts live)**. `md.tradovateapi.com` — market data. Staging: `*-api.staging.ninjatrader.dev`.

## READ path — the "during" fill stream (CONFIRMED)
`user/syncrequest` over WebSocket (`{host}/v1/websocket`) — real-time user/account sync.
- Body: `{ splitResponses, users?, accounts?, shardingExpression?, entityTypes[] }`.
- **`splitResponses: true` for any B2B vendor.**
- **`entityTypes` MUST be set** (default empty). Pass `"fill"`, `"fillPair"`, `"order"`, `"account"`,
  `"accountRiskStatus"`, `"cashBalance"`, etc. → this is the real-time fills read, and `accountRiskStatus`
  reads live lockout/risk state (the Sprint-2 "confirm the line held").
- **Sharding** (`divisor`/`remainder`, `modAccountId`/`modUserId`) to spread many accounts across sockets.
- → **Michelle's Q1 answered: a partner token DOES read `fill`/`syncrequest`.** The empty-array reports were
  retail OAuth, not this API.

## WRITE path — the lockout / auto-arm upgrade (CONFIRMED, documented)
- **Post-trade risk** (daily-loss auto-liquidate + lock): set `postTradeRisk` at account creation, or
  `POST /v1/userAccountAutoLiq/update` anytime. `doNotUnlock: true` keeps it locked after a daily-loss breach.
- **Immediate individual lock:** `POST /v1/accountRiskStatus/setAdminAutoLiqAction`
  `{ accountId, adminAction: "LockTradingImmediately", adminActionReasonCode, adminActionReason }`. Stays
  locked until explicitly unlocked (`adminAction: "Normal"`) — no auto-unlock, no timeout.
- **Category halt:** `POST /v1/accountRiskStatus/setDemoHalt { halt, riskCategoryId }`.
- **Pre-trade risk** (allowed products, max lot size) via Template Accounts / Risk Categories.
- → **Michelle's Q2 answered: API-write to arm/lock IS documented and real** — the "priced upgrade"
  (auto-arm) is technically de-risked. It is NOT undocumented as previously feared.

## The crux (the real 07-24 question is ACCESS, not capability)
Everything above operates on **accounts within an organization you administer** (partner provisions accounts
via `createEvaluationAccounts` / Template Accounts; endpoints need Org Admin creds + CID).
- Org-admin (API-key) read+write is **only on accounts in an org Run controls.** For a trader's account at an
  existing firm (a different org), the path is **user OAuth delegation, not the firm's cooperation** — see the
  corrected "Access model" section below (this crux note predates that live-doc read and understated it).
- **This is exactly why CSV-first (Path B) is correct**, and why the moat (corpus) must not depend on the API.
- **Native trader self-restriction IS supported** and maps directly to V1's Ulysses pact: a user may set their
  own post-trade risk "as long as MORE RESTRICTIVE than partner-level," and **Manual Lockouts** let "traders
  voluntarily lock themselves out for a set period." So the V1 binding (trader arms his own line while calm) is
  native — no API-write dependency.

## Access model — CORRECTED (live chrome-devtools doc read, 2026-07-18)
> **Supersedes the crux note above.** An earlier WebFetch pass mis-read this — it 404'd the OAuth page on a
> wrong slug (`o-oauth-token`; the real page is **`o-auth-token`**) and wrongly concluded "OAuth isn't a partner
> method / no clean cross-org path." Read live, the picture is *better*: OAuth delegation IS a first-class
> Partner API auth method and IS the standard cross-firm path.

**Two auth methods on the Partner API:**
- **API-key / org-admin** (`/auth/accesstokenrequest`; needs Org Admin + API Key + CID): machine-to-machine,
  **org-scoped** — manages accounts *Run's own org* provisions. Full read/write/lock on those.
- **OAuth authorization-delegation** (`/auth/oauthtoken`; user authorizes at `trader.tradovate.com/oauth`): the
  **user-consent** flow — a trader logs in with their own Tradovate credentials and grants Run a bearer token
  that acts **on their behalf, on their own accounts, regardless of which firm's org owns them.** This is the
  exact "Connect your Tradovate account" flow TradingView / TradersPost / PickMyTrade use. Standard OAuth2:
  `authorization_code` + PKCE (`code_verifier`), `client_id`/`client_secret` issued by Tradovate; token
  `expires_in` 3600s, refresh 14 days. Tutorial: `github.com/tradovate/example-api-oauth`.

**⇒ Cross-firm access is NOT gated on the prop firm.** A trader with an existing Apex/TopStep account can
authorize Run **directly via OAuth** — no firm cooperation, no own-org provisioning needed. What Run needs is to
be a **registered Tradovate OAuth partner** (issued a client_id/secret).

**The one precise open item (the real 07-24 / staging question): does an OAuth-delegated token READ FILLS on an
out-of-org account?**
- **Docs say yes:** `user/syncrequest` with `entityTypes:['fill','fillPair','accountRiskStatus','cashBalance']`
  is the documented real-time read, driven by a bearer accessToken.
- **But the 2026-07-10 recon found** third-party OAuth `fill/list` returning empty arrays (retail REST), with
  Partner/Enterprise creds + the Reporting API cited as the workaround. Reconcile: is that a *retail-API*
  artifact that doesn't apply to Partner-platform OAuth + `syncrequest`, or a real scope limit? **Confirm on the
  demo host in staging, or at the meeting.** *Write/trade* scope via OAuth is already proven in the wild
  (TradersPost et al. place live orders through it), so the open item is specifically **fills-read via OAuth**,
  not write.

**Heavier alternatives if OAuth fills-read disappoints:**
- **CTA Trading Permission** — `createTradingPermission` (partner-side, own-org) or `requestTradingPermission`
  (account-holder-initiated, "access as if your own account"). Docs **explicitly tell B2B partners NOT to use
  `requestTradingPermission`** — it's the compliance-reviewed managed-account/CTA route.
- **Own-org provisioning** (`createEvaluationAccounts` / `createPartnerSubaccountRequest`) — full control, but
  Run runs its own accounts (business-model change + AML/SSN onboarding).
- **CSV** — firm-agnostic, zero API dependency; the Path-B floor regardless.

**Implication for V1 (unchanged — still the right hedge):** V1 binds on the trader arming his **own native
lockout** (any account he controls, zero API-write) and reads via **CSV**, because OAuth partner registration +
the fills-read confirm aren't in hand yet. But the *upgrade path is cleaner than feared*: **OAuth delegation —
not firm-by-firm deals — is the route to live read + auto-arm on traders' existing accounts**, pending the
fills-read confirmation. Kay/Jobs' "never weld the core to the API; CSV is the floor" still holds.

## Live doc re-read 2026-07-23 (chrome-devtools CLI + the `.md`/`llms.txt` endpoints)

Re-verified this file against the live docs. **Everything above about auth and the read path checks out**,
and two things below it did not.

**Confirmed accurate, no change needed:** 90-min token / 85-min refresh · OAuth is a real Partner API method
at `/auth/oauthtoken` (`authorization_code` + `code_verifier` PKCE, `expires_in` 3600, `refresh_token_expires_in`
1209600 = the 14 days claimed above) · `user/syncrequest` semantics verbatim (`splitResponses` true for B2B,
`entityTypes` mandatory and empty by default, sharding via `modAccountId`/`modUserId`) · demo = the sim/eval
engine and live = graduated accounts (the demo→live transition is a partner-org operation needing POA,
government ID and proof of address).

### CORRECTION 1 — the API DOES have per-fill fees. `/fillFee/list` exists.
This file and `docs/data-model.md` both say there is no fee source on the API path (issue #23), which is why
Cash History is a required CSV upload. **That is wrong.** `GET /v1/fillFee/list` returns `FillFee` entities
carrying **`commission`, `exchangeFee`, `clearingFee`, `nfaFee`, `brokerageFee`, `ipFee`** - a **superset** of
Cash History's four lines, and **keyed per fill**.

Why this matters beyond "one more endpoint":
- `feeBucket()` in `src/lib/csv/shared.ts` joins fees to fills on `(local timestamp, contract)` **only because
  Cash History names no fill id.** The API path has a real fill-id key, so that string-matching hack is a
  CSV-intake concern, not an architectural one.
- It removes "Cash History is a REQUIRED upload" **for API-connected traders** (still required for CSV-only).
- Two fee types (`brokerageFee`, `ipFee`) do not appear in the CSV at all, so net P&L computed from the API
  could be *more* accurate than from the export, not merely equal.

### CORRECTION 2 — `fill/list` takes no date range, and no retention limit is documented anywhere.
The OpenAPI spec for `/v1/fill/list` is literally *"Fetches all Fill entities"* with a single `Authorization`
header parameter: **no date range, no pagination, no cursor.** A grep of the full 61KB `llms.txt` index finds
**zero** mentions of retention, lookback, history windows or archiving.

⇒ **The backfill-depth question (meeting Q5) cannot be answered from the docs. It has to be asked or measured.**
That is now confirmed rather than assumed, and it is why Q5 stays on the list. `user/syncrequest` does state it
sends an *"initial incoming dataset"* before streaming updates, but never says how far back that reaches.

### TRAP — every OpenAPI example points at the DEMO host and labels it "production".
Every endpoint spec on the site carries `servers: - url: https://demo.tradovateapi.com/v1` with
`description: production`. That is their docs being sloppy, and it is a live trap for us: copying any example
verbatim points a **live/retail** trader at the **eval** host. Reinforces the per-connection host column
(`widening-plan.md` §5.3) rather than a single global `TRADOVATE_API_BASE` default.

## What to build dark-but-ready (per Michelle Sprint-1 #7)
- Auth adapter: `accesstokenrequest` + token store + **85-min refresh** (rotate on the live socket).
- Reporting/historical adapter → Layer 1 (same `fill` events as CSV; dedupe on Fill ID — already reserved).
- `user/syncrequest` listener on an always-on worker (Fly/Railway), `entityTypes:['fill','fillPair','order',
  'account','accountRiskStatus','cashBalance']`, reconnect + gap-backfill via the historical pull.
- All dark until vendor creds + the org-access model land (~07-24). Keep it behind the platform-adapter seam;
  never weld the core to Tradovate.

## 07-24 meeting — the sharpened questions (post live-doc read)
1. **The one open item — OAuth fills-read:** for a trader's own account at an existing firm, connected via
   **OAuth delegation**, does the delegated token read fills through `user/syncrequest`
   (`entityTypes:['fill',...]`), or does it hit the empty-array problem the 2026-07-10 recon saw on retail REST
   (needing Partner/Enterprise creds + Reporting API)? This is the single gate on the "during" beat for
   *existing* accounts.
2. **OAuth partner registration:** how does Run get issued an OAuth `client_id`/`client_secret`, and what
   scopes does a delegated token carry (read fills? set risk / arm lockout, or read-only)?
3. **Own-org path (fallback):** if OAuth read is limited, what's the partner/reseller onboarding + economics +
   regulatory footprint to provision Run's own accounts?
4. Creds issuance (Org Admin + API Key + CID) + staging (demo host) access for the dark-listener soak.

### Added 2026-07-23 (from the widening review — `modryn-hq/projects/twin/widening-plan.md`)
5. **How far back does the OAuth read actually BACKFILL?** Is there a lookback cap (90 days? a year? full
   account history?), and does it differ between a live/retail account and a funded/eval one? **Why it matters
   far more than it looks:** it decides how copyable a retail trader's tape is, and **both answers cost
   something** - write that down before asking, so whichever lands cannot be narrated as a win.
   - **Deep backfill:** a retail trader arrives *thick* (good: the thin-corpus problem eases), but a competitor
     onboarding him in 2029 reconstructs everything Run captured since 2026 (bad: the tape confers no durable
     advantage).
   - **Bounded backfill:** Run's tape becomes uncopyable for retail after roughly a year (good), but retail
     arrives as *thin* as prop and the hardest V1 problem stays hard (bad).

   Circumstantial hint that it IS bounded: competitors keep CSV import specifically for "deeper/older history
   the API doesn't backfill," and TradeZella exposes a custom historical start date. Full branch table:
   `widening-plan.md` §3.4.
6. **Live vs demo host, per connection.** A retail trader is on `live.tradovateapi.com`; funded-eval accounts
   are on `demo.`. Does one OAuth consent resolve a user's accounts across **both** hosts, or must the
   connection know which host to target up front? Determines whether Run needs a per-connection host column
   (planned regardless, `widening-plan.md` §5.3) and whether the connect UI needs one card or two.
