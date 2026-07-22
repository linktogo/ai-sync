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
node apps/sync/bin/sync.js --config repos.json          # clone, generate, branch, commit, push
node apps/sync/bin/sync.js --config repos.json --pr      # also open a PR via gh
node apps/sync/bin/sync.js --config repos.json --dry-run # preview generated files, no git
node apps/sync/bin/sync.js --config repos.json --repo oc-be   # one repo only
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
node apps/workspace/bin/workspace.js --config repos.json --workspace ~/work/oclair                 # clone + install, prints `cd … && claude`
node apps/workspace/bin/workspace.js --config repos.json --workspace ~/work/oclair --editor vscode  # prints `code …`
node apps/workspace/bin/workspace.js --config repos.json --workspace ~/work/oclair --repo oc-be     # one repo only
node apps/workspace/bin/workspace.js --config repos.json --workspace ~/work/oclair --no-install     # skip dependency install
node apps/workspace/bin/workspace.js --config repos.json --workspace ~/work/oclair --dry-run         # preview clone/install actions, no side effects
node apps/workspace/bin/workspace.js --config repos.json --workspace ~/work/oclair --offline        # strict offline: fail if a dep is not already cached
```

### Worktrees (Claude Code)

When launching Claude Code, isolate the work on a dedicated branch with
`--worktree <branch>` (only valid with `--editor claude`). For each repo it runs
`git worktree add <repo>.<branch>` next to the checkout, installs deps in the
worktree, and points the launch command at it. Re-running reuses an existing
worktree. Without the flag the tool prints a tip suggesting it.

```bash
node apps/workspace/bin/workspace.js --config repos.json --workspace ~/work/oclair --worktree feat/login
# → adds oc-be.feat-login/, then: cd "~/work/oclair/oc-be.feat-login" && claude
```

### Status tracking

Bootstrap wires each checkout to report its kanban status into a shared
`board.json` at `<workspace>/.ai-sync/board.json` (the four states are `todo`,
`inprogress`, `question`, `done`). It does this by merging Claude Code hooks into
each repo's `.claude/settings.local.json`, so a running session updates the board
automatically:

- `UserPromptSubmit` → `inprogress` (work resumed)
- `Notification` (permission/idle prompt) → `question` (waiting on you)
- `Stop` → `question`

The hooks shell out to this CLI's `status` subcommand, which you can also run by
hand — e.g. to mark a repo done:

```bash
node apps/workspace/bin/workspace.js status oc-be done --board ~/work/oclair/.ai-sync/board.json
# or, if installed on PATH: ai-workspace status oc-be done --board <board.json>
```

The board is seeded (`todo` for every repo) at bootstrap and updated atomically.
Hook install and seeding are skipped on `--dry-run`. Only repos listed in the
config are tracked — a directory you create under the workspace by hand gets no
hooks and never appears on the board.

> **To see it in the dashboard, point the server at this same file** — see below.

## Board dashboard

A read-only kanban dashboard (Vue 3 + Tailwind) that displays each repo's status
by polling `board.json` every few seconds. It lives in `apps/board/` as a
self-contained sub-package; a tiny zero-dependency Node server (`apps/board/server.js`)
exposes `GET /api/board` and serves the built front-end.

`npm start` builds the front-end (deps install + Vite build) and then serves it:

```bash
npm start                                     # build + serve on http://localhost:4180 (auto-detects wk/.ai-sync/board.json)
npm start -- --board /tmp/board.json          # use a specific board file
AI_SYNC_BOARD=/tmp/board.json npm start       # board path via env instead of --flag
npm start -- --board /tmp/board.json --port 8080   # custom port
npm start -- --config repos.json              # also serve repo metadata at /api/config
npm run board:build                           # build only, without starting the server
```

**Board path resolution** (first match wins): `--board <path>` → `AI_SYNC_BOARD` env →
auto-detected `wk/.ai-sync/board.json` (the workspace board that [Status tracking](#status-tracking)
hooks write to) → `board.json` in the current directory. So a plain `npm start` from the repo
root picks up a live `wk/` workspace automatically; you only need `--board`/`AI_SYNC_BOARD` for a
workspace somewhere else. The startup log prints the resolved path (`board on … (data: …)`) — check
it if the board looks empty. If the chosen port is already in use, the server falls back to the next
free port (à la Angular CLI) and prints the one it settled on, so avoid starting a second instance.

`board.json` has the shape `{ version: 1, repos: { <name>: { status, updatedAt, lastEvent, events } } }`,
where `status` is one of `todo`, `inprogress`, `question`, `done` and `events` is a bounded
(last 20, newest-first) per-repo history of `{ event, at }` entries. The version stays `1`:
the `events` field is additive and legacy files are backfilled transparently on read. The
dashboard only reads it — writers (e.g. the `board.js` state module) work whether or not the
server is running.

Beyond the plain board, the dashboard fires a **browser notification** (with an optional,
off-by-default sound toggle persisted in `localStorage`) and a tab-title badge whenever a repo
transitions into `question` (an agent is blocked on you) or `done`. A **summary header** shows
per-status counts and a done-progress bar, a **filter bar** narrows the board by repo name or
technology, and clicking a card opens a **detail side panel** with the repo URL, technology/target
chips, and its event timeline. When started with `--config repos.json` (or `AI_SYNC_CONFIG`), the
server also exposes `GET /api/config` to power the links and technology filter; without it the
board still runs in a degraded mode (no links/filter).

## Tests

```bash
npm test          # nx run-many -t test: every lib/app, 100% coverage gate each (except board)
npm run test:board # apps/board suite only: server (node:test) + front-end (vitest)
```
