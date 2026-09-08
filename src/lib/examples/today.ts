/* EXAMPLE DATA FOR THE EMPTY STATES, and for the rack.
 *
 * Promoted out of `kitchen-sink/_fixtures` on 2026-09-08 when the pages started using it: a
 * first-time trader now sees the real page rendered with THIS data at 40% opacity under a card that
 * says "Let's begin" (`ui/page-empty-overlay.tsx`, copied from the reference's `PageEmptyOverlayCard`).
 * The rack and the product show the same picture, so there is one place the picture is drawn.
 *
 * EVERY NUMBER HERE IS INVENTED AND IS ONLY EVER LEGAL BEHIND THAT CARD. `CLAUDE.md`'s claim is
 * "never show a number you cannot reconcile"; the overlay's own note records why an inert, faded
 * example under a "begin here" card is a picture and not a claim - and why widening that is a bug.
 * Dates sit in 2027 on purpose: a fixture that cannot be mistaken for anything a live trader did.
 */
import type { CalendarDay } from '@/components/views/today/month-calendar';

/** A month of sessions for `MonthCalendar`: wins, losses, two break-even days, one outsized day. */
export const CALENDAR_FIXTURE: CalendarDay[] = [
  { day: '2027-02-24', cents: 41_250, trades: 6 },
  { day: '2027-02-25', cents: -18_800, trades: 11 },
  { day: '2027-02-26', cents: 7_400, trades: 3 },
  { day: '2027-03-01', cents: 84_000, trades: 9 },
  { day: '2027-03-02', cents: -61_025, trades: 14 },
  { day: '2027-03-03', cents: 0, trades: 2 },
  { day: '2027-03-04', cents: 12_600, trades: 4 },
  { day: '2027-03-05', cents: -3_450, trades: 7 },
  { day: '2027-03-08', cents: 1_284_000, trades: 21 },
  { day: '2027-03-09', cents: -22_100, trades: 5 },
  { day: '2027-03-11', cents: 9_900, trades: 3 },
  { day: '2027-03-12', cents: -7_250, trades: 8 },
  { day: '2027-03-16', cents: 33_400, trades: 6 },
  { day: '2027-03-17', cents: 0, trades: 1 },
  { day: '2027-03-18', cents: -14_050, trades: 9 },
  { day: '2027-03-19', cents: 52_775, trades: 12 },
];
