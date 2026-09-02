'use client';

/* THE TAPE'S OWN IMPORT, AND THE ONLY CONTROL ON `/trades` THAT ADDS ROWS (2026-09-02).
 *
 * WHY THIS PAGE HAS ONE AT ALL. Every other control in this band narrows: Clear, Search, Date,
 * Filters. The page had four ways to hide trades and none to fill it, and its own empty state said
 * "Import your Tradovate exports and they will appear here" with nothing to press. v2's rule,
 * quoted in `accounts-header.tsx`: "a page has exactly one action that changes what is on it, and
 * it should be the only thing on the screen wearing the accent." `/trades` is that page and the
 * action is this one. `spec.md` `S1`, amended 2026-09-02.
 *
 * READ OFF MONARCH, AND HALF OF IT REFUSED (2026-09-02, live). Monarch puts an `Add` in exactly
 * this position on `/transactions`, and it opens a form for typing one transaction in by hand.
 * Run takes the placement and refuses the payload: a hand-typed trade is unreconcilable by
 * construction, which is the one thing this product may never ship. Monarch can also afford to
 * keep CSV import off that page entirely, because it syncs from the institution automatically and
 * import there is a migration path used once. Run has no sync. The upload is the loop.
 *
 * ─── IT IS UNSCOPED, AND THAT IS A CORRECTNESS PROPERTY RATHER THAN AN OMISSION ─────────────────
 *
 * No `adoptAccountId`. `/trades` spans every account, so there is no row for the trader to be
 * asserting against and the files decide - which is `lib/intake/accounts.ts`'s "normal case, and
 * the one that must never adopt anything".
 *
 * THE COST, STATED SO IT IS NOT DISCOVERED LATER: a trader who hand-added an account this morning
 * and then imports from HERE gets a second row, with the hand-made one left empty forever. The
 * roster's `Add account` has always behaved this way, so the hazard is not new - but this is the
 * busiest surface in the app, so it moves from rare to reachable. Two mitigations, both deliberate:
 * this control says "Import trades" where the roster's says "Add account", and the account page's
 * own button (`import-into-account.tsx`) is the scoped one for exactly this case.
 *
 * SELF-CONTAINED RATHER THAN `AccountModalsProvider`. That provider carries the label, close and
 * delete modals too, and `/trades` has no account to edit - mounting it here would put three dead
 * openers on the page to reach one live one. Two instances of this component (the band and the
 * empty state) each own their modal state, which costs nothing: only one is ever open.
 */

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { IconButton } from '@/components/ui/icon-button';
import { Icon } from '@/components/ui/icon';
import { AddAccountModal } from '@/components/views/accounts/add-account-modal';

export function ImportTradesButton({
  /** The full-width pill under an empty tape, rather than the control in the header band. */
  cta = false,
  dryRun = false,
}: {
  cta?: boolean;
  /* DEMO ONLY, AND IT IS THE RACK'S ADMISSION TICKET rather than a convenience. `/kitchen-sink`'s
     header claims nothing on it writes to the database, and `demo.tsx` records what it cost to
     find that untrue: a scene mounted `AddAccountModal` directly, so clicking through Import
     trades reached the REAL upload step and posted to `/api/csv-import`. The rule it wrote is the
     one this prop exists to satisfy - "any scene added later takes `dryRun` or it does not go in".
     Never passed by app code. */
  dryRun?: boolean;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      {cta ? (
        <Button size="lg" onClick={() => setOpen(true)}>
          <Icon name="upload" size={18} />
          Import trades
        </Button>
      ) : (
        <>
          {/* THE ACCENT COMES OFF BELOW `md`, WHICH IS `accounts-header.tsx`'s CALL AND ITS
              REASONING: in a 390px band where every other control is a bare 36px disc, an
              accent-filled box does not read as emphasis, it reads as a control from a different
              screen. The label goes with it and the mark carries it.
              `aria-label` IS UNCONDITIONAL. A control whose name disappears at one width is
              nameless to a screen reader at that width. */}
          <IconButton className="md:hidden" aria-label="Import trades" onClick={() => setOpen(true)}>
            <Icon name="upload" size={22} />
          </IconButton>
          {/* `size="md"` (h-9), MATCHING EVERY OTHER CONTROL IN THIS BAND - `HeaderControl` for
              Search, Date and Filters, and `IconButton` beside them. One band, one control
              height; `accounts-header.tsx` records what `sm` looked like here. */}
          <Button
            size="md"
            className="max-md:hidden"
            aria-label="Import trades"
            onClick={() => setOpen(true)}
          >
            <Icon name="upload" size={16} />
            Import trades
          </Button>
        </>
      )}

      {/* `manual={false}`: "Add manually" CREATES AN ACCOUNT, and this button promises to import
          trades. Offering it here would answer a question the trader did not ask - the same call
          `import-trades-modal.tsx` makes from an account's page, for a different reason.
          `connected={0}` because no broker login exists to count until vendor OAuth lands.
          The modal owns its own phone sheet, its exit clock and its busy guard, so there is
          nothing for this file to arrange. */}
      {open && (
        <AddAccountModal
          onClose={() => setOpen(false)}
          connected={0}
          manual={false}
          title="Import trades"
          dryRun={dryRun}
        />
      )}
    </>
  );
}
