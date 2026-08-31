import type { Metadata } from 'next';
import { requireTrader, getSessionUser } from '@/lib/trader';
import { PAGE_COLUMN } from '@/lib/shell';
import { SESSION_BOUNDARY_ZONE } from '@/lib/time/session';
import { cn } from '@/lib/cn';
import { DailyRecap } from '@/components/views/today/daily-recap';
import { Greeting } from '@/components/views/today/greeting';
import { RECAP_STRONG } from '@/components/views/today/fixtures';

export const metadata: Metadata = { title: 'Today' };

/* TODAY — the front door (`S8`, `wireframes.md` §5).
 *
 * "Where do I stand right now", and since `spec.md` §4 was amended on 2026-08-31 it is the ONLY
 * front door: `Read` came out of the nav and the daily read ships here as a card, which is where
 * the reference keeps its own recap.
 *
 * ─── THE GRID IS THE REFERENCE'S, READ OUT OF ITS MARKUP ───────────────────────────────────────
 *
 * Monarch's dashboard is `Row > Column > Column > Card`, two columns above `lg` and one below, with
 * each widget draggable inside its column. This ships the two columns and not the dragging: reorder
 * is a real feature (`useListDrag` already does it for the roster) and it is a feature of a page
 * that has enough widgets to reorder. One widget cannot be rearranged.
 *
 * ─── WHAT IS HERE AND WHAT IS NOT ──────────────────────────────────────────────────────────────
 *
 * `Your Daily Recap` only, and it is deliberately the first thing built rather than the last. The
 * three figure widgets `wireframes.md` draws - Net P&L, Accounts, Last session - are all answerable
 * from read functions that already exist (`getDailySeries`, `getRoster` + `getFreshness`,
 * `getTape` + `getDigest`). The recap is the only one with nothing behind it, so it is the only one
 * whose SHAPE is a question, and it is the one worth putting in front of a person first.
 *
 * ─── THE READ IS A FIXTURE, AND THE PAGE SAYS SO NOWHERE ───────────────────────────────────────
 *
 * Deliberate. A banner reading "sample" would be the honest thing for a shipped product and the
 * wrong thing for a design pass: the question this page exists to answer is whether the card reads
 * right, and a disclaimer above it changes how it reads. **`/today` is not linked from the nav
 * until the job lands** - the sidebar's `Read` row still points at its own 404 and this route is
 * reachable by address only. That is the containment, rather than a label.
 */
export default async function TodayPage() {
  const trader = await requireTrader();
  const user = await getSessionUser();

  return (
    <div className={cn(PAGE_COLUMN, 'pb-8')}>
      {/* INTO THE HEADER BAND, where the route title would be. See `greeting.tsx`. */}
      <Greeting text={greetingFor(user?.name ?? null, trader.displayTimezone)} />

      {/* TWO COLUMNS ABOVE `lg`, ONE BELOW - the reference's own breakpoint. `items-start` so a
          short widget does not stretch to match a tall one beside it, which is what makes a
          dashboard read as a set of cards rather than a table. */}
      <div className="grid grid-cols-1 items-start gap-4 pt-4 lg:grid-cols-2">
        <DailyRecap recap={RECAP_STRONG} />
      </div>
    </div>
  );
}

/* THE TIME-OF-DAY GREETING. `wireframes.md` §5: "both Monarch and TradeZella do it; it's a
 * convention, adopt it."
 *
 * IN THE TRADER'S OWN ZONE, and this is the one place `display_timezone` is unambiguously correct
 * to read: "good afternoon" is a fact about the person, not about the market. `CLAUDE.md`'s rule is
 * that the zone is DISPLAY ONLY and must never reach the bucketing code, and a greeting is display
 * in the purest sense - nothing downstream of it is a number.
 *
 * THE NAME IS OPTIONAL BECAUSE IT IS NULLABLE. Google supplies one and the emailed-code path does
 * not (`schema.ts`), so half the traders who sign up have no name to greet. "Good afternoon" alone
 * is a complete sentence; "Good afternoon, null" is the bug that ships when a nullable column is
 * treated as a string.
 *
 * A STRING, NOT A COMPONENT. It is rendered by a portal into the shell's band, and the portal has
 * to be a client component; the hour has to come from a database column the shell does not carry.
 * So the server computes the sentence and hands it over finished, which is also what stops the HTML
 * and the hydrated tree disagreeing about what time it is.
 */
function greetingFor(name: string | null, zone: string): string {
  const hour = hourIn(zone);
  const part = hour < 12 ? 'morning' : hour < 17 ? 'afternoon' : 'evening';
  /* FIRST NAME ONLY. The provider hands over whatever the trader typed into Google, which is a full
     name more often than not, and "Good afternoon, Luke Hanner" is a form letter. */
  const first = name?.trim().split(/\s+/)[0];
  return `Good ${part}${first ? `, ${first}` : ''}`;
}

/* THE HOUR, 0-23, AND THREE WAYS THE OBVIOUS SPELLING BREAKS.
 *
 * The first version was `Number(new Intl.DateTimeFormat('en-US', { hour: 'numeric', hour12: false,
 * timeZone: zone }).format(new Date()))`. Each of the three changes below has a reason, and one of
 * them is smaller than it first looked - recorded that way rather than tidied, because the next
 * reader deserves to know which of these is a live bug and which is defence.
 *
 * ─── 1. `hourCycle: 'h23'` — DEFENCE, NOT A FIX (checked, 2026-08-31) ──────────────────────────
 *
 * `hour12: false` does not name a cycle; it lets the implementation resolve one, and the two have
 * historically disagreed - SpiderMonkey resolving `h23` while V8 resolved `h24`, under which
 * MIDNIGHT FORMATS AS "24". That would have made `24 < 12` false, `24 < 17` false, and told a
 * trader "good evening" at 00:30.
 *
 * **It does not reproduce here.** Run on this runtime (Node 22.19, ICU 77) across eight locales,
 * `hour12: false` resolves to `h23` in every one and midnight formats "00". So this was not a
 * shipped bug and the comment does not get to claim it was. `hourCycle: 'h23'` stays because it
 * STATES the cycle rather than relying on a resolution that is implementation-defined and has
 * already changed once. https://github.com/tc39/ecma402/issues/402
 *
 * ─── 2. `formatToParts`, NOT `format` — THIS ONE IS REAL ──────────────────────────────────────
 *
 * `format()` returns a string for human eyes and decorates it per locale. Measured on this runtime,
 * same options, one field requested:
 *
 *     de-DE  "00 Uhr"      fr-FR  "00 h"      ja-JP  "0時"      ko-KR  "0시"
 *
 * `Number("00 Uhr")` is `NaN`, and `NaN < 12` and `NaN < 17` are both false - so the greeting would
 * read **evening, permanently**. The old code was safe only because it pinned `'en-US'`, which is a
 * locale hardcoded to protect a numeric parse rather than to serve a reader. `formatToParts` hands
 * the hour back as DATA, so the parse cannot be broken by a decoration.
 *
 * ─── 3. AN UNKNOWN ZONE THROWS, ON A RENDER PATH ──────────────────────────────────────────────
 *
 * `Intl.DateTimeFormat` throws `RangeError` on a zone it cannot resolve (confirmed). `trader.ts`
 * validates on WRITE - `isKnownTimezone` asks `Intl` rather than matching a pattern - so a bad zone
 * cannot be stored today. But the IANA database renames and merges zones, so a row written this
 * year can stop resolving after a runtime update, and the failure would be a 500 on the front door
 * months later, for a greeting.
 *
 * IT FALLS BACK TO THE MARKET ZONE, which is the answer `trader.ts` already gives for a zone that
 * was never detected: "the least-wrong clock to show a futures trader is the one their sessions are
 * cut in, never a clock nobody trades on." */
function hourIn(zone: string): number {
  for (const z of [zone, SESSION_BOUNDARY_ZONE]) {
    try {
      const parts = new Intl.DateTimeFormat('en-US', {
        hour: 'numeric',
        hourCycle: 'h23',
        timeZone: z,
      }).formatToParts(new Date());
      const h = Number(parts.find((p) => p.type === 'hour')?.value);
      if (Number.isInteger(h) && h >= 0 && h <= 23) return h;
    } catch {
      // Falls through to the market zone, then to noon.
    }
  }
  /* UNREACHABLE unless `America/Chicago` stops resolving, which would mean the runtime has no time
     zone data at all. Noon rather than 0: if the clock is unknowable, the least-wrong greeting is
     the one that is right for the longest stretch of a trading day. */
  return 12;
}
