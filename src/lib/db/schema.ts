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
  numeric,
} from 'drizzle-orm/pg-core';

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
