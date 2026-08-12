import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactCompiler: true,
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
