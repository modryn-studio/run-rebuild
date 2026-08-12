# Market hours, and what a "trading day" is

> Written 2026-08-12 during `S2`, after Luke asked whether Run works for a trader who is not
> trading NQ and MNQ. **Read this before touching anything that buckets by day** — `sessionDateFor`,
> `bucketStartFor`, or any figure that says "your worst day".

**Every figure below was read from CME Group's own contract-spec service on 2026-08-12**, not from
a summary and not from memory:

```
GET /CmeWS/mvc/ProductSlate/V2/List?...        the roster: globex root, exchange, product group
GET /CmeWS/mvc/ContractSpecs/List/productId/N  per product: contract unit, tick, trading hours
```

Scope is **what a Tradovate prop or personal account can reach**: CME, CBOT, NYMEX, COMEX.

---

## 1. Three different hours, and only one of them is the boundary

The codebase used to look like it contradicted itself about 5pm and 4pm. It does not; they are
answers to different questions.

| | span | what it is |
|---|---|---|
| **the trade date** | 17:00 CT → 17:00 CT | the 24 hours a fill is DATED to. **The boundary.** |
| **the tradeable session** | 17:00 CT → 16:00 CT | when the book is open. 23 hours. |
| **the maintenance break** | 16:00 CT → 17:00 CT | Globex is down, Mon–Thu. |

`SESSION_BOUNDARY_HOUR` is **17**, paired with `America/Chicago`, and the pair travels together.

**Settlement is a fourth thing and is not the boundary.** Crude settles at 13:30 CT; the equity
index complex marks at 15:00 CT; ag settles at 13:15–13:20 CT. Those set the daily settlement
price. None of them rolls the trade date, and a product "closing" at 13:30 in a trader's mental
model is almost always its settlement rather than its session.

## 2. Per family, verified

| family | roots | Globex hours (CT) | open at 17:00? |
|---|---|---|---|
| Equity index | ES MES NQ MNQ YM MYM RTY M2K NKD EMD | Sun 17:00 → Fri 16:00, daily break 16:00–17:00 | no |
| Energy | CL MCL NG MNG QG BZ RB HO | same | no |
| Metals | GC MGC SI SIL HG MHG PL PA | same | no |
| FX | 6E 6B 6A 6J 6C 6S 6N 6M + micros | same | no |
| Rates | ZT ZF ZN TN ZB UB ZQ SR3 | same | no |
| **Grains / oilseeds** | ZC ZS ZW KE ZL ZM ZO | **Sun–Fri 19:00 → 07:45 and Mon–Fri 08:30 → 13:20** | **no** |
| **Livestock** | LE HE GF | **Mon–Fri 08:30 → 13:05** | **no** |
| **Crypto** | BTC MBT ETH MET | **24/7**, except Sat 02:00–04:00 and a two-minute stop Mon–Fri 16:00–16:02 | **YES** |

**Crude is not an exception** — this was checked specifically because it is the one most often
described as closing early. CME publishes *"Sunday - Friday 5:00 p.m. - 4:00 p.m. CT with a
60-minute break each day beginning at 4:00 p.m. CT."* Identical to NQ. The 13:30 figure people
remember is its settlement, per §1.

## 3. The ag question, which the previous build left open — RESOLVED

`run-trading@v2:docs/market-hours.md` §4 said the agricultural complex was *"NOT confirmed, and
deliberately not guessed at"*, and that if an ag contract ever appeared in a real import the
section had to be filled in before anything bucketed it. It is filled in now, and the answer is
better than expected:

**17:00 CT is correct for ag, and for the same reason 17:00 beat 16:00 for Globex — it lands in a
gap where no fills exist.** Grains close at 13:20 and reopen at 19:00, so the 17:00 roll sits
strictly inside a five-hour and forty-minute dead zone. Every fill in the 19:00 → 07:45 evening
session is at or past 17:00 and rolls to the next date, which is exactly what the exchange does
with it. Every fill in the 08:30 → 13:20 day session is before 17:00 and keeps its calendar date.
**No ag fill can land on the wrong side of the line, because no ag fill can land near it.**

Livestock is simpler still: the whole session is 08:30 → 13:05, entirely before the roll.

So the one boundary constant is right for **every CME Group product except crypto**, and that is a
measured claim rather than an inherited assumption.

## 4. Crypto is the real exception, and it is new

CME's bitcoin and ether futures are **24/7**. The book is open across the roll and across the
weekend. Three consequences, none of them fatal, all of them worth stating before somebody
rediscovers them:

1. **A fill can land exactly at 17:00 CT.** `sessionDateFor` rolls at `hour >= 17`, so the reopen
   instant belongs to the new date. Deterministic, and it matches how the rest of the complex is
   treated. *Not independently verified against CME's own crypto trade-date stamp* — if a real
   crypto export ever arrives, check the broker's trade-date column against ours before trusting
   evening crypto sessions.
2. **A round trip can straddle the boundary.** The previous build measured *0 of 729 round trips
   spanning a boundary* and leaned on prop firms auto-liquidating before the close. That still
   holds for prop accounts, but a **personal** account holding MBT overnight breaks it. Run is
   already correct here by doctrine rather than by luck: **`session_date` derives from `exit_at`**,
   so a straddling trade is filed under the session it was realised in, with no ambiguity.
3. **A session date can be a Saturday or a Sunday.** `spec.md` §8 says *"Friday close to Sunday
   open is not a session. Weekend has no bucket."* That is true of everything except crypto, and
   the qualifier now lives in both places. A Saturday session groups into the Monday-start week
   that began five days earlier, which is the correct reading: Saturday crypto is a continuation
   of Friday's tape, not the start of the next week.

## 5. What is deliberately NOT encoded

- **Holidays and early closes.** They follow the CME calendar, not a weekday rule. An early close
  shortens a session; it does not move the roll, so nothing here depends on knowing them. A
  holiday simply produces a session with no trades, which `spec.md` already requires to exist.
- **Prop firm daily-loss resets.** A firm rule, not an exchange one, and they disagree with each
  other. Run's daily line is the trader's own, armed against the exchange trade date, which is
  knowable. Firm rulebooks are an optional overlay and are never inferred.
- **Regular trading hours.** Equity index RTH is 08:30–15:15 CT and carries most of the volume.
  It is a time-of-day fact, relevant to reads about when a trader performs, and **must never be
  used as the boundary.**

## 6. Coverage, stated honestly

Luke's corpus is 612 fills, all between 08:00 and 15:00 CT, with **nothing after the 17:00 roll**
(`scripts/s1-boundary-check.mts`). So the real data agrees with a naive calendar-date rule too and
cannot prove the boundary by itself. `scripts/s1-gate.mts` §4 exercises the roll synthetically,
including both DST directions, and `scripts/s2-gate.mts` §1b checks that both ends of a trading
week land in one bucket. The gap is measured rather than assumed, and it closes the first time an
evening session is imported.
