'use client';

/* THE DASHBOARD'S PAGE-LEVEL ACCOUNT SCOPE, in the header band's controls cell.
 *
 * ─── WHY IT IS PAGE-LEVEL AND NOT PER-CARD ─────────────────────────────────────────────────────
 *
 * 2026-09-03. `Net P&L` shipped with a period picker and no account picker, and the question that
 * settled it was not about the control - it was about the scope. If a trader picks `Apex 50K` on one
 * card, either EVERY card follows or none does. If none does, three cards on one page each describe
 * a different set of accounts, which is a dashboard disagreeing with itself in public: the same
 * class of defect as v2's rail reading `+$954.99` under a chart reading `-$26,995.06`, which is the
 * fault this build keeps deleting. Luke: *"my answer would be that we will need a page-level scope
 * control."* Reasoning and the deferred parts are in `monarch-dashboard-teardown.md` §A8.
 *
 * THE REFERENCE IS NO HELP HERE, and that is worth stating rather than implying: Monarch's dashboard
 * has NO account scope at all. Its widgets scope by their own subject - Transactions by reviewer,
 * Budget by summary-or-expenses - and never by account. This is Run's own answer to a question a
 * personal-finance dashboard does not have, because a prop trader runs five accounts on one
 * decision and a retail budgeter does not.
 *
 * ─── WHERE IT SITS, AND RUN ALREADY HAD THE POSITION ───────────────────────────────────────────
 *
 * Measured on the reference the same day: its dashboard header is one grid row, 1388x64, with the
 * greeting in the left cell and `Customize` in the right one at 113x36, `14px/500`, ink on a white
 * ground, no border, radius 8. Luke's instinct was to put the picker to the left of that button -
 * and `HeaderSlot slot="controls"` IS that cell. `/accounts` already portals `RosterClear`,
 * `RosterFilters`, `RefreshRoster` and its CTA into it; `/trades` puts its columns and filter
 * controls there. It even carries the house ORDER for the cell, written in `accounts-header.tsx`:
 * **the undo, then the chrome, then the one thing wearing the accent.** A scope picker is chrome.
 *
 * NO `Customize` BUTTON (Luke, 2026-09-03: *"we can leave the customize button off for now"*), and
 * the picker never needed it: Monarch's Customize is a dialog of twelve switches, and it exists
 * because they ship twelve widgets a user may never want. Run ships six, each argued for. Building
 * the button first would be building the container before the thing it contains.
 *
 * ─── IT IS `AccountSelect`, THE SAME CONTROL `/trades` DRAWS ───────────────────────────────────
 *
 * Not a new component, and three things fall out of that which a new one would have had to
 * rediscover:
 *
 *   - **It renders at every account count and WRITES NOTHING at one.** At a single account it is a
 *     label wearing a menu's clothes, because picking the only account would write the param, select
 *     exactly the same trades, AND light every "something is narrowed" affordance - a control
 *     claiming the record was narrowed without narrowing it.
 *   - **The labels are the tape's own composed titles**, through `toFacetAccount`, so a chip here
 *     and a row on `/trades` cannot disagree about what an account is called.
 *   - **It writes the `accounts` search param**, which is the param `/trades` and its filter panel
 *     already share. A trader who narrows on `/trades` and walks to `/today` is not silently
 *     re-widened.
 *
 * IT WRITES THE URL, UNLIKE THE CARD'S PERIOD PICKER, and the split is deliberate rather than
 * inconsistent - it is the reference's own. Monarch's accounts PAGE keeps its chart in the query
 * string (`?chartType=performance&dateRange=1M&timeframe=month`); its dashboard WIDGET keeps the
 * period in the component. A page's subject belongs in the address: it survives a refresh, it can
 * be shared, and every card reads it on the server without a client context. A widget's period is a
 * glance (Luke: *"keep it local"*).
 *
 * ─── THE PHONE GETS A MARK AND A SHEET, NOT THIS MENU (2026-09-03, later the same day) ─────────
 *
 * This file shipped with the dropdown rendering at every width and a note saying the phone was out
 * of scope. Luke answered within the hour: *"i realize we have our account picker. but that doesn't
 * work in the header. i dont want it like that. we need to copy the same way we do everything else
 * in the header. look at the accounts and trades pages for mobile. we use icons."*
 *
 * So `AccountSelect` is now `max-md:hidden` and `ScopeSheetTrigger` is `md:hidden` - a `filter`
 * mark that opens a full-screen sheet, which is `design-system.md` §6a's rule rather than a
 * preference. `scope-sheet.tsx` carries which icon and why, and what was turned down.
 */

import { HeaderSlot } from '@/components/shell/header-slot';
import { AccountSelect } from '@/components/views/trades/account-select';
import { ScopeSheetTrigger } from './scope-sheet';
import type { FacetAccount } from '@/lib/trades/read';

export function TodayHeader({
  accounts,
  selected,
}: {
  /** Every account with trades, in the tape's own labels. Empty renders nothing at all. */
  accounts: FacetAccount[];
  /** The ids currently in the `accounts` param. Empty means every account. */
  selected: string[];
}) {
  return (
    <HeaderSlot slot="controls">
      {/* TWO CONTROLS, ONE PARAM, AND NEVER BOTH ON SCREEN (2026-09-03). `design-system.md` §6a:
          below `PHONE_QUERY` every dismissible surface is a full-screen sheet, so a 150px dropdown
          in a 375px band is a desktop control in the wrong place - it crowds a bar whose other
          items are 22px marks, and its popover opens over the card it is about.
          The pair is `max-md:hidden` / `md:hidden`, which is the shell's own phone boundary and the
          same split the band already makes for the notifications bell. Exactly one is in the
          document at any width, so there is one place a bug in this write can live. */}
      <div className="contents max-md:hidden">
        <AccountSelect accounts={accounts} selected={selected} />
      </div>
      <ScopeSheetTrigger accounts={accounts} selected={selected} />
    </HeaderSlot>
  );
}
