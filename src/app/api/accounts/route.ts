import { and, eq, like, ne, sql } from 'drizzle-orm';
import { z } from 'zod';
import { createRouteLogger } from '@/lib/route-logger';
import { getTrader } from '@/lib/trader';
import { db } from '@/lib/db';
import { account, importBatch, trade, ACCOUNT_TYPES, ACCOUNT_STATUSES } from '@/lib/db/schema';
import { ACCOUNT_SIZES } from '@/lib/prop-firms';

/* LABEL AN ACCOUNT THAT ALREADY EXISTS — the three questions Tradovate cannot answer (`S6d` C3).
 *
 * WHY IT IS A PATCH AND NOT A POST. The row is already there: an import created it from the only
 * identity the export carries, a name like `FTDFYL100183704873`. The firm, the size and the type
 * are absent from every one of the six Tradovate export types and from the API too
 * (`docs/prop-firm-identity.md`), so the row lands real, holding real fills, and unnamed. This route
 * fills in the identity the broker withheld; it does not create anything.
 *
 * THE FIRST WRITE PATH IN THIS BUILD THAT TOUCHES AN ACCOUNT. Everything before it appended to
 * `event` or projected from it. Three consequences, all deliberate:
 *
 *   IDENTITY COMES FROM THE SESSION, NEVER FROM THE BODY. There is no `traderId` in the schema
 *   below, and that absence is the point. The account id IS in the body — it has to be — so the
 *   trader scoping moves into the `WHERE` rather than into a separate check: a guessed uuid must
 *   relabel nothing rather than relabel somebody else's account.
 *
 *   IT DOES NOT TOUCH `event`. An account's firm is not something that HAPPENED, it is a fact about
 *   the account that the trader states and can correct. The append-only rule governs the record of
 *   trading; a label is a column.
 *
 *   EVERY FIELD IS APPLIED ONLY WHEN PRESENT, never defaulted. A form that sends two fields must not
 *   silently reset the third — v2 states the same rule and it is what makes a partial edit safe.
 *
 * ─── WHAT IS DELIBERATELY NOT HERE (Luke, 2026-08-28) ──────────────────────────────────────────
 * No `dailyLine`, and it is the only one of v2's fields still missing. The column is cut
 * (`s6-plan.md` D2), nothing reads the value in v2 either, and `psychology.md` puts the armed-line
 * ritual in a later slice where the number is set per SESSION rather than stored as a default.
 * Adding the column now would ship a field that does nothing.
 *
 * `displayName`, `hidden` and `excludedFromTotals` WERE missing and are not any more (2026-08-28).
 * They were left out on my own call while porting the modal, and the call was wrong twice over: all
 * three are in v2's Edit modal, and all three columns already exist in this schema.
 */

const log = createRouteLogger('accounts-label');

/* THE FIRM IS FREE TEXT, LENGTH-CAPPED, NOT AN ENUM. `PROP_FIRMS` is a convenience and prop firms
   launch monthly; rejecting an unlisted one would turn "we have not heard of yours yet" into "you
   cannot use Run", which is never the right trade. */
const MAX_FIRM_LEN = 60;
/** The firm's own SKU name — "Growth", "Select". Free text for the same reason. */
const MAX_PRODUCT_LEN = 60;
/** A display name is a label on a row, not prose. See the field's own note below. */
const MAX_NAME_LEN = 60;

/* THE PREFIX REACHES A `LIKE` PATTERN, so it is letters only and capped. `_` and `%` inside it
   would silently widen the match to accounts the trader never named — which on this route means
   relabelling somebody's whole roster from one answer. Drizzle parameterises the value, so this is
   not about injection; it is about the wildcard characters being MEANINGFUL to `LIKE`. */
const prefixSchema = z.string().regex(/^[A-Z]{2,16}$/);

const bodySchema = z.object({
  id: z.string().uuid(),
  /* `.optional()` THROUGHOUT, and `null` where null is a real answer rather than a missing field.
     `sizeDollars: null` is what re-labelling a 50K evaluation as a PERSONAL account sends, and it
     has to clear the column — a personal account keeping a firm-set size would leave every
     percentage downstream computed against a number that means nothing. */
  propFirm: z.string().trim().min(1).max(MAX_FIRM_LEN).optional(),
  accountType: z.enum(ACCOUNT_TYPES).optional(),
  sizeDollars: z
    .number()
    .refine((n) => (ACCOUNT_SIZES as readonly number[]).includes(n), 'Not an offered size')
    .nullable()
    .optional(),
  productName: z.string().trim().max(MAX_PRODUCT_LEN).optional(),
  /* CLOSING IS A STATUS CHANGE, NOT A DELETION: the tape stays, the row stops being live. It comes
     through this route rather than one of its own because it is the same object being edited, and
     the moment of intent lives in the confirmation UI rather than in a second endpoint.
     `status` AND `accountType` TRAVEL TOGETHER, and the schema is what forces it. The CHECK
     constraint pairs them: an evaluation may be passed or failed, a sim-funded account may be
     failed or closed, a personal one may only close. So the close flow sends the type ON SCREEN
     alongside the status - a trader who switched the type row to Evaluation and then closed is
     looking at an evaluation, and writing `passed` against a row the database still calls personal
     is exactly the incoherent pair the constraint would reject. */
  status: z.enum(ACCOUNT_STATUSES).optional(),
  /* A PLAIN CALENDAR DATE, and `null` is a real value - reopening sends it explicitly to clear the
     old one. Validated here rather than parsed: there is no time and no zone to reason about, and a
     bad string reaching Postgres would come back a 500 where it should be a 400. */
  closedOn: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullable()
    .optional(),
  /* THE ONE THAT SAVES REAL WORK, and it is safe for a specific reason: each prop firm issues its
     own Tradovate login, and every account under it carries the same account-name prefix. So a
     prefix maps to exactly one firm, and a copy-trader importing eleven accounts across two firms
     answers "which firm" twice instead of eleven times.
     ONLY THE FIRM SPREADS. Type and size stay per-account — a trader farming five evaluations can
     have exactly one of them promoted, and spreading that would be Run inventing a fact. */
  applyFirmToPrefix: prefixSchema.optional(),
  /* THE TRADER'S OWN NAME FOR THE ROW, and an EMPTY STRING IS A REAL ANSWER meaning "go back to the
     derived name" - so it is normalised to null below rather than stored as "". `accountRowTitle`
     already prefers it over the derived form, everywhere, which is why nothing downstream needs to
     learn about this field.
     A label on a row, not prose: long enough for "Apex 50K - the aggressive one", short enough that
     it cannot be used as a storage field. */
  displayName: z.string().trim().max(MAX_NAME_LEN).optional(),
  /* TWO KINDS OF "DO NOT SHOW ME THIS", and they are genuinely different questions. `hidden` is
     about the LIST: the row leaves the roster and every figure is untouched. `excludedFromTotals`
     is about the ARITHMETIC: the row stays and its P&L leaves the chart and the totals. Neither
     touches an event, which is what lets a trader use them without fear. */
  hidden: z.boolean().optional(),
  excludedFromTotals: z.boolean().optional(),
});

export async function PATCH(req: Request): Promise<Response> {
  const ctx = log.begin();
  try {
    const parsed = bodySchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      return log.end(ctx, Response.json({ error: 'Invalid request' }, { status: 400 }));
    }

    const trader = await getTrader();
    if (!trader) {
      return log.end(ctx, Response.json({ error: 'Not signed in' }, { status: 401 }));
    }

    const {
      id,
      propFirm,
      accountType,
      sizeDollars,
      productName,
      applyFirmToPrefix,
      status,
      closedOn,
      displayName,
      hidden,
      excludedFromTotals,
    } = parsed.data;

    const patch: Partial<typeof account.$inferInsert> = {};
    if (propFirm !== undefined) {
      patch.propFirm = propFirm;
      /* ANY WRITE THROUGH THIS ROUTE CAME FROM THE TRADER, so the guess becomes a statement.
         `firmSource` is what lets the roster tell "we recalled this from a confirmed prefix" from
         "they told us", and a labelled account must never keep reading as the former. */
      patch.firmSource = 'stated';
    }
    if (accountType !== undefined) patch.accountType = accountType;
    if (sizeDollars !== undefined) patch.sizeDollars = sizeDollars;
    if (productName !== undefined) patch.productName = productName || null;
    if (status !== undefined) patch.status = status;
    if (closedOn !== undefined) patch.closedOn = closedOn;
    // `|| null` rather than a truthiness guard: "" is the trader clearing the name, which is an
    // answer, and storing it as an empty string would leave `accountRowTitle` preferring nothing.
    if (displayName !== undefined) patch.displayName = displayName || null;
    if (hidden !== undefined) patch.hidden = hidden;
    if (excludedFromTotals !== undefined) patch.excludedFromTotals = excludedFromTotals;

    if (Object.keys(patch).length === 0) {
      return log.end(ctx, Response.json({ error: 'Nothing to update' }, { status: 400 }));
    }

    /* SCOPED TO THE TRADER IN THE `WHERE`, not checked separately. Object-level permission belongs
       in the query: a guessed uuid then updates zero rows and answers 404, which is the same answer
       an id that never existed gets. Two code paths — "find it, then check it" — is how the check
       eventually gets skipped on the branch nobody re-read. */
    const updated = await db
      .update(account)
      .set(patch)
      .where(and(eq(account.id, id), eq(account.traderId, trader.id)))
      .returning({ id: account.id });

    if (updated.length === 0) {
      return log.end(ctx, Response.json({ error: 'Account not found' }, { status: 404 }));
    }

    /* THE SIBLING WRITE COMES AFTER THE PRIMARY ONE SUCCEEDED, so a bad id fails loudly rather than
       quietly relabelling a dozen accounts and then 404ing on the one the trader was looking at. */
    let alsoUpdated = 0;
    if (applyFirmToPrefix && propFirm) {
      const siblings = await db
        .update(account)
        .set({ propFirm, firmSource: 'stated' })
        .where(
          and(
            eq(account.traderId, trader.id),
            like(account.externalAccountId, `${applyFirmToPrefix}%`),
            ne(account.id, id)
          )
        )
        .returning({ id: account.id });
      alsoUpdated = siblings.length;
    }

    return log.end(ctx, Response.json({ ok: true, alsoUpdated }));
  } catch (err) {
    log.err(ctx, err);
    return log.end(ctx, Response.json({ error: 'Could not save the account' }, { status: 500 }));
  }
}


/* DELETE AN ACCOUNT THAT NEVER HELD ANYTHING — and refuse every other one.
 *
 * WHY IT REFUSES RATHER THAN CASCADES. The whole claim of this product is that it keeps the tape,
 * especially the blown-account sessions the broker erases within hours. A menu item that erases it
 * is arguing against the thing being sold. The reference deletes everything - transactions,
 * balances, the lot - and that is right for a ledger a human curates and wrong here.
 *
 * THE DATABASE ALREADY REFUSES IT UNDERNEATH THIS. `import.account_id` is NOT NULL and
 * `event.account_id` is nullable, and NEITHER cascades - so a delete that would orphan a record
 * fails on the foreign key. `trade.account_id` DOES cascade, and that is correct rather than an
 * inconsistency: `trade` is a projection, rebuildable by replaying `event`, so it is not the record.
 * This route checks first so the trader gets a sentence instead of a 500 from the driver.
 *
 * 409, NOT 403. The request is well-formed and the trader owns the row; what refuses it is the
 * state of the thing. A 403 would say "not yours", which is both untrue and the one answer this
 * codebase reserves for somebody else's data.
 *
 * THE REFUSAL POINTS AT SOMETHING THAT EXISTS. The first draft said "Hide it to take it off your
 * list", copying v2 - and `hidden` has no control in this build yet, so the sentence would have sent
 * a trader looking for a switch that is not there. That is the same false promise v2's own close
 * copy made and had to fix. CLOSE is the real answer: it marks how the account ended and keeps every
 * trade in the totals.
 */
export async function DELETE(req: Request): Promise<Response> {
  const ctx = log.begin();
  try {
    const parsed = z
      .object({ id: z.string().uuid() })
      .safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      return log.end(ctx, Response.json({ error: 'Invalid request' }, { status: 400 }));
    }

    const trader = await getTrader();
    if (!trader) {
      return log.end(ctx, Response.json({ error: 'Not signed in' }, { status: 401 }));
    }

    const { id } = parsed.data;

    /* SCOPED IN THE `WHERE` LIKE EVERY OTHER READ HERE, so an id belonging to somebody else finds
       nothing and answers 404 - the same answer an id that never existed gets. */
    const [own] = await db
      .select({ id: account.id })
      .from(account)
      .where(and(eq(account.id, id), eq(account.traderId, trader.id)));
    if (!own) {
      return log.end(ctx, Response.json({ error: 'Account not found' }, { status: 404 }));
    }

    /* COUNTED IN ONE ROUND TRIP. Both matter and neither alone is sufficient: an account can hold
       a committed import whose rows all deduplicated to nothing, and it can hold trades from a
       replay whose import row was never written. */
    const [{ trades, imports }] = await db
      .select({
        trades: sql<number>`(select count(*) from ${trade} where ${trade.accountId} = ${id})`.mapWith(
          Number
        ),
        imports:
          sql<number>`(select count(*) from ${importBatch} where ${importBatch.accountId} = ${id})`.mapWith(
            Number
          ),
      })
      .from(account)
      .where(eq(account.id, id));

    if (trades > 0 || imports > 0) {
      log.warn(ctx.reqId, 'delete refused: account holds a record', { trades, imports });
      return log.end(
        ctx,
        Response.json(
          {
            error:
              'This account holds imported trades, so it cannot be deleted. Close it instead to mark how it ended.',
          },
          { status: 409 }
        )
      );
    }

    await db.delete(account).where(and(eq(account.id, id), eq(account.traderId, trader.id)));
    return log.end(ctx, Response.json({ ok: true }));
  } catch (err) {
    log.err(ctx, err);
    return log.end(ctx, Response.json({ error: 'Could not delete the account' }, { status: 500 }));
  }
}
