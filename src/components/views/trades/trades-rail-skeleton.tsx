import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { railScope } from '@/components/views/trades/trades-rail';
import type { TradesFilter } from '@/lib/trades/filter';

/* THE SUMMARY RAIL, BEFORE ITS FIGURES ARRIVE.
 *
 * A SKELETON RATHER THAN A SPINNER, and the rack states the test: "use a skeleton when you know the
 * shape of what is coming, and a spinner when you do not." Nothing about this panel's shape depends
 * on the data - twelve label/value rows in five groups, always - so there is nothing to guess.
 *
 * BOTH WIDTHS, NOT JUST THE PHONE. The rail's shape is identical at every viewport, and the reason
 * to prefer a skeleton (the layout is already known) does not change with screen size. A different
 * mark per breakpoint would be two answers to one question.
 *
 * IT MIRRORS `trades-rail.tsx` ROW FOR ROW, and that is the requirement rather than a nicety: a
 * skeleton whose shape does not match its content REFLOWS the moment the content lands, which reads
 * worse than the spinner it replaced. The rack's own intro says exactly that. `py-1.5 px-5` and the
 * group rules are copied from `Line` and `Group` there; if those change, this has to move with them.
 */

/** The same geometry `Line` uses, with bars where the label and value will be. */
function Bar({ label, value }: { label: number; value: number }) {
  return (
    /* THE WIDTH RIDES A WRAPPER, not the Skeleton. `Skeleton` takes `className` only, and widening
       a primitive so one call site can pass a number would be the wrong direction - these are
       per-row measurements, not a design decision the system should learn. An inline width is also
       the honest form here: there is no scale step for "about as wide as the word Average". */
    <div className="flex items-center justify-between gap-4 px-5 py-1.5">
      <span className="block" style={{ width: label }}>
        <Skeleton className="h-4 w-full" />
      </span>
      <span className="block" style={{ width: value }}>
        <Skeleton className="h-4 w-full" />
      </span>
    </div>
  );
}

/* WIDTHS VARY PER ROW, deliberately. A column of identical bars reads as a placeholder graphic; a
   ragged one reads as text that has not arrived. These are the real labels' approximate measures. */
const GROUPS: { label: number; value: number }[][] = [
  [
    { label: 56, value: 24 },
    { label: 44, value: 32 },
    { label: 56, value: 88 },
  ],
  [
    { label: 96, value: 64 },
    { label: 80, value: 64 },
    { label: 84, value: 72 },
  ],
  [
    { label: 76, value: 56 },
    { label: 76, value: 60 },
  ],
  [
    { label: 52, value: 80 },
    { label: 60, value: 16 },
  ],
  [
    { label: 64, value: 76 },
    { label: 60, value: 76 },
  ],
];

export function TradesRailSkeleton({
  filter,
  hasIds,
}: {
  /* THE CAPTION IS NOT WAITING ON ANYTHING. `railScope` reads the FILTER, which the page has before
     the digest resolves - so the skeleton renders the real text rather than a bar that would either
     vanish (unfiltered) or become text of a different width (filtered) when the figures land. */
  filter: TradesFilter;
  /* NOR IS THE FOOTER. `DownloadCsv` returns null at zero ids and takes its `border-t` with it, so a
     skeleton that always drew one added a rule that then disappeared. `ids` is known outside the
     Suspense boundary too. */
  hasIds: boolean;
}) {
  const scope = railScope(filter);
  return (
    /* THE CARD'S OWN CHROME IS REAL, not skeletonised. The panel's border, ground and radius are not
       waiting on anything - only its contents are - and drawing a grey block where a card will be is
       a bigger visual change on arrival than filling one that is already there. */
    <Card className="overflow-hidden max-md:h-full max-md:rounded-none max-md:shadow-none">
      <div className="wait-reveal">
        <div className="flex items-baseline justify-between gap-3 px-5 py-4">
          {/* The heading is a constant, so it is TEXT rather than a bar. "Summary" is true before
              the figures land and stays true after; blanking it would be pretending otherwise. */}
          <h2 className="text-title text-text font-medium">Summary</h2>
          {scope && <span className="text-body text-muted">{scope}</span>}
        </div>

        <div className="border-rule border-t pb-2">
          {GROUPS.map((rows, i) => (
            <div key={i}>
              {i > 0 && <div className="border-rule my-2 border-t" />}
              {rows.map((r, j) => (
                <Bar key={j} label={r.label} value={r.value} />
              ))}
            </div>
          ))}
        </div>

        {/* CENTRED, MATCHING `DownloadCsv`'s own `text-center`. Left-aligned, the bar jumped to the
            middle the moment the button replaced it. */}
        {hasIds && (
          <div className="border-rule border-t px-5 py-3 text-center">
            <span className="inline-block w-28">
              <Skeleton className="h-4 w-full" />
            </span>
          </div>
        )}
      </div>
    </Card>
  );
}
