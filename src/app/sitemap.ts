import { MetadataRoute } from 'next';
import { site } from '@/config/site';

/* THE DOOR'S PAGES, AND ONLY THOSE (2026-09-08). `layout.tsx` still sets `noindex` globally and the
 * APP stays noindex forever (`user-guide.md`: the app is never indexed) - but the landing, Terms and
 * Privacy each override that in their own `metadata`, and those are the three URLs a sitemap may
 * name. Listing a noindex URL here is what Search Console reports as `Submitted URL marked
 * 'noindex'`, so this list and those three overrides have to move together.
 *
 * The earlier plan had the door as a second host and a second repo; `build-plan.md` §3 settled it
 * as one repo, two route groups, so one sitemap describes both and only lists the public half. */
export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  return [
    { url: site.url, lastModified: now, changeFrequency: 'weekly', priority: 1 },
    { url: `${site.url}/terms`, lastModified: now, changeFrequency: 'yearly', priority: 0.3 },
    { url: `${site.url}/privacy`, lastModified: now, changeFrequency: 'yearly', priority: 0.3 },
  ];
}
