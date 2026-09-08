import { requireTrader } from '@/lib/trader';
import { PAGE_COLUMN } from '@/lib/shell';
import { cn } from '@/lib/cn';
import { SettingsNav } from '@/components/views/settings/settings-nav';

/* THE SETTINGS SEGMENT'S CHROME: the title, the sub-nav, and the two-column frame every settings
 * page sits in. A layout so it mounts once and the nav does not re-enter on every sub-page.
 *
 * THE GEOMETRY IS THE REFERENCE'S, MEASURED (`app.monarch.com/settings/*`, 1280 viewport,
 * 2026-09-08): a 1046px container with `0 16px 16px` padding beside a 224px sidebar; inside it a
 * 242px nav card and a 757px content column with roughly 16px between them. Run's shell already
 * carries the 224px sidebar and `PAGE_COLUMN`'s 16px gutters, so what this adds is `md:w-60` on the
 * nav and `max-w-3xl` on the content - the nearest named steps to 242 and 757 - and `gap-4`. Standard
 * steps rather than the literal pixels, because `CLAUDE.md`'s lint refuses arbitrary values and the
 * design system is the only place a number is allowed to live.
 *
 * THE BAND SAYS `Settings` ON EVERY PAGE HERE, and the SHELL says it, not this layout: `app-shell`'s
 * `routeTitle` knows the `/settings` prefix (`NAMED_ROUTES`). A title portalled from here would be
 * a second source for the same word, which is the double-title bug S5d recorded.
 *
 * `requireTrader` HERE AS WELL AS IN `(app)/layout.tsx` is not redundancy: `(app)` redirects, and
 * a settings page that loaded for a beat before the redirect would flash a stranger's controls.
 */
export default async function SettingsLayout({ children }: { children: React.ReactNode }) {
  await requireTrader();

  return (
    <div className={cn(PAGE_COLUMN, 'py-4')}>
      <div className="flex flex-col gap-4 md:flex-row md:items-start">
        <SettingsNav />
        <div className="min-w-0 flex-1 md:max-w-3xl">{children}</div>
      </div>
    </div>
  );
}
