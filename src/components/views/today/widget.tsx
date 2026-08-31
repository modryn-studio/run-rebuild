/* THE DASHBOARD WIDGET CONTRACT, and it is a port rather than a design.
 *
 * `wireframes.md` §5 copies it wholesale from the Monarch teardown, and re-reading the live markup
 * on 2026-08-31 confirmed every line of it:
 *
 *   | Title          | links to the full page for that concept |
 *   | Headline value | one number, with its delta               |
 *   | Scope control  | a small combobox INSIDE the widget       |
 *   | Body           | a chart, a list, or an empty state with a SPECIFIC CTA |
 *
 * WHAT THE MARKUP ADDED to the teardown's four lines:
 *
 * THE TITLE IS THE LINK, not a chevron beside it. Monarch wraps title + period in one `<a>`
 * (`DashboardWidget__HeaderClickable`), so the whole header block is the target rather than a 20px
 * mark at the end of it. On a phone that difference is the whole affordance.
 *
 * THE PERIOD SITS WITH THE TITLE, not in the body. `Your Weekly Recap` and `August 23rd-29th` are
 * siblings inside the header. It reads as one label naming one thing, which is why the widget can
 * say what it covers without spending a line of body copy on it.
 *
 * NO PAGINATION, ANYWHERE. Checked every widget on the dashboard: zero previous/next controls. A
 * widget shows ONE state and links out; moving through time is the page's job. That is not a
 * Monarch quirk - `dashboardderesignpatterns.github.io` states it as the pattern, because a
 * dashboard's whole claim is "at a glance" and pagination turns a glance into a task.
 *
 * A WIDGET THAT OPENS IN PLACE STILL GETS A HEADER LINK'S SHAPE. `Your Daily Recap` has no page to
 * point at (`spec.md` §4, amended 2026-08-31), so its header is a button rather than an anchor -
 * same box, same target size, different element. `href` is optional here for exactly that reason,
 * and a widget with neither `href` nor `onOpen` renders a header that is not interactive at all,
 * which is the honest shape for a widget whose subject has nowhere to go.
 */

import Link from 'next/link';
import type { ReactNode } from 'react';
import { Card } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { cn } from '@/lib/cn';

export function Widget({
  title,
  /** What the widget covers, beside the title. A period, a count, a date. Never a sentence. */
  period,
  href,
  onOpen,
  /** The small control that scopes this widget only. A `Menu`, never a filter bar. */
  scope,
  children,
  className,
}: {
  title: string;
  period?: string;
  href?: string;
  onOpen?: () => void;
  scope?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  const head = (
    <>
      <span className="text-body-lg text-text font-medium">{title}</span>
      {period && <span className="text-body text-muted shrink-0">{period}</span>}
    </>
  );

  /* `min-h-13` MATCHES EVERY OTHER HEADER ROW IN THIS PRODUCT - the rail cards, the tape's caption,
     `RecentTrades`. A dashboard of cards that each pick their own header height is the drift
     `design-system.md` §2a exists to stop. */
  const headClass =
    'flex min-h-13 w-full items-center gap-2 px-5 text-left max-md:px-4';

  return (
    <Card className={cn('flex flex-col overflow-hidden', className)}>
      {href ? (
        <Link href={href} className={cn(headClass, 'hover:bg-hover transition-colors')}>
          {head}
          <Icon name="chevron" size={16} className="text-muted ml-auto shrink-0 -rotate-90" />
        </Link>
      ) : onOpen ? (
        <button type="button" onClick={onOpen} className={cn(headClass, 'hover:bg-hover transition-colors')}>
          {head}
          <Icon name="chevron" size={16} className="text-muted ml-auto shrink-0 -rotate-90" />
        </button>
      ) : (
        <div className={headClass}>
          {head}
          {scope && <span className="ml-auto shrink-0">{scope}</span>}
        </div>
      )}

      {/* NO RULE UNDER THE HEADER. `design-system.md` §3: a ground change or a gap separates a label
          from its content, and a card that draws a line inside itself is stating one boundary
          twice. The rail cards use a rule because their body is a TABLE of rows; a widget body is
          one object. */}
      <div className="min-w-0 flex-1 px-5 pt-1 pb-5 max-md:px-4">{children}</div>
    </Card>
  );
}
