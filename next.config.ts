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
  //   async redirects() {
  //     return [{ source: '/old', destination: '/new', permanent: true }];
  //   },
};

export default nextConfig;
