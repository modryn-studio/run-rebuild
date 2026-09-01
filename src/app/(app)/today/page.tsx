import type { Metadata } from 'next';
import { requireTrader } from '@/lib/trader';
import { PAGE_COLUMN } from '@/lib/shell';
import { cn } from '@/lib/cn';
import { DailyRecap } from '@/components/views/today/daily-recap';
import { RECAP_STRONG } from '@/components/views/today/fixtures';

export const metadata: Metadata = { title: 'Today' };

/* TODAY - the front door (`S8`, `wireframes.md` §5).
 *
 * "Where do I stand right now", and since `spec.md` §4 was amended on 2026-08-31 it is the ONLY
 * front door: `Read` came out of the nav and the daily read ships here as a card, which is where
 * the reference keeps its own recap.
 *
 * ─── THE GRID IS THE REFERENCE'S, READ OUT OF ITS MARKUP ───────────────────────────────
 *
 * Monarch's dashboard is `Row > Column > Column > Card`, two columns above `lg` and one below, with
 * each widget draggable inside its column. This ships the two columns and not the dragging: reorder
 * is a real feature (`useListDrag` already does it for the roster) and it is a feature of a page
 * that has enough widgets to reorder. One widget cannot be rearranged.
 *
 * ─── NO GREETING. THE BAND SAYS `Today`, LIKE EVERY OTHER PAGE ──────────────────────────
 *
 * 2026-09-01, Luke: *"we will not have a 'Good Afternoon' greeting in the header. no greeting.
 * replace the greeting with 'Today'. the name of the page. and center it. make sure it is exactly
 * consistent with the /accounts and /trades pages."*
 *
 * This reverses 2026-08-31, and the whole apparatus went with it rather than being left inert: a
 * `Greeting` component, a `SELF_TITLED` set in the shell that made this the one route rendering no
 * route title, and two helpers here (`greetingFor`, `hourIn`) whose only caller was the greeting.
 * `hourIn` was 60 lines of genuinely hard-won reasoning about `Intl` - `formatToParts` because
 * `format()` returns `"00 Uhr"` in de-DE, a market-zone fallback because an unknown IANA zone throws
 * `RangeError` on a render path - and it is deleted anyway, because a helper kept for its comments
 * is dead code with a story attached. `git log` holds it if a clock is ever needed here again.
 *
 * WHAT THIS BUYS IS THE THING THAT WAS ASKED FOR: the shell's own `<h1>` now titles this page, so
 * `/today` gets `text-h3` centred on a phone and `sm:text-title` static from `sm` - the same
 * element, the same classes and the same position as `/accounts` and `/trades`, rather than a
 * portalled span that only resembled them.
 *
 * ─── WHAT IS HERE AND WHAT IS NOT ────────────────────────────────────────────
 *
 * `Your Daily Recap` only, and it is deliberately the first thing built rather than the last. The
 * three figure widgets `wireframes.md` draws - Net P&L, Accounts, Last session - are all answerable
 * from read functions that already exist (`getDailySeries`, `getRoster` + `getFreshness`,
 * `getTape` + `getDigest`). The recap is the only one with nothing behind it, so it is the only one
 * whose SHAPE is a question, and it is the one worth putting in front of a person first.
 *
 * ─── THE READ IS A FIXTURE, AND THE PAGE SAYS SO NOWHERE ───────────────────────────
 *
 * Deliberate. A banner reading "sample" would be the honest thing for a shipped product and the
 * wrong thing for a design pass: the question this page exists to answer is whether the card reads
 * right, and a disclaimer above it changes how it reads. **`/today` is not linked from the nav
 * until the job lands** - the sidebar's `Read` row still points at its own 404 and this route is
 * reachable by address only. That is the containment, rather than a label.
 */
export default async function TodayPage() {
  /* THE AUTH GATE, and it is the only reason this page is async now. It used to bind `trader` and
     `user` for the greeting; neither is read any more, but the call is what refuses an unauthorised
     request and it stays. */
  await requireTrader();

  return (
    <div className={cn(PAGE_COLUMN, 'pb-8')}>
      {/* TWO COLUMNS ABOVE `lg`, ONE BELOW - the reference's own breakpoint. `items-start` so a
          short widget does not stretch to match a tall one beside it, which is what makes a
          dashboard read as a set of cards rather than a table.
          `pt-4` NO LONGER SITS UNDER A PORTALLED GREETING, so it is the page's own top gutter and
          matches what `/accounts` and `/trades` put between the band and their first card. */}
      <div className="grid grid-cols-1 items-start gap-4 pt-4 lg:grid-cols-2">
        <DailyRecap recap={RECAP_STRONG} />
      </div>
    </div>
  );
}
