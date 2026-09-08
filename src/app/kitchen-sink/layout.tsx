import { notFound } from 'next/navigation';
import { getAdmin } from '@/lib/require-admin';

/* THE RACK IS ADMIN-ONLY, AND IT STILL SHIPS TO PRODUCTION. Those are not in tension, and the
 * distinction is the whole reason this file is a layout rather than a deletion.
 *
 * WHY IT MUST STAY DEPLOYED: `demo/page.tsx` already argues it, and `CLAUDE.md` states it - "works
 * on mobile" means a deployed build on a real phone, and a route that exists only on localhost
 * cannot be opened on the device it is meant to be judged on. A 375px desktop viewport has a mouse.
 * So a `NODE_ENV` gate would quietly retire the only surface that measures the design system on the
 * hardware it has to survive.
 *
 * WHY IT COULD NOT STAY OPEN: `sections/today.tsx` imports `views/today/fixtures.ts` and renders it
 * at six call sites - invented dollar figures, fake trade rows, fabricated prose. Until this file
 * existed there was no middleware in the repo and no gate on this directory, so the build emitted
 * `○ /kitchen-sink` as a STATIC route and anyone who guessed the URL read numbers this product made
 * up. On a product whose one claim is that it never shows a number it cannot reconcile, that was
 * the worst artefact in the codebase. `page.tsx`'s own header had asked for this since it was
 * written: *"delete the whole directory or put it behind the admin check."*
 *
 * A LAYOUT, NOT A CHECK PER PAGE, for the reason `require-admin.ts` gives for existing at all: the
 * reference implementation repeated its check across six files and one missed file was the whole
 * hole. A layout wraps every route in this segment, including the ones nobody has added yet.
 *
 * 404 RATHER THAN 403, matching `/admin`: refusing by name confirms the route exists.
 *
 * The cost is that both routes become dynamic. That is correct - they now depend on a session -
 * and nothing here was worth caching to a stranger anyway.
 */
export default async function KitchenSinkLayout({ children }: { children: React.ReactNode }) {
  const admin = await getAdmin();
  if (!admin) notFound();

  return children;
}
