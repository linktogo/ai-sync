# ai-sync

Tools to sync AI agent skills, practices, and workflows across repositories.

Skills are authored once under `skills/<techno>/<name>/SKILL.md` and translated
into each target platform's format (Claude Code, GitHub Copilot, Cursor, Windsurf).

## Usage

```bash
node bin/sync.js --config repos.json          # clone, generate, branch, commit, push
node bin/sync.js --config repos.json --pr      # also open a PR via gh
node bin/sync.js --config repos.json --dry-run # preview generated files, no git
node bin/sync.js --config repos.json --repo oc-be   # one repo only
```

## Workspace bootstrap

Clone the repos from `repos.json` into a workspace folder, install Node deps with
`pnpm`, and print the command to open the workspace in Claude Code or VS Code.
Re-running against an existing folder reuses the checkouts already present (and
refreshes their dependencies), so the same command both creates a new workspace
and resumes an existing one.

```bash
node bin/workspace.js --config repos.json --workspace ~/work/oclair                 # clone + pnpm install, prints `cd … && claude`
node bin/workspace.js --config repos.json --workspace ~/work/oclair --editor vscode  # prints `code …`
node bin/workspace.js --config repos.json --workspace ~/work/oclair --repo oc-be     # one repo only
node bin/workspace.js --config repos.json --workspace ~/work/oclair --no-install     # skip pnpm install
node bin/workspace.js --config repos.json --workspace ~/work/oclair --dry-run         # preview clone/install actions, no side effects
```

### Worktrees (Claude Code)

When launching Claude Code, isolate the work on a dedicated branch with
`--worktree <branch>` (only valid with `--editor claude`). For each repo it runs
`git worktree add <repo>.<branch>` next to the checkout, installs deps in the
worktree, and points the launch command at it. Re-running reuses an existing
worktree. Without the flag the tool prints a tip suggesting it.

```bash
node bin/workspace.js --config repos.json --workspace ~/work/oclair --worktree feat/login
# → adds oc-be.feat-login/, then: cd ~/work/oclair/oc-be.feat-login && claude
```

## Tests

```bash
npm test   # runs all tests with a strict 100% coverage gate on src/
```
