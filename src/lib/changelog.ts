/* WHAT CHANGED, IN THE TRADER'S TERMS. Read by `/whats-new`.
 *
 * A HAND-KEPT LIST, NOT THE GIT LOG. A commit message is written for the next engineer and says
 * "the RSC boundary becomes a rule"; an entry here is written for a trader and says what they can
 * now do. The two audiences want different sentences about the same change, and the only way to get
 * the second one is to write it. Newest first.
 *
 * `build-plan.md` §S8b calls this "the smallest surface in the plan", and it is: an account-menu
 * row, not a destination. A changelog is something you read once and never look for again, which is
 * why it never earns a sidebar slot.
 *
 * House style applies (`CLAUDE.md`): no em dashes, and the app never names itself. "Your trades",
 * never "Run now shows your trades".
 */
export interface ChangelogEntry {
  /** ISO date, the day it reached the deployed app. */
  date: string;
  title: string;
  /** One to three sentences. What you can do now, or what stopped being true. */
  body: string;
}

export const CHANGELOG: readonly ChangelogEntry[] = [
  {
    date: '2026-09-08',
    title: 'Settings, and a place to see what changed',
    body: 'Your display name, time zone and appearance now have a home under Settings. Your data has one too: download every trade as a CSV, or delete your account and everything in it.',
  },
  {
    date: '2026-09-08',
    title: 'Larger exports are refused before they fail',
    body: 'An upload over 4 MB is turned back with the size and what to do about it, instead of failing silently. Re-export a shorter date range and upload it in batches; each one adds to your record.',
  },
  {
    date: '2026-09-04',
    title: 'The month, one cell per day',
    body: 'Today carries a calendar of the month: each day shows its net and its trade count, and the arrows step back through earlier months.',
  },
  {
    date: '2026-08-31',
    title: 'Accounts',
    body: 'Every account on one page, with its P&L over time, and a scope control that narrows every figure on the page to the accounts you pick.',
  },
  {
    date: '2026-08-25',
    title: 'Trades',
    body: 'Your full record, grouped by session and reconciled to your broker’s export to the cent. Fees are resolved per round trip from Cash History, never estimated.',
  },
];
