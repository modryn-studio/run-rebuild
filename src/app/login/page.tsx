import { Suspense } from 'react';
import type { Metadata, Viewport } from 'next';
import { Login } from '@/components/views/auth/login';
import { LoadingMark } from '@/components/ui/loading-mark';

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
export default function LoginPage() {
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
