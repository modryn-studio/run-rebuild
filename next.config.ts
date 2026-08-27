import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactCompiler: true,
  experimental: {
    /* THE CLIENT CACHE IS ON, BECAUSE OFF MEANS THE WAITING STATE PLAYS EVERY SINGLE TIME
     * (2026-08-27, Luke: "you would think i shouldn't get the loading mark every single time i
     * switch back and forth from /accounts to /trades. i would image on the first load, yes. but
     * every single time? am i wrong?"). He is not wrong, and it was a default rather than a
     * decision.
     *
     * WHAT THE DEFAULT DOES. Next's own prefetching guide states it as a table: a DYNAMIC page with
     * a `loading.js` prefetches only "layout to first loading boundary", and its Client Cache TTL is
     * "off by default". Both pages here are dynamic - they read the corpus per request - and both
     * sit under `(app)/loading.tsx`. So every hop between them is a full server round trip that has
     * nothing cached to paint from, and the boundary is therefore obliged to show its fallback.
     * Nobody chose that: `staleTimes.dynamic` defaulted to 30s until `v15.0.0` changed it to 0.
     *
     * WHAT 30 BUYS. A return trip inside the window reuses the RSC payload already in memory and
     * paints instantly - no fallback, no round trip, no layout settling. The first visit is
     * unchanged and still shows a waiting state, which is what Luke asked for.
     *
     * WHY 30 IS SAFE HERE SPECIFICALLY, and this is the part that would not transfer to another
     * app. Nothing on these pages changes without an action the app itself performs: the corpus
     * moves on IMPORT, and both the import and `RefreshRoster` finish through `router.refresh()`,
     * which invalidates the whole client cache. There is no background writer and no second actor,
     * so a stale read cannot arrive from anywhere this cache does not already hear about.
     * The reconcile rule is untouched: this caches a RENDER for half a minute, it does not cache a
     * FIGURE - every number in that payload was still computed in SQL over the real record. */
    staleTimes: { dynamic: 30 },
    /* TURBOPACK'S BUILD CACHE IS OFF, AND IT IS OFF BECAUSE IT SHIPPED A BROKEN PRODUCTION BUILD
     * (2026-08-24). This is not a performance preference. It is the deterministic-output rule that
     * the rest of this codebase already lives by, applied to the build itself.
     *
     * WHAT HAPPENED. Deployment `0849edc` served CURRENT HTML with a STALE STYLESHEET. Measured:
     * the deployed CSS was 56,566 bytes where a clean local build of the same commit produces
     * 60,818, and every rule added on the merged branch was missing from it - `sheet-transition`,
     * `drawer-transition`, `icon-btn`, `menu-panel`, `clip-allow-shadow`, `pane-bottom-clearance`,
     * plus the `--color-success` / `--color-danger` / `--text-h3` tokens. It still carried
     * `pop-in-up`, a class that `90c7ff0` REPLACED with `menu-panel`, which dates the stylesheet to
     * an intermediate commit on the branch rather than to either release.
     *
     * WHAT IT COST. `filter-sheet.tsx` is a full-screen `fixed inset-0 z-[70]` panel that is always
     * mounted, and the one rule holding it off-screen is `.sheet-transition[data-open='false']`.
     * Without that rule it renders over the entire app, and because its wrapper carries
     * `pointer-events-none` while closed, the visible UI is inert and taps fall through to a tape
     * nobody can see. The phone was bricked. Build green, lint green, typecheck green, `/status`
     * reporting the right SHA.
     *
     * WHY THIS FLAG. `experimental.turbopackFileSystemCacheForBuild` defaults to TRUE, and Next's
     * own version history dates that default to `v16.3.0` - the exact version pinned here, so this
     * project adopted it the week it landed. Vercel restores `.next/cache` between deployments,
     * which makes the cache the one input to a production build that is not the source tree. It is
     * also the only difference between Vercel's build and a clean local one, and a clean local one
     * is correct.
     *
     * WHAT IS NOT CLAIMED. A two-commit warm-cache rebuild was run locally and did NOT reproduce
     * it, so the precise invalidation path is unproven. That is a reason to remove the cache, not
     * to keep it: an experimental cache that cannot be shown to be wrong on demand, and cannot be
     * shown to be right either, has no place between the source and the thing traders load.
     *
     * THE COST IS SECONDS. This app builds cold in roughly two minutes. Reverting this trades a
     * silent, invisible, total-failure mode for that. `scripts/verify-css.mjs` is the backstop if
     * this is ever turned back on. */
    turbopackFileSystemCacheForBuild: false,
  },
  // Pin the workspace root explicitly. Without this, if this project is ever checked out with
  // a nested structure that has its own package-lock.json somewhere below it (e.g. a git
  // worktree spawned under .claude/worktrees/ with its own npm install — a pattern used by
  // Claude Code for isolated parallel sessions), Turbopack's auto-detection can pick the WRONG,
  // larger directory as root and pull unrelated node_modules/source trees into its dev-server
  // file watcher. Over a long session that inflated watch surface can OOM-crash the dev server.
  turbopack: {
    root: __dirname,
  },
  // When you rename a route, add a PERMANENT redirect here rather than deleting the old path.
  // An OAuth callbackURL, a bookmark, and any link that escaped the rename all still point at the
  // old one, and a 404 on a landing route is the worst possible place to discover a missed
  // reference.
  async redirects() {
    return [
      // THE DOOR IS NOT THE APP. One Vercel project currently serves both hosts, so every app
      // route also answers on the marketing domain — where it is broken by design: Better Auth
      // sends an empty `trustedOrigins` in production, so only `BETTER_AUTH_URL`'s own origin is
      // accepted and a sign-in POST from www 403s before anything is attempted. Measured:
      // www.run.trading/login and /status both returned 200 before this rule.
      //
      // `/:path+` is one-or-more segments, so `/` stays on the door and everything else moves.
      //
      // TEMPORARY (307), NOT PERMANENT, and that is the load-bearing part. A 308 is cached by
      // the browser essentially forever, so the first real marketing page — /pricing, /faq —
      // would bounce every previous visitor to an app URL that does not exist. This mapping is
      // an artefact of one project serving two hosts, and it is deleted the day the door
      // becomes its own deployment.
      {
        source: '/:path+',
        has: [{ type: 'host', value: 'www.run.trading' }],
        destination: 'https://app.run.trading/:path+',
        permanent: false,
      },
    ];
  },
};

export default nextConfig;
