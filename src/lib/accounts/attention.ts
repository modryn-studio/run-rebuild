import 'server-only';
import { and, eq, max } from 'drizzle-orm';
import { db } from '@/lib/db';
import { importBatch } from '@/lib/db/schema';
import { accountPrefix } from '@/lib/prop-firms';
import type { RosterAccount } from './read';

/* THE THINGS ONLY THE TRADER CAN ANSWER, computed rather than remembered.
 *
 * `monarch-dashboard-teardown.md` §A15. Modelled on the reference's mobile "Let's review some
 * transactions" banner, which is chrome above their widget grid rather than a widget in it - it
 * takes no slot, is not in their Customize catalogue, and appears only when there is something to
 * say.
 *
 * WHAT RUN PUTS IN IT IS NOT WHAT MONARCH PUTS IN IT, and the difference is the whole design.
 * Their queue is a CLEANING queue: a bank feed guesses a merchant and a category, and the human
 * corrects it. Run has no such queue, because `preflight.ts` refuses a dirty import at the gate
 * rather than letting it in to be tidied later. What Run is left with is the opposite shape:
 * facts that exist in NO FILE and that Run can therefore never derive, at any cost, ever.
 *
 * `schema.ts` on `account_type`: "Phase is also not derivable, ever: a funded account and an
 * evaluation produce byte-identical files." The prop firm appears in none of the six export types.
 * Neither does the size. Neither does the fact that an evaluation ended last Thursday.
 *
 * ─── NO MEMORY, ON PURPOSE ────────────────────────────────────────────────────────────────
 *
 * There is no queue table, no dismissal, no "seen" flag and no cursor. This is a pure function of
 * the account rows and the import log, so the strip is correct on every render and closing it costs
 * nothing: label the account and it is gone, ignore it and it is still true. A dismissal state would
 * make the strip a BACKLOG - something that persists because the trader has not dealt with it - and
 * `CLAUDE.md` forbids exactly that: "No state may represent absence."
 *
 * WHICH IS ALSO WHY NOTHING HERE COUNTS DAYS. The `ended` question is asked off the IMPORT LOG, not
 * off a clock: "the newest import did not name this account" is a fact about a file. "You have not
 * traded this account in nine days" is a progress report on a person, and it is the sentence this
 * module exists to never write.
 */

/** One thing to ask about, and the account it is about. */
export interface AttentionItem {
  /** `label` - an import created this account and nothing has said what it is.
   *  `ended`  - it is still open on the roster and the newest import did not name it. */
  kind: 'label' | 'ended';
  account: RosterAccount;
  /* HOW MANY OTHER ACCOUNTS SHARE THIS ONE'S NAME PREFIX, so the card can offer to spread one firm
     answer across them - the same offer `label-account-form.tsx` makes, and the reason it exists is
     the copy-trader whose import brings in eleven accounts under one login. Computed here rather
     than queried per card because the roster is already in memory and `countPrefixSiblings` is the
     same count over the same rows: every account of this trader whose name starts with the prefix,
     minus itself. Zero for a personal account, a `pending:` placeholder, or a name with no prefix. */
  siblingCount: number;
}

/**
 * When Run last committed an import for each account, as epoch milliseconds.
 *
 * COMMITTED ONLY. A `pending` row is an upload mid-flight and a `rejected` one never landed; either
 * counted as "we saw this account" would answer the `ended` question with a file that contributed
 * nothing.
 *
 * `import` IS PER ACCOUNT - `account_id` is NOT NULL on that table - so one upload covering three
 * accounts writes three rows. That is what makes this shape work without an upload-session id:
 * comparing each account's newest import against the trader's newest import answers "was this
 * account in the last thing that landed" with no grouping to invent.
 */
export async function readLastImports(traderId: string): Promise<Map<string, number>> {
  const rows = await db
    .select({ accountId: importBatch.accountId, at: max(importBatch.uploadedAt) })
    .from(importBatch)
    .where(and(eq(importBatch.traderId, traderId), eq(importBatch.status, 'committed')))
    .groupBy(importBatch.accountId);

  const out = new Map<string, number>();
  for (const r of rows) if (r.at) out.set(r.accountId, r.at.getTime());
  return out;
}

/**
 * Build the lane. PURE, so `/kitchen-sink` can render every state off fixtures and so the ordering
 * rule is testable without a database - the same split `preflight.ts` uses for the same reason.
 *
 * @param accounts the full roster, unfiltered. Hidden rows are dropped HERE rather than in SQL,
 *   because the caller already has the roster and a second query for a subset of it would be a
 *   second chance to disagree with `getRoster` about what an account is.
 */
export function buildAttention(
  accounts: RosterAccount[],
  lastImports: Map<string, number>
): AttentionItem[] {
  /* THE NEWEST IMPORT ANYWHERE, taken across EVERY account including hidden and closed ones. The
     question is "what was in the last thing that landed", and an upload that only touched a hidden
     account still landed. Narrowing this to the visible set would make a hidden account's import
     invisible to the comparison and ask about every other account for no reason. */
  let newest = 0;
  for (const at of lastImports.values()) if (at > newest) newest = at;

  const label: AttentionItem[] = [];
  const ended: AttentionItem[] = [];
  const siblings = (a: RosterAccount) => {
    const prefix = accountPrefix(a.externalAccountId);
    if (!prefix) return 0;
    /* `startsWith` ON THE RAW NAME, matching `countPrefixSiblings`' `LIKE 'PREFIX%'` exactly.
       Postgres `LIKE` is case-sensitive, so uppercasing here would make this count rows that one
       does not and put a different number under the same switch on two screens. */
    return accounts.filter((o) => o.id !== a.id && o.externalAccountId.startsWith(prefix)).length;
  };

  for (const account of accounts) {
    /* HIDDEN IS AN ANSWER. A trader who tidied a row off the roster has said they do not want to
       look at it, and putting it back on the front door would overrule that from a different
       screen. Hiding is about the LIST, and this strip is a list. */
    if (account.hidden) continue;

    /* UNLABELLED FIRST, AND IT SUBSUMES THE OTHER QUESTION. `account_type_status_check` pairs the
       type with the status, so an account with no type is necessarily `active` and CANNOT be closed
       until it has one - `label-account-form.tsx` disables Close on exactly that condition. Asking
       "did this end?" about a row that cannot be ended is a dead end, so an unlabelled account
       raises the labelling question only, and the ending question follows on a later pass if the
       next import still does not name it. */
    if (account.accountType === null) {
      label.push({ kind: 'label', account, siblingCount: siblings(account) });
      continue;
    }

    if (account.status !== 'active') continue;

    /* NEVER IMPORTED AT ALL IS NOT MISSING. A hand-added evaluation bought this morning has no
       import and is not dead; it is waiting for its first one. `undefined` here means "no committed
       import has ever named this account", which is a different fact from "the last one did not". */
    const seen = lastImports.get(account.id);
    if (seen === undefined || seen >= newest) continue;

    ended.push({ kind: 'ended', account, siblingCount: 0 });
  }

  /* LABELS BEFORE ENDINGS because labelling is what unblocks everything else: the type gates
     closing, and it gates the loss line and the profit target that §A4 and §A5 put on the account
     row. Within each group the roster's own order is kept, which is newest first. */
  return [...label, ...ended];
}

/** The lane, read for a trader whose roster the caller already has. */
export async function getAttention(
  traderId: string,
  accounts: RosterAccount[]
): Promise<AttentionItem[]> {
  return buildAttention(accounts, await readLastImports(traderId));
}
