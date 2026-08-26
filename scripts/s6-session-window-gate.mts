const { sessionWindow, sessionDateFor, SESSION_BOUNDARY_ZONE } = await import(
  '../src/lib/time/session.ts'
);

let bad = 0;
const eq = (l: string, a: unknown, b: unknown) => {
  const ok = JSON.stringify(a) === JSON.stringify(b);
  if (!ok) bad++;
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${l}`);
  if (!ok) console.log(`        want ${JSON.stringify(b)}\n        got  ${JSON.stringify(a)}`);
};

const ct = (d: Date) =>
  new Intl.DateTimeFormat('en-CA', {
    timeZone: SESSION_BOUNDARY_ZONE,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hour12: false,
  }).format(d);

console.log('\n=== THE WINDOW IS 17:00 CT TO 17:00 CT, WHATEVER THE OFFSET ===\n');
/* The one thing that must hold in every season: both ends read 17:00 on the boundary zone's own
   wall clock. If a fixed offset had been used, one of these two would read 16:00 or 18:00. */
for (const day of ['2026-01-15', '2026-04-15', '2026-07-15', '2026-10-15']) {
  const w = sessionWindow(day);
  eq(`${day}: opens at 17:00 CT`, ct(w.open).slice(-5), '17:00');
  eq(`${day}: ends at 17:00 CT`, ct(w.end).slice(-5), '17:00');
}

console.log('\n=== SUMMER IS -05:00 AND WINTER IS -06:00, DERIVED NOT ASSUMED ===\n');
/* July 15th's session ends 17:00 CDT = 22:00 UTC. January 15th's ends 17:00 CST = 23:00 UTC.
   A single hard-coded offset cannot produce both, which is the whole reason this is derived. */
eq('a summer session ends at 22:00 UTC', sessionWindow('2026-07-15').end.toISOString(), '2026-07-15T22:00:00.000Z');
eq('a winter session ends at 23:00 UTC', sessionWindow('2026-01-15').end.toISOString(), '2026-01-15T23:00:00.000Z');
eq('a summer session opens the previous day at 22:00 UTC',
  sessionWindow('2026-07-15').open.toISOString(), '2026-07-14T22:00:00.000Z');

console.log('\n=== IT IS THE EXACT INVERSE OF `sessionDateFor` ===\n');
/* The two functions have to agree at the boundary or a trade lands in a bucket whose window
   excludes it - the chart would then draw a day that does not contain its own trades. */
for (const day of ['2026-03-09', '2026-07-15', '2026-11-05']) {
  const w = sessionWindow(day);
  eq(`${day}: one ms after the open is inside this session`,
    sessionDateFor(new Date(w.open.getTime() + 1)), day);
  eq(`${day}: the end instant itself belongs to the NEXT session`,
    sessionDateFor(w.end) !== day, true);
  eq(`${day}: one ms before the end is still this session`,
    sessionDateFor(new Date(w.end.getTime() - 1)), day);
  /* THE OPEN IS INCLUSIVE. `sessionDateFor` says "at or after 17:00 CT belongs to the NEXT
     session", so (D-1) 17:00 exactly is the FIRST instant of D - not the last of D-1. Asserting
     the opposite here is what caught the docblock claiming a `(open, end]` window. */
  eq(`${day}: the open instant itself is already this session`,
    sessionDateFor(w.open), day);
}

console.log('\n=== ACROSS THE DST TRANSITIONS THEMSELVES ===\n');
/* US DST 2026: forward Sunday March 8th, back Sunday November 1st. A session spanning a transition
   is 23 or 25 hours long, and that is CORRECT - the market's clock moved, not the session's rule.
   The failure a fixed offset produces is a window that is still 24 hours and therefore misaligned
   with the exchange for the whole following season. */
const hours = (d: string) => {
  const w = sessionWindow(d);
  return (w.end.getTime() - w.open.getTime()) / 3_600_000;
};
/* The transition fires at 02:00 local on Sun Mar 8th / Sun Nov 1st 2026, so the session that
   CONTAINS it is the one ENDING that day - Mar 7 17:00 -> Mar 8 17:00. Getting this off by one is
   what the first run of this gate caught in the test rather than in the code. */
eq('an ordinary session is 24 hours', hours('2026-07-15'), 24);
eq('the spring-forward session is 23 hours', hours('2026-03-08'), 23);
eq('the fall-back session is 25 hours', hours('2026-11-01'), 25);
eq('the session AFTER a transition is 24 again', hours('2026-03-09'), 24);
eq('...and the one before it too', hours('2026-03-07'), 24);

console.log('\n=== MONTH AND YEAR ENDS ===\n');
eq('the 1st opens on the last day of the previous month',
  sessionWindow('2026-03-01').open.toISOString().slice(0, 10), '2026-02-28');
eq('Jan 1st opens in the previous YEAR',
  sessionWindow('2026-01-01').open.toISOString().slice(0, 10), '2025-12-31');
eq('a leap day resolves', sessionWindow('2028-03-01').open.toISOString().slice(0, 10), '2028-02-29');

console.log(bad === 0 ? '\nSESSION WINDOW GATE PASSED\n' : `\nFAILED (${bad})\n`);
process.exit(bad === 0 ? 0 : 1);
