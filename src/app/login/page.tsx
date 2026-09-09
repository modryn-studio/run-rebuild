import { Suspense } from 'react';
import type { Metadata, Viewport } from 'next';
import { redirect } from 'next/navigation';
import { Login } from '@/components/views/auth/login';
import { LoadingMark } from '@/components/ui/loading-mark';
import { getSessionUser } from '@/lib/trader';
import { safeNext } from '@/lib/next-path';

/* THE ONE ROUTE WITH NO PAGE TITLE (found 2026-08-20, Luke: "why does every page have the page
 * name in it on the chrome tab except for the /login page"). Every other route exports its own
 * `metadata.title`; this one never did, so the browser tab fell back to the root layout's bare
 * `site.name` - correct as a FALLBACK, wrong as this page's actual title, and invisible unless a
 * tab is sitting open beside its siblings. "Sign in" rather than "Log in": the product's own copy
 * already says "sign-in" throughout this file and the component it renders. */
export const metadata: Metadata = { title: 'Sign in' };

/* THIS ONE ROUTE LETS THE KEYBOARD RESIZE THE PAGE (2026-09-01, Luke: *"on the login page, im not
 * able to scroll when my phone's keyboard is open"*).
 *
 * The root sets `overlays-content`, and for the right reason: `/trades` has a bottom bar, and a
 * layout viewport that shrinks with the keyboard makes four nav tabs ride up and sit on top of the
 * keyboard the trader is typing into (2026-08-24). That export's own note flagged the cost it was
 * accepting - *"the one thing to watch is a field low on the screen being covered"* - and `/login`
 * is exactly that surface: a card centred in a `min-h-dvh` column, with the field and its button in
 * the lower half and no bottom bar anywhere near it.
 *
 * So the reason for `overlays-content` does not apply here, and `resizes-content` shrinks the
 * layout viewport with the keyboard. `min-h-dvh` shrinks with it, the content becomes taller than
 * the viewport, the page scrolls, and the browser's own "scroll the focused field into view" has
 * somewhere to put it. No JavaScript, on the browsers that implement it.
 *
 * **WebKit DOES NOT IMPLEMENT `interactive-widget`** (Chrome 108+, Firefox 132+ only), so on an
 * iPhone this line does nothing at all and `useKeyboardInset` is what carries the fix. The two are
 * built not to double up: that hook measures the gap between the layout and visual viewports, which
 * is ~0 precisely when this key is honoured.
 *
 * `viewportFit` IS RESTATED, NOT INHERITED BY LUCK. A segment's `viewport` export is the one that
 * resolves for its route, and dropping `cover` here would take every `env(safe-area-inset-*)` in
 * the codebase to zero on this page - the exact silent failure the root export's second half was
 * written to stop. Cheap to restate; expensive to discover. */
export const viewport: Viewport = {
  interactiveWidget: 'resizes-content',
  viewportFit: 'cover',
};

// Identity-first: the login screen is the front door (route /login for now; enforcing it as the
// app entry for unauthenticated visitors is a follow-up, see GitHub issue #17).
// No min-h-dvh here - Login owns the shell height (h-dvh); duplicating it would make 200dvh the
// moment Login is composed alongside anything else.
//
/* THE BOUNDARY IS DECLARED HERE, and it has to be (2026-08-20, S5 step 1). `Login` reads `?next=`
 * through `useSearchParams()`, which forces a client-side bailout and therefore needs a Suspense
 * boundary above it or the page cannot be prerendered at all.
 *
 * IT USED TO BE SATISFIED BY ACCIDENT. `src/app/loading.tsx` sat at the app root and its boundary
 * happened to sit above this route, so the build passed and `login.tsx`'s own comment recorded the
 * requirement as "which the route already provides" - true, but not because anything here provided
 * it. Moving that file into `(app)` where it belongs took the boundary away and the build failed
 * immediately, which is the honest version of a dependency that was always there.
 *
 * This is the second half of the house rule: no `loading.tsx` at the app root, and **a route that
 * needs a Suspense boundary declares its own**. `modryn-base` names this exact file as the example.
 *
 * The fallback is what gets STATICALLY PRERENDERED, so it is the first paint a visitor sees before
 * hydration swaps in the real screen. `h-dvh` because `Login` owns that height and the fallback has
 * to stand in the same space, or the page jumps as it arrives. */
export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  /* ALREADY SIGNED IN? GO WHERE YOU WERE GOING (2026-09-09). This route had no session check at
   * all, so a trader with a live session who reached it - most likely from the public door's own
   * "Sign in" header link, which is the only affordance `/` offers - was shown a form asking them
   * to sign in again, and an emailed code they did not need.
   *
   * IT GUARDS HERE RATHER THAN ON `/`, and that is the deliberate half. The obvious fix is to
   * redirect signed-in visitors away from the landing page instead; the cost is that `/` stops
   * being statically rendered, and `/` is the ONE page in this deployment that is indexed, crawled
   * and worth caching at the edge. `/login` is `noindex` and its static half is only the fallback
   * below - the real screen already waits on hydration to read `?next=` - so the session lookup
   * this adds costs a little TTFB on a page nobody crawls, and buys the door's header link the
   * right behaviour in one hop. The landing page stays static.
   *
   * `getSessionUser`, NOT `getTrader`: this needs to know whether a session exists, and
   * `getTrader` would additionally select and possibly INSERT a trader row - work this route has no
   * business doing on a page it is about to redirect away from.
   *
   * THROUGH `safeNext`, like every other read of this parameter. It is attacker-supplied here
   * exactly as it is in the client component below, and a redirect performed by the SERVER with a
   * live session attached is the open-redirect this module exists to prevent. */
  const { next } = await searchParams;
  if (await getSessionUser()) redirect(safeNext(next));

  return (
    <main>
      <Suspense
        fallback={
          <div className="h-dvh">
            <LoadingMark />
          </div>
        }
      >
        <Login />
      </Suspense>
    </main>
  );
}
