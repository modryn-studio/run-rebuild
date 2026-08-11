// Loads .env.local from the nearest ancestor directory that has one.
//
// WHY THIS EXISTS. The desk scripts were written inside a git worktree at
// `.claude/worktrees/<name>/`, three levels below the repo that holds `.env.local`, so they
// hardcoded `config({ path: '../../../.env.local' })`. That path is wrong everywhere else.
//
// The failure is silent and total: run the same script from the repo root and dotenvx reports
// `injected env (0)` rather than erroring, then `env.ts` throws on the first import because
// nothing was loaded. The 24-assertion gate stopped running the moment the branch merged, and
// it announced that by printing nothing at all.
//
// Walking up fixes both locations at once, and keeps working if the scripts move again.
import { existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { config } from 'dotenv';

export function loadEnv(): string {
  let dir = dirname(fileURLToPath(import.meta.url));
  for (;;) {
    const candidate = join(dir, '.env.local');
    if (existsSync(candidate)) {
      config({ path: candidate });
      return candidate;
    }
    const parent = resolve(dir, '..');
    if (parent === dir) throw new Error('No .env.local found in any ancestor of scripts/');
    dir = parent;
  }
}
