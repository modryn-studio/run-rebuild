/* The page header band: title on the left, page actions on the right.
 *
 * NO 'use client'. It renders in whichever context the page is, and it imports the layout
 * constants directly from `@/lib/shell` rather than re-exporting them through a client module —
 * see the note in that file for what re-exporting costs.
 *
 * SUB-NAVIGATION BELONGS HERE, NEVER IN THE SIDEBAR (wireframes.md). The sidebar is one level and
 * four rows; a page with tabs carries them in `children` below this band.
 *
 * The 64px height is the same `SHELL_HEADER_H` the sidebar's wordmark row uses, because the two
 * sit in one band across the top of the app and any disagreement shows as a step in the top edge.
 */
import { cn } from '@/lib/cn';
import { PAGE_COLUMN, HEADER_INDENT } from '@/lib/shell';

export function PageHeader({
  title,
  actions,
  children,
}: {
  title: string;
  /** Buttons for the page as a whole. Filters, Add account, Refresh. */
  actions?: React.ReactNode;
  /** Sub-navigation or a filter bar, directly under the title band. */
  children?: React.ReactNode;
}) {
  return (
    <header>
      <div className={cn(PAGE_COLUMN, HEADER_INDENT, 'flex items-center gap-4')}>
        {/* The title is indented 8px INSIDE the left edge of the card it names. Measured, and it
            looks 8px off on purpose — do not "fix" it. */}
        <h1 className="text-h2 min-w-0 truncate">{title}</h1>
        {actions ? <div className="ml-auto flex shrink-0 items-center gap-2">{actions}</div> : null}
      </div>
      {children ? <div className={cn(PAGE_COLUMN, 'pt-2')}>{children}</div> : null}
    </header>
  );
}
