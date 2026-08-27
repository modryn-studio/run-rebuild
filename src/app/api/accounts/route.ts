import { and, eq, like, ne } from 'drizzle-orm';
import { z } from 'zod';
import { createRouteLogger } from '@/lib/route-logger';
import { getTrader } from '@/lib/trader';
import { db } from '@/lib/db';
import { account, ACCOUNT_TYPES } from '@/lib/db/schema';
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
 * ─── WHAT IS DELIBERATELY NOT HERE (Luke, 2026-08-27) ──────────────────────────────────────────
 * No `dailyLine`: the column is cut (`s6-plan.md` D2).
 * No `status` / `closedOn`: closing an account is its own flow with its own confirmation.
 * No `hidden` / `excludedFromTotals`: the roster owns those.
 * No `displayName`: there is no free-text rename. The title is derived from firm + size + last 4,
 *   and a typed name competing with it on every roster row is new design rather than a port.
 * Each of those is a real field in v2's own route; leaving them out is a decision, and adding one
 * back means adding its surface with it.
 */

const log = createRouteLogger('accounts-label');

/* THE FIRM IS FREE TEXT, LENGTH-CAPPED, NOT AN ENUM. `PROP_FIRMS` is a convenience and prop firms
   launch monthly; rejecting an unlisted one would turn "we have not heard of yours yet" into "you
   cannot use Run", which is never the right trade. */
const MAX_FIRM_LEN = 60;
/** The firm's own SKU name — "Growth", "Select". Free text for the same reason. */
const MAX_PRODUCT_LEN = 60;

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
  /* THE ONE THAT SAVES REAL WORK, and it is safe for a specific reason: each prop firm issues its
     own Tradovate login, and every account under it carries the same account-name prefix. So a
     prefix maps to exactly one firm, and a copy-trader importing eleven accounts across two firms
     answers "which firm" twice instead of eleven times.
     ONLY THE FIRM SPREADS. Type and size stay per-account — a trader farming five evaluations can
     have exactly one of them promoted, and spreading that would be Run inventing a fact. */
  applyFirmToPrefix: prefixSchema.optional(),
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

    const { id, propFirm, accountType, sizeDollars, productName, applyFirmToPrefix } = parsed.data;

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
