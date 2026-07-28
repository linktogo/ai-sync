# ai-sync

Tools to sync AI agent skills, practices, and workflows across repositories.

Skills are authored once under `skills/<techno>/<name>/SKILL.md` and translated
into each target platform's format (Claude Code, GitHub Copilot, Cursor, Windsurf).

It ships two CLIs — `ai-sync` (push skills to repos) and `ai-workspace`
(bootstrap a local workspace + status board) — as an [Nx](https://nx.dev)
monorepo (npm workspaces). See [Project layout](#project-layout).

## Skills library

The `skills/` directory ships a starter set of guidance, grouped by technology
and matched against each repo's `technologies` list:

- `skills/nestjs/` — module structure, dependency injection
- `skills/postgres/` — safe migrations, query performance
- `skills/nextjs/` — App Router server/client boundaries
- `skills/reactjs/` — component design, hooks
- `skills/angular/` — component architecture, RxJS
- `skills/vuejs/` — Composition API, state management
- `skills/nx/` — monorepo structure, task running (affected + caching)
- `skills/firebase/` — Firestore data modeling, Security Rules
- `skills/cloudflare/` — Worker deployment (Wrangler, environments, secrets)

Add a new skill by creating `skills/<techno>/<name>/SKILL.md` with YAML
frontmatter (`name`, `description`, optional `globs`) followed by the guidance
body. Any repo whose `technologies` include `<techno>` picks it up on the next
sync.

## Configuration

Both commands read a JSON config describing the target repos. The canonical
config lives in a **separate repository**,
[`linktogo-org/lk-config`](https://github.com/linktogo-org/lk-config), and is
fetched with `--config-repo` (see [Config source](#config-source) below). A local
`repos.example.json` in this repo documents the shape:

```json
{
  "defaultTargets": ["claude", "copilot"],
  "repos": [
    {
      "name": "example-api",
      "url": "https://github.com/example-org/example-api.git",
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
- `path`: optional path (typically absolute — a relative value resolves
  against the current working directory, not the config file's location) to
  an existing local checkout. When set, `ai-workspace bootstrap` wires up
  status tracking, hooks, and dependency install there instead of cloning
  into the `--workspace` folder (cloning straight into `path` first if it
  doesn't exist yet). Only consumed by `ai-workspace`; `ai-sync` (the
  skill-push CLI) always clones into its own temporary work dir regardless.

### Config source

Both CLIs resolve their config from **exactly one** of two flags:

- `--config <path>` — read a local JSON file (e.g. `--config repos.example.json`).
- `--config-repo <url>` — shallow-clone a git repository into a temp dir and read
  the config from it. This is how the shared `lk-config` repo is consumed:

  ```bash
  --config-repo https://github.com/linktogo-org/lk-config.git
  ```

  The file read defaults to `repos.json` at the repo root; override it with
  `--config-file <path-in-repo>` (e.g. `--config-file environments/prod.json`).
  SSH/scp-style repo URLs are rewritten to HTTPS automatically, and the checkout
  is cleaned up after the config is read.

Passing both `--config` and `--config-repo` (or neither) is an error.

## Usage

Examples call the CLI through its source entry (`node apps/sync/bin/sync.js`).
Once the package is installed the same commands are available as the `ai-sync`
binary (and `ai-workspace` for the workspace tool).

```bash
# Local file
node apps/sync/bin/sync.js --config repos.example.json          # clone, generate, branch, commit, push

# Shared config repo (lk-config)
node apps/sync/bin/sync.js --config-repo https://github.com/linktogo-org/lk-config.git
node apps/sync/bin/sync.js --config-repo <url> --config-file repos.json --pr   # also open a PR via gh
node apps/sync/bin/sync.js --config-repo <url> --dry-run        # preview generated files, no git
node apps/sync/bin/sync.js --config-repo <url> --repo example-api     # one repo only
node apps/sync/bin/sync.js --config-repo <url> --strict         # fail if a technology has no skills
```

By default a repo whose `technologies` list references a technology with no
`skills/<techno>/` directory (or that otherwise resolves to zero skills) only
logs a warning and is left untouched. Pass `--strict` to turn that mismatch into
a hard error (non-zero exit, the repo recorded as `error`) — useful in CI to
catch a typo'd technology or a skill folder that never got created.

## Workspace bootstrap

Clone the repos from the config (`--config-repo` or `--config`) into a workspace
folder, install dependencies
(Node via `pnpm`, Java via `mvn dependency:go-offline`, detected from
`package.json` / `pom.xml`), and print the command to open the workspace in
Claude Code or VS Code. Installs are cache-first (`pnpm --prefer-offline`;
Maven resolves `~/.m2` first) so a slow network stays off the critical path.
Re-running against an existing folder reuses the checkouts already present (and
refreshes their dependencies), so the same command both creates a new workspace
and resumes an existing one.

The examples below use the shared `lk-config` repo via `--config-repo`; swap in
`--config repos.example.json` to point at a local file instead.

```bash
CFG="--config-repo https://github.com/linktogo-org/lk-config.git"
node apps/workspace/bin/workspace.js $CFG --workspace ~/work/myorg                 # clone + install, prints `cd … && claude`
node apps/workspace/bin/workspace.js $CFG --workspace ~/work/myorg --editor vscode  # prints `code …`
node apps/workspace/bin/workspace.js $CFG --workspace ~/work/myorg --repo example-api     # one repo only
node apps/workspace/bin/workspace.js $CFG --workspace ~/work/myorg --no-install     # skip dependency install
node apps/workspace/bin/workspace.js $CFG --workspace ~/work/myorg --dry-run         # preview clone/install actions, no side effects
node apps/workspace/bin/workspace.js $CFG --workspace ~/work/myorg --offline        # strict offline: fail if a dep is not already cached
```

### Worktrees (Claude Code)

When launching Claude Code, isolate the work on a dedicated branch with
`--worktree <branch>` (only valid with `--editor claude`). For each repo it runs
`git worktree add <repo>.<branch>` next to the checkout, installs deps in the
worktree, and points the launch command at it. Re-running reuses an existing
worktree. Without the flag the tool prints a tip suggesting it.

```bash
node apps/workspace/bin/workspace.js --config-repo https://github.com/linktogo-org/lk-config.git --workspace ~/work/myorg --worktree feat/login
# → adds example-api.feat-login/, then: cd "~/work/myorg/example-api.feat-login" && claude
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
node apps/workspace/bin/workspace.js status example-api done --board ~/work/myorg/.ai-sync/board.json
# or, if installed on PATH: ai-workspace status example-api done --board <board.json>
```

The board is seeded (`todo` for every repo) at bootstrap and updated atomically.
Hook install and seeding are skipped on `--dry-run`. Only repos listed in the
config are tracked — a directory you create under the workspace by hand gets no
hooks and never appears on the board. A repo can also point at an existing
checkout **outside** the workspace via `path` (see [Configuration](#configuration))
— it's tracked on the same board exactly like a repo cloned into the workspace.

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
npm start -- --config repos.example.json      # also serve repo metadata at /api/config
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
chips, and its event timeline. When started with `--config repos.example.json` (or `AI_SYNC_CONFIG`), the
server also exposes `GET /api/config` to power the links and technology filter; without it the
board still runs in a degraded mode (no links/filter).

## Project layout

An Nx monorepo (npm workspaces). Applications live in `apps/`, shared code in
`libs/`:

| Project | Kind | Role |
|---|---|---|
| `apps/sync` | app | `ai-sync` CLI — render skills into each repo and push |
| `apps/workspace` | app | `ai-workspace` CLI — bootstrap a workspace + status board |
| `apps/board` | app | Vue 3 kanban dashboard + zero-dep server |
| `libs/config` | lib | load/validate config from a local file or a git repo |
| `libs/git` | lib | thin git/`gh` wrapper (clone, branch, commit, push, PR) |
| `libs/renderers` | lib | per-target renderers (claude, copilot, cursor, windsurf) |
| `libs/skill-sync` | lib | resolve skills for a repo and drive the sync pipeline |
| `libs/workspace-bootstrap` | lib | clone/install, hooks, and the board state model |

Nx enforces module boundaries by `scope:*` tags (see `eslint.config.js`); each
library exposes its public surface through its package entry. This repo builds
and installs with **npm** (`npm ci`) — do not add a `pnpm-lock.yaml`, it breaks
the Nx project graph.

## Tests

```bash
npm test          # nx run-many -t test: every lib/app, 100% coverage gate each (except board)
npm run test:board # apps/board suite only: server (node:test) + front-end (vitest)
```

CI runs `nx run-many -t lint test build`. Because Nx detects the package
manager from the lockfile, keep `package-lock.json` as the only lockfile.
