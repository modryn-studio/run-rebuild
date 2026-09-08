'use client';

/* THE MONTH, ONE CELL PER DAY. `monarch-dashboard-teardown.md` §A16.
 *
 * ─── WHOSE OBJECT THIS IS, BECAUSE IT IS TWO PRODUCTS' ─────────────────────────────────────
 *
 * The reference ships a calendar card on its PHONE dashboard only - confirmed by reading their
 * desktop markup on 2026-09-08, where twelve draggable widgets carry no such id. Theirs colours the
 * days ELAPSED in the month, teal before you have opened the walkthrough behind it and green with a
 * checkmark after. There is no per-day value in it at all: the cells hold a date and nothing else.
 *
 * So the geometry is theirs and the cell is not, and the split is deliberate:
 *
 *   FROM THE REFERENCE   the month header, the SUN-SAT rule, the seven-column grid, the summary
 *                        block under it, and the card's place in the ordinary widget column
 *   FROM THE FIELD       what goes IN a day. Tradervue prints "the number of trades and the P&L"
 *                        per cell; TradeZella prints the P&L and a month total above it. Both
 *                        colour green for a winning day and red for a losing one, and Tradervue
 *                        gives a break-even day its own hue rather than folding it into either.
 *
 * WHAT DOES NOT COME ACROSS, and it is the half that makes their card feel good. Their calendar
 * turns green with a tick once you have viewed the month's walkthrough, and the walkthrough ends on
 * confetti reading "You're all caught up... Keep it up next week!". That is a completion badge for
 * OPENING A SCREEN, which `psychology.md` §7 rules out by name, and "caught up" asserts a backlog
 * that `CLAUDE.md`'s re-entry rule says may never exist. Nothing here has a seen state, a done
 * state or a streak: the calendar is a picture of what happened, and it reads the same on the day
 * it is drawn and a year later.
 *
 * ─── WHY A COLOURED DAY IS NOT A CONTRIBUTION HEATMAP ──────────────────────────────────────
 *
 * The nearest banned thing is close enough to be worth naming. `spec.md` §6 excludes "streaks,
 * contribution heatmaps" - a grid that rewards the ACT of showing up. This grid says nothing about
 * showing up: an untraded day is blank rather than an absence, there is no total of days traded, no
 * comparison to another month's count, and a month of four sessions draws exactly as calmly as a
 * month of twenty. What is coloured is a RESULT, which is the one thing in this product that has
 * always earned pos/neg ink (`trades-tape.tsx`'s row rule, one level up).
 */

import { useState } from 'react';
import { Widget } from './widget';
import { IconButton } from '@/components/ui/icon-button';
import { Icon, ICON_TOUCH } from '@/components/ui/icon';
import { fmtMoney } from '@/lib/format';
import { cn } from '@/lib/cn';

/** One day the trader traded, already scoped and already countable. */
export interface CalendarDay {
  day: string;
  cents: number;
  trades: number;
}

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/* A SESSION DATE IS A LABEL, NOT AN INSTANT, so every read of one is UTC. `session_date` is already
   the answer to "which trading day" - parsing it in the browser's zone would shift a Chicago evening
   to the wrong cell for a trader in Tokyo, which is the one failure `CLAUDE.md` says the time module
   exists to prevent. `series.ts` reads its own day strings exactly this way. */
const atUtc = (day: string) => new Date(`${day}T00:00:00Z`);
const monthOf = (day: string) => day.slice(0, 7);

/** `2026-09` → `September 2026`. The reference's own header string. */
function monthLabel(month: string): string {
  return atUtc(`${month}-01`).toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

function stepMonth(month: string, by: number): string {
  const at = atUtc(`${month}-01`);
  at.setUTCMonth(at.getUTCMonth() + by);
  return at.toISOString().slice(0, 7);
}

/* NO CENTS IN A CELL, and it is a width decision rather than a taste one. Seven columns inside a
   half-width card is ~80px a cell on a desktop and ~50px on a phone; `-$1,558.90` does not fit
   either, and a figure that wraps or clips in half the cells makes the grid unreadable in exactly
   the months worth reading. The dollars are the shape, and `/trades` holds the cents. */
function compact(cents: number): string {
  const dollars = Math.round(cents / 100);
  const sign = dollars > 0 ? '+' : dollars < 0 ? '-' : '';
  const abs = Math.abs(dollars);
  if (abs >= 10_000) return `${sign}$${(abs / 1000).toFixed(1)}k`;
  return `${sign}$${abs.toLocaleString('en-US')}`;
}

/**
 * The weeks of one month, Sunday-first, padded to whole rows.
 *
 * PADDED WITH NULLS RATHER THAN WITH THE NEIGHBOURING MONTH'S DATES. A grid that spills into August
 * and October has to decide whether those days carry their own P&L, and either answer is wrong:
 * showing it puts another month's result under this month's header, and greying it invites the tap
 * that does nothing. The reference pads with blanks for the same reason.
 */
function weeksOf(month: string): (string | null)[][] {
  const first = atUtc(`${month}-01`);
  const lead = first.getUTCDay();
  const length = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0)).getUTCDate();

  const cells: (string | null)[] = Array(lead).fill(null);
  for (let d = 1; d <= length; d++) cells.push(`${month}-${String(d).padStart(2, '0')}`);
  while (cells.length % 7 !== 0) cells.push(null);

  const weeks: (string | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  return weeks;
}

/**
 * `/trades`, narrowed to one month, carrying the page's account scope unchanged.
 *
 * BUILT HERE RATHER THAN HANDED IN, and that is not a preference - it is the RSC boundary. The
 * first version took `href: (month: string) => string` from the page, which type-checked, built
 * clean, and threw a 500 on every request: a function cannot be serialised to a Client Component,
 * and `/today` is the one page behind auth that no local check had loaded. What crosses now is
 * `scope`, a `string[]`, which is what the band wrote into the URL in the first place.
 *
 * THE LAST DAY IS COMPUTED, NEVER TYPED. `Date.UTC(y, m, 0)` is the last day of month `m`, which is
 * the one piece of arithmetic in a calendar that must not become a table with February in it.
 */
function monthHref(month: string, scope: string[]): string {
  const [y, m] = month.split('-').map(Number);
  const end = new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);
  return `/trades?${new URLSearchParams([
    ['from', `${month}-01`],
    ['to', end],
    ...scope.map((id) => ['accounts', id] as [string, string]),
  ])}`;
}

export function MonthCalendar({
  days,
  /** The newest counted session. The month this opens on, and the forward bound. */
  endsOn,
  scope = [],
  imported,
}: {
  days: CalendarDay[];
  endsOn: string | null;
  /** The account ids the band narrowed to, passed through untouched. See `monthHref`. */
  scope?: string[];
  imported: boolean;
}) {
  /* IT OPENS ON THE MONTH OF THE LAST TRADING DAY, NEVER ON TODAY'S, and that is this page's own
     anchor rather than a new idea: card 1 windows its ranges off `endsOn` and card 2 draws the
     newest session with trades. A trader back after two weeks away opens on the month they actually
     traded instead of on an empty grid, which is the re-entry rule reaching the calendar. */
  const [month, setMonth] = useState(() => monthOf(endsOn ?? new Date().toISOString().slice(0, 10)));

  const byDay = new Map(days.map((d) => [d.day, d]));

  /* THE BOUNDS ARE THE DATA'S, so the arrows cannot walk into a month that could only ever be empty.
     Both leaders in the field clamp the same way, and the alternative - infinite arrows - makes the
     control's own affordance a lie in every direction but one. */
  const first = days.length > 0 ? monthOf(days[0].day) : null;
  const last = endsOn ? monthOf(endsOn) : first;
  const canBack = first !== null && month > first;
  const canForward = last !== null && month < last;

  const inMonth = days.filter((d) => monthOf(d.day) === month);
  const net = inMonth.reduce((n, d) => n + d.cents, 0);
  /* THE DAY THAT MOVED THE MONTH MOST, in either direction. The second figure under the grid, and
     it is chosen over "best day" because a month is as often decided by its worst one - naming only
     the winner would be the flattering half of a fact the grid already shows both halves of. */
  const biggest = inMonth.reduce<CalendarDay | null>(
    (a, d) => (a === null || Math.abs(d.cents) > Math.abs(a.cents) ? d : a),
    null
  );

  /* ONE BLANK, NOT THREE (#55, 2026-09-08): the page says the scope's two states once, above the
     grid, and this card keeps only the one about its own subject. */
  const nothingImported = !imported;
  const empty = nothingImported;

  return (
    <Widget
      /* THE MONTH IS THE TITLE, AND ONLY WHEN THERE IS A MONTH TO NAME. An empty card draws no grid,
         so a month name over it is a heading for something not on screen - and on day one it would
         be a specific month Run holds nothing for, which is a date asserting something. `Last
         session` refuses to print a date in the same three states for the same reason. */
      title={empty ? 'This month' : monthLabel(month)}
      period={empty ? undefined : `${inMonth.length === 1 ? '1 session' : `${inMonth.length} sessions`}`}
      href={empty ? undefined : monthHref(month, scope)}
      /* THE ARROWS ARE THE WIDGET'S OWN SCOPE CONTROL, which is the slot `widget.tsx` describes as
         "the small control that scopes this widget only". The reference centres its month between a
         back arrow and the card edge; Run's header is title-left, control-right for every widget on
         this page, and one card inventing its own header geometry is the thing the contract exists
         to stop. Hidden entirely when there is nothing to page through. */
      scope={
        empty ? undefined : (
          <span className="flex items-center gap-0.5">
            <IconButton
              aria-label={`Previous month, ${monthLabel(stepMonth(month, -1))}`}
              onClick={() => setMonth(stepMonth(month, -1))}
              disabled={!canBack}
            >
              <Icon name="chevron" size={ICON_TOUCH} className="rotate-90" />
            </IconButton>
            <IconButton
              aria-label={`Next month, ${monthLabel(stepMonth(month, 1))}`}
              onClick={() => setMonth(stepMonth(month, 1))}
              disabled={!canForward}
            >
              <Icon name="chevron" size={ICON_TOUCH} className="-rotate-90" />
            </IconButton>
          </span>
        )
      }
    >
      {nothingImported ? (
        <p className="text-body text-muted">
          Every day you trade lands here, coloured by what it made, straight from your broker&rsquo;s
          export.
        </p>
      ) : (
        <>
          {/* THREE LETTERS, NOT ONE. The reference writes SUN-SAT and it is the right call at this
              width: a single-letter row makes T and S ambiguous, and the trader is scanning for a
              weekday rather than reading a label. `text-caption` is the system's smallest step and
              this is the one row on the card that is pure chrome. */}
          <div className="grid grid-cols-7 gap-1">
            {WEEKDAYS.map((d) => (
              <div key={d} className="text-caption text-muted pb-1 text-center uppercase">
                {d}
              </div>
            ))}

            {weeksOf(month).flat().map((day, i) => {
              if (day === null) return <div key={`pad-${i}`} aria-hidden />;
              const hit = byDay.get(day);

              /* AN UNTRADED DAY IS NOT A FLAT DAY. No fill, muted date, nothing else - it is a day
                 that is not part of the record rather than a zero in it. A break-even day gets the
                 recessed ground instead, so "I was at the desk and came out level" is legible as
                 its own outcome. Rounding it up to a win is the flattering direction. */
              const ground =
                hit === undefined
                  ? ''
                  : hit.cents > 0
                    ? 'bg-pos-soft'
                    : hit.cents < 0
                      ? 'bg-neg-soft'
                      : 'bg-flat-soft';

              return (
                <div
                  key={day}
                  /* THE WHOLE SENTENCE, FOR SOMEONE NOT LOOKING AT THE COLOURS. The cell is three
                     abbreviations by design and none of them survives being read aloud - "8",
                     "+$12.8k", "21" is not a day. */
                  aria-label={
                    hit
                      ? `${day}, ${compact(hit.cents)}, ${hit.trades === 1 ? '1 trade' : `${hit.trades} trades`}`
                      : undefined
                  }
                  className={cn(
                    'flex min-h-14 min-w-0 flex-col rounded-[var(--radius-sm)] p-1',
                    ground,
                    hit === undefined && 'text-muted'
                  )}
                >
                  {/* THE DATE AND THE COUNT SHARE THE TOP ROW, and the count is bare.
                      IT WAS "9 trades" ON ITS OWN LINE AND IT CLIPPED. Seven columns inside a
                      half-width card leaves ~47px of inner cell, "14 trades" needs ~52px, and
                      `nowrap` turned it into "14 trade" - a label that reads as a typo. Widening
                      is not available (the grid is the reference's) and the word cannot shrink
                      (`text-caption` is the smallest step in the system), so the word goes.
                      A BARE NUMERAL IS THE CONVENTION HERE rather than a compromise: in a calendar
                      cell the muted figure opposite the date is the count, which is how every
                      journal in the field draws it. The word survives in the `aria-label`, where
                      there is no width at all. */}
                  <span className="flex items-baseline justify-between gap-1">
                    <span className="text-caption tabular-nums">{Number(day.slice(8))}</span>
                    {hit && <span className="text-caption text-muted tabular-nums">{hit.trades}</span>}
                  </span>
                  {hit && (
                    /* THE FIGURE IS INK, NOT POS/NEG, and that is the one place this departs from
                       the tape's row rule on purpose: the GROUND already carries the sign, and
                       colouring the number as well would put two signals on one axis and leave a
                       colourblind trader with neither. Weight carries it instead. */
                    <span className="text-caption mt-auto font-medium tabular-nums">
                      {compact(hit.cents)}
                    </span>
                  )}
                </div>
              );
            })}
          </div>

          {/* THE MONTH'S OWN LINE, under the grid where the reference puts its title block. Card 2's
              shape exactly: the net takes the colour because it is a RESULT, and the count beside it
              is metadata. A month with no sessions in it says so rather than printing $0.00, which
              would be a figure asserting a flat month that never happened. */}
          <p className="text-body-lg max-sm:text-body mt-4 flex flex-wrap items-baseline gap-x-2">
            {inMonth.length === 0 ? (
              <span className="text-body text-muted">No trades in this month.</span>
            ) : (
              <>
                <span
                  className={
                    net > 0 ? 'text-pos font-medium' : net < 0 ? 'text-neg font-medium' : 'font-medium'
                  }
                >
                  {net > 0 ? `+${fmtMoney(net)}` : fmtMoney(net)}
                </span>
                {/* NOT THE SESSION COUNT AGAIN. The header's period already carries it, and the
                    first pass printed "13 sessions" in the period and "net across 13 sessions"
                    here - one fact, twice, eleven lines apart. The card's second figure is the one
                    the grid cannot be read for at a glance. */}
                <span className="text-body text-muted">
                  net{biggest && `, biggest day ${compact(biggest.cents)}`}
                </span>
              </>
            )}
          </p>
        </>
      )}
    </Widget>
  );
}

/* NOT BUILT, AND EACH ONE IS A DECISION RATHER THAN AN OVERSIGHT:
 *
 * A DAY IS NOT TAPPABLE. Luke, 2026-09-08: *"nothing happens right now. we will plan this out better
 * later."* The header still links to `/trades` for the month, because that is the widget contract
 * every card on this page keeps and it is the destination the whole card is about.
 *
 * NO WEEKLY TOTAL COLUMN. TradeZella runs an eighth column carrying the week's net and days traded.
 * It is genuinely useful and it is a second object: it breaks the seven-column grid this card was
 * asked to copy, and a week total on a MONTH card raises the weekly-versus-monthly question `§A3`
 * has reserved for its own session. Worth revisiting once that lands.
 *
 * NO UNIT PICKER. The field offers R-multiple, ticks, points and a privacy mode. R needs a risk per
 * trade Run does not hold, and the rest are a settings surface for a card that does not have one yet.
 */
