/* THE ONE SENTENCE A REFUSED SIGNUP READS, AND THE CODE THAT IDENTIFIES IT.
 *
 * A PLAIN MODULE ON PURPOSE - no `server-only`, no database, no `env`. `beta-access.ts` holds the
 * decision and cannot be imported by a client file (it reads the database to answer whether an
 * address already has an account), but the LOGIN SCREEN has to render the refusal, and the login
 * screen is a Client Component. This is the same split `src/lib/shell.ts` exists for, and the same
 * rule from CLAUDE.md: a `'use client'` file may import TYPES from a db-backed module but never
 * VALUES, and re-exporting through the server module does not launder it. So the string lives here,
 * where both sides can take it, and there is exactly one copy of it.
 *
 * WHY A CODE AS WELL AS A MESSAGE. The Google path never returns this error to the caller: Better
 * Auth's OAuth callback catches an APIError and REDIRECTS, putting `?error=<body.code>` and
 * `?error_description=<body.message>` on the URL (verified in
 * `node_modules/better-auth/dist/api/routes/callback.mjs` and `dist/oauth2/errors.mjs`). The login
 * screen therefore has to recognise the refusal from a query parameter.
 *
 * AND IT RENDERS FROM THE CODE, NEVER FROM `error_description`. A description read off the URL is
 * attacker-controlled text shown inside the product's own error slot, which is a phishing surface
 * ("Your account is suspended, call this number"). React escapes it, so it is not XSS - it is
 * worse, it is credible. Matching the code and rendering OUR copy costs nothing and closes it.
 */

/** Set as `body.code` on the refusal, so the OAuth redirect carries `?error=NOT_INVITED`. */
export const NOT_INVITED_CODE = 'NOT_INVITED';

/** Deliberately does not say WHICH of unknown, uninvited or already-known applies: a refusal that
 *  distinguishes those is an account-enumeration oracle, and the vaguer sentence is no less useful
 *  to somebody who really was invited. It also does not name the app (CLAUDE.md) - "This is a
 *  closed beta", never "Run is in a closed beta". */
export const NOT_INVITED_MESSAGE =
  'This is a closed beta, and this address is not on the list yet. If you were invited, use the address the invitation was sent to.';
