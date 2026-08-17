import { AddAccountDemo } from './demo';

/* SHIPS TO PRODUCTION, like the rack it sits under, and for the same reason: "works on mobile" means
 * a deployed build on a real phone, and a route that only exists on localhost cannot be opened on
 * the device it is meant to be judged on. Unlinked from the app and `noindex`.
 *
 * v2's equivalent 404'd in production, on the argument that a scripted upload screen reaching a real
 * trader is the fake UI the intake was built to avoid. That argument is right about FAKE screens and
 * this page has none: every scene mounts the shipped component, and the one that can submit is
 * behind `dryRun` so it cannot write. The rack already accepts the same trade.
 */
export const metadata = { title: 'Add account, live', robots: { index: false, follow: false } };

export default function Page() {
  return <AddAccountDemo />;
}
