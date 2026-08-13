/* The shell's layout numbers, in a module with NO 'use client' directive.
 *
 * THAT ABSENCE IS THE ENTIRE POINT OF THIS FILE. Do not add the directive, and do not move these
 * into the shell components. Every export of a `'use client'` module becomes a CLIENT REFERENCE
 * when a Server Component imports it. That is exactly right for components — it is how the
 * boundary works — but a plain string does not survive it: the server receives an opaque object
 * rather than `'mx-auto w-full px-4'`, and `clsx` drops any argument that is not a string.
 *
 * IT FAILS SILENTLY, which is why this deserves a file rather than a comment. No error, no
 * warning, no type complaint — `cn(PAGE_COLUMN, 'pb-8')` simply renders `class="pb-8"` and the
 * page loses its gutter. Measured on the previous build (2026-07-29), same constant, same call
 * shape, three pages, two results:
 *
 *   /sessions   (client component)  ->  "mx-auto w-full px-4"   correct
 *   /accounts   (server component)  ->  "pb-8"                  PAGE_COLUMN gone
 *   /dashboard  (server component)  ->  "pb-8"                  PAGE_COLUMN gone
 *
 * The tell was that the two broken pages were the two Server Components. Importing a COMPONENT
 * from a client module into a server file is fine and is done in `(app)/layout.tsx` with
 * `<AppShell>`; reasoning from that to "constants are fine too" is what shipped the bug.
 *
 * RE-EXPORTING THESE FROM A CLIENT FILE DOES NOT LAUNDER THEM. Import from here, always.
 */

/** ONE header height for the whole shell, published so nothing has to guess.
 *
 * THREE things are this tall and they sit in one band across the top: the sidebar's wordmark row,
 * the content pane's header, and the floating Open control that appears where the sidebar was.
 * Any disagreement between them shows as a step in the top edge, and two files each hard-coding
 * their own number is how that step arrives — it was already 12px out once, when this constant
 * said 3.25rem while the sidebar row said `h-16`. Resolved UP to 64px.
 *
 * A PAGE DOES NOT OFFSET ITS OWN STICKY SURFACES BY THIS. The header sits OUTSIDE the scroll
 * container, so the scrollport already begins below the band and anything a route docks to the
 * top of the pane sticks at `top: 0`.
 */
export const SHELL_HEADER_H = '4rem';

/** THE ONE CONTENT COLUMN. The header band and every page body use this exact string, so they
 * share a width, a centring and a right gutter and cannot drift apart as the viewport changes.
 *
 * It exists because they did drift. The header carried a bare `px-4` while pages carried
 * `mx-auto max-w-[1600px] px-4`. Those agree at 1280 and come apart above 1600 of pane width: at
 * a 1920 viewport the title measured x=240 against a card at x=288 — 48px out, invisible until
 * someone opened it on a wide monitor.
 *
 * NO MAX-WIDTH, deliberately reversing that 1600 cap. The cap was defended on the grounds that a
 * ledger row's date and its P&L end up far apart on an ultrawide. That cost is real, but **it is
 * paid by the ROW**, so it belongs to whatever renders rows rather than to every page — a chart
 * wants the space a row does not. A surface that needs a measure caps its own content and still
 * sits in this column.
 *
 * `mx-auto` stays even though it does nothing while uncapped. It is the one line that has to be
 * here rather than added later if a cap ever returns: a centred cap against a flush-left header
 * is exactly the 48px drift described above.
 */
export const PAGE_COLUMN = 'mx-auto w-full px-4';

/** The header's left is the ONE deliberate exception to `PAGE_COLUMN`.
 *
 * It adds this on top, indenting the title 8px INSIDE the left edge of the card it names — the
 * measured relationship (header padded 24 left, title at x=248, card at x=240). So do not "fix" a
 * header that looks 8px off, and do not fold the 24 into `PAGE_COLUMN`: the page bodies must keep
 * their 16, or the indent becomes a uniform shift and stops reading as an indent at all.
 */
export const HEADER_INDENT = 'pl-6';

/** 224px. Measured, not chosen — it was `w-64` and got narrowed.
 *
 * Collapses to `w-0` and hides COMPLETELY. No icon rail: a rail keeps taking horizontal space
 * while giving nothing back, and it pops open on an accidental mouse-over.
 */
export const SIDEBAR_W = 'w-56';

/** 304px. Collapsible, and it COLLAPSES WITHOUT UNMOUNTING — see the note in `summary-rail.tsx`
 * for why conditionally rendering it is a one-way door.
 */
export const RAIL_W = 'lg:w-76';

/** Where the sidebar's collapsed state is remembered. A plain localStorage key rather than a
 * cookie: it is a per-device display preference, the server never needs it, and sending it on
 * every request would make every page in the shell uncacheable to buy nothing.
 */
export const SIDEBAR_COLLAPSE_KEY = 'run_sidebar_collapsed';

/** Below this the sidebar overlays instead of pushing. 768px.
 *
 * At 375px a 224px inline panel leaves 151px of content, which is not a layout, it is a squeeze.
 * Kept as a string so the component and any test read the same query.
 */
export const SIDEBAR_OVERLAY_QUERY = '(max-width: 767px)';
