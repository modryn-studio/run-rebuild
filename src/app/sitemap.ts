import { MetadataRoute } from 'next';

/* EMPTY WHILE THE APP IS noindex, and the two facts are tied together on purpose.
 *
 * `layout.tsx` sets `robots: { index: false, follow: false }` for every route, which is right for
 * a trading journal — this host is the APP, and the app is never indexed (see
 * modryn-hq/playbooks/door-and-app.md). Listing a URL here at the same time is a contradiction:
 * a sitemap means "please index these", and Search Console reports the pair as an outright error,
 * `Submitted URL marked 'noindex'`.
 *
 * The file stays rather than being deleted because `robots.ts` points at it and because the door
 * will want one — but the door is a different host and, once it is its own deployment, a different
 * repo. THIS sitemap only ever describes the app, so while the app is noindex it describes nothing.
 *
 * Fill it in at the same moment the global `noindex` comes off, never before.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  return [];
}
