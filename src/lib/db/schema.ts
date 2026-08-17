// Baseline schema — auth identity, product analytics, alert throttling.
// Everything here is generic scaffolding every Modryn build needs. Your domain tables go
// BELOW the marker at the bottom; don't edit the auth tables (Better Auth owns their shape).
import {
  pgTable,
  uuid,
  text,
  timestamp,
  jsonb,
  boolean,
  index,
  uniqueIndex,
  numeric,
  integer,
  bigint,
  date,
  check,
  foreignKey,
  primaryKey,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

// ── Better Auth tables. Managed by better-auth via the Drizzle adapter. ──────────────
// Physical names are auth_-prefixed so `auth_session` can never collide with a domain
// table called `session` (a real collision on a previous build). See src/lib/auth.ts.
export const authUser = pgTable('auth_user', {
  id: text('id').primaryKey(),
  name: text('name'), // nullable: Google supplies one, the emailed-code path does not
  email: text('email').notNull().unique(),
  emailVerified: boolean('email_verified').notNull().default(false),
  image: text('image'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const authSession = pgTable('auth_session', {
  id: text('id').primaryKey(),
  userId: text('user_id')
    .notNull()
    .references(() => authUser.id, { onDelete: 'cascade' }),
  token: text('token').notNull().unique(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  ipAddress: text('ip_address'),
  userAgent: text('user_agent'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const authAccount = pgTable('auth_account', {
  id: text('id').primaryKey(),
  userId: text('user_id')
    .notNull()
    .references(() => authUser.id, { onDelete: 'cascade' }),
  accountId: text('account_id').notNull(),
  providerId: text('provider_id').notNull(),
  accessToken: text('access_token'),
  refreshToken: text('refresh_token'),
  idToken: text('id_token'),
  accessTokenExpiresAt: timestamp('access_token_expires_at', { withTimezone: true }),
  refreshTokenExpiresAt: timestamp('refresh_token_expires_at', { withTimezone: true }),
  scope: text('scope'),
  password: text('password'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const authVerification = pgTable('auth_verification', {
  id: text('id').primaryKey(),
  identifier: text('identifier').notNull(),
  value: text('value').notNull(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

// ── analytics_event — the free, self-hosted product funnel (no Google Analytics). ────
// The user is referenced by id and cascades on delete, so an erasure request takes this
// with it — analytics must not become a second un-deletable store of personal data. No IP
// is captured for the same reason; `user_agent` is kept only to filter bots.
export const analyticsEvent = pgTable(
  'analytics_event',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    name: text('name').notNull(),
    // Null until the visitor signs in — most funnel events fire before there is a user.
    userId: text('user_id').references(() => authUser.id, { onDelete: 'cascade' }),
    // First-party cookie, survives tabs and reloads (a sessionStorage-only id resets per
    // tab and silently inflates the session count).
    visitorId: text('visitor_id'),
    // Per-tab, so a single visitor's separate visits stay distinguishable.
    sessionId: text('session_id'),
    properties: jsonb('properties'),
    path: text('path'),
    userAgent: text('user_agent'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    // Every funnel query filters name + date; without this they are all seq scans.
    index('analytics_event_name_created_idx').on(t.name, t.createdAt),
    index('analytics_event_visitor_idx').on(t.visitorId),
    index('analytics_event_user_idx').on(t.userId),
  ],
);

// ── alert_throttle — flood control for founder alerts. ───────────────────────────────
// A durable, cross-instance cooldown: an in-memory Map is per-instance on serverless and
// therefore close to meaningless, so one error loop either buries the signal or hits
// Gmail's ~500/day cap. One row per alert kind; see sendNotification's `throttleKey`.
export const alertThrottle = pgTable('alert_throttle', {
  key: text('key').primaryKey(),
  lastSentAt: timestamp('last_sent_at', { withTimezone: true }).notNull().defaultNow(),
});

// ─────────────────────────────────────────────────────────────────────────────────────
// DOMAIN TABLES — add yours below this line.
//
// After any change here: `npx drizzle-kit generate` then `migrate`. NEVER `push` — see
// CLAUDE.md. One push makes migrate skip older migrations forever, silently, exit 0.
// ─────────────────────────────────────────────────────────────────────────────────────

// ── contract_spec — what an instrument is, MINUS the one field that used to matter most.
//
// `point_value_cents` WAS here and is gone (S2, 2026-08-12 — see docs/architecture.md, the
// contract_spec section). It is now DERIVED per symbol_root from the trader's own closed round
// trips: pointValue = gross / (deltaPrice x qty), solved from the broker's realised P&L, which
// is the same source every other figure in the product reconciles to. A hand-seeded multiplier
// was a human transcription sitting underneath every P&L number, and "never show a number you
// cannot reconcile" forbids exactly that. It was also the only design that could invert NQ and
// MNQ into a 10x error; derivation cannot, because each root solves from its own trades.
// `lib/desk/tape.ts` owns the derivation and quarantines on disagreement — never a median.
//
// WHAT REMAINS IS WHAT CANNOT BE DERIVED, and each field is load-bearing on its own:
//   tick_size  the instrument's own precision, which a round trip does not reveal
//   currency   a EUR-denominated product's P&L may not be summed with a USD one
//   exchange   drives the session calendar (CME hours are not the ag complex's hours)
//
// AN UNKNOWN ROOT STILL QUARANTINES. The row no longer carries the multiplier, but it carries
// the currency and the calendar, and guessing either is the same failure in a different field.
//
// SEEDED NARROW, by scripts/seed-contract-spec.mts, not by a migration — it is data, so it
// corrects without a deploy. The asymmetry decides the width: a MISSING row fails loudly, a
// WRONG row produces a plausible number nobody catches. So breadth bought from memory is a
// liability rather than coverage. Every value comes from the exchange's own published contract
// spec with the source URL and the date read beside it, and the table grows only when a real
// import quarantines something.
export const contractSpec = pgTable('contract_spec', {
  symbolRoot: text('symbol_root').primaryKey(), // MNQ, NQ — what has actually been traded
  tickSize: numeric('tick_size').notNull(),
  currency: text('currency').notNull(),
  exchange: text('exchange').notNull(), // drives the session calendar
});

// ── trader — the domain identity, and the thing every query is scoped by ─────────────
//
// ONE ROW PER AUTH USER, linked rather than duplicated. Better Auth owns `auth_user` and
// writes `auth_user.email` itself (Google supplies one, a future email change rewrites it),
// so a second copy of the address here would be a column guaranteed to disagree eventually.
// Nothing looks a trader up by email: every query is scoped by `trader_id` FROM THE SESSION,
// never from the request, and admin surfaces join. See docs/architecture.md §1.
//
// `display_timezone` IS DISPLAY ONLY and must never reach the bucketing code. A trade renders
// at THEIR 9:31am; which session it belongs to is a market fact that does not move because the
// trader moved (spec.md §8, the three time layers). `lib/time/session.ts` cannot import this
// module, and `scripts/s3-gate.mts` asserts that it doesn't — the one guard that matters here,
// because the failure is silent and would corrupt every figure in the product.
//
// `display_timezone_set_by_user` IS THE PRECEDENCE RULE, not a preference. False means the
// value was detected from the browser and may be improved; true means a human chose it and
// detection must never overwrite it. Without this, opening the app from an airport would
// silently relabel every clock in the record.
//
// `key_id` IS A COLUMN WITH NOTHING BEHIND IT, deliberately. The erasure doctrine says
// crypto-shred solves the backup window, but that is only true once `event.payload` is
// encrypted with a per-trader key, and in v1 it is NOT. The column ships now because it is
// free and nullable; the encryption does not, because it changes every read path for a product
// with one user. UNTIL PAYLOAD IS ENCRYPTED, DROPPING A KEY DOES NOTHING — v1 erasure is
// hard-delete only. The trigger to build the rest is the first user who is not Luke.
export const trader = pgTable('trader', {
  id: uuid('id').primaryKey().defaultRandom(),
  authUserId: text('auth_user_id')
    .notNull()
    .unique()
    .references(() => authUser.id, { onDelete: 'cascade' }),
  displayTimezone: text('display_timezone').notNull(),
  displayTimezoneSetByUser: boolean('display_timezone_set_by_user').notNull().default(false),
  keyId: uuid('key_id'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

/* ─────────────────────────────────────────────────────────────────────────────────────
   S4a — THE INGEST TABLES. `account`, `import`, `event`.

   Reviewed against `run-trading@v2` before writing, per Luke. What that build got right is
   carried over with its reasoning; what it got wrong it says so itself, and those are fixed
   here rather than inherited.
   ───────────────────────────────────────────────────────────────────────────────────── */

// ── account — a broker account, owned by a trader ────────────────────────────────────
//
// `platform` AND `prop_firm` ARE TWO COLUMNS, and this is the one place run-rebuild
// deliberately departs from v2. That build called this column `firm` and its own comment
// admits the mistake: "The PLATFORM, not the prop firm... The name is a known misnomer. Not
// renamed here because it is half the natural key and every event is already filed under it."
// A naming error becomes unfixable the moment a corpus is filed under it. This build has no
// corpus yet, so it gets the right name for free.
//
// `external_account_id` IS THE ACCOUNT NAME, NOT THE NUMERIC ID — v2's hardest-won finding
// here. The name (ELTDENF260623134425853685) is the only key present in ALL SIX Tradovate
// exports; the numeric id appears in two, so it cannot key a Cash History or Position History
// row. Keying on the numeric id would have made fees unattachable.
//
// THE IDENTITY COLUMNS ARE NULLABLE ON PURPOSE. An import creates this row before anyone has
// said what kind of account it is, and a half-labelled account still has to hold its fills.
// `account_type` is the exception: spec.md §3 requires it at creation, because without it Run
// cannot tell a personal signup from a prop one.
//
// CASCADE ON THE TRADER, and note what does NOT cascade: `event`. A trader's mutable children
// die with them; the immutable log does not, and its erasure is a separate privileged path.
//
// DELETION POLICY: THERE ISN'T ONE. An account is never DELETEd. `closed` and `breached` are
// states, not absences. Any ON DELETE CASCADE reaching this table or below it is a bug.
/* `sim_funded`, NOT `funded`, and the longer word is the honest one (Luke, 2026-08-15).
 *
 * A prop "funded" account is funded by the FIRM and traded in SIMULATION. The firms themselves use
 * the longer term. Storing `funded` and printing "Funded" quietly claims the trader is trading real
 * money, which is exactly the kind of flattering imprecision this product exists to refuse — and it
 * would sit one column away from `personal`, which IS real money, in the same enum.
 *
 * Renamed at S4e rather than papered over in a label map, because no row carried the value yet.
 * That window does not reopen: after the first real import this is a data migration across an
 * append-only corpus instead of a one-line CHECK change. */
export const ACCOUNT_TYPES = ['evaluation', 'sim_funded', 'personal'] as const;
export const ACCOUNT_STATES = ['active', 'closed', 'breached'] as const;

export const account = pgTable(
  'account',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    traderId: uuid('trader_id')
      .notNull()
      .references(() => trader.id, { onDelete: 'cascade' }),
    platform: text('platform').notNull(), // 'tradovate'. The platform, never the firm.
    externalAccountId: text('external_account_id').notNull(), // the NAME, see above
    /* Tradovate's numeric account id ("56963172"), when an export carries one. Nullable on
       purpose: it appears in only two of the six export types, so it is a second identifier and
       never the key. Parsed since S1 and stored from S4e. */
    brokerAccountId: text('broker_account_id'),
    displayName: text('display_name').notNull(),

    /* ── The identity Tradovate does not carry. `docs/docs from run-trading/prop-firm-identity.md`.
     *
     * NULLABLE, ALL OF THEM, AND THAT IS THE DESIGN (2026-08-15, S4e). Verified across all six
     * export types from two different firms: the prop firm's name appears in NONE of them, and
     * OAuth returns the same account object, so this is not a gap the live socket closes later.
     *
     * `account_type` was NOT NULL until S4e and it could not stay that way. An import creates this
     * row before anyone has said what it is — and it cannot be asked first, because the number of
     * accounts inside an export is unknown until it is parsed and a copy-trader's export holds
     * many. Phase is also not derivable, ever: a funded account and an evaluation produce
     * byte-identical files. So an unlabelled account is a NORMAL STATE, holding real fills, named
     * afterwards. A default here would be Run inventing a fact about somebody's money.
     *
     * The CHECK below still constrains the three real values — `null in (...)` is NULL in
     * Postgres and a CHECK passes on NULL, so nullable and constrained are not in tension. */
    accountType: text('account_type'),
    propFirm: text('prop_firm'), // "Tradeify", "TradeDay". Null for personal, and null is normal.
    /* How we came to believe the firm. `stated` = the trader said so on THIS account, and those
       rows are what grow `CONFIRMED_PREFIXES`. `detected` = recalled from a prefix confirmed on
       somebody else's account, which is weaker and is always overwritten by the trader's answer. */
    firmSource: text('firm_source'),
    /* Whole dollars, not cents, and the exception is deliberate: prop accounts are sold in round
       SKUs (50000, 100000, 150000). This is a product size, not money that gets arithmetic done to
       it, so the integer-cents rule that governs P&L does not apply. */
    sizeDollars: integer('size_dollars'),
    /* The firm's own product name when the trader knows it ("Growth", "Select", "Lightning").
       Free text on purpose: every firm names its SKUs differently and the list changes monthly. */
    productName: text('product_name'),
    state: text('state').notNull().default('active'),
    closedAt: timestamp('closed_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    check('account_type_check', sql`${t.accountType} in ('evaluation', 'sim_funded', 'personal')`),
    check('account_state_check', sql`${t.state} in ('active', 'closed', 'breached')`),
    // The natural key. Two firms can issue the same account name, so platform is part of it.
    uniqueIndex('account_identity_uq').on(t.traderId, t.platform, t.externalAccountId),
    index('account_trader_idx').on(t.traderId),
    index('account_trader_state_idx').on(t.traderId, t.state),
  ],
);

// ── import — the provenance object ───────────────────────────────────────────────────
//
// ITS OWN TABLE, not a `csv_import` event as in v2. That build recorded provenance as a row in
// the log, which works for "what happened" and cannot answer "have these exact bytes been seen
// before" — there is nowhere to put a file hash under a unique constraint, and no status to
// hold a parse that has not been committed yet.
//
// `(account_id, file_hash)` IS UNIQUE, so re-uploading the same file is a no-op enforced by the
// database rather than by application logic. That is a DIFFERENT guarantee from the row-level
// dedupe on `event`: this one stops the work, that one stops the rows.
//
// NOTHING COMMITS UNTIL status = 'committed'. The flow parses, writes a `pending` row, shows
// the counts, and only then commits. That is the wireframe's step 3 and the first trust moment
// in the product.
//
// THIS TABLE IS WHY PROVENANCE IS A LOOKUP RATHER THAN A CLAIM. Every figure traces to a row
// here, which is what lets a trust note say "from your Tradovate export of Aug 11, covering
// Jun 3 to Aug 8" without anyone having to take it on faith.
export const IMPORT_SOURCES = ['tradovate_csv', 'tradezella_csv', 'tradovate_oauth'] as const;
export const IMPORT_STATUSES = ['pending', 'committed', 'rejected'] as const;

export const importBatch = pgTable(
  'import',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    traderId: uuid('trader_id')
      .notNull()
      .references(() => trader.id, { onDelete: 'cascade' }),
    accountId: uuid('account_id')
      .notNull()
      .references(() => account.id),
    filename: text('filename').notNull(),
    fileHash: text('file_hash').notNull(), // sha256 of the bytes
    source: text('source').notNull(),
    uploadedAt: timestamp('uploaded_at', { withTimezone: true }).notNull().defaultNow(),
    rowsParsed: integer('rows_parsed').notNull().default(0),
    rowsRejected: integer('rows_rejected').notNull().default(0),
    rangeStart: date('range_start'), // trade dates covered, from the one time module
    rangeEnd: date('range_end'),
    status: text('status').notNull().default('pending'),
  },
  (t) => [
    check(
      'import_source_check',
      sql`${t.source} in ('tradovate_csv', 'tradezella_csv', 'tradovate_oauth')`,
    ),
    check('import_status_check', sql`${t.status} in ('pending', 'committed', 'rejected')`),
    uniqueIndex('import_file_uq').on(t.accountId, t.fileHash),
    index('import_trader_idx').on(t.traderId),
  ],
);

// ── event — the log. The only immutable table, and the corpus. ───────────────────────
//
// Everything else in the data model is a projection over this. `fill`, `round_trip` and `fee`
// are TYPES here, not tables.
//
// `bigint identity`, NOT a uuid, and the reason is behavioural: replay order is signal, and
// timestamps cannot provide a total order (millisecond ties, and CSV stamps are coarser than
// that). A monotonic id is the order things were learned in.
//
// EVENTS POINT AT THE PERSON, NOT THE ACCOUNT. `trader_id` is required and `account_id` is not,
// because the corpus is one trader's history across every firm they have ever traded at. That
// is the cross-firm identity rule, and it is the thing a competitor cannot clone.
//
// PROMOTED COLUMNS ARE A PROJECTION OF `payload`, written atomically in the same INSERT. Safe
// ONLY because this table is immutable: projection and payload can never diverge after write,
// which would not hold on a mutable table. They exist for INTEGRITY, not speed — P&L is the
// number everything else rests on, so it gets a typed, constrained column that rejects garbage
// at write time rather than hiding a bad value inside a blob.
//
// MONEY IS bigint CENTS. Never a float. See CLAUDE.md.
//
// CORRECTIONS APPEND. A bust or an adjustment writes a NEW row pointing at the original via
// `corrects_event_id`; the original never mutates. The trigger in the migration makes that a
// database guarantee rather than a convention.
//
// `dedupe_key` IS NAMESPACED BY TYPE — f: fills, p: round trips, o: orders, x: cash — so two
// entities that happen to share a numeric id can never collide. The partial unique index below
// plus onConflictDoNothing makes a re-uploaded file a no-op AT THE DATABASE LEVEL, which is the
// only place it cannot be forgotten.
export const EVENT_TYPES = ['fill', 'round_trip', 'fee', 'order', 'csv_import'] as const;
export const EVENT_SOURCES = ['csv', 'api', 'app'] as const;

export const event = pgTable(
  'event',
  {
    id: bigint('id', { mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
    traderId: uuid('trader_id')
      .notNull()
      .references(() => trader.id),
    accountId: uuid('account_id').references(() => account.id),
    // Which upload put this row here. Null for events that did not come from a file.
    importId: uuid('import_id').references(() => importBatch.id),
    type: text('type').notNull(),
    payload: jsonb('payload').notNull(),
    // So a v0 row still replays correctly through v2 extraction code.
    payloadVersion: integer('payload_version').notNull().default(1),
    // ON THE EVENT, NOT THE ACCOUNT: the same account ingests via CSV now and API later.
    source: text('source').notNull(),
    // Null on raw fills — a single leg has no realised P&L. A fee's is its signed cash delta,
    // which is what makes net a single sum over round_trip + fee rather than a join.
    pnlCents: bigint('pnl_cents', { mode: 'number' }),
    symbol: text('symbol'),
    qty: integer('qty'),
    side: text('side'),
    correctsEventId: bigint('corrects_event_id', { mode: 'number' }),
    // The real-world instant, always UTC. A fee carries its FILL's instant, never the naive
    // local string from Cash History: parsing that resolves against the server's zone and files
    // an evening fee under the previous trade date, so the trade prices at zero fees.
    occurredAt: timestamp('occurred_at', { withTimezone: true }).notNull(),
    recordedAt: timestamp('recorded_at', { withTimezone: true }).notNull().defaultNow(),
    dedupeKey: text('dedupe_key'),
  },
  (t) => [
    check(
      'event_type_check',
      sql`${t.type} in ('fill', 'round_trip', 'fee', 'order', 'csv_import')`,
    ),
    check('event_source_check', sql`${t.source} in ('csv', 'api', 'app')`),
    check('event_side_check', sql`${t.side} is null or ${t.side} in ('buy', 'sell')`),
    foreignKey({
      columns: [t.correctsEventId],
      foreignColumns: [t.id],
      name: 'event_corrects_fk',
    }),
    // Partial: skips null keys, which is every event that did not come from a file row.
    uniqueIndex('event_account_dedupe_uq')
      .on(t.accountId, t.dedupeKey)
      .where(sql`${t.dedupeKey} is not null`),
    index('event_trader_idx').on(t.traderId),
    index('event_account_idx').on(t.accountId),
    index('event_type_idx').on(t.type),
    index('event_import_idx').on(t.importId),
    // Every read is scoped by account AND window from the first query (CLAUDE.md): free now,
    // unretrofittable once four surfaces depend on it.
    index('event_account_occurred_idx').on(t.accountId, t.occurredAt),
  ],
);

// ── trade — a round trip, DERIVED. The projection every read path draws from. ─────────
//
// `architecture.md` §"`trade` — a round trip, derived" specifies this table; read that before
// changing a column here. What follows is why it is a TABLE rather than a view or a query.
//
// NOTHING READS `event.payload` ON A RENDER PATH (CLAUDE.md), and this table is what makes that
// affordable rather than aspirational. `event` promotes `symbol`, `qty`, `pnl_cents` and
// `occurred_at`; a tape row also needs entry and exit prices, a direction and a fee — all of
// which live inside the jsonb. `run-trading@v2` read them straight out of the payload on the
// render path and measured the bill in its own comments: a 9,530ms page load and a 1.1MB
// payload, which then needed a whole index-and-paging subsystem to work around.
//
// A PROJECTION, WHICH MEANS IT IS DISPOSABLE. Every row here is rebuildable by replaying `event`,
// so this table may be dropped and regenerated at any time and nothing is lost. That is what
// licenses storing derived values (`fee_cents`, `direction`, `session_date`) that an append-only
// log could never revise — see `src/lib/trades/project.ts`.
export const TRADE_STATES = ['ok', 'quarantined', 'excluded'] as const;
export type TradeState = (typeof TRADE_STATES)[number];
export const TRADE_DIRECTIONS = ['long', 'short'] as const;
export type TradeDirection = (typeof TRADE_DIRECTIONS)[number];

export const trade = pgTable(
  'trade',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    traderId: uuid('trader_id')
      .notNull()
      .references(() => trader.id, { onDelete: 'cascade' }),
    accountId: uuid('account_id')
      .notNull()
      .references(() => account.id, { onDelete: 'cascade' }),
    /* THE ROUND-TRIP EVENT THIS PROJECTS, and the idempotency key for re-projection. One trade per
       event, so re-running the projector over a window updates rows instead of duplicating them. */
    eventId: bigint('event_id', { mode: 'number' }).notNull(),
    symbolRoot: text('symbol_root').notNull(), // "MNQ" — the product, never the contract month
    contract: text('contract'), // "MNQU6" — what the trader's own platform shows them

    /* ENTRY AND EXIT ARE A SEQUENCE, NOT A SIDE, and getting that wrong shipped once. Tradovate's
       payload carries buy/sell PRICES; a short OPENS on the sell, so mapping buy→entry is right
       for a long and exactly backwards for a short. Luke, 2026-08-01: "it says it was a short and
       i made money.. entry at 30,134.25 and exit at 30,147.50. how can that be?" — it could not,
       and every winning short read as a loser that made money. Resolved once, here, at projection
       time, so `entry_price` means what it says everywhere it is read. */
    entryAt: timestamp('entry_at', { withTimezone: true }).notNull(),
    exitAt: timestamp('exit_at', { withTimezone: true }).notNull(),
    /* Derived from `exit_at` via `lib/time/session` and PERSISTED, because every grouping in the
       product keys off it and recomputing a zone-and-calendar value per query is both slow and a
       place for two code paths to disagree. A trade belongs to the session it was REALISED in. */
    sessionDate: date('session_date').notNull(),
    qty: integer('qty').notNull(),
    /* Null is honest. Direction is "did you buy first or sell first", so with either timestamp
       missing there is no answer — and an unknown direction beats a guessed one on a row whose
       whole content is what happened. Never derived from price ordering: that silently guesses on
       a scratch trade, where P&L is zero and the two prices are equal. */
    direction: text('direction'),
    /* A QUOTE, NOT MONEY — `numeric(19,6)`, not cents. 6E quotes at 1.08500; stored as cents it
       becomes 109 and a real 1.08500→1.08600 winner prints identical entry and exit beside a
       profit. Money is integer cents; quotes are not money. */
    entryPrice: numeric('entry_price', { precision: 19, scale: 6 }).notNull(),
    exitPrice: numeric('exit_price', { precision: 19, scale: 6 }).notNull(),
    grossPnlCents: bigint('gross_pnl_cents', { mode: 'number' }).notNull(),
    /* NEGATIVE, and 0 when no Cash History covers this trade. `net` is NOT a column: it is
       `gross + fee` at render, so the two halves can never disagree with each other.
       Stored despite `architecture.md`'s "net is derived" rule because that rule binds `event`,
       where fees genuinely do not exist yet when a round trip is written. This is a projection,
       rebuilt after the import commits, so the fees DO exist — and the projector re-projects the
       whole affected window on every import, which is what keeps this from going stale when Cash
       History arrives in a later upload. */
    feeCents: bigint('fee_cents', { mode: 'number' }).notNull().default(0),

    /* `ok` IS THE ONLY STATE THAT FEEDS A COMPUTED FIGURE, and the other two stay visible and
       countable — an exclusion may never silently shrink the record (spec S3, S9b). */
    state: text('state').notNull().default('ok'),
    quarantineReason: text('quarantine_reason'),
    exclusionReason: text('exclusion_reason'), // the trader's own words, S9b
    projectedAt: timestamp('projected_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    check('trade_state_check', sql`${t.state} in ('ok', 'quarantined', 'excluded')`),
    check(
      'trade_direction_check',
      sql`${t.direction} is null or ${t.direction} in ('long', 'short')`,
    ),
    // One trade per round-trip event. This is what makes re-projection an upsert rather than a
    // duplicate, so the projector can be re-run over any window as often as it likes.
    uniqueIndex('trade_event_uq').on(t.eventId),
    // The two reads this table exists for: group a session, and window a range. Both scoped by
    // account from the first query (CLAUDE.md).
    index('trade_account_session_idx').on(t.accountId, t.sessionDate),
    index('trade_account_exit_idx').on(t.accountId, t.exitAt),
    index('trade_trader_session_idx').on(t.traderId, t.sessionDate),
    index('trade_state_idx').on(t.state),
  ],
);

// ── session — the trading day, materialised ──────────────────────────────────────────
//
// KEYED ON THE TRADER, NOT THE ACCOUNT (`architecture.md`). A trader may work several accounts in
// one session and the wedge is about THEIR day; per-account rollups are a filter over `trade`,
// not a second table.
//
// A SESSION WITH NO TRADES STILL EXISTS. Gaps and "you don't trade Mondays" need the absence to
// be a row rather than a missing key — but note this table never manufactures one: a day is
// written when it is inside the corpus's own range, so an empty row means "you were away", not
// "we have no data".
export const tradingSession = pgTable(
  'session',
  {
    traderId: uuid('trader_id')
      .notNull()
      .references(() => trader.id, { onDelete: 'cascade' }),
    sessionDate: date('session_date').notNull(),
    /* Both stored, because a session header states net AND the fee component, and deriving one
       from the other on a render path is the join this table exists to avoid. */
    netPnlCents: bigint('net_pnl_cents', { mode: 'number' }).notNull().default(0),
    feesCents: bigint('fees_cents', { mode: 'number' }).notNull().default(0),
    tradeCount: integer('trade_count').notNull().default(0),
    winCount: integer('win_count').notNull().default(0),
    firstTradeAt: timestamp('first_trade_at', { withTimezone: true }),
    lastTradeAt: timestamp('last_trade_at', { withTimezone: true }),
    projectedAt: timestamp('projected_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    // A REAL COMPOSITE PK, as `architecture.md` specifies, not a unique index standing in for one.
    // Same guarantee either way; this is the identity of a row here, and saying so in the schema
    // keeps the code and the locked doc from disagreeing about something neither would notice.
    primaryKey({ columns: [t.traderId, t.sessionDate] }),
    index('session_trader_idx').on(t.traderId),
  ],
);
