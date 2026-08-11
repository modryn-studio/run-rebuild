---
name: prune-worktree
description: "Symmetrically tear down a prototype worktree — remove the git worktree, delete the LOCAL branch, AND delete the branch on GitHub — so local and origin stay in sync. Never touches the base branch. Trigger when Luke says 'prune/remove/kill this worktree', 'delete this treatment', or 'get rid of branch X everywhere'."
argument-hint: "[branch-name]"
---

<!-- Sync: master copy in modryn-boilerplate/.claude/skills/prune-worktree/. Mirror any edit there
     (and vice versa) until the boilerplate is rebuilt off your-project. -->


# /prune-worktree — delete a worktree locally AND on GitHub

The auto-push Stop hook keeps every worktree's branch pushed to GitHub. So when a worktree is done,
deleting it locally must also delete it on origin — otherwise dead branches pile up on GitHub. This
skill does the full symmetric teardown.

**Args:** `/prune-worktree <branch-name>` (the branch/treatment to remove). If omitted, list the
current worktrees and ask which one.

## Guards — refuse if any of these are true

- The target is the **base branch** (`twin`, or whatever the repo's default is), `main`, or `master`.
- You are **currently inside** the worktree being pruned (you can't remove the worktree you're in — run
  this from the base checkout).
- The target branch doesn't exist.

## Steps

1. **Identify the base branch and current location.** `git worktree list`, `git rev-parse
   --abbrev-ref HEAD`, `git branch --show-current`. Confirm you're in the base checkout, not the
   target worktree. Apply the guards above.

2. **Check for work you'd lose** (this is destructive — do not skip):
   - Unmerged into base: `git log --oneline <base>..<target>`
   - Unpushed to origin: `git log --oneline origin/<target>..<target>` (if the remote branch exists)
   If either shows commits, **stop and tell Luke exactly what would be lost**, and get an explicit
   go-ahead before deleting. If both are empty, the branch is safe to remove.

3. **Confirm** the plan with Luke before deleting the remote branch (deleting a GitHub branch is
   hard to reverse): name the worktree path, the local branch, and the remote branch you're about to
   delete. Proceed once he confirms (or if he already said "delete it everywhere" / "prune X" — that
   is the go-ahead).

4. **Execute, in order:**
   ```bash
   git worktree remove "<path-to-worktree>"        # add --force only if it's dirty and Luke okayed it
   git branch -D <target>                            # delete local branch
   git push origin --delete <target>                 # delete the branch on GitHub
   git worktree prune                                # clean up worktree admin refs
   ```

5. **Report the reconciled state:** `git worktree list`, `git branch`, and
   `git ls-remote --heads origin` — confirm local and origin now hold the same set of branches.

## Note

This is a manual, deliberate teardown — there is no automatic "local delete → remote delete" git
event to hook. Run this skill whenever you retire a treatment so GitHub never drifts from local.
