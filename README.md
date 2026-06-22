# ai-sync

Tools to sync AI agent skills, practices, and workflows across repositories.

Skills are authored once under `skills/<techno>/<name>/SKILL.md` and translated
into each target platform's format (Claude Code, GitHub Copilot, Cursor, Windsurf).

## Configuration

Both commands read a JSON config (see `repos.json`) describing the target repos:

```json
{
  "defaultTargets": ["claude", "copilot"],
  "repos": [
    {
      "name": "oc-be",
      "url": "https://github.com/oclair-org/oc-be.git",
      "technologies": ["nestjs", "postgres"],
      "targets": ["claude", "cursor"]
    }
  ]
}
```

- `repos` (required): non-empty array. Each repo needs `name`, `url`, and a
  non-empty `technologies` array (matched against `skills/<techno>/`).
- `targets`: per-repo list of output formats. Falls back to `defaultTargets`
  when omitted. Known targets: `claude`, `copilot`, `cursor`, `windsurf`.
- `url`: SSH and scp-style URLs (`git@host:org/repo.git`, `ssh://…`) are
  rewritten to HTTPS automatically before cloning.

## Usage

```bash
node bin/sync.js --config repos.json          # clone, generate, branch, commit, push
node bin/sync.js --config repos.json --pr      # also open a PR via gh
node bin/sync.js --config repos.json --dry-run # preview generated files, no git
node bin/sync.js --config repos.json --repo oc-be   # one repo only
```

## Workspace bootstrap

Clone the repos from `repos.json` into a workspace folder, install dependencies
(Node via `pnpm`, Java via `mvn dependency:go-offline`, detected from
`package.json` / `pom.xml`), and print the command to open the workspace in
Claude Code or VS Code. Installs are cache-first (`pnpm --prefer-offline`;
Maven resolves `~/.m2` first) so a slow network stays off the critical path.
Re-running against an existing folder reuses the checkouts already present (and
refreshes their dependencies), so the same command both creates a new workspace
and resumes an existing one.

```bash
node bin/workspace.js --config repos.json --workspace ~/work/oclair                 # clone + install, prints `cd … && claude`
node bin/workspace.js --config repos.json --workspace ~/work/oclair --editor vscode  # prints `code …`
node bin/workspace.js --config repos.json --workspace ~/work/oclair --repo oc-be     # one repo only
node bin/workspace.js --config repos.json --workspace ~/work/oclair --no-install     # skip dependency install
node bin/workspace.js --config repos.json --workspace ~/work/oclair --dry-run         # preview clone/install actions, no side effects
node bin/workspace.js --config repos.json --workspace ~/work/oclair --offline        # strict offline: fail if a dep is not already cached
```

### Worktrees (Claude Code)

When launching Claude Code, isolate the work on a dedicated branch with
`--worktree <branch>` (only valid with `--editor claude`). For each repo it runs
`git worktree add <repo>.<branch>` next to the checkout, installs deps in the
worktree, and points the launch command at it. Re-running reuses an existing
worktree. Without the flag the tool prints a tip suggesting it.

```bash
node bin/workspace.js --config repos.json --workspace ~/work/oclair --worktree feat/login
# → adds oc-be.feat-login/, then: cd "~/work/oclair/oc-be.feat-login" && claude
```

## Board dashboard

A read-only kanban dashboard (Vue 3 + Tailwind) that displays each repo's status
by polling `board.json` every few seconds. It lives in `apps/board/` as a
self-contained sub-package; a tiny zero-dependency Node server (`apps/board/server.js`)
exposes `GET /api/board` and serves the built front-end.

`npm start` builds the front-end (deps install + Vite build) and then serves it:

```bash
npm start                                     # build + serve on http://localhost:4180 (board.json in cwd)
npm start -- --board /tmp/board.json          # use a specific board file
AI_SYNC_BOARD=/tmp/board.json npm start       # board path via env instead of --flag
npm start -- --board /tmp/board.json --port 8080   # custom port
npm start -- --config repos.json              # also serve repo metadata at /api/config
npm run board:build                           # build only, without starting the server
```

With no `--board`/`AI_SYNC_BOARD`, the server defaults to `board.json` in the current
directory and serves an empty board until that file exists. If the chosen port is
already in use, the server falls back to the next free port (à la Angular CLI) and
prints the one it settled on.

`board.json` has the shape `{ version: 1, repos: { <name>: { status, updatedAt, lastEvent } } }`,
where `status` is one of `todo`, `inprogress`, `question`, `done`. The dashboard only
reads it — writers (e.g. the `board.js` state module) work whether or not the server is running.

## Tests

```bash
npm test          # root suite: 100% coverage gate on src/
npm run test:board # apps/board suite: server (node:test) + front-end (vitest)
```
