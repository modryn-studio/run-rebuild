// Hard build-time guard: one accidental import from a client component would otherwise ship
// this whole secret schema to the browser. Fails the build instead.
import 'server-only';
import { z } from 'zod';

// Validated environment variables — imported anywhere a secret/config value is read.
// Register each new var here so a missing/invalid value fails fast at boot rather
// than surfacing as a confusing runtime error deep inside a request.
// Treat an empty-string env var as absent (a common .env footgun where `KEY=` sets '').
const optionalUrl = z.preprocess((v) => (v === '' ? undefined : v), z.string().url().optional());

const schema = z.object({
  NEXT_PUBLIC_SITE_URL: optionalUrl,

  // Required for AI routes (streamText, useChat, generateObject).
  ANTHROPIC_API_KEY: z.string().min(1, 'ANTHROPIC_API_KEY is required'),

  // Media generation (video, imagery) for the landing and login surfaces. OPTIONAL, and the
  // distinction is the whole point: it GENERATES assets, it does not SERVE them. The output is
  // committed to public/ and shipped as static files, so the running app never reads this key.
  // Marking it required would fail every production render on a credential production does not
  // use. Absent = generation is dark, not broken — the same contract as the mail vars below.
  // Fill it locally, leave it out of the deploy.
  REPLICATE_API_TOKEN: z.string().optional(),

  // Neon Postgres (src/lib/db).
  DATABASE_URL: z.string().url('DATABASE_URL must be a valid Postgres connection string'),

  // Auth (Better Auth, src/lib/auth.ts). Secret is required; sign-in providers are
  // optional and stay dark until their creds land.
  BETTER_AUTH_SECRET: z.string().min(1, 'BETTER_AUTH_SECRET is required'),
  BETTER_AUTH_URL: z.string().url().optional(), // defaults to http://localhost:3000
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),

  // All email (the sign-in code + founder alerts) goes over Gmail SMTP on a Google Workspace
  // account. GMAIL_APP_PASSWORD is a Google *app password*, not the account password.
  // Absent = email is dark, not broken.
  GMAIL_USER: z.string().optional(),
  GMAIL_APP_PASSWORD: z.string().optional(),
  // Visible From address, when it should differ from the SMTP account. Gmail SILENTLY rewrites
  // From to the authenticated user unless the address is a verified "Send mail as" identity —
  // so this only works once that identity exists and is verified. Unset = send as GMAIL_USER.
  MAIL_FROM: z.string().optional(),
  // The address shown in copy as "reply to this email", and the actual Reply-To header on every
  // user-facing send — separate from MAIL_FROM, which is the technical sender identity. Unlike
  // MAIL_FROM it needs no Send-mail-as verification (Reply-To is unauthenticated), only to exist
  // to catch replies. Unset = falls back to MAIL_FROM, then GMAIL_USER.
  SUPPORT_EMAIL: z.string().optional(),
  FEEDBACK_TO: z.string().optional(), // alert recipient; falls back to GMAIL_USER

  // Comma-separated allowlist for /admin. NOT a secret — it is a list of addresses, so it leaks
  // nothing if seen. Access is proven by an actual Better Auth session, not by holding this
  // string. Unset = nobody is admin (see require-admin.ts: it fails closed).
  ADMIN_EMAILS: z.string().optional(),

  // ── Add project keys below. Required ones use .min(1) with a message; anything the app can
  // boot without stays .optional() so a half-configured environment still runs. ──
});

const parsed = schema.safeParse(process.env);

if (!parsed.success) {
  const missing = parsed.error.issues.map((i) => `  ${i.path.join('.')}: ${i.message}`).join('\n');
  throw new Error(`Missing or invalid environment variables:\n${missing}`);
}

export const env = parsed.data;
