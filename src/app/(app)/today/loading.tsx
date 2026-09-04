import { HeaderSlot } from '@/components/shell/header-slot';
import { Skeleton } from '@/components/ui/skeleton';
import { PAGE_COLUMN } from '@/lib/shell';
import { cn } from '@/lib/cn';
import {
  PlotSkeleton,
  SessionRowsSkeleton,
  WidgetSkeleton,
} from '@/components/views/today/widget-skeleton';

/* THE DASHBOARD, BEFORE ITS FIGURES ARRIVE.
 *
 * WHY A SKELETON AND NOT A SPINNER lives in `widget-skeleton.tsx`, beside the component, because
 * that is the decision for every card this page will hold rather than a property of this route.
 * Short version: `design-system.md` §7 asks whether you know the SHAPE of what is arriving, and on
 * `/today` the answer is always yes.
 *
 * ─── WHY THIS SEGMENT NEEDS ITS OWN BOUNDARY AT ALL ────────────────────────────────────────────
 *
 * `(app)/loading.tsx` exists and shows the wordmark, which is right for a cold entry and useless
 * here: §7's rule is that *"a `loading.tsx` higher up is already mounted once you are inside it, and
 * React will not re-show an existing fallback during a transition"*. Moving between `/today`,
 * `/accounts` and `/trades` inside a shell that never left is not a cold entry, so the segment that
 * waits on data declares its own. `/trades` already did exactly this, for the same reason.
 *
 * ─── INVISIBLE FOR THE FIRST 300ms ─────────────────────────────────────────────────────────────
 *
 * `.wait-reveal` holds the whole grid hidden for 300ms and then fades it in over 200ms, which is
 * §7's rule and not a flourish: *"most navigations in this app are prefetched and land inside that
 * window, where a mark that appears and vanishes ADDS a flicker to a load that already felt
 * instant."* Confirmed here rather than assumed - with a 20x CPU throttle and the sidebar's own
 * prefetch, a client navigation from `/accounts` to `/today` rendered no skeleton frame at all. On
 * a warm router this boundary correctly shows nothing; a cold one gets the shape.
 *
 * ON THE GRID AND NOT ON EACH CARD, so six cards fade in as one surface rather than as six things
 * arriving. (`trades/loading.tsx` does not carry this and probably should. Flagged rather than
 * changed: its header band holds a search field that is chrome and must not fade, so the fix there
 * is narrower than one class. Not this card's slice.)
 *
 * ─── IT OCCUPIES THE PAGE'S OWN BOXES, GUTTER INCLUDED ─────────────────────────────────────────
 *
 * `PAGE_COLUMN` and the same grid as `page.tsx`, because a boundary is NOT inside the page's
 * wrapper and the gutter therefore has to be declared again. `/trades`'s boundary shipped without
 * it and Luke caught it: *"the skeleton takes up the full width of the screen. it has no right and
 * left side padding. i thought it was supposed to take place of the content that will be loaded
 * in."* `items-start` too, or a one-card grid stretches its cell.
 *
 * ─── IT MIRRORS WHAT THE PAGE MOUNTS, AND GROWS WITH IT ────────────────────────────────────────
 *
 * TWO CARDS AS OF 2026-09-04, because `page.tsx` mounts two. A boundary standing in for six while
 * the page renders two is a boundary that reflows on every load. The rule for the next four: add its
 * skeleton here in the same commit that mounts it - which is how `Last session`'s arrived.
 *
 * `scope={false}` ON THE SECOND, and that is not a detail. `Last session` has no header control:
 * `§A8` made the account scope PAGE-level, so the card owns no picker, and a boundary drawing a
 * 112px bar where nothing will mount is a boundary that reflows by exactly that much.
 */
export default function Loading() {
  return (
    <>
      {/* ─── THE BAND'S LEFT, WHICH THIS SESSION EMPTIED (found by postcheck, 2026-09-03) ───────
       *
       * `/today` is the one route in `SELF_TITLED`, so from `md` up the shell renders NO route
       * title and the PAGE portals a greeting into the slot instead. A page that is suspended
       * portals nothing - so on a desktop the band's left was blank for the whole wait and the
       * greeting popped in when the page committed. Every other route keeps its title throughout,
       * because the shell derives it from `usePathname()` and that never suspends.
       *
       * NOTHING MOVES, which is why this is a pop-in rather than the 57px jag `trades/loading.tsx`
       * exists to prevent: the band is a fixed height and the greeting sits at its left. It is
       * still the front door showing nothing where every sibling shows its name.
       *
       * `trades/[id]/loading.tsx` SET THE PRECEDENT - it portals a skeleton where its title will be,
       * because "the title is the instrument and it is not known yet". Here the greeting is not
       * known either: it is computed from the trader's own `display_timezone`, which is a database
       * column the shell does not carry.
       *
       * `md` ONLY, and `hidden md:block` rather than `max-md:hidden` so it is absent by default:
       * below that width the shell's own `<h1>Today</h1>` is already rendering, and a skeleton
       * beside it would be the band saying its name twice. */}
      <HeaderSlot slot="title">
        <Skeleton className="hidden h-6 w-40 md:block" />
      </HeaderSlot>

      <div className={cn(PAGE_COLUMN, 'pb-8')}>
        <div className="wait-reveal grid grid-cols-1 items-start gap-4 pt-4 lg:grid-cols-2">
          {/* `Net P&L`: a header with a period picker, and a body that is the plot. */}
          <WidgetSkeleton>
            <PlotSkeleton />
          </WidgetSkeleton>
          {/* `Last session`: a header with no control, and a body that is a figure and five rows. */}
          <WidgetSkeleton scope={false}>
            <SessionRowsSkeleton />
          </WidgetSkeleton>
        </div>
      </div>
    </>
  );
}
