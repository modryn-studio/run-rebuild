import 'server-only';
import { and, eq, isNull } from 'drizzle-orm';
import { db, account } from '@/lib/db';
import { knownFirmForAccount } from '@/lib/prop-firms';
import type { ACCOUNT_TYPES } from '@/lib/db';

export type AccountType = (typeof ACCOUNT_TYPES)[number];

/* WHICH ACCOUNT A ROW BELONGS TO.
 *
 * THE INVARIANT THIS FILE EXISTS FOR: every event is filed under the account NAMED IN THE ROW,
 * never under a per-trader default. A copy-trader runs one strategy across five accounts, and
 * pooling them makes a single position look five times its real size — which corrupts every
 * figure that reads a position, silently, in an append-only log that cannot be corrected.
 *
 * KEYED ON THE ACCOUNT NAME, which is the only identifier present in every Tradovate export.
 * Verified on the real ten-day set: all 612 fills, 360 round trips, 2,448 cash rows and 1,009
 * orders carry it, and Tradovate's numeric account id appears in only two of the four. Keying on
 * the number would have left Cash History and Position History unattachable.
 */

/** Rows grouped by the account they name, plus the ones that named nothing. */
export interface AccountGroups<T> {
  groups: { accountName: string; rows: T[] }[];
  /** NOT silently bucketed into a default. See the note on `resolveAccount`. */
  unnamed: T[];
}

/** Pure. Splits parsed rows by the account name they carry. */
export function groupByAccount<T extends { accountName: string | null }>(
  rows: T[]
): AccountGroups<T> {
  const byName = new Map<string, T[]>();
  const unnamed: T[] = [];

  for (const row of rows) {
    if (!row.accountName) {
      unnamed.push(row);
      continue;
    }
    const bucket = byName.get(row.accountName);
    if (bucket) bucket.push(row);
    else byName.set(row.accountName, [row]);
  }

  return {
    groups: [...byName].map(([accountName, rows]) => ({ accountName, rows })),
    unnamed,
  };
}

export interface ResolveAccountArgs {
  traderId: string;
  /** The account NAME from the export, e.g. `FTDFYL100183704873`. */
  externalAccountId: string;
  /* OPTIONAL, AND IT WAS REQUIRED UNTIL 2026-08-15 (S4e). The old note here said "the flow asks
     for it in step 1 before a file is even chosen, which is why it can be required" — and that
     flow is exactly what could not be built. An export names an unknown number of accounts until
     it is parsed, so a question asked before the upload asks once when the answer might be
     eleven; and phase is not derivable from the files at all, since a funded account and an
     evaluation produce byte-identical exports.
     See `docs/docs from run-trading/prop-firm-identity.md` §2.3. Undefined means UNLABELLED, which
     is a normal state for a row that just arrived carrying real fills, and the labelling step
     names it afterwards. Never defaulted: a guess here is Run inventing a fact about somebody's
     money, and it lands in a row every later surface reads as true. */
  accountType?: AccountType | null;
  platform?: string;
  /** The firm, when it is known. Null is the normal answer — Tradovate carries it nowhere. */
  propFirm?: string | null;
  /** How the firm was arrived at. `detected` for a prefix recalled from another trader's
   *  confirmed account; `stated` only when this trader said so about THIS account. */
  firmSource?: 'stated' | 'detected' | null;
  /** Defaults to the account name. An override, never a requirement. */
  displayName?: string;
}

/**
 * The account this row belongs to, created on first sight.
 *
 * SCOPED BY `trader_id`, not just by name. Two traders can legitimately import the same account
 * name — a shared demo account, or one person testing two logins — and without the scope the
 * second one's trades land on the first one's account row. That is somebody else's trading
 * history, in an append-only log.
 *
 * SELECT-THEN-INSERT IS A RACE, and this flow will run it concurrently: four files arrive
 * together and each resolves its own accounts. Two of them see nothing, both insert, and the
 * unique index fails one. `onConflictDoNothing` makes the loser a no-op, and it then re-reads the
 * row the winner created. Handling this by catching the constraint error would work too and would
 * be harder to read six months from now.
 *
 * NO ADOPTION PATH, and that is a deliberate omission rather than a gap. The previous build let an
 * import claim a hand-added `pending:<uuid>` placeholder, under four conditions, because that
 * build had a "add an account by hand, import into it later" flow. This one does not: the account
 * is created BY the import (`wireframes.md` §2). Porting the adoption logic now would be a
 * mechanism with no caller, guarding a mistake nobody can currently make. If a hand-add flow ever
 * lands, that code is worth re-reading first — its four conditions are all earned.
 */
export async function resolveAccount(args: ResolveAccountArgs): Promise<string> {
  const platform = args.platform ?? 'tradovate';
  const { traderId, externalAccountId } = args;

  const [existing] = await db
    .select({ id: account.id })
    .from(account)
    .where(
      and(
        eq(account.traderId, traderId),
        eq(account.platform, platform),
        eq(account.externalAccountId, externalAccountId)
      )
    )
    .limit(1);
  /* A KNOWN FIRM UPGRADES A ROW THAT HAS NONE, which is the one thing this early return may do
     besides return. A prefix gets confirmed AFTER accounts already exist — that is the normal
     order, since a prefix is confirmed by a trader looking at an account Run already imported — so
     without this the accounts that motivated the entry are the only ones that never benefit from it.
     STRICTLY AN UPGRADE. Guarded on `prop_firm is null`, so a `stated` value the trader gave us is
     never touched, and nothing here can overwrite one recollection with another. */
  if (existing) {
    if (args.propFirm) {
      await db
        .update(account)
        .set({ propFirm: args.propFirm, firmSource: args.firmSource ?? 'detected' })
        .where(and(eq(account.id, existing.id), isNull(account.propFirm)));
    }
    return existing.id;
  }

  const [created] = await db
    .insert(account)
    .values({
      traderId,
      platform,
      externalAccountId,
      /* NOT DEFAULTED TO THE ACCOUNT NAME. `display_name` means "what the trader called this", and
         filling it with the id Run already has makes every account look named — which is exactly
         what stopped `accountRowTitle` from ever composing "Tradeify (...4873)". Null until a human
         types something; the raw name is not lost, it is in `external_account_id`. */
      displayName: args.displayName ?? null,
      accountType: args.accountType ?? null,
      propFirm: args.propFirm ?? null,
      firmSource: args.firmSource ?? null,
    })
    .onConflictDoNothing()
    .returning({ id: account.id });
  if (created) return created.id;

  // Lost the race. The winner's row is there now.
  const [raced] = await db
    .select({ id: account.id })
    .from(account)
    .where(
      and(
        eq(account.traderId, traderId),
        eq(account.platform, platform),
        eq(account.externalAccountId, externalAccountId)
      )
    )
    .limit(1);
  if (!raced) throw new Error(`Could not resolve account ${platform}/${externalAccountId}`);
  return raced.id;
}

/**
 * Resolve every account a set of rows names, in one pass. Returns a name → id map so the caller
 * can file each row without re-querying per row.
 *
 * THE FIRM IS RECALLED PER ACCOUNT, which is why it is derived here rather than passed in: the
 * prefix is a property of the account NAME, and one upload can name several accounts at different
 * firms. `FTDFYL100183704873` is Tradeify and `ELTDENF2606…` is TradeDay, both confirmed by a real
 * trader on a real account — `prop-firms.ts` is explicit that an entry exists only for that reason
 * and never because the letters look like a name.
 *
 * `detected`, NEVER `stated`. The prefix was confirmed on somebody else's account, not on this one,
 * so this is a recollection rather than a fact the trader gave us — and the trader's own answer
 * always overwrites it. An unknown prefix stays null, which is the normal answer and the one that
 * asks a one-tap question later instead of asserting something false about somebody's money.
 *
 * A CALLER-SUPPLIED `propFirm` STILL WINS, because that one came from the trader.
 */
export async function resolveAccountsFor<T extends { accountName: string | null }>(
  rows: T[],
  args: Omit<ResolveAccountArgs, 'externalAccountId'>
): Promise<Map<string, string>> {
  const { groups } = groupByAccount(rows);
  const out = new Map<string, string>();
  for (const g of groups) {
    const detected = knownFirmForAccount(g.accountName);
    out.set(
      g.accountName,
      await resolveAccount({
        ...args,
        externalAccountId: g.accountName,
        propFirm: args.propFirm ?? detected,
        firmSource: args.firmSource ?? (detected ? 'detected' : null),
      })
    );
  }
  return out;
}
