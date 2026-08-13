import { redirect } from 'next/navigation';
import { AppShell } from '@/components/shell/app-shell';
import { getTrader } from '@/lib/trader';

/* The signed-in app shell.
 *
 * `(app)` IS A ROUTE GROUP: the parentheses keep it out of the URL, so a page at
 * `(app)/admin/page.tsx` is still served at `/admin` — no link, redirect or auth callbackURL
 * changes when a page moves in or out of here.
 *
 * THE GATE IS ONE NULL CHECK, and it covers both failures that matter. `getTrader()` returns null
 * when there is no session at all, and resolves-or-creates the row when there is — so "never
 * signed in" and "signed in but somehow no trader row" collapse into the same branch and neither
 * can fall through to a page that assumes an identity.
 *
 * NO DEV BYPASS, deliberately, and this differs from the previous build. That one skipped the
 * gate entirely under `next dev` so routes were URL-typeable without signing in, and its own
 * comment then had to explain that the gate could therefore only be exercised against a
 * production build. A gate that never runs in development is a gate nobody has watched work.
 * Signing in locally is one emailed code.
 *
 * `redirect()` throws, so nothing below it runs — it is not a return value to check.
 */
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const trader = await getTrader();
  /* A bare `/login`, not `loginWithNext(...)`. A layout has no supported way to read the current
     path — `headers()` carries no reliable pathname — and the previous build only managed it by
     having a proxy inject one. Sending a signed-out visitor to a login screen that returns them
     HOME is a smaller cost than adding a proxy for it, and `safeNext` is already in place for the
     day a link-preserving redirect is worth wiring properly. */
  if (!trader) redirect('/login');

  return <AppShell>{children}</AppShell>;
}
