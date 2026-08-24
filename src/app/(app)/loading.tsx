import { LoadingMark } from '@/components/ui/loading-mark';

/* The signed-in app's waiting state, and it belongs to THIS segment rather than the root.
 *
 * MOVED DOWN FROM `src/app/loading.tsx` (2026-08-20, S5 step 1). It had sat at the app root since
 * S0.1, which was correct then and stopped being correct the moment `(app)/layout.tsx` arrived: a
 * `loading.tsx` wraps the segment it sits in, so at the root its boundary is ABOVE the layout that
 * renders the shell. Every suspending navigation between /trades, /accounts and /admin therefore
 * replaced the sidebar, the header band and the rail with a bare full-screen spinner, and then
 * rebuilt them. Nobody chose that; the shell was simply added underneath a boundary nobody moved.
 *
 * `design-system.md` had been describing the INTENDED behaviour all along - "Next's automatic
 * Suspense boundary wraps the page, not the layout, so the sidebar stays mounted and interactive
 * while only the content pane waits" - which is true of a boundary inside `(app)` and false of one
 * above it. The doc was right and the file was in the wrong place.
 *
 * `LoadingMark`'s own comment is the corroborating evidence: it reasons about `h-full` versus
 * `flex-1` against "the app shell's <main>", so it was written for a boundary that renders INSIDE
 * the shell. What was here instead was a `min-h-dvh` centred `Spinner` - full-viewport geometry,
 * and the wrong mark. `Spinner` is the in-button, action-in-flight indicator; a whole surface
 * arriving is a presence, not a progress report.
 *
 * AND IT IS A ROOT-BOUNDARY SCAR TOO (`docs/scar-tissue.md`): past ~50KB of streamed payload a
 * root `loading.tsx` boundary stops hydrating, silently.
 *
 * NOTHING ELSE GETS ONE. `/login` and the kitchen sink are static, so there is nothing to wait for;
 * `/status` is force-dynamic but is the walking skeleton and is meant to go away. A route that
 * genuinely needs a boundary declares its own.
 */
export default function Loading() {
  return <LoadingMark />;
}
