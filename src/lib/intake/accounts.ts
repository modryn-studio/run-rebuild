import 'server-only';
import { and, eq } from 'drizzle-orm';
import { db, account } from '@/lib/db';
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
  /** Required at creation (`spec.md` §3): without it Run cannot tell a personal signup from a
   *  prop one, and admitting the segment at all would be pointless. The flow asks for it in step
   *  1 before a file is even chosen, which is why it can be required here. */
  accountType: AccountType;
  platform?: string;
  propFirm?: string | null;
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
  if (existing) return existing.id;

  const [created] = await db
    .insert(account)
    .values({
      traderId,
      platform,
      externalAccountId,
      // The raw broker name until a human renames it. Better than a generated label: it is what
      // the trader sees in Tradovate, so the two surfaces agree on day one.
      displayName: args.displayName ?? externalAccountId,
      accountType: args.accountType,
      propFirm: args.propFirm ?? null,
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

/** Resolve every account a set of rows names, in one pass. Returns a name → id map so the caller
 *  can file each row without re-querying per row. */
export async function resolveAccountsFor<T extends { accountName: string | null }>(
  rows: T[],
  args: Omit<ResolveAccountArgs, 'externalAccountId'>
): Promise<Map<string, string>> {
  const { groups } = groupByAccount(rows);
  const out = new Map<string, string>();
  for (const g of groups) {
    out.set(g.accountName, await resolveAccount({ ...args, externalAccountId: g.accountName }));
  }
  return out;
}
