# Prop accounts: what a trader actually has, and what Tradovate will tell us

> Started 2026-07-29 while scoping the Accounts page, expanded 2026-07-30 from Luke's own explanation plus
> verification against his real exports, live sources, GitHub and web search. **This is the file to read before
> touching anything that models an account.** It exists so the same ground does not have to be re-explained.
>
> Every claim here is either (a) verified against Luke's twelve real CSV files, (b) sourced with a URL and a
> date, or (c) explicitly labelled as Luke's account of his own trading. Nothing is from memory.

---

## 1. The world a prop trader actually lives in

Luke's account of it (2026-07-30), which reshapes several assumptions the app was carrying:

**One trader, many accounts, and that is the normal case, not the power user.**
- Two kinds of prop account: **evaluation** and **sim funded**. Plus, sometimes, a **personal** Tradovate
  account with the trader's own money. A trader can hold all three at once.
- Traders buy **several accounts at one firm** and **accounts at several firms**.
- They trade them **individually, copy-traded, or a mix**, and it changes day to day. Copy trading happens
  **between different firms**, not just within one.
- **Most accounts renew monthly unless cancelled, including failed ones.** So a dead account can still be
  billing, and "how many accounts do I have" is not the same question as "how many am I trading."

**Every firm issues its own Tradovate login.** This is the single most useful fact in this document.
- A prop firm assigns the trader a **Tradovate username and password specific to that firm**. A trader with
  accounts at three firms is managing three sets of credentials, plus a fourth if they have a personal account.
- **Therefore: one login = one firm = one account-name prefix.** That is what makes §2's "ask once per prefix"
  correct rather than a convenient shortcut, and it is what makes the OAuth path answer the firm question for
  free later (one connection is one firm, so the trader names it once at connect time).
- It also means credential sprawl is a real, felt problem for this user, sitting right next to the thing Run is
  already building. Noted as an opening; not a V1 commitment.

**Retail traders are in scope too**, not only prop (`modryn-hq/projects/twin/widening-plan.md`). A retail
Tradovate trader normally keeps **one** account for years, which is the exact inverse of the prop pattern. So
`/accounts` has to read well at one row and at fifteen.

---

## 2. The prop firm's name is not in the data. Anywhere.

**Verified 2026-07-29, re-verified 2026-07-30** against Luke's exports from **two different prop firms**, all
six Tradovate export types each (Fills, Orders, Cash History, Position History, Performance, Account Balance
History). Twelve files. A grep for every firm name and for the word "prop" returns **zero occurrences**.

| | Firm A | Firm B |
|---|---|---|
| `Account` / `Account Name` | `ELTDENF260623134425853685` | `FTDFYL100183704873` |
| `Account ID` | `55206944` | `56963172` |
| Actual firm | **TradeDay** | **Tradeify** |
| Firm named anywhere in the files | **no** | **no** |

This is **not an export limitation** - it is how Tradovate models the world. From the Tradovate community forum
(2026): *"because prop firms are separate companies, accounts cannot be grouped directly inside Tradovate."*
The firm is the account's *owner*, sitting above Tradovate's object graph.

**⇒ OAuth will not fix this.** The vendor API returns the same account object. Do not plan as though the live
socket rescues it later. What OAuth *does* fix is cheaper: the trader authenticates per firm-issued login, so
the firm can be captured once per connection instead of once per account.

### 2.1 The prefix encodes the firm, and the letters are NOT readable. This cost a real mistake.

On 2026-07-29 the prefix table shipped with one entry, `ELTD -> Elite Trader Funding`, reasoned from the
letters. **`ELTDENF…` is a TradeDay account.** The second prefix, `FTDFYL…`, decodes to nothing at all by eye
and is **Tradeify**. So on a sample of two: one confident-looking guess was wrong, and the other was
unreadable.

That is the worst possible pair of outcomes, on the one page whose entire job is proving Run pays attention to
this trader's own accounts. Luke's framing is the right one: *"Run will look really bad when guessing wrong."*

**Nobody has published a decoder either.** Searched 2026-07-30 across web search and GitHub (`gh search repos`
over Tradovate and prop-firm-rules projects, ~40 repos reviewed): **no repo, no forum thread, no vendor doc maps
Tradovate prop account prefixes to firms.** There is nothing to import and nothing to check our work against.

**So the standing rule, enforced in `src/lib/prop-firms.ts`:** a prefix entry exists **only** because a real
trader confirmed a real account from that firm. Never because the letters look like a name. A missing prefix
costs a one-tap question; a wrong one tells a trader something false about their own money.

*(One observation, recorded but deliberately not built on: `ELTDENF260623134425853685` contains what looks like
a creation timestamp - `260623` `134425` reads as 2026-06-23 13:44:25. `FTDFYL100183704873` shows no such
pattern. One sample each. Not a format, an anecdote.)*

### 2.2 What IS recoverable, and how confident we can be

| Field | Source | Confidence |
|---|---|---|
| **Firm** | account-name prefix, **looked up** in confirmed pairs | **recall, not inference.** Null is the normal answer. |
| **Size** | Cash History's opening `Fund Transaction` row (Firm B: exactly `100,000.00`) | **exact** when the export covers the account's first day. Otherwise a guess: Firm A's balance history opens at `105,326.00` with `1,983.70` already realized, so the number on the first available day is not the account size. |
| **Phase** (evaluation / sim funded / personal) | **nothing** | **not derivable, ever.** A funded account and an eval produce byte-identical files. Must be asked. |

**The split that shapes every intake flow: firm is recallable, size is sometimes computable, phase must be
asked.**

### 2.3 The consequence for UI

**You cannot ask for firm/size/phase before an upload.** The number of accounts inside an export is unknown
until it is parsed, and a copy-trader's export contains many. So capture is a **post-ingest confirm step**
("here is what I found, correct me"), never a pre-ingest form. That is also the better product: Run's promise is
that it knows you, so after a file lands it should *state what it found* rather than interrogate.

**And it is asked once per prefix, not once per account.** One login per firm (§1) means one prefix is one firm,
so a copy-trader importing eleven accounts across two firms answers "which firm" **twice**. Only the firm
spreads across siblings - phase and size stay per-account, because a trader farming five evals can have exactly
one of them promoted, and spreading that would be Run inventing a fact.

**The table improves on its own, which is the real payoff.** Every trader who labels an account writes
`firm_source = 'stated'`, so confirmed (prefix -> firm) pairs already accumulate in the corpus with no new
schema:

```sql
select substring(external_account_id from '^[A-Z]+') as prefix, prop_firm, count(*)
  from account where firm_source = 'stated' and prop_firm is not null
 group by 1, 2 order by 3 desc;
```

Each answer makes the next trader's intake shorter. Promote confirmed rows into `CONFIRMED_PREFIXES`.

---

## 3. Which firms are even reachable

**Source: `prop.tradovate.com/find-a-prop-firm`, read 2026-07-30.** Twenty live, three coming soon. The full
list and Tradovate's own ordering live in `src/lib/prop-firms.ts` (`PROP_FIRMS`), which is the single copy - do
not duplicate it here and let the two drift.

- **Live (20):** Take Profit Trader, Tradeify, Funded Futures Family, BluSky Trading Company, TradeDay, Lucid
  Trading, FundedNext Futures, Top One Futures, Legends Trading, The Trading Pit, Elite Trader Funding, Blue
  Guardian Futures, FuturesElite, Phidias, HolaPrime, AquaFutures, EmergeProfit, FXify, Goat Funded Futures,
  LifeUp Trading.
- **Coming soon (3):** Apex Trader Funding, My Funded Futures, Purdia Capital. Notable because **Apex is one of
  the largest futures prop firms** and is not on this rail yet.

**Topstep is not on Tradovate and is not coming.** Verified 2026-07-30: Topstep removed every third-party
platform in July 2025 and moved all accounts to its own TopstepX; the ProjectX backend that still routed legacy
Tradovate-hosted Topstep accounts was **shut down for third-party firms on 2026-02-28** (Topstep acquired
ProjectX outright in late 2025). A Topstep account cannot reach Run through this rail at all, so listing it
anywhere would promise an intake that does not exist. It arrives with a ProjectX/TopstepX rail or not at all.

---

## 4. Account rules: do not ask the trader, and do not guess

Each firm sells several **products/plans** ("Growth", "Select", "Lightning" at Tradeify, and every firm names
its own differently), and each plan carries its own **max drawdown, daily loss limit, trailing-DD style,
consistency rule and payout terms**. The plan is not in the export either.

**Two options were considered and one is rejected.**

**Rejected: ask the trader to enter their rules.** That is homework, and it is the journaling grind this product
exists to end (Luke, 2026-07-30). Nothing in the app asks for a drawdown number and nothing should. `firm` +
`product_name` is enough to look a rulebook up later; asking a trader to transcribe one is asking them to be the
database.

**Open: a Run-maintained rulebook, crawled and refreshed.** Luke's suggestion (weekly/monthly crawl into a Run
prop-firm knowledge base) is sound, and **the research says nobody has done it for futures**:

| Existing attempt | What it is | Verdict |
|---|---|---|
| `HFTArbitrage/prop-firm-rules-watchdog` | daily crawl of ~20 firms' rules pages into a Google Sheet, git history per change, MIT | closest to Luke's idea and **already built** - but **forex** firms (FTMO, FundedNext, The5ers). 1 star. The `firms.yaml` + selector-per-firm shape is worth copying. |
| `HFTArbitrage/prop-firm-rules-database` | "40+ forex prop firms" | forex. |
| `oxyalgo/trading-seatbelt-os` | pre-trade risk governor + **futures** rule packs (TakeProfitTrader, Topstep, Apex), MIT | the only futures one found, and it is aimed at Run's own #3 wedge. 4 tiny JS rule packs. 0 stars. Worth reading before building. |

**No API exists.** No commercial or open endpoint returns futures prop-firm rules. So: build it or do without
it. **Not V1** - `widening-plan.md` §5.2 is explicit that firm rulebooks are an **optional overlay** and the
trader's own self-set loss line is the spine. Getting that backwards makes Live the one surface needing a
rewrite to serve retail.

---

## 4a. Open question: does Run take money from prop firms?

Raised by Luke 2026-07-30, in the specific form *"maybe in the future prop firms can pay to have their firm at
the top of the list"* (the firm picker's **Most popular** section, `POPULAR_PROP_FIRMS`). **Recorded, not
decided.** Two separate issues, and the second is the real one:

**The label.** "Most popular" that is actually "paid" is a lie told on the screen whose job is proving Run is
straight with this trader. If placement is sold, the section has to be renamed (Featured / Sponsored), the paid
rows marked individually, and an unpaid popularity list kept underneath. Cheap to do, and non-negotiable if the
first issue resolves in favour.

**The conflict.** Run exists to stand between this trader and the account they are about to blow. A prop firm's
revenue comes from evaluation fees and monthly renewals - including on failed accounts, which keep billing
unless cancelled (§1). So the firm makes money when the trader fails and re-buys, which is the precise outcome
Run is built to prevent. Affiliate revenue from futures prop firms is real and substantial, and taking it would
put Run on both sides at once. Worth deciding deliberately and out loud, before any surface implies an answer.

---

## 5. Vocabulary: "failed" stays

Researched 2026-07-30. The landscape:

- **"Blown"** is the trader's own word, universal and informal. *"Blowing an account"* = breaching risk
  parameters, not necessarily losing every cent.
- **"Breached"** is the firm's word for the rule violation.
- **"Failed"** is what the firms themselves print on their own dashboards for an evaluation that ended.

**Decision (Luke, 2026-07-30): keep "Failed."** It is the industry's own word and traders can read their own
vocabulary. An earlier pass softened it to "Ended," which is Run being squeamish about the trader's life on the
one page that promises to hold the record of it without flinching.

**But the word depends on the phase**, and that is a real distinction rather than a hedge (implemented as
`statusLabel` in `src/lib/prop-firms.ts`):

| Phase | Active | Ended well | Ended badly |
|---|---|---|---|
| Evaluation | Active | **Passed** | **Failed** |
| Sim Funded | Active | *(no such event - you get paid, you don't "pass")* | **Failed** |
| Personal | Active | - | **Closed** *(it was never in an evaluation to fail)* |

Stored values stay three (`active` / `passed` / `failed`, CHECK-constrained). Only the label varies.

---

## 6. The deletion moat: scope it precisely

**Corrected by Luke twice (2026-07-29, 2026-07-30).** Several docs said or implied the deleted sessions are ones
*"nobody else keeps."* That is false, and stating it that way makes the moat easy to knock down.

**What actually happens:** **Tradovate** - the **broker**, not the prop firm - deletes the account and its trade
history once an evaluation or sim-funded account breaches and is marked failed. Timing: `recon.md:6` records
**"within minutes-to-hours"**, and Luke's lived experience is checking ~1 hour later and finding it gone. Same
trading day either way.

**What competitors have:** TradeZella and TradesViz retain whatever they had **already synced**, on their own
servers, until the user deletes it. A trader journaling with them through a blown account keeps that history.

**The sharpest true version of the claim** (`recon.md:140`, and it is stronger than the retention argument):

> A competitor architected around a **daily batch sync** fires *after the account is already gone*. So the
> blow-up session - the one that matters most - is the one most likely to have **never been captured at all**.
> Not "stored history lost." Last session never captured.

And the ownership version:

> Whoever was connected when the account died holds the **only** copy. Nobody can acquire it afterwards, at any
> price, because the broker's row no longer exists to backfill from.

That is a **first-mover moat** (be the one connected, in real time, when it happens), not a **uniqueness moat**.
The difference is not academic:

- It makes **connect-early** and **real-time capture** the things that matter commercially, not connect-at-all.
- A competitor onboarding the same trader **today** starts accumulating an identical asset from today forward.
  The gap is frozen at whatever Run captured first and never widens on its own.
- It is consistent with `widening-plan.md` §3.2 (*"a moat that does not widen with time is a head start"*) and
  with §3's standing rule: never write *"Run has no moat"* - write *"the moat protects prop; retail is added
  reach, not moated."*

**House rules:** never write "nobody else keeps it." Never write "your prop firm deletes it" - **Tradovate**
does. Write the scoped versions above.

---

## 7. What this is implemented as

| Concern | Where |
|---|---|
| Confirmed prefixes, firm list, sizes, phase + status labels | `src/lib/prop-firms.ts` |
| `account.prop_firm` / `firm_source` / `size_dollars` / `phase` / `product_name` + CHECKs | `src/lib/db/schema.ts`, migrations `0018`, `0019` |
| Roster read (accounts + fills + net P&L per account) | `src/lib/data/accounts.ts` |
| Create by hand / label after import | `src/app/api/accounts/route.ts` (POST / PATCH, `applyFirmToPrefix`) |
| The three questions as shared fields | `src/components/views/accounts/account-fields.tsx`, `firm-picker.tsx` |
| Add-account door, label-an-account confirm | `add-account-modal.tsx`, `label-account-form.tsx`, `account-modals.tsx` |

**Related debt.** `widening-plan.md` §5.5 flagged that `account.firm` holds the *platform* (`'tradovate'`),
hardcoded, with nothing branching on it. It still does; `prop_firm` is the real firm now sitting beside it. The
rename to `platform` is deferred to ride along with §5.3's per-connection-host migration, which must land before
the first real broker connection.
