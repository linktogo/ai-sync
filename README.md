# ai-sync

[![CI](https://github.com/linktogo/ai-sync/actions/workflows/ci.yml/badge.svg)](https://github.com/linktogo/ai-sync/actions/workflows/ci.yml)
[![License: Apache 2.0](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](LICENSE)
[![Node >= 22](https://img.shields.io/badge/node-%3E%3D22-brightgreen.svg)](https://nodejs.org)
[![PRs welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](CONTRIBUTING.md)

Tools to sync AI agent skills, practices, and workflows across repositories.

Skills are authored once under `skills/<techno>/<name>/SKILL.md` and translated
into each target platform's format (Claude Code, GitHub Copilot, Cursor,
Windsurf).

It ships two CLIs — `ai-sync` (push skills to repos) and `ai-workspace`
(bootstrap a local workspace + status board) — plus a kanban dashboard, as an
[Nx](https://nx.dev) monorepo on npm workspaces.

## Why

Every repository in an organization ends up with its own drifting copy of the
same agent instructions — one for Claude Code, another for Copilot, a third for
Cursor. `ai-sync` keeps one reviewed source of truth: write the guidance once,
declare which technologies each repo uses, and let the tool render and open the
pull requests.

## Quick start

Requires **Node.js >= 22** and `git` on your PATH.

```bash
npm install -g @linktogo/ai-sync

# See what would be pushed to the repos in your config — no side effects
ai-sync --config repos.json --dry-run
```

The installed package bundles the skills library, so the CLI works from any
directory. A `skills/` folder in the current directory takes precedence, which
is what you want when working from a clone; `--skills <dir>` overrides both.

To hack on the project itself, work from a checkout:

```bash
git clone https://github.com/linktogo/ai-sync.git
cd ai-sync
npm ci
node apps/sync/bin/sync.js --config repos.example.json --dry-run
```

Then copy `repos.example.json`, point it at your own repositories, and drop the
`--dry-run` when the preview looks right.

```bash
npm run wk     # clone those repos into ./wk and print the command to open them
npm start      # serve the board (auto-detects wk/.ai-sync/board.json)
```

New here? Read [Configuration](docs/configuration.md) next, then
[Adding a skill](CONTRIBUTING.md#adding-a-skill).

## Documentation

Full reference lives in [`docs/`](docs/README.md):

| Page | What it covers |
|---|---|
| [Configuration](docs/configuration.md) | The `repos.json` schema, and the two ways both CLIs resolve it |
| [Skills library](docs/skills-library.md) | Authoring skills, how they map to each target platform |
| [`ai-sync` CLI](docs/sync-cli.md) | Rendering skills into repos and pushing them |
| [`ai-workspace` CLI](docs/workspace-cli.md) | Bootstrapping a workspace, worktrees, status tracking |
| [Board dashboard](docs/board-dashboard.md) | The kanban dashboard, its server and endpoints |
| [CI status](docs/ci-status.md) | Per-contributor CI badges on the board, and how to enable them |
| [Architecture](docs/architecture.md) | Nx layout, module boundaries, testing and coverage gates |

`docs/superpowers/` holds the design record — one spec and plan per feature,
kept as history rather than maintained.

## Skills library

`skills/` ships a starter set of guidance, grouped by technology and matched
against each repo's `technologies` list: `nestjs`, `postgres`, `nextjs`,
`reactjs`, `angular`, `vuejs`, `nx`, `firebase`, `cloudflare`.

Add one by creating `skills/<techno>/<name>/SKILL.md` with YAML frontmatter
(`name`, `description`, optional `globs`) followed by the guidance body. Any
repo whose `technologies` include `<techno>` picks it up on the next sync — see
[Skills library](docs/skills-library.md).

## Published packages

Everything publishes under the single **`@linktogo`** scope. The CLIs ship as
`@linktogo/ai-sync` (the package you install); the libraries are published
independently so they can be reused on their own:

| Package | What it gives you |
|---|---|
| [`@linktogo/ai-config`](libs/config) | load/validate the repo config from a file or a git repo |
| [`@linktogo/ai-git`](libs/git) | thin git/`gh` wrapper |
| [`@linktogo/ai-renderers`](libs/renderers) | render a skill for claude/copilot/cursor/windsurf |
| [`@linktogo/ai-skill-sync`](libs/skill-sync) | skill resolution + the sync pipeline |
| [`@linktogo/ai-workspace-bootstrap`](libs/workspace-bootstrap) | clone/install, hooks, board state |
| [`@linktogo/ai-ci-status`](libs/ci-status) | CI status payloads, validation and state mapping |

All are released in lockstep on the same version — see
[Releasing](CONTRIBUTING.md#releasing). The `apps/*` projects stay private, keep
internal `@ai-sync/*` names, and are never published on their own.

## Development

```bash
npm test       # every project
npm run lint
npm run build
```

Nx enforces module boundaries by `scope:*` tags, and every `libs/` project
carries a 100% line/function/branch coverage gate. Layout, testing conventions
and the reasons behind them are in [Architecture](docs/architecture.md).

Because Nx detects the package manager from the lockfile, keep
`package-lock.json` as the only lockfile — a `pnpm-lock.yaml` breaks the project
graph.

## Contributing

Contributions are welcome — especially new skills, which are the easiest way in.
Start with [CONTRIBUTING.md](CONTRIBUTING.md) for the dev setup, the coverage
bar, the commit format, and how to add a skill. Participation is governed by our
[Code of Conduct](CODE_OF_CONDUCT.md).

- 🐛 [Report a bug](https://github.com/linktogo/ai-sync/issues/new/choose)
- 💡 [Propose a feature or a skill](https://github.com/linktogo/ai-sync/issues/new/choose)
- 🔒 Security issues: see [SECURITY.md](SECURITY.md) — never a public issue
